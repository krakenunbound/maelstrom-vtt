// The gate a PDF conversion must pass before it is called done (docs/pdf-to-kpack.md). It compares the built pack
// with the PDF and the conversion's work folder, and exits 1 while anything is left:
//
//   node scripts/pdf-kpack/verify-conversion.mjs <pack.kpack> --pdf <book.pdf> --work <work folder>
//   npm run kpack:verify -- <pack.kpack> --pdf <book.pdf> --work <work folder>
//
// The work folder holds the conversion's state, written as the work goes:
//   ledger.csv      one row per PDF page (columns pdf_page, printed_folio, section, pack_record, content, checked, notes)
//   inventory.json  { "things": [ { "type": "npc", "name": "Goblin", "page": 31 }, ... ] }, written before any record
//                   is made (and "approvedByUser": { "ruleset": "Any" } only when the user said to file it under Any)
//   playtest.md     what was tried in Maelstrom with the pack (phase D) and what it showed
//
//   node scripts/pdf-kpack/verify-conversion.mjs --games    lists the games Maelstrom plays (use before any pack exists)
//
// Its report is the hand-over: paste it as it prints. Needs Python with PyMuPDF (pdf_text.py beside this file).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
if (args.includes("--games")) {
  console.log(`Games Maelstrom plays: ${knownGames().join(", ")}`);
  process.exit(0);
}
const packFile = args.find((arg, index) => !arg.startsWith("--") && !["--pdf", "--work"].includes(args[index - 1]));
const pdfFile = option("--pdf");
const work = option("--work");
if (!packFile || !pdfFile || !work) {
  console.error("Usage: node scripts/pdf-kpack/verify-conversion.mjs <pack.kpack> --pdf <book.pdf> --work <work folder>");
  process.exit(2);
}

// The games Maelstrom plays: its own and those an installed pack's game.json defines.
function knownGames(except) {
  const source = readFileSync(path.join(repo, "scripts", "kpack-check.mjs"), "utf8");
  const games = JSON.parse(/const RULESETS = (\[[^\]]*\])/.exec(source)[1]).filter((name) => name !== "Any");
  const packs = process.env.KRAKEN_PACKS ?? path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", "Documents", "Kraken VTT", "Packs");
  const walk = (dir, depth) => (depth > 2 || !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() && !entry.name.startsWith(".") ? walk(path.join(dir, entry.name), depth + 1) : /\.kpack$/i.test(entry.name) ? [path.join(dir, entry.name)] : [])));
  for (const file of walk(packs, 0)) {
    if (except && path.resolve(file) === path.resolve(except)) continue;
    try {
      const listing = execFileSync("unzip", ["-Z1", file], { encoding: "utf8", maxBuffer: 2 ** 26 });
      if (!/^game\.json$/m.test(listing)) continue;
      const game = JSON.parse(execFileSync("unzip", ["-p", file, "game.json"], { encoding: "utf8" }));
      if (game.name && !games.includes(game.name)) games.push(game.name);
    } catch { /* not readable: not a game */ }
  }
  return games;
}

// What a facsimile page (kept as a picture) may be, and which of those may carry a lot of text.
const FACSIMILE = ["cover", "art", "map", "form", "handout", "advertisement", "credits", "index"];
const WORDY_FACSIMILE = new Set(["map", "form", "advertisement", "credits", "index"]);
const COVERAGE = 0.9; // share of a page's (readable) PDF words its pack page must hold
const results = [];
const gate = (name, problems, detail = "") => results.push({ name, ok: problems.length === 0, problems, detail });

