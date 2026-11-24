// The ready check in the real app (verify-ready-check-ui): the GM types /rc in chat; a test player in Chrome
// (joined over the network as any player) sees a banner at the top of their screen and I'm back on the chat line;
// pressing it takes the banner away, and the GM's chat shows them back and "everyone is back". Then the party
// sheet's Ready check starts another, and the GM's End closes it naming who is not back. Screenshots of both screens.
//   node scripts/verify-ready-check-ui.mjs <out folder>
import "./loopback.mjs";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { _electron as electron, chromium } from "playwright-core";
import { CHROME } from "./lib/chrome.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const out = process.argv[2] ?? mkdtempSync(path.join(tmpdir(), "kraken-ready-shots-"));
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), "kraken-ready-check-"));
const env = { ...process.env, KRAKEN_AGENT_FILE: path.join(profile, "agent.json"), KRAKEN_AGENT_PORT: "0" };
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
let browser = null;
try {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check", version: "1" } });
  const campaign = await tool("kraken_campaign_create", { name: "Ready check", ruleset: "Worldbuilding" });
  const port = 47441;
  await tool("kraken_host", { campaignId: campaign.id, port, password: "pw" });
  await page.waitForSelector("text=Hosting");
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const seat = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  seat.on("pageerror", (error) => failures.push(`player: ${error.message}`));
  await seat.goto(`http://127.0.0.1:${port}/`);
  await seat.fill('input[name="name"]', "A test player");
  await seat.fill('input[name="account-password"]', "test-pass");
  await seat.fill('input[name="password"]', "pw");
  await seat.click('button[type="submit"]');
  await seat.waitForSelector(".sidebar");

  // 1. The GM types /rc.
  await page.fill("form.chat-entry input", "/rc");
  await page.press("form.chat-entry input", "Enter");
  await seat.waitForSelector("[data-ready-banner]", { timeout: 10000 });
  await page.waitForSelector('.chat-ready[data-ready="open"] [data-ready-waiting]');
  assert(/A test player/.test((await page.textContent('.chat-ready[data-ready="open"] [data-ready-waiting]')) ?? ""), "the GM sees who is waiting");
  assert((await page.$("[data-ready-banner]")) === null, "the GM gets no banner");
  await seat.screenshot({ path: path.join(out, "player-banner.png") });
  await page.screenshot({ path: path.join(out, "gm-waiting.png") });

  // 2. The player is back.
  await seat.click('[data-ready-banner] [data-action="ready-back"]');
  await seat.waitForSelector("[data-ready-banner]", { state: "detached" });
  await page.waitForSelector('.chat-ready[data-ready="closed"] [data-ready-back]');
  await page.waitForFunction(() => [...document.querySelectorAll(".chat-line, .chat-dock *")].some((node) => /everyone is back/.test(node.textContent ?? "")));
  await page.screenshot({ path: path.join(out, "gm-all-back.png") });

  // 3. The party sheet's Ready check, ended by the GM.
  await page.click('.sidebar [data-launch="party"]');
  await page.click('[data-action="party-ready-check"]');
  await seat.waitForSelector("[data-ready-banner]", { timeout: 10000 });
  await page.click('.chat-ready[data-ready="open"] [data-action="ready-end"]');
  await seat.waitForSelector("[data-ready-banner]", { state: "detached" });
  await page.waitForFunction(() => [...document.querySelectorAll(".chat-dock *")].some((node) => /Not back: A test player/.test(node.textContent ?? "")));
  await page.screenshot({ path: path.join(out, "gm-ended.png") });

  assert(failures.length === 0, `page errors: ${failures.join(" | ")}`);
  console.log(`ok ready check ui: /rc puts a banner on the player's screen and I'm back takes it away (the GM's chat: back, everyone is back); the party sheet's Ready check, ended by the GM, names who is not back. ${out}`);
} finally {
  await browser?.close();
  child.kill();
  await app.close();
}
