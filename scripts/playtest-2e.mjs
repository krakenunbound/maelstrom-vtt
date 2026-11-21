// A play test of AD&D 2E with the GM's own books (the 2E Players Handbook and B2 The Keep on the
// Borderlands packs): not a check, a session to look at. The GM in the app, a player in Chrome; a
// dwarf fighter and a human cleric; the kobolds' guard room from the book's map link; surprise,
// initiative with a weapon and a spell, a proficiency, attacks and damage, memorized spells. Every
// step runs even when one fails; what failed is listed at the end, with a screenshot of each step
// (PLAYTEST_OUT, default the temp folder). Needs the GM's packs; without them it says so.
import "./loopback.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { _electron as electron, chromium } from "playwright-core";
import { CHROME } from "./lib/chrome.mjs";

const out = process.env.PLAYTEST_OUT || path.join(tmpdir(), "kraken-playtest-2e");
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), "kraken-playtest-2e-"));
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
  return JSON.parse(text);
};
const findings = [];
const errors = [];
page.on("pageerror", (error) => errors.push(`GM: ${error.message}`));
let shot = 0;
const snap = async (where, name) => {
  shot += 1;
  await where.screenshot({ path: path.join(out, `${String(shot).padStart(2, "0")}-${name}.png`) }).catch(() => undefined);
};
// One step of play: logged, its failure noted, the play goes on.
const step = async (name, run) => {
  try {
    const result = await run();
    console.log(`ok   ${name}${result ? `: ${result}` : ""}`);
  } catch (error) {
    findings.push(`${name}: ${error.message.split("\n")[0]}`);
    console.log(`FAIL ${name}: ${error.message.split("\n")[0]}`);
  }
};
const lastChat = async (pattern) => {
  const log = await tool("kraken_chat_log", { limit: 40 }).catch(() => []);
  const lines = (Array.isArray(log) ? log : log.lines ?? log.messages ?? []).map((line) => line.roll?.label ?? line.text ?? "");
  return [...lines].reverse().find((text) => pattern.test(text)) ?? "";
};

