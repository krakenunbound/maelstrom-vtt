const fs = require("fs");
const path = require("path");

// The GM's sounds, in Kraken's assets folder (assets/sounds in the app's
// data), by kind and then by folder, as Syrinscape's sets are:
//   oneshots/   short sounds the GM plays by hand (a door, a chest, a scream)
//   sfx/        sound effects the chat sets off (sfx/Weapons/Sword/Hit/...)
//   ambience/   loops that play under the game (ambience/Forest at Night/...)
//   music/      music
// A folder is a group: playing it picks one of its sounds at random, so a
// sword hit is not the same every time. Ids are paths inside the folder,
// only ever looked up in the index.
// builtin: the table's own sounds shipped with the app (dice moments: crits,
// fumbles, initiative, saves, surprise, turns, levels), in the same layout.
// packs: the sound packs' folder (Documents/Kraken VTT/Sound Packs): each
// .kpack (kind "sound-pack") holds <kind>/<group>/<file> entries, read in
// place, with the same ids a loose file there would have. A pack's sound wins
// over the app's, and a sound of the GM's with the same path wins over both.

const KINDS = ["oneshots", "sfx", "ambience", "music"];
const AUDIO = { ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".webm": "audio/webm", ".flac": "audio/flac", ".opus": "audio/ogg" };
const MAX_BYTES = 200 * 1024 * 1024;
const MAX_FILES = 20000;

const mimeOf = (name) => AUDIO[path.extname(name).toLowerCase()] ?? null;
const prettyName = (file) => path.basename(file, path.extname(file)).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

function createSoundLibrary({ folder, builtin = "", packs = "" }) {
  let index = null;
  let indexedAt = 0;

  function scan() {
    if (index && Date.now() - indexedAt < 10000) return index;
    const items = new Map();
    const walk = (root, dir, depth) => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (items.size >= MAX_FILES) return;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && depth < 6) walk(root, full, depth + 1);
        else if (entry.isFile() && mimeOf(entry.name)) {
          const id = path.relative(root, full).split(path.sep).join("/");
          const [kind, ...rest] = id.split("/");
          if (!KINDS.includes(kind) || rest.length === 0) continue;
          items.set(id, { id, kind, group: rest.slice(0, -1).join("/"), name: prettyName(entry.name), file: full, mime: mimeOf(entry.name) });
        }
      }
    };
    if (builtin) walk(builtin, builtin, 0);
    if (packs) {
      for (const pack of require("./artPacks.cjs").packsIn(packs, "sound-pack")) {
        for (const [entry, info] of pack.entries) {
          if (items.size >= MAX_FILES) break;
          const [kind, ...rest] = entry.split("/");
          if (!KINDS.includes(kind) || rest.length < 1 || !mimeOf(entry) || !info.size) continue;
          items.set(entry, { id: entry, kind, group: rest.slice(0, -1).join("/"), name: prettyName(entry), pack: pack.file, entry, size: info.size, mime: mimeOf(entry) });
        }
      }
    }
    walk(folder, folder, 0);
    index = items;
    indexedAt = Date.now();
    return index;
  }

  return {
    // Refresh (the GM's Folders window): read the folder again at the next look.
    forget() {
      index = null;
    },
    folder,
    kinds: KINDS,
    list(kind) {
      return [...scan().values()]
        .filter((item) => !kind || item.kind === kind)
        .map(({ id, kind: itemKind, group, name }) => ({ id, kind: itemKind, group, name }))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    },
    // The groups (folders) of a kind, with how many sounds each has.
    groups(kind) {
      const counts = new Map();
      for (const item of scan().values()) if (!kind || item.kind === kind) counts.set(`${item.kind}/${item.group}`, (counts.get(`${item.kind}/${item.group}`) ?? 0) + 1);
      return [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => a.id.localeCompare(b.id));
    },
    has: (id) => scan().has(String(id)),
    // A sound by id, or one at random from a group ("sfx/Weapons/Sword/Hit"),
    // or from anything under it ("sfx/Weapons/Sword").
    pick(idOrGroup) {
      const wanted = String(idOrGroup ?? "").replace(/\/+$/, "");
      const all = scan();
      if (all.has(wanted)) return all.get(wanted);
      const inside = [...all.values()].filter((item) => `${item.kind}/${item.group}` === wanted || `${item.kind}/${item.group}`.startsWith(`${wanted}/`));
      return inside.length ? inside[Math.floor(Math.random() * inside.length)] : null;
    },
    // On disk ({ path, mime }) or inside a sound pack ({ pack, entry, mime }: artPacks.read gives its bytes).
    file(id) {
      const item = scan().get(String(id));
      if (!item) return null;
      return item.pack ? { pack: item.pack, entry: item.entry, mime: item.mime } : { path: item.file, mime: item.mime };
    },
    // The sound packs read (their file and manifest), for the GM's list.
    packs: () => (packs ? require("./artPacks.cjs").packsIn(packs, "sound-pack").map((pack) => ({ file: pack.file, ...pack.manifest, sounds: [...pack.entries.keys()].filter((name) => mimeOf(name)).length })) : []),
    // A sound file from anywhere, copied into a kind and group.
    add(kind, group, name, bytes) {
      if (!KINDS.includes(kind)) throw new Error(`A sound is one of: ${KINDS.join(", ")}.`);
      if (!mimeOf(String(name))) throw new Error("A sound is an .mp3, .ogg, .wav, .m4a, .webm or .flac file.");
      const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      if (data.length === 0 || data.length > MAX_BYTES) throw new Error("That sound is empty or larger than 200 MB.");
      const parts = String(group ?? "").split(/[\\/]+/).map((part) => part.replace(/[^\w .()&'-]+/g, "_").trim()).filter((part) => part && part !== "." && part !== "..");
      const dir = path.join(folder, kind, ...parts);
      fs.mkdirSync(dir, { recursive: true });
      const safe = path.basename(String(name)).replace(/[^\w .()&'-]+/g, "_");
      let target = safe;
      // A second sound of the same name: "<name> (2)", from the cleaned name (never the raw one).
      for (let n = 2; fs.existsSync(path.join(dir, target)); n++) target = `${path.basename(safe, path.extname(safe))} (${n})${path.extname(safe)}`;
      fs.writeFileSync(path.join(dir, target), data);
      index = null;
      const id = [kind, ...parts, target].join("/");
      return { id, kind, group: parts.join("/"), name: prettyName(target) };
    },
    // A module's sound kept in the library for good (a book made active, a map bundle opened): the
    // same file already there (its name and size in that folder) is not added twice.
    keep(kind, group, name, bytes) {
      if (!KINDS.includes(kind) || !mimeOf(String(name))) return null;
      const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      const parts = String(group ?? "").split(/[\\/]+/).map((part) => part.replace(/[^\w .()&'-]+/g, "_").trim()).filter((part) => part && part !== "." && part !== "..");
      const safe = path.basename(String(name)).replace(/[^\w .()&'-]+/g, "_");
      const there = path.join(folder, kind, ...parts, safe);
      try {
        if (fs.existsSync(there) && fs.statSync(there).size === data.length) return { id: [kind, ...parts, safe].join("/"), kind, group: parts.join("/"), name: prettyName(safe), kept: true };
      } catch {
        /* added below */
      }
      return this.add(kind, group, name, data);
    },
    addFile(kind, group, file) {
      return this.add(kind, group, path.basename(file), fs.readFileSync(file));
    },
  };
}

module.exports = { createSoundLibrary, SOUND_KINDS: KINDS };
