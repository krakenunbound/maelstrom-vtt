// A new DM's first day, game by game, in an isolated copy (no FG modules, an empty Packs folder, its own profile):
// the start screen offers only the shipped games; a game's rulebook and an adventure copied into Packs/<game>
// appear (no restart), are filed right, activate, read, build a character, fight a battle, open a map;
// then they are taken out and the game is gone again. Findings are printed, never thrown.
// The packs are the GM's own (licensed, never in the repository): a game whose packs are not on this computer is
// skipped. Run it after a change to how packs are found, filed or played.
//   node scripts/verify-new-dm-ui.mjs <out folder> [game names comma separated]
import "./loopback.mjs";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { createRequire } from "node:module";
import { _electron as electron } from "playwright-core";
const { readPack } = createRequire(import.meta.url)("../electron/packs.cjs");

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const LIB = path.join(process.env.USERPROFILE, "Documents", "Kraken VTT", "Packs");
const GAMES = [
  { game: "D&D 5E", folder: "D&D 5E", rules: "DD PHB Deluxe.kpack", adventure: "The Secrets of Skyhorn Lighthouse Fantasy Grounds.kpack" },
  { game: "D&D 3.5E", folder: "D&D 3.5E", rules: "D&D 3.5e Player's Handbook v1.kpack", adventure: "D&D 3.5e B2 The Keep on the Borderlands.kpack" },
  { game: "AD&D 2E", folder: "AD&D 2E", rules: "AD&D 2E Players Handbook.kpack", adventure: "B2 The Keep on the Borderlands (AD&D 2E).kpack" },
  { game: "Castles & Crusades", folder: "Castles & Crusades", rules: "C&C Player's Handbook.kpack", adventure: "B2 The Keep on the Borderlands (C&C).kpack" },
  { game: "D&D BECMI", folder: "D&D BECMI", rules: "Set 1_ Basic Rules.kpack", adventure: "B2 The Keep on the Borderlands.kpack" },
  { game: "Descending Darkness", folder: "DD", rules: "Descending Darkness Player's Handbook - Playtest.kpack", adventure: null, extra: ["Descending Darkness Player's Handbook"] },
].filter((item) => !process.argv[3] || process.argv[3].split(",").includes(item.game))
  .filter((item) => [item.rules, item.adventure].filter(Boolean).every((file) => existsSync(path.join(LIB, item.folder, file))) || (console.log(`skip ${item.game}: its packs are not on this computer`), false));

const home = mkdtempSync(path.join(tmpdir(), "mvtt-newdm-"));
const packs = path.join(home, "Packs");
const modules = path.join(home, "fg-modules");
mkdirSync(modules, { recursive: true });
const profile = path.join(home, "profile");
const findings = [];
const note = (game, ok, what) => findings.push({ game, ok, what }) && console.log(`${ok ? "ok  " : "FAIL"} [${game}] ${what}`);

const env = { ...process.env, KRAKEN_AGENT_FILE: path.join(home, "agent.json"), KRAKEN_AGENT_PORT: "0", KRAKEN_HOME: home, KRAKEN_PACKS: packs, KRAKEN_BOOKS: modules, KRAKEN_NO_UPDATES: "1" };
delete env.KRAKEN_ALL_GAMES;
const app = await electron.launch({ args: [".", "--mute-audio", `--user-data-dir=${profile}`], cwd: process.cwd(), env });
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => message.type() === "error" && errors.push(`console: ${message.text().slice(0, 200)}`));
await page.waitForSelector("text=My Campaigns");
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
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// The new-campaign screen's game tiles, as the DM sees them now.
async function offered() {
  // The DM comes back to Maelstrom's window after copying the files.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await wait(800);
  for (let tries = 0; tries < 3 && !(await page.$(".ruleset-tiles")); tries++) {
    if (await page.$('[data-action="campaigns-mode"]')) await page.click('[data-action="campaigns-mode"]').catch(() => {});
    if (await page.$('[data-action="new-campaign"]')) await page.click('[data-action="new-campaign"]').catch(() => {});
    await page.waitForSelector(".ruleset-tiles", { timeout: 5000 }).catch(() => {});
  }
  return page.evaluate(() => [...document.querySelectorAll(".ruleset-tiles [data-ruleset]")].map((tile) => tile.getAttribute("data-ruleset")));
}

