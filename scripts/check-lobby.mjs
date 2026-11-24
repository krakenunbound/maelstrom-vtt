// The Find a game list (electron/lobby.cjs), against a fake list on this computer, never maelstromvtt.com:
// a listed table checks in (its key, id, name, ruleset, password or not, players, port) and is told whether
// the site reached it; the list's refusal or silence is reported, never thrown; stopping takes it off;
// a computer keeps one key and each campaign its own id. The site's own API (website/src/worker.js) is checked
// with `npx wrangler dev` (see docs/find-a-game.md).
import "./loopback.mjs";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const calls = [];
let answer = (route) => (route === "/api/lobby/checkin" ? [200, { ok: true, reachable: true, address: "203.0.113.5:47300" }] : [200, { ok: true }]);
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    calls.push({ route: req.url, body: JSON.parse(body || "{}") });
    const [status, reply] = answer(req.url);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(reply));
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
process.env.KRAKEN_LOBBY_URL = `http://127.0.0.1:${server.address().port}`;
const lobby = require("../electron/lobby.cjs");

// One key per computer, one id per campaign, kept.
let prefs = {};
const preferences = () => prefs;
const save = (key, value) => (prefs = { ...prefs, [key]: value });
const a = lobby.identity(preferences, save, "camp-a");
const again = lobby.identity(preferences, save, "camp-a");
const b = lobby.identity(preferences, save, "camp-b");
assert(a.key === again.key && a.id === again.id, "the same campaign keeps its id and key");
assert(b.key === a.key && b.id !== a.id, "another campaign: same key, its own id");
assert(/^[A-Za-z0-9_-]{16,40}$/.test(a.id) && a.key.length >= 24, "id and key in the site's form");

// A check-in, its answer, and close on stop.
let players = 2;
const listing = lobby.startListing({ id: a.id, key: a.key, listing: () => ({ gm: "Kraken", campaign: "Saltmarsh", ruleset: "D&D 5E", locked: true, players, port: 47300, version: "test" }) });
const first = await listing.ready;
assert(first.listed && first.reachable && first.address === "203.0.113.5:47300", `first check-in shown: ${JSON.stringify(first)}`);
const sent = calls.find((call) => call.route === "/api/lobby/checkin").body;
assert(sent.id === a.id && sent.key === a.key && sent.gm === "Kraken" && sent.locked === true && sent.players === 2 && sent.port === 47300, "the check-in carries the listing");
assert(!("address" in sent) && !("ip" in sent), "the app never claims an address");
await listing.stop();
const closed = calls.find((call) => call.route === "/api/lobby/close");
assert(closed && closed.body.id === a.id && closed.body.key === a.key, "stopping takes the game off");

// Refused, or no list at all: reported, never thrown.
answer = () => [429, { error: "Too many games listed from this address." }];
const refused = await lobby.startListing({ id: a.id, key: a.key, listing: () => ({ port: 1 }) }).ready;
assert(!refused.listed && refused.error === "Too many games listed from this address.", `refusal reported: ${JSON.stringify(refused)}`);
server.close();
process.env.KRAKEN_LOBBY_URL = "http://127.0.0.1:9";
const gone = lobby.startListing({ id: a.id, key: a.key, listing: () => ({ port: 1 }) });
const silent = await gone.ready;
assert(!silent.listed && silent.error, "no list: reported");
await gone.stop();

// maelstrom:// links (electron/launchLink.cjs): an address and port, checked; anything else is ignored.
const { parseLaunchLink } = require("../electron/launchLink.cjs");
const link = (url) => parseLaunchLink(["Maelstrom VTT.exe", "--flag", url]);
assert(JSON.stringify(link("maelstrom://join?address=203.0.113.5&port=47300")) === JSON.stringify({ address: "203.0.113.5", port: 47300 }), "a join link");
assert(link("maelstrom://join/?address=table.example.org&port=80")?.address === "table.example.org", "a host name");
assert(link("maelstrom://join?address=%5B2001%3Adb8%3A%3A1%5D&port=47300")?.address === "2001:db8::1", "an IPv6 address");
for (const bad of ["maelstrom://join?address=1.2.3.4&port=0", "maelstrom://join?address=1.2.3.4&port=70000", "maelstrom://join?address=a%20b&port=1", "maelstrom://join?address=x/../y&port=1", "maelstrom://host?address=1.2.3.4&port=1", "maelstrom://join?port=1", "https://join?address=1.2.3.4&port=1"])
  assert(link(bad) === null, `refused: ${bad}`);
assert(parseLaunchLink(["Maelstrom VTT.exe"]) === null, "no link");

console.log(JSON.stringify({ ok: true, checks: ["identity", "check-in", "close", "refused", "no list", "launch links"] }));