let browser = null;
try {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "playtest", version: "1" } });
  const campaign = await tool("kraken_campaign_create", { name: "2E play test", ruleset: "AD&D 2E" });
  const port = 47431;
  await tool("kraken_host", { campaignId: campaign.id, port, password: "pw" });
  await page.waitForSelector("text=Hosting");
  const shelf = await tool("kraken_books", { action: "list" });
  const books = shelf.books ?? shelf;
  const phb = books.find((item) => /AD&D 2E Players Handbook/.test(item.name));
  const b2 = books.find((item) => /Keep on the Borderlands \(AD&D 2E\)/.test(item.name));
  if (!phb || !b2) {
    console.log("SKIP: the 2E Players Handbook and B2 (AD&D 2E) packs are not here");
    process.exit(0);
  }
  await tool("kraken_books", { action: "activate", book: phb.id });
  await tool("kraken_books", { action: "activate", book: b2.id });

  browser = await chromium.launch({ args: ["--mute-audio"], executablePath: CHROME, headless: true });
  const seat = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  seat.on("pageerror", (error) => errors.push(`player: ${error.message}`));
  await seat.goto(`http://127.0.0.1:${port}/`);
  await seat.fill('input[name="name"]', "Player");
  await seat.fill('input[name="account-password"]', "play-pass");
  await seat.fill('input[name="password"]', "pw");
  await seat.click('button[type="submit"]');
  await seat.waitForSelector(".sidebar");

  let garrick = null;
  let tolm = null;
  await step("build a dwarf fighter and a human cleric for the player", async () => {
    const made = await tool("kraken_build_character", { owner: "Player", spec: { name: "Garrick", race: "Dwarf", class: "Fighter", level: 2, nonweapon: ["Blind-fighting", "Swimming"], weapon: ["Long sword", "Short bow", "Dagger"] } });
    garrick = { id: made.id, name: "Garrick" };
    const cleric = await tool("kraken_build_character", { owner: "Player", spec: { name: "Brother Tolm", race: "Human", class: "Cleric", level: 2, spells: ["Bless", "Cure Light Wounds"] } });
    tolm = { id: cleric.id, name: "Brother Tolm" };
    return `Garrick (HP ${made.hp}, AC ${made.ac}, THAC0 ${made.thaco}${made.problems?.length ? `; ${made.problems.join("; ")}` : ""}), Brother Tolm (HP ${cleric.hp}${cleric.problems?.length ? `; ${cleric.problems.join("; ")}` : ""})`;
  });
  const sheet = (id) => `[data-window="sheet"]:has([data-record="${id}"]), [data-window="sheet"]`;
  await step("the player opens Garrick's sheet", async () => {
    await seat.click('.sidebar [data-launch="characters"]');
    await seat.click(`[data-charselect="${garrick.id}"]`);
    await seat.waitForSelector(".sheet-2e", { timeout: 15000 });
    await snap(seat, "player-sheet-main");
  });
  await step("Skills tab: proficiencies with their targets and dice", async () => {
    await seat.click('[data-sheet-tab="skills"]');
    await seat.waitForSelector('.sheet-2e [data-proficiency] [data-action="roll-proficiency"]', { timeout: 10000 });
    await snap(seat, "player-skills");
    const rows = await seat.$$eval(".sheet-2e [data-proficiency]", (items) => items.map((item) => item.textContent.replace(/\s+/g, " ").trim()));
    await seat.click('.sheet-2e [data-proficiency="1"] [data-action="roll-proficiency"]');
    await seat.waitForTimeout(800);
    return `${rows.join(" | ")}; rolled: ${await lastChat(/PROFICIENCY/)}`;
  });
  await step("Combat tab: weapons with INIT, THAC0 matrix, quick notes, features", async () => {
    await seat.click('[data-sheet-tab="combat"]');
    await seat.waitForSelector('.sheet-2e [data-attack] [data-action="init"]', { timeout: 10000 });
    await snap(seat, "player-combat");
    await seat.click('[data-sheet-tab="notes"]');
    await snap(seat, "player-notes");
    const features = await seat.$$eval(".sheet-2e [data-feature]", (items) => items.map((item) => item.textContent.replace(/\s+/g, " ").trim()).slice(0, 6));
    return `features: ${features.join(" | ") || "none"}`;
  });

  let page1 = null;
  await step("the GM opens B2 at 1. Guard Room (Kobolds) and its map link", async () => {
    const toc = await tool("kraken_books", { action: "contents", book: b2.id });
    page1 = toc.chapters.flatMap((chapter) => chapter.sections.flatMap((section) => section.pages)).find((item) => item.name === "1. Guard Room (Kobolds)");
    await tool("kraken_quickslots", { slots: [{ kind: "book", book: b2.id, page: page1.id, label: page1.name }, null, null, null, null, null, null, null, null, null, null, null] });
    await page.click('[data-quick-slot="0"]');
    const link = `[data-window="book"] [data-book-page="${page1.id}"] a.book-link.picture[data-file="images/maps/caves.webp"]`;
    await page.waitForSelector(link, { timeout: 20000 });
    await snap(page, "gm-book-guard-room");
    await page.click(link);
    await page.waitForSelector(".world", { timeout: 30000 });
    await page.waitForTimeout(2500);
    await snap(page, "gm-map-at-guard-room");
  });
  let fight = [];
  await step("the GM puts the party and the guard room's kobolds on the tracker (on the map)", async () => {
    await tool("kraken_combat", { action: "add", recordId: garrick.id });
    await tool("kraken_combat", { action: "add", recordId: tolm.id });
    await tool("kraken_library", { action: "battle", path: `battle.c01@${b2.name}` });
    fight = (await tool("kraken_combat", { action: "view" })).entries;
    await page.waitForTimeout(1500);
    await snap(page, "gm-map-kobolds-placed");
    return fight.map((entry) => `${entry.name}`).join(", ");
  });
  await step("the GM's map: the kobolds' tokens show their pictures", async () => {
    const tokens = await page.$$eval(".world [data-token]", (items) => items.map((item) => {
      const img = item.querySelector("img, video");
      return `${item.getAttribute("data-name")}: ${img ? `${img.getAttribute("src")?.slice(0, 80)} loaded ${img.naturalWidth ?? "video"}` : "no picture"}`;
    }));
    return tokens.join(" | ");
  });
  await step("the player speaks as Garrick", async () => {
    await seat.selectOption('select[aria-label="Speak as"]', "Garrick");
  });
  await step("the player opens the tracker: Surprise and initiative from the header", async () => {
    await seat.click('.sidebar [data-launch="combat"]');
    await seat.waitForSelector(".ct-own", { timeout: 10000 });
    await seat.click('.ct-own [data-action="own-surprise"]');
    await seat.waitForTimeout(800);
    const surprise = await lastChat(/SURPRISE/);
    const who = await seat.textContent(".ct-own .ct-own-name");
    await snap(seat, "player-tracker-header");
    await seat.click('.sidebar [data-launch="combat"]');
    return `header for ${who}: ${surprise}`;
  });
  await step("Garrick's initiative with his long sword (INIT on the weapon row)", async () => {
    await seat.click('[data-sheet-tab="combat"]');
    const row = '.sheet-2e [data-attack]:has(b:text-is("Longsword"))';
    await seat.click(`${row} [data-action="init"]`);
    await seat.waitForTimeout(800);
    return await lastChat(/\[INIT\] Garrick/);
  });
  await step("the GM rolls the kobolds' initiative and starts the fight", async () => {
    await tool("kraken_combat", { action: "init", which: "npcs" });
    await tool("kraken_combat", { action: "next" });
    const view = await tool("kraken_combat", { action: "view" });
    await snap(page, "gm-tracker-started");
    return view.entries.map((entry) => `${entry.name} ${entry.initresult}`).join(", ");
  });
  await step("Garrick attacks a kobold, then rolls damage", async () => {
    const view = (await tool("kraken_combat", { action: "view" })).entries;
    const me = view.find((entry) => entry.recordId === garrick.id);
    const kobold = view.find((entry) => /kobold/i.test(entry.name));
    await tool("kraken_combat", { action: "target", id: me.id, targetId: kobold.id, on: true });
    const row = '.sheet-2e [data-attack]:has(b:text-is("Longsword"))';
    await seat.click(`${row} [data-action="attack"]`);
    await seat.waitForTimeout(800);
    const attack = await lastChat(/\[ATTACK\]/);
    await seat.click(`${row} [data-action="damage"]`);
    await seat.waitForTimeout(800);
    await snap(seat, "player-attack");
    return `${attack} / ${await lastChat(/DAMAGE|->/)}`;
  });
  await step("THAC0 as a plain attack", async () => {
    await seat.click('.sheet-2e [data-action="roll-thaco"]');
    await seat.waitForTimeout(800);
    return await lastChat(/\[ATTACK\]/);
  });
  await step("Brother Tolm memorizes Bless and rolls initiative casting it", async () => {
    await seat.click('.sidebar [data-launch="characters"]');
    await seat.click(`[data-charselect="${tolm.id}"]`);
    const tolmWindow = '[data-window="sheet"][aria-label="Brother Tolm"]';
    await seat.waitForSelector(`${tolmWindow} [data-sheet-tab="spells"]`, { timeout: 15000 });
    await seat.click(`${tolmWindow} [data-sheet-tab="spells"]`);
    await seat.waitForSelector('[aria-label="Bless memorized"]', { timeout: 10000 });
    await seat.fill('[aria-label="Bless memorized"]', "1");
    await seat.press('[aria-label="Bless memorized"]', "Tab");
    await seat.waitForTimeout(800);
    await seat.click(`${tolmWindow} [data-spell="Bless"] [data-action="spell-init"]`);
    await seat.waitForTimeout(800);
    await snap(seat, "player-cleric-spells");
    return await lastChat(/\[INIT\] Brother Tolm/);
  });
  await snap(page, "gm-end");
  await snap(seat, "player-end");
} catch (error) {
  findings.push(`the play test stopped: ${error.message}`);
} finally {
  console.log(`\nscreenshots: ${out}`);
  console.log(findings.length ? `FINDINGS:\n- ${findings.join("\n- ")}` : "no failed steps");
  console.log(errors.length ? `PAGE ERRORS:\n- ${[...new Set(errors)].join("\n- ")}` : "no page errors");
  await browser?.close().catch(() => undefined);
  child.kill();
  await app.close();
}