try {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "newdm", version: "1" } });
  // 0. Fresh: what a new DM sees before any book.
  const shipped = await offered();
  await shot("00-fresh-start");
  note("fresh", true, `games offered with no books of the DM's: ${shipped?.join(", ")}`);
  const folderList = await tool("kraken_folders", { action: "list" }).catch((error) => ({ error: error.message }));
  note("fresh", !folderList.error, `folders: ${JSON.stringify(folderList).slice(0, 300)}`);
  note("fresh", readdirSync(packs).every((name) => !name.endsWith(".kpack")), `Packs folder made, holds: ${readdirSync(packs).join(", ") || "nothing"}`);

  for (const spec of GAMES) {
    const g = spec.game;
    const tag = g.replace(/[^A-Za-z0-9]+/g, "");
    // 1. The books copied in while Maelstrom is open on the start screen.
    const dir = path.join(packs, spec.folder);
    mkdirSync(dir, { recursive: true });
    for (const file of [spec.rules, spec.adventure].filter(Boolean)) copyFileSync(path.join(LIB, spec.folder, file), path.join(dir, file));
    let tiles = await offered();
    note(g, tiles?.includes(g), `offered on the new-campaign screen without a restart: ${tiles?.includes(g) ? "yes" : `no (${tiles?.join(", ")})`}`);
    if (!tiles?.includes(g)) {
      // As the hint tells the DM: restart Maelstrom. (Here: the screen asked again by a reload.)
      await page.reload();
      await page.waitForSelector("text=My Campaigns");
      tiles = await offered();
      note(g, tiles?.includes(g), `offered after the window is reloaded: ${tiles?.includes(g) ? "yes" : "no"}`);
    }
    await shot(`${tag}-1-offered`);
    // 2. A campaign of the game, hosted.
    const campaign = await tool("kraken_campaign_create", { name: `New DM ${g}`, ruleset: g });
    await tool("kraken_host", { campaignId: campaign.id, port: 47470, password: "pw" });
    await page.waitForSelector("text=Hosting", { timeout: 30000 });
    // 3. Its books: listed for the game, filed as a rulebook and an adventure.
    const shelfOut = await tool("kraken_books", { action: "list" });
    const shelf = Array.isArray(shelfOut) ? shelfOut : (shelfOut.books ?? []);
    const nameOf = (file) => readPack(path.join(LIB, spec.folder, file)).info.name;
    const rules = shelf.find((item) => item.id === nameOf(spec.rules) || item.title === nameOf(spec.rules));
    const adventure = spec.adventure ? shelf.find((item) => item.id === nameOf(spec.adventure) || item.title === nameOf(spec.adventure)) : null;
    if (adventure && !adventure.adventure) note(g, false, `${adventure.title} is not filed as an adventure (category ${adventure.category})`);
    note(g, Boolean(rules), `the rulebook is on the shelf: ${rules ? `${rules.title} (${rules.category}, ${rules.adventure ? "adventure" : "book"})` : `missing; shelf: ${shelf.map((item) => item.title).join(", ")}`}`);
    if (spec.adventure) note(g, Boolean(adventure), `the adventure is on the shelf as an adventure: ${adventure ? `${adventure.title} (${adventure.category})` : `missing; shelf: ${shelf.map((item) => `${item.title}${item.adventure ? "*" : ""}`).join(", ")}`}`);
    const others = shelf.filter((item) => item !== rules && item !== adventure);
    note(g, true, `other books on this game's shelf: ${others.map((item) => item.title).join(", ") || "none"}`);
    // 4. Activated.
    for (const book of [rules, adventure].filter(Boolean)) {
      try {
        const done = await tool("kraken_books", { action: "activate", book: book.id });
        note(g, true, `activated ${book.title}: ${JSON.stringify(done).slice(0, 160)}`);
      } catch (error) {
        note(g, false, `activate ${book.title}: ${error.message}`);
      }
    }
    for (const title of spec.extra ?? []) {
      const book = shelf.find((item) => item.title === title || item.id === title);
      if (!book) note(g, false, `${title} is not on the shelf`);
      else await tool("kraken_books", { action: "activate", book: book.id }).then(() => note(g, true, `activated ${title} (shipped)`), (error) => note(g, false, `activate ${title}: ${error.message}`));
    }
    // The Modules window as the DM sees it.
    await page.click('.sidebar [data-launch="books:activation"]').catch(() => {});
    await wait(1500);
    await shot(`${tag}-2-modules`);
    const modulesText = await page.evaluate(() => document.querySelector('.window[data-window^="books"]')?.innerText?.slice(0, 1500) ?? "no Modules window");
    note(g, true, `Modules window reads: ${modulesText.replace(/\s+/g, " ").slice(0, 400)}`);
    await tool("kraken_windows", { action: "close", kind: "books" }).catch(() => {});
    // 5. The rulebook reads: its contents and a page.
    if (rules) {
      try {
        const contents = await tool("kraken_books", { action: "contents", book: rules.id });
        const pages = (contents.chapters ?? []).flatMap((chapter) => (chapter.sections ?? []).flatMap((section) => section.pages ?? []));
        const first = pages[0];
        const pg = first ? await tool("kraken_books", { action: "page", book: rules.id, page: first.id }) : null;
        note(g, pages.length > 0 && (pg?.blocks?.length ?? 0) > 0, `the rulebook reads: ${pages.length} pages; "${first?.name}" has ${pg?.blocks?.length ?? 0} blocks`);
      } catch (error) {
        note(g, false, `read the rulebook: ${error.message}`);
      }
    }
    // 6. A character from the books.
    try {
      const built = await tool("kraken_build_character", { spec: { name: "Newcomer", class: "Fighter" } });
      note(g, Boolean(built.id), `a Fighter built: ${built.id ? "yes" : "no"}${built.problems?.length ? `; said: ${built.problems.join(" | ").slice(0, 300)}` : ""}`);
    } catch (error) {
      note(g, false, `build a Fighter: ${error.message.slice(0, 300)}`);
    }
    // 7. The adventure plays: a story entry, a battle on the tracker, a map.
    if (adventure) {
      const lib = async (kind) => (await tool("kraken_library", { action: "list", module: adventure.id, kind }).catch((error) => ({ error: error.message })));
      const stories = await lib("story");
      const storyList = Array.isArray(stories) ? stories : [];
      note(g, !stories.error && storyList.length > 0, `story entries: ${stories.error ?? storyList.length}`);
      if (storyList[0]) {
        const text = await tool("kraken_library", { action: "story", module: adventure.id, path: storyList[0].path }).catch((error) => ({ error: error.message }));
        note(g, !text.error, `story "${storyList[0].name}" opens: ${text.error ?? String(text.text ?? text.html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)}`);
      }
      const battles = await lib("battle");
      const battleList = Array.isArray(battles) ? battles : [];
      note(g, !battles.error && battleList.length > 0, `battles: ${battles.error ?? battleList.length}`);
      if (battleList[0]) {
        const fought = await tool("kraken_library", { action: "battle", module: adventure.id, path: battleList[0].path, place: false }).catch((error) => ({ error: error.message }));
        const ct = await tool("kraken_combat", {}).catch((error) => ({ error: error.message }));
        const entries = ct.entries ?? ct.combatants ?? [];
        note(g, !fought.error && entries.length > 0 && entries.every((entry) => Number(entry.hp ?? entry.hitPoints ?? 1) > 0), `battle "${battleList[0].name}" on the tracker: ${fought.error ?? `${entries.length} creatures, hp ${entries.map((entry) => entry.hp).join("/")}`}`);
      }
      const maps = await lib("map");
      const mapList = Array.isArray(maps) ? maps : [];
      note(g, !maps.error && mapList.length > 0, `maps: ${maps.error ?? mapList.length}`);
      if (mapList[0]) {
        const opened = await tool("kraken_open_fg_module", { module: adventure.id, maps: [mapList[0].name] }).catch((error) => ({ error: error.message }));
        await wait(2500);
        const shown = await page.$(".map-toolbar");
        note(g, !opened.error && Boolean(shown), `map "${mapList[0].name}" opens on the table: ${opened.error ?? (shown ? "yes" : "no toolbar")}`);
        await shot(`${tag}-3-map`);
      }
    }
    await shot(`${tag}-4-table`);
    // 8. Done: stop, take the books out; the game is gone again.
    await page.click('.menubar button:has-text("Leave")').catch((error) => note(g, false, `Leave: ${error.message.slice(0, 120)}`));
    await wait(400);
    if (await page.$("dialog.ask-dialog[open]")) await page.click('dialog.ask-dialog [data-ask-answer="ok"]');
    await page.waitForSelector("text=My Campaigns", { timeout: 15000 }).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
    await wait(500);
    tiles = await offered();
    note(g, !tiles?.includes(g) || g === "D&D 5E" || g === "Descending Darkness", `gone from the new-campaign screen once its books are out (5E and Descending Darkness ship books, so stay): ${!tiles?.includes(g) ? "yes" : "no (still offered)"}`);
  }
  // A pack dropped straight into Packs, not in its game's folder (a new DM's likely first try).
  copyFileSync(path.join(LIB, "AD&D 2E", "AD&D 2E Players Handbook.kpack"), path.join(packs, "AD&D 2E Players Handbook.kpack"));
  const loose = await offered();
  note("loose", loose?.includes("AD&D 2E"), `a pack put straight into Packs (no game folder) is found: ${loose?.includes("AD&D 2E") ? "yes" : "no"}`);
  await shot("90-loose-pack");
  note("all", errors.length === 0, `page errors: ${errors.length ? [...new Set(errors)].slice(0, 8).join(" | ") : "none"}`);
} catch (error) {
  note("run", false, `stopped: ${error.stack?.slice(0, 500)}`);
} finally {
  writeFileSync(path.join(out, "findings.json"), JSON.stringify(findings, null, 1));
  child.kill();
  await app.close();
  rmSync(home, { recursive: true, force: true });
}
