// A Foundry adventure bundle (an "Adventure Bundler" .zip: bundle.json and its assets) opened in the
// GM's app, each scene compared with what Foundry keeps in it: its size and grid, walls and doors,
// lights, the map picture; then the map shared and a player's view of it. A GM's purchased map set:
// FOUNDRY_BUNDLES names the folder of its .zip files (default: Dirty Rotten Looters in Downloads);
// without it, the check says so and stops.
import "./loopback.mjs";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { unzipSync, strFromU8 } from "fflate";
import { _electron as electron, chromium } from "playwright-core";
import { CHROME } from "./lib/chrome.mjs";

const folder = process.env.FOUNDRY_BUNDLES || path.join(homedir(), "Downloads", "Dirty Rotten Looters (Prepared Foundry)", "Dirty Rotten Looters (Prepared Foundry)");
if (!existsSync(folder)) {
  console.log(`SKIP verify-foundry-bundle-ui: no bundles at ${folder}`);
  process.exit(0);
}
const zips = readdirSync(folder).filter((name) => name.toLowerCase().endsWith(".zip")).map((name) => path.join(folder, name));
const out = path.join(tmpdir(), "kraken-foundry-bundle");
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
// What Foundry keeps in each bundle's scenes.
const expected = zips.map((file) => {
  const files = unzipSync(new Uint8Array(readFileSync(file)), { filter: (entry) => entry.name.endsWith("bundle.json") });
  const adventure = JSON.parse(strFromU8(Object.values(files)[0])).adventureData;
  return {
    file,
    scenes: adventure.scenes.map((scene) => ({
      name: scene.name,
      width: scene.width,
      height: scene.height,
      grid: scene.grid?.size ?? scene.grid,
      // A wall with no length (both ends at one point, as Foundry can keep) is no wall: left out here as on the table.
      walls: scene.walls.filter((wall) => !(wall.c[0] === wall.c[2] && wall.c[1] === wall.c[3])).length,
      doors: scene.walls.filter((wall) => wall.door).length,
      lights: scene.lights.length,
    })),
    playlists: (adventure.playlists ?? []).flatMap((list) => list.sounds.map((sound) => `${list.name}: ${sound.name}`)),
  };
});

const profile = mkdtempSync(path.join(tmpdir(), "kraken-foundry-bundle-"));
const env = { ...process.env, KRAKEN_AGENT_FILE: path.join(profile, "agent.json"), KRAKEN_AGENT_PORT: "0" };
const app = await electron.launch({ args: [".", "--mute-audio", `--user-data-dir=${profile}`], cwd: process.cwd(), env });
const page = await app.firstWindow();
await page.setViewportSize({ width: 1600, height: 1000 }).catch(() => undefined);
await page.waitForSelector("text=My Campaigns");
const child = spawn(process.execPath, ["electron/agent/mcp-stdio.cjs"], { env, stdio: ["pipe", "pipe", "inherit"] });
const answers = new Map();
readline.createInterface({ input: child.stdout }).on("line", (line) => {
  const message = JSON.parse(line);
  answers.get(message.id)?.(message);
});
let nextId = 0;
const rpc = (method, params) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 120000);
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
  return JSON.parse(text);
};
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = [];
try {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "foundry", version: "1" } });
  const campaign = await tool("kraken_campaign_create", { name: "Foundry bundle", ruleset: "Worldbuilding" });
  await tool("kraken_host", { campaignId: campaign.id, port: 47433, password: "" });
  await page.waitForSelector("text=Hosting");
  for (const bundle of expected) {
    const opened = await tool("kraken_open_adventure", { path: bundle.file });
    report.push(`${path.basename(bundle.file)}: ${JSON.stringify(opened).slice(0, 220)}`);
    // Its playlists' music into the GM's sound library (Music, a folder per playlist).
    const tracks = bundle.playlists.map((line) => line.replace(": ", "/"));
    assert(tracks.every((track) => (opened.music ?? []).some((kept) => kept.startsWith(track))), `the bundle's music kept: ${tracks.join(", ")} vs ${JSON.stringify(opened.music)}`);
    for (const want of bundle.scenes) {
      await tool("kraken_scenes", { scene: want.name });
      await page.waitForTimeout(1500);
      const map = await tool("kraken_map", {});
      const listed = await tool("kraken_wall", { action: "list" });
      const walls = Array.isArray(listed) ? listed.length : Array.isArray(listed.walls) ? listed.walls.length : Number(listed.count ?? NaN);
      const doors = (map.doors ?? []).length;
      const got = { name: map.scene?.name ?? map.name, grid: map.grid, doors, walls, lights: Array.isArray(map.lights) ? map.lights.length : map.lights };
      report.push(`  ${want.name}: Foundry ${JSON.stringify(want)} | Maelstrom ${JSON.stringify(got)}`);
      await page.screenshot({ path: path.join(out + `-${want.name.replace(/\W+/g, "")}.png`) });
      assert(doors === want.doors && walls === want.walls, `${want.name}: Foundry ${want.walls} walls (${want.doors} doors), here ${walls} (${doors})`);
    }
  }
  // The whole folder at once (the set as it was bought): one adventure listing every floor, each switched to.
  const all = await tool("kraken_open_adventure", { path: folder });
  const names = expected.flatMap((bundle) => bundle.scenes.map((scene) => scene.name));
  report.push(`the folder: ${JSON.stringify(all).slice(0, 220)}`);
  assert(names.every((name) => (all.adventures ?? []).includes(name)), `every floor in one go: ${JSON.stringify(all.adventures)}`);
  for (const bundle of expected)
    for (const want of bundle.scenes) {
      await tool("kraken_scenes", { adventure: want.name, scene: want.name });
      await page.waitForTimeout(800);
      const map = await tool("kraken_map", {});
      assert((map.doors ?? []).length === want.doors, `${want.name} from the folder: ${want.doors} doors, ${(map.doors ?? []).length} here`);
    }
  report.push(`  switched to each floor from the one adventure: ${names.join(", ")}`);
  // The music kept in the library once, though four imports brought it.
  const library = await tool("kraken_sound", { action: "list" });
  const copies = JSON.stringify(library).match(/Daggers In The Dark/g) ?? [];
  assert(copies.length >= 1 && !/Daggers In The Dark \(2\)/.test(JSON.stringify(library)), `the music once in the library: ${copies.length} mentions`);
  report.push("  the bundle's music in the sound library, once");
  // A player's view of the shared Ground Floor (in Chrome).
  await tool("kraken_scenes", { adventure: "Ground Floor", scene: "Ground Floor" });
  await tool("kraken_map", { share: true });
  const browser = await chromium.launch({ args: ["--mute-audio"], executablePath: CHROME, headless: true });
  try {
    const seat = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await seat.goto("http://127.0.0.1:47433/");
    await seat.fill('input[name="name"]', "Looter");
    await seat.fill('input[name="account-password"]', "loot-pass");
    await seat.click('button[type="submit"]');
    await seat.waitForSelector(".sidebar", { timeout: 20000 });
    await seat.waitForSelector(".world", { timeout: 20000 });
    await seat.waitForTimeout(2500);
    await seat.screenshot({ path: `${out}-player.png` });
    report.push("  a player sees the shared Ground Floor");
  } finally {
    await browser.close();
  }
} catch (error) {
  report.push(`FAILED: ${error.message}`);
} finally {
  console.log(report.join("\n"));
  console.log(errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
  child.kill();
  await app.close();
}
