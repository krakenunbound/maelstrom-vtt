// A book's map link opens the map on its lair (the GM's app): B2's "1. Guard Room (Kobolds)" opens
// The Caves of Chaos centred on the guard room's kobolds, "3. Food Storage Room" on its own pin; an
// encounter run on that map stands its creatures there (FG's maplink: from the centre, y down).
// Needs the GM's B2 (AD&D 2E) pack; without it says so and stops.
import "./loopback.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { _electron as electron } from "playwright-core";

const profile = mkdtempSync(path.join(tmpdir(), "kraken-book-map-"));
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
    answers.set(id, (message) => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
const tool = async (name, args = {}) => JSON.parse((await rpc("tools/call", { name, arguments: args })).content[0].text);
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
try {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify", version: "1" } });
  const campaign = await tool("kraken_campaign_create", { name: "Book map", ruleset: "AD&D 2E" });
  await tool("kraken_host", { campaignId: campaign.id, port: 47399, password: "" });
  await page.waitForSelector("text=Hosting");
  const shelf = await tool("kraken_books", { action: "list" });
  const b2 = (shelf.books ?? shelf).find((item) => /Keep on the Borderlands \(AD&D 2E\)/.test(item.name));
  if (!b2) {
    console.log("SKIP verify-book-map-ui: no B2 The Keep on the Borderlands (AD&D 2E) pack here");
    process.exit(0);
  }
  await tool("kraken_books", { action: "activate", book: b2.id });
  const toc = await tool("kraken_books", { action: "contents", book: b2.id });
  const pages = toc.chapters.flatMap((chapter) => chapter.sections.flatMap((section) => section.pages));
  // Where the map window's middle is, in map pixels, and its zoom.
  const viewed = () =>
    page.evaluate(() => {
      const world = document.querySelector(".world");
      const view = world.parentElement.getBoundingClientRect();
      const [x, y, s] = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(world.style.transform).slice(1).map(Number);
      return { x: (view.width / 2 - x) / s, y: (view.height / 2 - y) / s, scale: s, width: parseFloat(world.style.width), height: parseFloat(world.style.height) };
    });
  const open = async (name) => {
    const target = pages.find((item) => item.name === name);
    await tool("kraken_quickslots", { slots: [{ kind: "book", book: b2.id, page: target.id, label: name }, null, null, null, null, null, null, null, null, null, null, null] });
    await page.click('[data-quick-slot="0"]');
    const link = `[data-window="book"] [data-book-page="${target.id}"] a.book-link.picture[data-file="images/maps/caves.webp"]`;
    await page.waitForSelector(link, { timeout: 20000 });
    const at = (await page.getAttribute(link, "data-at")).split(",").map(Number);
    await page.click(link);
    await page.waitForSelector(".world", { timeout: 30000 });
    await page.waitForTimeout(2000);
    return { at, seen: await viewed() };
  };
  const guard = await open("1. Guard Room (Kobolds)");
  const want = { x: guard.seen.width / 2 + guard.at[0], y: guard.seen.height / 2 + guard.at[1] };
  assert(Math.hypot(guard.seen.x - want.x, guard.seen.y - want.y) < 8 && guard.seen.scale > 1, `the guard room's map link opens on it, zoomed in: ${JSON.stringify({ guard, want })}`);
  const store = await open("3. Food Storage Room");
  const pinned = { x: store.seen.width / 2 + store.at[0], y: store.seen.height / 2 + store.at[1] };
  assert(Math.hypot(store.seen.x - pinned.x, store.seen.y - pinned.y) < 8 && store.at[2] === 0, `the store room opens on its pin: ${JSON.stringify({ store, pinned })}`);
  // The guard room's kobolds stand where the book's encounter puts them (in the room the link opened on).
  await tool("kraken_library", { action: "battle", path: `battle.c01@${b2.name}` });
  await page.waitForFunction(() => document.querySelectorAll(".world [data-token]").length >= 6, null, { timeout: 15000 });
  const tokens = await page.$$eval(".world [data-token]", (items) => items.map((item) => ({ x: item.offsetLeft + item.offsetWidth / 2, y: item.offsetTop + item.offsetHeight / 2 })));
  const middle = { x: tokens.reduce((sum, item) => sum + item.x, 0) / tokens.length, y: tokens.reduce((sum, item) => sum + item.y, 0) / tokens.length };
  assert(Math.hypot(middle.x - want.x, middle.y - want.y) < 60, `the encounter's kobolds stand in the guard room: ${JSON.stringify({ middle, want, tokens: tokens.length })}`);
  await page.screenshot({ path: path.join(tmpdir(), "kraken-book-map.png") });
  console.log(`BOOK_MAP_UI_OK B2's 1. Guard Room opens The Caves of Chaos on it (x${guard.seen.scale.toFixed(2)}), 3. Food Storage Room on its pin, and the guard room's encounter stands its ${tokens.length} kobolds there. ${path.join(tmpdir(), "kraken-book-map.png")}`);
} finally {
  child.kill();
  await app.close();
}
