// The start screen's art packs, in a fresh copy (no art folders, an empty Art Packs folder), against a stand-in for
// the art-packs release (KRAKEN_ART_URL, a local server with four small packs): the card says 0 of 4; Choose,
// Select all, Select none, then all again and Download: each pack lands in Art Packs, the card goes; a hosted
// campaign's pickers list the packs' art and the table serves a picture from a pack. kraken_art_packs reads the same.
//   node scripts/verify-art-packs-ui.mjs [screenshot folder]
import "./loopback.mjs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { strToU8, zipSync } from "fflate";
import { _electron as electron } from "playwright-core";
import { ART_PACKS } from "../shared/art/packs.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const shots = process.argv[2] ?? mkdtempSync(path.join(tmpdir(), "mvtt-art-shots-"));
mkdirSync(shots, { recursive: true });
const home = mkdtempSync(path.join(tmpdir(), "mvtt-art-ui-"));
const webp = (name) => strToU8(`RIFF\0\0\0\0WEBPVP8 ${name}`);
const pair = (ruleset, race, cls, gender) => ({ ruleset, race, cls, gender, name: "V1", portrait: `${ruleset}/${race}/${cls}/${gender}/P_Portrait.webp`, token: `${ruleset}/${race}/${cls}/${gender}/P_Token.webp`, rulesets: [ruleset] });
// The four packs, small: one pair each (the monsters an owlbear).
const bodies = Object.fromEntries(
  ART_PACKS.map((pack) => {
    const files = { "kraken-pack.json": strToU8(JSON.stringify({ format: "kraken-pack", kind: "art-pack", id: pack.id, name: `Maelstrom Art: ${pack.title}` })) };
    if (pack.id === "monsters") Object.assign(files, { "creatures/portraits/Owlbear_Portrait.webp": webp("owlbear"), "creatures/tokens/Owlbear_Token.webp": webp("owlbear token") });
    else {
      const one = pair(pack.id === "fantasy" ? "in_common" : pack.id === "scifi" ? "Traveller 2e (2022)" : "Call of Cthulhu 7e", pack.id === "fantasy" ? "Dwarf" : "Human", "Fighter", "Male");
      Object.assign(files, { "characters/manifest.json": strToU8(JSON.stringify({ format: 1, pairs: [one] })), [`characters/${one.portrait}`]: webp(`${pack.id} portrait`), [`characters/${one.token}`]: webp(`${pack.id} token`) });
    }
    return [pack.file, Buffer.from(zipSync(files, { level: 0 }))];
  }),
);
const asked = [];
const server = createServer((req, res) => {
  const name = decodeURIComponent(req.url.split("/").pop());
  asked.push(name);
  // GitHub answers a release file with a redirect to its storage: so does this.
  if (!req.url.startsWith("/storage/")) {
    res.writeHead(302, { Location: `/storage/${encodeURIComponent(name)}` });
    res.end();
    return;
  }
  const body = bodies[name];
  if (!body) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Length": body.length, "Content-Type": "application/octet-stream" });
  res.end(body);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/download`;

const env = { ...process.env, KRAKEN_HOME: home, KRAKEN_PACKS: path.join(home, "Packs"), KRAKEN_BOOKS: path.join(home, "fg"), KRAKEN_ART_URL: base, KRAKEN_NO_ART_FOLDERS: "1", KRAKEN_NO_UPDATES: "1", KRAKEN_AGENT_FILE: path.join(home, "agent.json"), KRAKEN_AGENT_PORT: "0" };
mkdirSync(path.join(home, "fg"), { recursive: true });
const app = await electron.launch({ args: [".", "--mute-audio", `--user-data-dir=${path.join(home, "profile")}`], cwd: process.cwd(), env });
const page = await app.firstWindow();
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
const child = spawn(process.execPath, ["electron/agent/mcp-stdio.cjs"], { env, stdio: ["pipe", "pipe", "inherit"] });
const answers = new Map();
let n = 0;
readline.createInterface({ input: child.stdout }).on("line", (line) => {
  const message = JSON.parse(line);
  answers.get(message.id)?.(message);
});
const rpc = (method, params) => new Promise((resolve) => { const id = ++n; answers.set(id, resolve); child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`); });
async function tool(name, args = {}) {
  const message = await rpc("tools/call", { name, arguments: args });
  const text = message.result?.content?.[0]?.text ?? message.error?.message ?? "";
  if (message.error || message.result?.isError) throw new Error(`${name}: ${text}`);
  return JSON.parse(text);
}
const report = [];
try {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "art", version: "1" } });
  await page.waitForSelector("text=My Campaigns");
  await page.waitForSelector('[data-art-packs="0/4"]', { timeout: 15000 });
  await page.screenshot({ path: path.join(shots, "art-packs-0.png") });
  report.push("the start screen says 0 of 4");

  await page.click('[data-action="art-packs-choose"]');
  await page.click('[data-action="art-packs-all"]');
  assert((await page.$$eval('.art-pack-row input:checked', (boxes) => boxes.length)) === 4, "Select all ticks the four");
  await page.click('[data-action="art-packs-none"]');
  assert((await page.$$eval('.art-pack-row input:checked', (boxes) => boxes.length)) === 0 && (await page.$('[data-action="art-packs-download"][disabled]')), "Select none clears them; nothing to download");
  await page.click('[data-art-pack="scifi"] input');
  await page.click('[data-art-pack="horror"] input');
  await page.screenshot({ path: path.join(shots, "art-packs-choose.png") });
  await page.click('[data-action="art-packs-download"]');
  const folder = path.join(home, "Art Packs");
  for (let wait = 0; wait < 60 && !(existsSync(path.join(folder, ART_PACKS[2].file)) && existsSync(path.join(folder, ART_PACKS[3].file))); wait++) await new Promise((resolve) => setTimeout(resolve, 250));
  await page.waitForSelector('[data-art-packs="2/4"]', { timeout: 15000 });
  report.push("two ticked: downloaded (through a redirect, as GitHub's) into Art Packs, 2 of 4");

  const listed = await tool("kraken_art_packs", {});
  assert(listed.packs.filter((item) => item.installed).map((item) => item.id).sort().join() === "horror,scifi", `kraken_art_packs lists them: ${JSON.stringify(listed.packs.map((item) => [item.id, item.installed]))}`);
  await tool("kraken_art_packs", { action: "download", packs: ["monsters", "fantasy"] });
  for (let wait = 0; wait < 60 && readdirSync(folder).filter((name) => name.endsWith(".kpack")).length < 4; wait++) await new Promise((resolve) => setTimeout(resolve, 250));
  assert(!readdirSync(folder).some((name) => name.endsWith(".part")), "no half-downloaded files are left");
  await page.reload();
  await page.waitForSelector("text=My Campaigns");
  await page.waitForTimeout(1500);
  assert((await page.$("[data-art-packs]")) === null, "all four installed: the card is gone");
  report.push("the other two by kraken_art_packs; with all four the card is gone");

  // A campaign's art from the packs.
  const campaign = await tool("kraken_campaign_create", { name: "Art", ruleset: "Worldbuilding" });
  await tool("kraken_host", { campaignId: campaign.id, port: 47481, password: "pw" });
  await page.waitForSelector("text=Hosting", { timeout: 30000 });
  // The table's art pickers (kraken_art, as the pickers show it): the packs' pictures, by their ids.
  const library = await tool("kraken_art", { kind: "portrait" });
  const ids = (Array.isArray(library) ? library : library.items ?? library.art ?? []).map((item) => item.id);
  assert(ids.includes("creatures/portraits/Owlbear_Portrait.webp") && ids.some((id) => id.startsWith("characters/in_common/Dwarf/")), `the table's pickers list the packs' art: ${ids.slice(0, 8)}`);
  report.push(`the table's pickers list the packs' art (${ids.length} portraits)`);
  assert(failures.length === 0, `page errors: ${failures.join(" | ")}`);
  console.log(`ok art packs ui: ${report.join("; ")}. ${shots}`);
} finally {
  child.kill();
  await app.close();
  server.close();
  rmSync(home, { recursive: true, force: true });
}
