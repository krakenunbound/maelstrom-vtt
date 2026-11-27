// Prints real records of one type from the installed packs of one game, to copy their data shape exactly:
//   node skills/pdf-to-kpack/scripts/sample_record.mjs "<game>" <type> [how many, default 2]
//   node skills/pdf-to-kpack/scripts/sample_record.mjs "D&D BECMI" npc
// With no type it lists which record types the game's packs hold, and how many of each.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";

const [game, type, many = "2"] = process.argv.slice(2);
if (!game) {
  console.error('Usage: node skills/pdf-to-kpack/scripts/sample_record.mjs "<game>" [type] [how many]');
  process.exit(2);
}
const packs = process.env.KRAKEN_PACKS ?? path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", "Documents", "Kraken VTT", "Packs");
const walk = (dir, depth) => (depth > 2 || !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() && !entry.name.startsWith(".") ? walk(path.join(dir, entry.name), depth + 1) : /\.kpack$/i.test(entry.name) ? [path.join(dir, entry.name)] : [])));
const counts = {};
let shown = 0;
for (const file of walk(packs, 0)) {
  let files;
  try {
    files = unzipSync(new Uint8Array(readFileSync(file)), { filter: (entry) => entry.name === "kraken-pack.json" || entry.name === "records.json" });
  } catch {
    continue;
  }
  if (!files["kraken-pack.json"] || !files["records.json"]) continue;
  const manifest = JSON.parse(strFromU8(files["kraken-pack.json"]));
  if (manifest.ruleset !== game) continue;
  const records = JSON.parse(strFromU8(files["records.json"]));
  for (const record of records) {
    counts[record.type] = (counts[record.type] ?? 0) + 1;
    if (type && record.type === type && shown < Number(many)) {
      shown++;
      console.log(`--- ${record.type} "${record.name}" from ${path.basename(file)}`);
      console.log(JSON.stringify(record, null, 1));
    }
  }
}
if (!Object.keys(counts).length) console.log(`No installed pack is for "${game}".`);
else if (!type) console.log(`Record types in "${game}" packs: ${JSON.stringify(counts)}`);
else if (!shown) console.log(`No "${type}" record in "${game}" packs. Types there: ${JSON.stringify(counts)}`);
