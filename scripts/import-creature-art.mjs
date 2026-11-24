// A creature book's own art (an FG module whose creatures each have a picture and a token: the GM's 3.5e Monster
// Manual, AI-made) brought into games/creatures as a portrait and token per creature, named after its record:
// portraits/<Name>_Portrait.webp, tokens/<Name>_Token.webp (docs/character-art.md, "Creature art"). The files are
// copied as they are (already WebP); a creature already brought in is skipped.
//   node --max-old-space-size=4096 scripts/import-creature-art.mjs <module.mod>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const require = createRequire(import.meta.url);
const { readModule } = require("../electron/importers/fgModule.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEST = path.join(ROOT, "games", "creatures");
const source = process.argv[2];
if (!source) throw new Error("Which module? node scripts/import-creature-art.mjs <module.mod>");
const files = unzipSync(fs.readFileSync(source));
const creatures = readModule(source, { only: new Set(["npc"]) }).records.filter((record) => record.type === "npc");
const safe = (name) => name.replace(/[<>:"/\\|?*]+/g, "-").trim();
fs.mkdirSync(path.join(DEST, "portraits"), { recursive: true });
fs.mkdirSync(path.join(DEST, "tokens"), { recursive: true });
let added = 0;
let kept = 0;
const missing = [];
for (const creature of creatures) {
  const portraitBytes = files[String(creature.data?.picture ?? "").split("@")[0]];
  const tokenBytes = files[String(creature.data?.token ?? "").split("@")[0]];
  if (!portraitBytes || !tokenBytes) {
    missing.push(creature.name);
    continue;
  }
  const portraitFile = path.join(DEST, "portraits", `${safe(creature.name)}_Portrait.webp`);
  const tokenFile = path.join(DEST, "tokens", `${safe(creature.name)}_Token.webp`);
  if (fs.existsSync(portraitFile) && fs.existsSync(tokenFile)) {
    kept += 1;
    continue;
  }
  fs.writeFileSync(portraitFile, portraitBytes);
  fs.writeFileSync(tokenFile, tokenBytes);
  added += 1;
}
console.log(JSON.stringify({ creatures: creatures.length, added, kept, missing }));
