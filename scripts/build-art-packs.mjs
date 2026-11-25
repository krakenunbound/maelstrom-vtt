// Builds Maelstrom's art packs (electron/artPacks.cjs reads them) from games/characters and games/creatures:
//   Maelstrom-Art-Monsters.kpack            the creature portraits and tokens
//   Maelstrom-Art-Fantasy-Characters.kpack  the fantasy games' character art and the shared fantasy races
//   Maelstrom-Art-Scifi-Characters.kpack    the science fiction games' and the shared sci-fi races
//   Maelstrom-Art-Horror-Modern-Characters.kpack
// Each is a zip, stored (the pictures are WebP already), written a file at a time.
//   node scripts/build-art-packs.mjs <out folder>
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { zipWriter } from "./lib/zipWriter.mjs";

const out = process.argv[2] ?? "release/art-packs";
mkdirSync(out, { recursive: true });
const CHARACTERS = "games/characters";
const CREATURES = "games/creatures";

// Which pack a game system's character art goes in.
const SCIFI = new Set(["Alien RPG", "Cyberpunk RED", "Lancer RPG", "Mothership 1e", "Numenera", "Rifts Ultimate Edition", "Shadowrun 6e", "Starfinder 1e", "Starfinder 2e", "Traveller 2e (2022)"]);
const HORROR = new Set(["Call of Cthulhu 7e", "Delta Green", "Vampire the Masquerade 5e"]);
const SCIFI_RACES = new Set(["Android", "Kasatha", "Lashunta", "Shirren", "Vesk", "Ysoki"]);
const genreOf = (pair) => {
  const system = pair.portrait.split("/")[0];
  if (system === "in_common") return SCIFI_RACES.has(pair.race) ? "scifi" : "fantasy";
  return SCIFI.has(system) ? "scifi" : HORROR.has(system) ? "horror" : "fantasy";
};
const PACKS = [
  { id: "monsters", file: "Maelstrom-Art-Monsters.kpack", title: "Monsters", blurb: "A portrait and a token for each creature" },
  { id: "fantasy", file: "Maelstrom-Art-Fantasy-Characters.kpack", title: "Fantasy Characters", blurb: "Character portraits and tokens for fantasy games, and the faces of people in any game" },
  { id: "scifi", file: "Maelstrom-Art-Scifi-Characters.kpack", title: "Sci-fi Characters", blurb: "Character portraits and tokens for science fiction games" },
  { id: "horror", file: "Maelstrom-Art-Horror-Modern-Characters.kpack", title: "Horror & Modern Characters", blurb: "Character portraits and tokens for horror and modern games" },
];

const manifest = JSON.parse(readFileSync(path.join(CHARACTERS, "manifest.json"), "utf8"));
const review = existsSync(path.join(CHARACTERS, "review.json")) ? JSON.parse(readFileSync(path.join(CHARACTERS, "review.json"), "utf8")) : {};
const made = new Date().toISOString();
const report = [];
for (const pack of PACKS) {
  const target = path.join(out, pack.file);
  const zip = zipWriter(target);
  let pairs = 0;
  let creatures = 0;
  if (pack.id === "monsters") {
    for (const kind of ["portraits", "tokens"]) {
      for (const name of readdirSync(path.join(CREATURES, kind)).sort()) {
        zip.add(`creatures/${kind}/${name}`, path.join(CREATURES, kind, name));
        if (kind === "tokens") creatures++;
      }
    }
  } else {
    const mine = manifest.pairs.filter((pair) => genreOf(pair) === pack.id && existsSync(path.join(CHARACTERS, ...pair.portrait.split("/"))));
    const notLikeRace = Object.fromEntries(Object.entries(review.notLikeRace ?? {}).filter(([portrait]) => mine.some((pair) => pair.portrait === portrait)));
    zip.add("characters/manifest.json", Buffer.from(JSON.stringify({ ...manifest, pairs: mine, removed: undefined })));
    zip.add("characters/review.json", Buffer.from(JSON.stringify({ notLikeRace })));
    for (const pair of mine) {
      for (const kind of ["portrait", "token"]) if (existsSync(path.join(CHARACTERS, ...pair[kind].split("/")))) zip.add(`characters/${pair[kind]}`, path.join(CHARACTERS, ...pair[kind].split("/")));
      pairs++;
    }
  }
  zip.add("kraken-pack.json", Buffer.from(JSON.stringify({ format: "kraken-pack", version: 3, kind: "art-pack", id: pack.id, name: `Maelstrom Art: ${pack.title}`, title: pack.title, blurb: pack.blurb, author: "The Kraken", pairs, creatures, made }, null, 1)));
  const { files, bytes } = zip.end();
  report.push({ pack: pack.file, files, pairs, creatures, mb: Math.round(bytes / 1048576) });
}
console.log(JSON.stringify(report, null, 1));
