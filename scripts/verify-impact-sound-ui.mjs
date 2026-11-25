// A weapon's blow heard in the right order on the GM's screen (Maelstrom, 3D dice on): the damage roll's dice
// land and its hit sounds, then what the blow lands on (the orc's chain mail: sfx/Impacts/Chain), never the clang
// first, though the wound line naming the orc comes while the dice are still in the air.
import "./loopback.mjs";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { _electron as electron } from "playwright-core";

function wav() {
  const samples = 2400;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin(i / 3) * 9000), i * 2);
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(8000, 24);
  head.writeUInt32LE(16000, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const profile = mkdtempSync(path.join(tmpdir(), "kraken-impact-sound-"));
// The GM's own chain impact (the placeholder pack has none yet), a short beep.
mkdirSync(path.join(profile, "assets", "sounds", "sfx", "Impacts", "Chain"), { recursive: true });
writeFileSync(path.join(profile, "assets", "sounds", "sfx", "Impacts", "Chain", "chain-test.wav"), wav());
// Its own home (not the GM's Documents), with the first test sounds as a sound pack: the app ships only the
// table's own sounds.
const home = path.join(profile, "home");
execFileSync(process.execPath, ["scripts/build-sound-packs.mjs", "sound-packs/Placeholder", path.join(home, "Sound Packs"), "--name", "Placeholder"], { stdio: "ignore" });
const env = { ...process.env, KRAKEN_HOME: home, KRAKEN_AGENT_FILE: path.join(profile, "agent.json"), KRAKEN_AGENT_PORT: "0" };
const app = await electron.launch({ args: [".", "--mute-audio", `--user-data-dir=${profile}`], cwd: process.cwd(), env });
const page = await app.firstWindow();
await page.waitForSelector("text=My Campaigns");
const child = spawn(process.execPath, ["electron/agent/mcp-stdio.cjs"], { env, stdio: ["pipe", "pipe", "inherit"] });
const answers = new Map();
readline.createInterface({ input: child.stdout }).on("line", (line) => {
  const message = JSON.parse(line);
  answers.get(message.id)?.(message);
});
let nextId = 0;
function rpc(method, params) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 90000);
    answers.set(id, (message) => {
      clearTimeout(timer);
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}
async function tool(name, args = {}) {
  const result = await rpc("tools/call", { name, arguments: args });
  const text = result.content?.[0]?.text ?? "";
  if (result.isError) throw new Error(`${name}: ${text}`);
  return JSON.parse(text);
}
const failures = [];
page.on("pageerror", (error) => failures.push(error.message));
const until = async (test, what) => {
  for (let wait = 0; wait < 60; wait++) {
    const value = await test();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`timed out: ${what}`);
};

try {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check", version: "1" } });
  const campaign = await tool("kraken_campaign_create", { name: "Impact sound", ruleset: "D&D 5E" });
  await tool("kraken_host", { campaignId: campaign.id, port: 47438, password: "pw" });
  await page.waitForSelector("text=Hosting");
  await page.waitForSelector(".sidebar");
  // What the engine plays, and when; and when the damage roll's dice land.
  await page.evaluate(() => {
    const engine = window.__krakenSound;
    const play = engine.play.bind(engine);
    window.__played = [];
    engine.play = (id, ...rest) => {
      window.__played.push({ id, at: performance.now() });
      return play(id, ...rest);
    };
  });
  const orc = await tool("kraken_record_create", { type: "npc", name: "Orc", data: { hp: { total: 30, wounds: 0 }, ac: 16, actext: "(chain mail)" } });
  await tool("kraken_combat", { action: "add", recordId: orc.id ?? orc.record?.id });
  await page.waitForTimeout(1500);
  await tool("kraken_roll", { formula: "2d8+3", label: "[DAMAGE] (M) Longsword [TYPE: slashing]", as: "Combat" });
  await tool("kraken_chat_send", { text: "[DAMAGE] Longsword -> Orc: 9 (Wounded)", as: "Combat" });
  const woundAt = await page.evaluate(() => performance.now());
  const played = await until(async () => {
    const list = await page.evaluate(() => window.__played);
    return list.some((item) => item.id.startsWith("sfx/Impacts/")) && list.some((item) => item.id.startsWith("sfx/Weapons/Sword/Hit/")) ? list : null;
  }, "the hit and the impact played");
  const hit = played.find((item) => item.id.startsWith("sfx/Weapons/Sword/Hit/"));
  const impact = played.find((item) => item.id.startsWith("sfx/Impacts/"));
  assert(impact.id.startsWith("sfx/Impacts/Chain/"), `the orc's chain mail: ${impact.id}`);
  // The wound line was here before the dice landed (the hit waits for them): the impact waited too.
  assert(hit.at - woundAt > 250, `the dice were still in the air when the wound line came: ${Math.round(hit.at - woundAt)} ms`);
  assert(impact.at > hit.at, `the impact after the hit: hit at ${Math.round(hit.at)}, impact at ${Math.round(impact.at)}`);
  assert(failures.length === 0, `no page errors: ${failures.join(" | ")}`);
  console.log(`ok impact sound ui: the longsword's hit (${hit.id}) then the chain mail's impact ${Math.round(impact.at - hit.at)} ms after; the wound line came ${Math.round(hit.at - woundAt)} ms before the dice landed`);
} finally {
  child.kill();
  await app.close().catch(() => undefined);
}
