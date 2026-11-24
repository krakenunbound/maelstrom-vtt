// The Find a game list on maelstromvtt.com (website/src/worker.js): a hosted table the GM chose to list
// checks in every 3 minutes (its name, ruleset, password or not, players); the site takes the address from the
// connection itself and checks the port answers. Stopping takes it off at once. Listing never stops a table:
// every failure is only reported. KRAKEN_LOBBY_URL points tests at `wrangler dev`.
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const net = require("net");

const EVERY_MS = 3 * 60 * 1000;
const base = () => process.env.KRAKEN_LOBBY_URL || "https://maelstromvtt.com";

// The list as players see it: the games hosted now, a player's past games' state, a game's address on Join.
function get(route, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(route, base());
    } catch {
      resolve({ ok: false, error: "The list's address is wrong." });
      return;
    }
    const request = (url.protocol === "http:" ? http : https).get(url, { timeout: timeoutMs }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (text += chunk));
      response.on("end", () => {
        let reply = {};
        try {
          reply = JSON.parse(text);
        } catch {
          /* not the list */
        }
        resolve(response.statusCode === 200 ? { ok: true, ...reply } : { ok: false, error: reply.error || `The list answered ${response.statusCode}.` });
      });
    });
    request.on("timeout", () => request.destroy(new Error("The list did not answer in time.")));
    request.on("error", (error) => resolve({ ok: false, error: error.message || "The list could not be reached." }));
  });
}

// Whether a table answers at address:port (a past game joined by address; this computer can look on its own network).
function probe(address, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: address, port });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

function post(route, body, timeoutMs) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(route, base());
    } catch {
      resolve({ ok: false, error: "The list's address is wrong." });
      return;
    }
    const data = Buffer.from(JSON.stringify(body));
    // IPv4: the table listens on IPv4, and the site lists the address the check-in came from.
    const request = (url.protocol === "http:" ? http : https).request(
      url,
      { method: "POST", family: 4, timeout: timeoutMs, headers: { "content-type": "application/json", "content-length": data.length } },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (text += chunk));
        response.on("end", () => {
          let reply = {};
          try {
            reply = JSON.parse(text);
          } catch {
            /* not the list */
          }
          resolve(response.statusCode === 200 ? { ok: true, ...reply } : { ok: false, error: reply.error || `The list answered ${response.statusCode}.` });
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("The list did not answer in time.")));
    request.on("error", (error) => resolve({ ok: false, error: error.message || "The list could not be reached." }));
    request.end(data);
  });
}

// This computer's key (one per install, never in a campaign) and each campaign's own listing id.
function identity(preferences, savePreference, campaignId) {
  const saved = preferences().lobby;
  const lobby = saved && typeof saved === "object" && typeof saved.key === "string" ? { key: saved.key, ids: { ...(saved.ids ?? {}) } } : { key: crypto.randomBytes(32).toString("base64url"), ids: {} };
  const slot = campaignId || "-";
  if (typeof lobby.ids[slot] !== "string") lobby.ids[slot] = crypto.randomBytes(16).toString("base64url");
  if (saved?.key !== lobby.key || saved?.ids?.[slot] !== lobby.ids[slot]) savePreference("lobby", lobby);
  return { key: lobby.key, id: lobby.ids[slot] };
}

// listing() gives what to show now ({ gm, campaign, ruleset, locked, players, port, version }).
function startListing({ id, key, listing }) {
  let stopped = false;
  let status = { listed: false, pending: true, id };
  const tell = (next) => {
    status = { ...next, id };
  };
  const beat = async () => {
    if (stopped) return;
    const reply = await post("/api/lobby/checkin", { id, key, ...listing() }, 10000);
    if (stopped) return;
    tell(reply.ok ? { listed: true, reachable: Boolean(reply.reachable), address: reply.address ?? "" } : { listed: false, error: reply.error });
  };
  const ready = beat().then(() => status);
  const timer = setInterval(() => void beat(), EVERY_MS);
  timer.unref?.();
  return {
    id,
    // The first check-in's answer.
    ready,
    status: () => status,
    async stop() {
      stopped = true;
      clearInterval(timer);
      await post("/api/lobby/close", { id, key }, 3000);
    },
  };
}

module.exports = { startListing, identity, get, probe };