// The pack.
const files = unzipSync(new Uint8Array(readFileSync(packFile)));
const manifest = JSON.parse(strFromU8(files["kraken-pack.json"]));
const records = files["records.json"] ? JSON.parse(strFromU8(files["records.json"])) : [];
const byPath = new Map(records.map((record) => [String(record.id).replace(/^[^:]*:/, ""), record]));
const textOf = (record) => {
  const blocks = Object.values(record?.data?.blocks ?? {});
  return [record?.data?.text ?? "", ...blocks.map((block) => block.text ?? "")].join("\n");
};
const plain = (html) => html.replace(/<linklist>[\s\S]*?<\/linklist>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");
const words = (text) => (text.toLowerCase().replace(/[’']/g, "").match(/[a-z]{4,}/g) ?? []);

// 1. Maelstrom's own checker.
{
  const run = spawnSync(process.execPath, [path.join(repo, "scripts", "kpack-check.mjs"), packFile], { encoding: "utf8" });
  const out = `${run.stdout}${run.stderr}`;
  // Its warning that the game is not built in is gate 2's business; every other warning is fixed.
  const problems = out.split("\n").filter((line) => /^\s*(error|warning)/i.test(line) && !/is not one of Maelstrom's own games/.test(line)).map((line) => line.trim());
  gate("kpack:check has no errors or warnings", run.status === 0 ? problems : [...problems, `kpack-check exited ${run.status}`]);
}

// 2. A game Maelstrom plays. A book is never filed under Any, or given a game.json of its own, without the user's yes.
const inventoryFile = path.join(work, "inventory.json");
const inventory = existsSync(inventoryFile) ? JSON.parse(readFileSync(inventoryFile, "utf8")) : {};
{
  const problems = [];
  const approved = inventory.approvedByUser ?? {};
  if (manifest.ruleset === "Any") {
    if (approved.ruleset !== "Any") problems.push('filed under "Any": only when the user said so (then inventory.json "approvedByUser": { "ruleset": "Any" }). STOP and ask.');
  } else if (files["game.json"]) {
    if (approved.gameJson !== manifest.ruleset) problems.push(`the pack defines a new game "${manifest.ruleset}": only when the user said to add it (then inventory.json "approvedByUser": { "gameJson": "${manifest.ruleset}" }). STOP and ask.`);
  } else if (!knownGames(packFile).includes(manifest.ruleset)) {
    problems.push(`no built-in game and no pack's game.json defines "${manifest.ruleset}". STOP: ask the user whether to add the game (docs/pack-games.md) or file the book under another game; do not choose for them.`);
  }
  gate(`"${manifest.ruleset}" is a game Maelstrom plays`, problems);
}

// The PDF, page by page.
const pdf = JSON.parse(execFileSync("python", ["-I", path.join(here, "pdf_text.py"), pdfFile], { encoding: "utf8", maxBuffer: 2 ** 30 }));

// 3. The ledger: every PDF page once, in order, checked, landed in the pack.
const ledgerFile = path.join(work, "ledger.csv");
let ledger = [];
{
  const problems = [];
  if (!existsSync(ledgerFile)) problems.push(`no ${ledgerFile}: start it before transcribing (one row per PDF page)`);
  else {
    const lines = readFileSync(ledgerFile, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
    const parse = (line) => { const out = []; let cell = "", quoted = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (quoted) { if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; } else if (c === '"') quoted = true; else if (c === ",") { out.push(cell); cell = ""; } else cell += c; } out.push(cell); return out; };
    const head = parse(lines[0]).map((cell) => cell.trim());
    for (const column of ["pdf_page", "pack_record", "content", "checked"]) if (!head.includes(column)) problems.push(`ledger.csv has no "${column}" column`);
    ledger = lines.slice(1).map((line) => Object.fromEntries(parse(line).map((cell, index) => [head[index], cell.trim()])));
    const numbers = ledger.map((row) => Number(row.pdf_page));
    const missing = [];
    for (let n = 1; n <= pdf.count; n++) if (!numbers.includes(n)) missing.push(n);
    if (missing.length) problems.push(`${missing.length} of ${pdf.count} PDF pages have no row (first: ${missing.slice(0, 10).join(", ")})`);
    if (numbers.length !== new Set(numbers).size) problems.push("a PDF page has more than one row");
    const uses = {};
    for (const row of ledger) for (const id of (row.pack_record ?? "").split(";").map((item) => item.trim()).filter(Boolean)) uses[id] = (uses[id] ?? 0) + 1;
    for (const [id, count] of Object.entries(uses)) if (count > 6) problems.push(`${id} is named by ${count} PDF pages (at most 6: one book page per section)`);
    const unchecked = ledger.filter((row) => row.checked !== "yes").map((row) => row.pdf_page);
    if (unchecked.length) problems.push(`${unchecked.length} rows not checked against the page (first: ${unchecked.slice(0, 10).join(", ")})`);
    for (const row of ledger) {
      const kind = row.content ?? "";
      if (!(kind === "reflowed" || kind === "blank" || FACSIMILE.some((reason) => kind === `facsimile:${reason}`))) problems.push(`page ${row.pdf_page}: content "${kind}" is not reflowed, blank or facsimile:<${FACSIMILE.join("|")}>`);
      if (kind !== "blank") for (const id of (row.pack_record ?? "").split(";").map((s) => s.trim()).filter(Boolean)) if (!byPath.has(id)) problems.push(`page ${row.pdf_page}: pack_record ${id} is not in the pack`);
      if (kind !== "blank" && !(row.pack_record ?? "").trim()) problems.push(`page ${row.pdf_page}: no pack_record`);
    }
  }
  gate("ledger: every PDF page has a checked row that lands in the pack", problems.slice(0, 40), problems.length > 40 ? `(${problems.length} problems, first 40 shown)` : "");
}

// 4. Facsimiles are for pictures, maps, forms and the like, never to skip transcribing a page of text.
{
  const problems = [];
  const facs = ledger.filter((row) => (row.content ?? "").startsWith("facsimile:"));
  for (const row of facs) {
    const reason = row.content.slice("facsimile:".length);
    const count = words(pdf.pages[Number(row.pdf_page) - 1] ?? "").length;
    if (count > 150 && !WORDY_FACSIMILE.has(reason)) problems.push(`page ${row.pdf_page}: kept as a picture ("${reason}") but has ${count} words of text: transcribe it`);
  }
  gate("facsimile pages are pictures, not skipped text", problems, `${facs.length} facsimile pages`);
}

// 5. Each reflowed page holds its PDF page's words.
{
  const problems = [];
  let compared = 0, noLayer = 0;
  // A scan's text layer misreads words ("thcy" for "they"); the conversion corrects them, so only the PDF's words that
  // occur somewhere in the pack are compared. A page left out still fails: its ordinary words are in the rest of the book.
  const vocabulary = new Set(words(plain(records.map(textOf).join("\n"))));
  for (const row of ledger.filter((item) => item.content === "reflowed")) {
    const raw = words(pdf.pages[Number(row.pdf_page) - 1] ?? "");
    const source = raw.filter((word) => vocabulary.has(word));
    if (raw.length < 20 || source.length < raw.length * 0.3) { noLayer++; continue; }
    const ours = new Set(words(plain((row.pack_record ?? "").split(";").map((id) => textOf(byPath.get(id.trim()))).join("\n"))));
    const found = source.filter((word) => ours.has(word)).length / source.length;
    compared++;
    if (found < COVERAGE) problems.push(`page ${row.pdf_page}: pack text holds ${Math.round(found * 100)}% of the PDF page's words (needs ${COVERAGE * 100}%)`);
  }
  gate("reflowed pages hold their PDF text", problems.slice(0, 40), `${compared} compared; ${noLayer} with no usable PDF text layer (visual check only)`);
}

// 6. Real book pages, not a picture with the PDF's raw text under it.
{
  const problems = [];
  const pages = records.filter((record) => record.type === "refpage");
  const html = pages.map(textOf).join("\n");
  const breaks = (html.match(/<br\s*\/?>/g) ?? []).length;
  const paragraphs = (html.match(/<p[\s>]/g) ?? []).length;
  const headings = (html.match(/<h[\s>]/g) ?? []).length;
  if (breaks > paragraphs * 2 + 50) problems.push(`${breaks} line breaks against ${paragraphs} paragraphs: the PDF's lines were copied, not made into paragraphs`);
  const sizes = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => plain(match[1]).split(/\s+/).filter(Boolean).length).sort((a, b) => a - b);
  const median = sizes.length ? sizes[sizes.length >> 1] : 0;
  if (sizes.length > 50 && median < 12) problems.push(`paragraphs average ${median} words: the PDF's lines were made paragraphs`);
  if (pages.length > 10 && headings === 0) problems.push("no headings (<h>) on any page: the book's sections were not rebuilt");
  const pdfWords = new Set(pdf.pages.flatMap((page) => page.toLowerCase().match(/[a-z]+/g) ?? []));
  const glued = [...new Set(plain(html).match(/\b[a-z]{20,}\b/g) ?? [])].filter((word) => !pdfWords.has(word));
  if (glued.length) problems.push(`${glued.length} run-together words (${glued.slice(0, 5).join(", ")})`);
  if (/Extracted page text|searchable text|manual(ly)? (in|handle)|resolve (this )?manually/i.test(plain(html))) problems.push("notes about the conversion or the app inside the book text (belong in the report)");
  const facPages = new Set(ledger.filter((row) => (row.content ?? "").startsWith("facsimile:")).flatMap((row) => row.pack_record.split(";").map((id) => id.trim())));
  const pictureOnly = pages.filter((record) => words(plain(textOf(record))).length < 15 && !facPages.has(String(record.id).replace(/^[^:]*:/, "")));
  if (pictureOnly.length) problems.push(`${pictureOnly.length} pages with no text that the ledger does not list as a facsimile (first: ${pictureOnly.slice(0, 5).map((record) => record.name).join(" | ")})`);
  gate("pages are rebuilt text", problems, `${pages.length} pages, ${headings} headings, ${paragraphs} paragraphs, ${breaks} line breaks`);
}

// 7. Everything the book has is a record: the counts written at the start against the pack.
{
  const problems = [];
  const file = inventoryFile;
  const have = {};
  for (const record of records) have[record.type] = (have[record.type] ?? 0) + 1;
  if (!existsSync(file)) problems.push(`no ${file}: list the book's creatures, items, spells, tables, maps and the like, by name, before making records`);
  else {
    // { "things": [ { "type": "npc", "name": "Goblin", "page": 31 }, ... ] }: each one named, so a list cannot be short
    // by a number; each must be a record of its type with that name.
    const things = inventory.things ?? [];
    if (!things.length) problems.push('inventory.json lists no things ({ "things": [ { "type", "name", "page" } ] })');
    const norm = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const names = new Map();
    // A creature, item or spell with only a name is a stub, not a record.
    const bare = new Set(["name", "fgPath", "text", "description", "picture", "token", "fgCategory", "category", "source"]);
    for (const record of records) {
      const fields = Object.keys(record.data ?? {}).filter((key) => !bare.has(key)).length;
      const key = `${record.type}|${norm(record.name)}`;
      names.set(key, names.get(key) === true || !["npc", "item", "spell"].includes(record.type) || fields >= 3);
    }
    const stubs = things.filter((thing) => names.get(`${thing.type}|${norm(thing.name)}`) === false);
    for (const thing of stubs.slice(0, 20)) problems.push(`${thing.type} "${thing.name}" has no game data (its stats, cost, damage...)`);
    const missing = things.filter((thing) => !names.has(`${thing.type}|${norm(thing.name)}`));
    for (const thing of missing.slice(0, 40)) problems.push(`${thing.type} "${thing.name}" (PDF page ${thing.page ?? "?"}) is not in the pack`);
    if (missing.length > 40) problems.push(`... ${missing.length - 40} more`);
  }
  gate("every listed thing is a record", problems, JSON.stringify(have));
}

// 8. The contents list opens every page it names.
{
  const problems = [];
  const index = records.find((record) => record.type === "refindex");
  if (!index) problems.push("no refindex (the book's contents)");
  else {
    const targets = JSON.stringify(index.data).match(/"recordname":"([^"@]+)@/g) ?? [];
    const dead = targets.map((item) => item.slice(14, -1)).filter((id) => !byPath.has(id));
    if (dead.length) problems.push(`${dead.length} contents entries open nothing (first: ${dead.slice(0, 5).join(", ")})`);
    const listed = new Set(targets.map((item) => item.slice(14, -1)));
    const unlisted = records.filter((record) => record.type === "refpage" && !listed.has(String(record.id).replace(/^[^:]*:/, "")));
    if (!targets.length) problems.push("the contents list is empty");
    if (unlisted.length) problems.push(`${unlisted.length} pages not in the contents (first: ${unlisted.slice(0, 5).map((record) => record.name).join(" | ")})`);
  }
  gate("contents list resolves", problems);
}

// 9. It was played, not only opened (phase D).
{
  const file = path.join(work, "playtest.md");
  const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.trim()).length : 0;
  gate("played in Maelstrom (playtest.md)", lines >= 10 ? [] : [`${existsSync(file) ? "playtest.md is too short" : `no ${file}`}: do phase D and write what was tried and what it showed`]);
}

console.log(`Conversion gate: ${path.basename(packFile)}  (PDF: ${pdf.count} pages)`);
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.detail ? `  [${result.detail}]` : ""}`);
  for (const problem of result.problems) console.log(`      - ${problem}`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(failed ? `NOT DONE: ${failed} of ${results.length} gates fail. Go back to the loop (docs/pdf-to-kpack.md).` : `DONE: all ${results.length} gates pass. Paste this report in the hand-over.`);
process.exit(failed ? 1 : 0);
