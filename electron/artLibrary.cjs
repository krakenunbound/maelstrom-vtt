const fs = require("fs");
const path = require("path");

// The GM's portraits and tokens, where FG keeps them: the data folder's
// portraits/ and tokens/, and each campaign's own portraits/ and tokens/.
// The host serves them to the table by id (a path inside the data folder),
// so players pick from the GM's collection; nothing is copied.

const KINDS = ["portrait", "token"];
const IMAGE = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webm": "video/webm" };
const MAX_FILES = 5000;

function defaultRoots(dataFolder) {
  const roots = [
    { dir: path.join(dataFolder, "portraits"), kind: "portrait", group: "Portraits" },
    { dir: path.join(dataFolder, "tokens"), kind: "token", group: "Tokens" },
  ];
  let campaigns = [];
  try {
    campaigns = fs.readdirSync(path.join(dataFolder, "campaigns"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch {
    /* no campaigns folder */
  }
  for (const campaign of campaigns) {
    for (const kind of KINDS) {
      roots.push({ dir: path.join(dataFolder, "campaigns", campaign.name, `${kind}s`), kind, group: campaign.name });
    }
  }
  return roots;
}

// The character art library (games/characters: its manifest.json lists every portrait and token pair by race, class
// or role and gender; shared/characters/art.mjs): read from the manifest, not walked, and only the pairs that serve
// the campaign's game (ruleset). Each item carries its race, class, gender and its partner's id (pair).
function characterItems(characters) {
  if (!characters?.dir) return [];
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(characters.dir, "manifest.json"), "utf8"));
  } catch {
    return [];
  }
  const { servesGame } = require("../shared/characters/art.mjs");
  const out = [];
  for (const pair of Array.isArray(manifest?.pairs) ? manifest.pairs : []) {
    if (characters.ruleset !== undefined && !servesGame(pair, characters.ruleset)) continue;
    const ids = { portrait: `characters/${pair.portrait}`, token: `characters/${pair.token}` };
    for (const kind of KINDS) {
      out.push({ id: ids[kind], kind, group: `Characters · ${pair.race}`, name: `${pair.race} ${pair.cls}, ${pair.gender} (${String(pair.name).replace(/_/g, " ")})`, video: false, file: path.join(characters.dir, ...pair[kind].split("/")), mime: "image/webp", race: pair.race, cls: pair.cls, gender: pair.gender, pair: ids[kind === "portrait" ? "token" : "portrait"] });
    }
  }
  return out;
}

// base: the folder ids are relative to. roots: [{ dir, kind, group, prefix? }];
// a root outside base (Kraken's own assets folder) gives its ids a prefix and
// is relative to its own folder. characters: { dir, ruleset } (the character art library, the campaign's game).
function createArtLibrary({ base, roots, characters = null }) {
  const root = path.resolve(base);
  let index = null;
  let indexedAt = 0;

  function walk(dir, depth, out) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= MAX_FILES) return;
      const full = path.join(dir, entry.name);
      // Deep collections (a token pack by type and kind: Creatures/Beast/Reptiles) are read; the file cap bounds it.
      if (entry.isDirectory() && depth < 6) walk(full, depth + 1, out);
      else if (entry.isFile() && IMAGE[path.extname(entry.name).toLowerCase()]) out.push(full);
    }
  }

  function scan() {
    if (index && Date.now() - indexedAt < 30000) return index;
    const items = new Map();
    for (const { dir, kind, group, prefix } of roots) {
      const files = [];
      walk(dir, 0, files);
      for (const file of files) {
        const id = prefix ? `${prefix}${path.relative(dir, file).split(path.sep).join("/")}` : path.relative(root, file).split(path.sep).join("/");
        if (id.startsWith("..") || items.has(id)) continue;
        const ext = path.extname(file).toLowerCase();
        // A subfolder (FG's portraits/Dwarf, Kraken's by race) is a folder of its own.
        const sub = path.relative(dir, path.dirname(file)).split(path.sep)[0];
        items.set(id, { id, kind, group: sub && sub !== "." ? `${group} · ${sub}` : group, name: path.basename(file, path.extname(file)), video: ext === ".webm", file, mime: IMAGE[ext] });
      }
    }
    for (const item of characterItems(characters)) if (!items.has(item.id)) items.set(item.id, item);
    index = items;
    indexedAt = Date.now();
    return index;
  }

  return {
    // Refresh (the GM's Folders window): read the folder again at the next look.
    forget() {
      index = null;
    },
    // What the pickers show, newest scan at most 30 seconds old.
    list(kind) {
      return [...scan().values()]
        .filter((item) => !kind || item.kind === kind)
        .map(({ id, kind: itemKind, group, name, video, race, cls, gender, pair }) => ({ id, kind: itemKind, group, name, video, ...(pair ? { race, cls, gender, pair } : {}) }))
        .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
    },
    // Only files the scan found are served: an id is never a free path.
    file(id) {
      const item = scan().get(String(id));
      return item ? { path: item.file, mime: item.mime } : null;
    },
    has: (id) => scan().has(String(id)),
    // The id of a file in a root (a picture just added), read again first.
    idOf(file) {
      index = null;
      const wanted = path.resolve(file);
      return [...scan().values()].find((item) => path.resolve(item.file) === wanted)?.id ?? null;
    },
  };
}

module.exports = { createArtLibrary, defaultRoots };
