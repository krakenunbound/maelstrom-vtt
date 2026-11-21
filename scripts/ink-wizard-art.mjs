// The shipped character wizards' page art as ink on nothing (electron/inkArt.cjs),
// for their dark pages: C&C's and 3.5E's page pictures, rewritten in place.
// Run once after adding or replacing one (a picture already inked stays as it is).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { inkArt } = require("../electron/inkArt.cjs");
const sharp = require("sharp");
const PAGES = {
  "public/rulesets/cnc/wizard": ["abilities", "class", "commit", "equipment", "hp", "primes", "race", "spells"],
  "public/rulesets/dnd35/wizard": ["abilities", "alignment", "class", "commit", "equipment", "feats", "languages", "race", "skills", "spells"],
};
for (const [folder, names] of Object.entries(PAGES))
  for (const name of names) {
    const file = `${folder}/${name}.webp`;
    const bytes = readFileSync(file);
    // Already ink: every pixel white.
    const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let white = true;
    for (let i = 0; i < data.length && white; i += 4) if (data[i + 3] && (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250)) white = false;
    if (white) continue;
    writeFileSync(file, await inkArt(bytes));
    console.log("inked", file);
  }
