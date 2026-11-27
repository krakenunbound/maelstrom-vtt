// The GM's layout kept across a restart: the app's own window, and the table's windows.
//  - The app's window opens where it was left (a saved window-state.json puts it on the left monitor here), maximized
//    again after it was maximized and closed, full screen again after full screen.
//  - A table's windows come back as they were left: one open stays open where it was, one minimized to the tray comes
//    back minimized (not open in front), and a map whose window the GM closed stays closed.
// No KRAKEN_WINDOW_AT here (a test window placed by it neither reads nor writes the state). Its own profile and home:
// the GM's settings are never touched.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";

const REPO = process.cwd();
const require = createRequire(`${REPO}/package.json`);
const { _electron: electron } = require("playwright-core");
const sharp = require("sharp");
const OUT = process.env.SHOTS || tmpdir();
mkdirSync(OUT, { recursive: true });
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const profile = mkdtempSync(path.join(tmpdir(), "mvtt-layout-"));
const home = path.join(profile, "home");
mkdirSync(home, { recursive: true });
// On the left monitor, as the GM might leave it.
writeFileSync(path.join(profile, "window-state.json"), JSON.stringify({ bounds: { x: -2500, y: 40, width: 1500, height: 950 }, maximized: false, fullScreen: false }));
const env = { ...process.env, KRAKEN_HOME: home, KRAKEN_PACKS: path.join(home, "Packs"), KRAKEN_BOOKS: path.join(profile, "no-fg"), KRAKEN_AGENT_FILE: path.join(profile, "agent.json"), KRAKEN_AGENT_PORT: "0", KRAKEN_BIND: "127.0.0.1" };
delete env.KRAKEN_WINDOW_AT;
const report = {};
const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function start(label) {
  const app = await electron.launch({ args: [".", "--mute-audio", `--user-data-dir=${profile}`], cwd: REPO, env });
  const page = await app.firstWindow();
  await page.waitForSelector("text=My Campaigns", { timeout: 60000 });
  await settle(1500);
  report[`${label} window`] = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return { bounds: win.getBounds(), maximized: win.isMaximized(), fullScreen: win.isFullScreen() };
  });
  return { app, page };
}
async function agentFor() {
  for (let i = 0; i < 100 && !existsSync(path.join(profile, "agent.json")); i++) await settle(200);
  const child = spawn(process.execPath, ["electron/agent/mcp-stdio.cjs"], { cwd: REPO, env, stdio: ["pipe", "pipe", "inherit"] });
  const answers = new Map();
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    answers.get(message.id)?.(message);
  });
  let nextId = 0;
  const rpc = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 90000);
      answers.set(id, (message) => {
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  const tool = async (name, args = {}) => {
    const result = await rpc("tools/call", { name, arguments: args });
    const text = result.content?.[0]?.text ?? "";
    if (result.isError) throw new Error(`${name}: ${text}`);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "layout", version: "1" } });
  return { child, tool };
}
const openWindows = (page) =>
  page.$$eval(".window[data-window]", (wins) =>
    wins.map((win) => {
      const box = win.getBoundingClientRect();
      return `${win.getAttribute("data-window")} @${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`;
    }),
  );

let app;
try {
  // Run 1: maximized, hosted; Settings and Dice open, a map played and its window closed, Dice minimized; left; closed.
  let page;
  ({ app, page } = await start("run1 start"));
  assert(report["run1 start window"].bounds.x === -2500 && report["run1 start window"].bounds.width === 1500, `the app's window opens where it was left (${JSON.stringify(report["run1 start window"])})`);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize());
  await settle(1500);
  let agent = await agentFor();
  const campaign = await agent.tool("kraken_campaign_create", { name: "Layout", ruleset: "D&D 5E" });
  await agent.tool("kraken_host", { campaignId: campaign.id, port: 47398, password: "pw" });
  await page.waitForSelector("text=Hosting", { timeout: 60000 });
  await settle(2500);
  await page.click('[data-launch="settings"]');
  await page.click('[data-setting="dice"]');
  await settle(1000);
  const maps = path.join(home, "Campaigns", "Layout", "Maps");
  mkdirSync(maps, { recursive: true });
  await sharp({ create: { width: 700, height: 700, channels: 3, background: "#304030" } }).png().toFile(path.join(maps, "arena.png"));
  await agent.tool("kraken_image", { action: "open", own: true, file: "arena.png" });
  await agent.tool("kraken_image", { action: "play" });
  await page.waitForSelector('.window[data-window="map"]', { timeout: 30000 });
  await page.click('.window[data-window="map"] [aria-label^="Close "]');
  await settle(1000);
  await page.click('.window[data-window="dice"] [data-action="window-minimize"]');
  await settle(800);
  report["run1 arranged: windows"] = await openWindows(page);
  await agent.tool("kraken_leave");
  await page.waitForSelector("text=My Campaigns", { timeout: 60000 });
  await settle(1000);
  agent.child.kill();
  await app.close();
  const saved = JSON.parse(readFileSync(path.join(profile, "window-state.json"), "utf8"));
  assert(saved.maximized === true && saved.bounds.x === -2500, `closing keeps the window's state (${JSON.stringify(saved)})`);

  // Run 2: started again, hosted again.
  ({ app, page } = await start("run2 start"));
  assert(report["run2 start window"].maximized, `the app's window opens maximized again (${JSON.stringify(report["run2 start window"])})`);
  agent = await agentFor();
  await agent.tool("kraken_host", { campaignId: campaign.id, port: 47398, password: "pw" });
  await page.waitForSelector("text=Hosting", { timeout: 60000 });
  await settle(3000);
  const run2 = await openWindows(page);
  report["run2 hosted: windows"] = run2;
  await page.screenshot({ path: path.join(OUT, "kraken-layout-restart.png") });
  assert(run2.some((item) => item.startsWith("settings @340,70")), `Settings opens again where it was (${run2.join("; ")})`);
  assert(run2.includes("dice @0,0 0x0"), `the Dice window comes back minimized, not open in front (${run2.join("; ")})`);
  assert(!run2.some((item) => item.startsWith("map ")), `the map whose window was closed stays closed (${run2.join("; ")})`);

  // Full screen, closed, started again: full screen.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setFullScreen(true));
  await settle(1500);
  agent.child.kill();
  await app.close();
  ({ app, page } = await start("run3 start"));
  assert(report["run3 start window"].fullScreen, `the app's window opens full screen again (${JSON.stringify(report["run3 start window"])})`);
  await app.close();
  app = null;
  console.log("ok layout restart ui: the app's window where it was left, maximized and full screen again; a table's open window open again where it was, a minimized one minimized, a closed map closed");
} catch (error) {
  console.log(JSON.stringify(report, null, 1));
  console.error(error.message);
  await app?.close().catch(() => undefined);
  process.exit(1);
}
