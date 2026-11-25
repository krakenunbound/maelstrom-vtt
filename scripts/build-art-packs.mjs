// Builds Maelstrom's art packs (electron/artPacks.cjs reads them) from games/characters and games/creatures:
//   Maelstrom-Art-Monsters.kpack            the creature portraits and tokens
//   Maelstrom-Art-Fantasy-Characters.kpack  the fantasy games' character art and the shared fantasy races
//   Maelstrom-Art-Scifi-Characters.kpack    the science fiction games' and the shared sci-fi races
//   Maelstrom-Art-Horror-Modern-Characters.kpack
// Each is a zip, stored (the pictures are WebP already), written a file at a time.
//   node scripts/build-art-packs.mjs <out folder>
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, writeSync } from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";

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

// A stored zip, written as it goes: add(name, bytes | file), then end().
function zipWriter(file) {
  const fd = openSync(`${file}.part`, "w");
  let offset = 0;
  const central = [];
  const put = (buffer) => {
    writeSync(fd, buffer);
    offset += buffer.length;
  };
  return {
    add(name, source) {
      const data = Buffer.isBuffer(source) ? source : readFileSync(source);
      const nameBytes = Buffer.from(name, "utf8");
      const crc = crc32(data) >>> 0;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6); // names in UTF-8
      local.writeUInt16LE(0, 8); // stored
      local.writeUInt16LE(0, 10);
      local.writeUInt16LE(0x21, 12); // 1980-01-01
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(nameBytes.length, 26);
      local.writeUInt16LE(0, 28);
      const at = offset;
      put(local);
      put(nameBytes);
      put(data);
      central.push({ nameBytes, crc, size: data.length, at });
    },
    end() {
      const start = offset;
      for (const entry of central) {
        const head = Buffer.alloc(46);
        head.writeUInt32LE(0x02014b50, 0);
        head.writeUInt16LE(20, 4);
        head.writeUInt16LE(20, 6);
        head.writeUInt16LE(0x0800, 8);
        head.writeUInt16LE(0, 10);
        head.writeUInt16LE(0, 12);
        head.writeUInt16LE(0x21, 14);
        head.writeUInt32LE(entry.crc, 16);
        head.writeUInt32LE(entry.size, 20);
        head.writeUInt32LE(entry.size, 24);
        head.writeUInt16LE(entry.nameBytes.length, 28);
        head.writeUInt32LE(entry.at, 42);
        put(head);
        put(entry.nameBytes);
      }
      const tail = Buffer.alloc(22);
      tail.writeUInt32LE(0x06054b50, 0);
      tail.writeUInt16LE(central.length, 8);
      tail.writeUInt16LE(central.length, 10);
      tail.writeUInt32LE(offset - start, 12);
      tail.writeUInt32LE(start, 16);
      put(tail);
      closeSync(fd);
      renameSync(`${file}.part`, file);
      return { files: central.length, bytes: offset };
    },
  };
}

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
