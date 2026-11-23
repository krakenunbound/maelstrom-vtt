// The character art library (portrait and token pairs by race, class or role, and gender; docs/character-art.md)
// brought into games/characters as WebP: the same tree (in_common/<Race>/<Class>/<Gender>/, <Ruleset>/<Race>/...),
// each pair's portrait (1024, opaque) and token (512, transparent outside its ring), and one manifest.json that the
// app reads. Driven by the source's manifest.csv (every pair it lists, nothing else); a pair already brought in is
// skipped, so it runs again for each new batch. Files are written to a temporary name and renamed when whole.
//   node scripts/import-character-art.mjs <source folder> [--verify] [--jobs 3]
//   --verify: only check games/characters (every file decodes at its size, tokens transparent at the corner).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
sharp.concurrency(1);
sharp.cache(false);

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEST = path.join(ROOT, "games", "characters");
const args = process.argv.slice(2);
const verifyOnly = args.includes("--verify");
const jobs = Math.max(1, Math.min(8, Number(args[args.indexOf("--jobs") + 1]) || 3));
const source = args.find((arg) => !arg.startsWith("--") && arg !== String(jobs));

// A CSV line by line, quoted fields kept whole.
function csvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), (i += 1);
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(field), (field = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field), (field = "");
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows;
  return body.map((cells) => Object.fromEntries(head.map((name, index) => [name.trim(), (cells[index] ?? "").trim()])));
}
const webpOf = (rel) => rel.replace(/\.png$/i, ".webp");
const manifestFile = path.join(DEST, "manifest.json");
const readManifest = () => {
  try {
    return JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch {
    return { format: "maelstrom-character-art", version: 1, pairs: [] };
  }
};
async function writeWebp(from, to, token) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const temp = `${to}.part`;
  await sharp(from).webp(token ? { quality: 85, alphaQuality: 90, effort: 4 } : { quality: 85, effort: 4 }).toFile(temp);
  fs.renameSync(temp, to);
}
async function pool(items, work) {
  let next = 0;
  const run = async () => {
    while (next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: jobs }, run));
}

async function verify() {
  const manifest = readManifest();
  const bad = [];
  let checked = 0;
  await pool(manifest.pairs, async (pair) => {
    for (const [rel, size, token] of [[pair.portrait, 1024, false], [pair.token, 512, true]]) {
      try {
        const file = path.join(DEST, rel);
        const meta = await sharp(file).metadata();
        if (meta.width !== size || meta.height !== size) bad.push(`${rel}: ${meta.width}x${meta.height}`);
        if (token) {
          const { data, info } = await sharp(file).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
          if (info.channels !== 4 || data[3] !== 0) bad.push(`${rel}: corner not transparent`);
        }
      } catch (error) {
        bad.push(`${rel}: ${error.message}`);
      }
      checked += 1;
    }
  });
  return { pairs: manifest.pairs.length, files: checked, bad };
}

if (verifyOnly) {
  const result = await verify();
  console.log(JSON.stringify({ verified: result.files, pairs: result.pairs, bad: result.bad.length, firstBad: result.bad.slice(0, 20) }));
  process.exit(result.bad.length ? 1 : 0);
}
if (!source || !fs.existsSync(path.join(source, "manifest.csv"))) {
  console.error("Usage: node scripts/import-character-art.mjs <folder with manifest.csv> [--jobs 3] | --verify");
  process.exit(2);
}

const rows = csvRows(fs.readFileSync(path.join(source, "manifest.csv"), "utf8"));
const manifest = readManifest();
const have = new Map(manifest.pairs.map((pair) => [pair.portrait, pair]));
const listed = new Set();
const todo = [];
const missing = [];
for (const row of rows) {
  const portrait = row.Portrait.replace(/\\/g, "/");
  const token = row.Token.replace(/\\/g, "/");
  listed.add(portrait.toLowerCase()).add(token.toLowerCase());
  if (!fs.existsSync(path.join(source, portrait)) || !fs.existsSync(path.join(source, token))) {
    if (!have.has(webpOf(portrait))) missing.push(portrait);
    continue;
  }
  const pair = {
    ruleset: row.Ruleset,
    race: row["Race or ancestry"],
    cls: row["Class or role"],
    gender: row.Gender,
    name: row.Character,
    portrait: webpOf(portrait),
    token: webpOf(token),
    rulesets: row["Applicable rulesets"].split(";").map((name) => name.trim()).filter(Boolean),
  };
  const done = have.has(pair.portrait) && fs.existsSync(path.join(DEST, pair.portrait)) && fs.existsSync(path.join(DEST, pair.token));
  if (done) have.set(pair.portrait, pair);
  else todo.push({ pair, from: [path.join(source, portrait), path.join(source, token)] });
}
// PNGs in the source that its manifest does not list (not brought in).
const extras = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.png$/i.test(entry.name) && !listed.has(path.relative(source, full).replace(/\\/g, "/").toLowerCase())) extras.push(path.relative(source, full).replace(/\\/g, "/"));
  }
})(source);

const failed = [];
let made = 0;
const started = Date.now();
const save = () => {
  const pairs = [...have.values()].sort((a, b) => a.portrait.localeCompare(b.portrait));
  fs.mkdirSync(DEST, { recursive: true });
  fs.writeFileSync(`${manifestFile}.part`, JSON.stringify({ format: "maelstrom-character-art", version: 1, pairs }));
  fs.renameSync(`${manifestFile}.part`, manifestFile);
};
await pool(todo, async ({ pair, from }) => {
  try {
    await writeWebp(from[0], path.join(DEST, pair.portrait), false);
    await writeWebp(from[1], path.join(DEST, pair.token), true);
    have.set(pair.portrait, pair);
    made += 1;
    if (made % 250 === 0) {
      save();
      console.log(`${made}/${todo.length} pairs (${Math.round((Date.now() - started) / 1000)}s)`);
    }
  } catch (error) {
    failed.push(`${pair.portrait}: ${error.message}`);
  }
});
save();
console.log(JSON.stringify({ listed: rows.length, brought: made, already: rows.length - todo.length - missing.length, missing: missing.length, failed: failed.length, firstFailed: failed.slice(0, 10), notListed: extras.length, extras: extras.slice(0, 40), pairs: have.size, seconds: Math.round((Date.now() - started) / 1000) }));
