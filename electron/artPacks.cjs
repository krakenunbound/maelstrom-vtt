const fs = require("fs");
const path = require("path");
const { inflateRawSync } = require("zlib");

// Maelstrom's art packs (Documents/Kraken VTT/Art Packs): the character and creature art that used to come inside the
// installer, now optional downloads (the installer's Art packs page, or the start screen's), one pack a kind:
// Monsters, Fantasy characters, Sci-fi characters, Horror and modern characters. Each is a zip (.kpack) read in place:
//   kraken-pack.json      { format: "kraken-pack", kind: "art-pack", name, title, pairs, creatures }
//   characters/manifest.json, characters/review.json, characters/<system>/<race>/... (the character art's own layout)
//   creatures/portraits/*, creatures/tokens/*        (the creature art's)
// Ids stay as they were (characters/..., creatures/...), so art a campaign already chose keeps working.

const PACK = /\.kpack$/i;
const cache = new Map(); // file -> { key, manifest, entries: Map(name -> { offset, size, packed, method }) }

// The zip's central directory, read once a file (size and time): every entry's place in the file.
function indexOf(file) {
  const stat = fs.statSync(file);
  const key = `${stat.size}|${Math.round(stat.mtimeMs)}`;
  const known = cache.get(file);
  if (known?.key === key) return known;
  const fd = fs.openSync(file, "r");
  try {
    const at = (length, position) => {
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, position);
      return buffer;
    };
    const tail = at(Math.min(stat.size, 65557), Math.max(0, stat.size - 65557));
    const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0) throw new Error(`${path.basename(file)} is not a pack.`);
    const directory = at(tail.readUInt32LE(end + 12), tail.readUInt32LE(end + 16));
    const entries = new Map();
    for (let i = 0; i + 46 <= directory.length && directory.readUInt32LE(i) === 0x02014b50; ) {
      const nameLength = directory.readUInt16LE(i + 28);
      const name = directory.toString("utf8", i + 46, i + 46 + nameLength);
      entries.set(name, { method: directory.readUInt16LE(i + 10), packed: directory.readUInt32LE(i + 20), size: directory.readUInt32LE(i + 24), header: directory.readUInt32LE(i + 42) });
      i += 46 + nameLength + directory.readUInt16LE(i + 30) + directory.readUInt16LE(i + 32);
    }
    const found = { key, entries, manifest: null };
    cache.set(file, found);
    found.manifest = JSON.parse(read(file, "kraken-pack.json").toString("utf8"));
    return found;
  } finally {
    fs.closeSync(fd);
  }
}

// One file of a pack, its bytes.
function read(file, name) {
  const entry = (cache.get(file) ?? indexOf(file)).entries.get(name);
  if (!entry) return null;
  const fd = fs.openSync(file, "r");
  try {
    const local = Buffer.alloc(30);
    fs.readSync(fd, local, 0, 30, entry.header);
    const data = Buffer.alloc(entry.packed);
    fs.readSync(fd, data, 0, entry.packed, entry.header + 30 + local.readUInt16LE(26) + local.readUInt16LE(28));
    return entry.method === 8 ? inflateRawSync(data) : data;
  } finally {
    fs.closeSync(fd);
  }
}

// The art packs in a folder: { file, manifest, entries } each (one that cannot be read is left out). kind: the
// manifest's kind ("sound-pack" for the sound packs, read the same way).
function packsIn(folder, kind = "art-pack") {
  let names = [];
  try {
    names = fs.readdirSync(folder).filter((name) => PACK.test(name));
  } catch {
    return [];
  }
  const out = [];
  for (const name of names.sort()) {
    const file = path.join(folder, name);
    try {
      const { manifest, entries } = indexOf(file);
      if (manifest?.kind === kind) out.push({ file, manifest, entries });
    } catch {
      /* not an art pack */
    }
  }
  return out;
}

// The character art of every pack, put together: manifest pairs (each with the pack it is in) and the review's list.
function characterArt(folder) {
  const pairs = [];
  const notLikeRace = {};
  for (const pack of packsIn(folder)) {
    if (!pack.entries.has("characters/manifest.json")) continue;
    try {
      const manifest = JSON.parse(read(pack.file, "characters/manifest.json").toString("utf8"));
      for (const pair of manifest.pairs ?? []) pairs.push({ ...pair, pack: pack.file });
      const review = pack.entries.has("characters/review.json") ? JSON.parse(read(pack.file, "characters/review.json").toString("utf8")) : null;
      Object.assign(notLikeRace, review?.notLikeRace ?? {});
    } catch {
      /* a pack whose manifest cannot be read gives nothing */
    }
  }
  return { pairs, notLikeRace };
}

// The creature art of every pack: { id (creatures/portraits/X.webp), kind, name, pack, entry }.
function creatureArt(folder) {
  const out = [];
  for (const pack of packsIn(folder)) {
    for (const name of pack.entries.keys()) {
      const match = /^creatures\/(portraits|tokens)\/([^/]+)$/.exec(name);
      if (match) out.push({ id: name, kind: match[1] === "portraits" ? "portrait" : "token", name: path.basename(match[2], path.extname(match[2])), pack: pack.file, entry: name });
    }
  }
  return out;
}

const has = (file, name) => Boolean((cache.get(file) ?? indexOf(file)).entries.has(name));

module.exports = { packsIn, characterArt, creatureArt, read, has };
