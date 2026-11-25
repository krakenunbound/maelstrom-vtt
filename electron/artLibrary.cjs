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
  if (!characters?.dir && !characters?.packs) return [];
  let manifest = null;
  try {
    manifest = characters.dir ? JSON.parse(fs.readFileSync(path.join(characters.dir, "manifest.json"), "utf8")) : null;
  } catch {
    manifest = null;
  }
  // The art packs' character art (Documents/Kraken VTT/Art Packs), beside or instead of the folder.
  const packed = characters.packs ? require("./artPacks.cjs").characterArt(characters.packs) : { pairs: [], notLikeRace: {} };
  if (!manifest && !packed.pairs.length) return [];
  const { servesGame } = require("../shared/characters/art.mjs");
  // Portraits that do not look like their race (review.json): never picked by themselves, still offered.
  let unlike = {};
  try {
    unlike = characters.dir ? JSON.parse(fs.readFileSync(path.join(characters.dir, "review.json"), "utf8"))?.notLikeRace ?? {} : {};
  } catch {
    unlike = {};
  }
  unlike = { ...packed.notLikeRace, ...unlike };
  const out = [];
  const seen = new Set();
  for (const pair of [...(Array.isArray(manifest?.pairs) ? manifest.pairs : []), ...packed.pairs]) {
    if (seen.has(pair.portrait)) continue;
    seen.add(pair.portrait);
    // Every pair is kept (a creature's face may come from any system's art); the pickers list only the game's.
    const serves = characters.ruleset === undefined || servesGame(pair, characters.ruleset);
    // A pair whose pictures were deleted (the GM taking out ones that do not fit) is left out.
    const inPack = pair.pack ? { pack: pair.pack } : null;
    if (inPack ? !require("./artPacks.cjs").has(pair.pack, `characters/${pair.portrait}`) : !fs.existsSync(path.join(characters.dir, ...String(pair.portrait).split("/")))) continue;
    const ids = { portrait: `characters/${pair.portrait}`, token: `characters/${pair.token}` };
    for (const kind of KINDS) {
      out.push({ id: ids[kind], kind, group: `Characters · ${pair.race}`, name: `${pair.race} ${pair.cls}, ${pair.gender} (${String(pair.name).replace(/_/g, " ")})`, video: false, ...(inPack ? { pack: pair.pack, entry: `characters/${pair[kind]}`, file: "" } : { file: path.join(characters.dir, ...pair[kind].split("/")) }), mime: "image/webp", race: pair.race, cls: pair.cls, gender: pair.gender, pair: ids[kind === "portrait" ? "token" : "portrait"], serves, ...(unlike[pair.portrait] ? { unlike: true } : {}) });
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
  let indexSignature = "";
  const listeners = new Set();
  // Creatures' picks, for the index they were made from (the map asks for them often).
  const creatures = { index: null, picks: new Map() };

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
    // The art packs' creature art (creatures/portraits/X, as the folder's ids are).
    if (characters?.packs)
      for (const art of require("./artPacks.cjs").creatureArt(characters.packs))
        if (!items.has(art.id)) items.set(art.id, { id: art.id, kind: art.kind, group: "Creatures", name: art.name, video: false, file: "", pack: art.pack, entry: art.entry, mime: IMAGE[path.extname(art.entry).toLowerCase()] ?? "image/webp" });
    // What it holds changed (pictures added or deleted): those that show its pictures are told (the map's tokens).
    const signature = `${items.size}:${[...items.keys()].join("|").length}`;
    const changed = index && signature !== indexSignature;
    indexSignature = signature;
    index = items;
    indexedAt = Date.now();
    if (changed) for (const listener of listeners) setImmediate(listener);
    return index;
  }

  return {
    // Refresh (the GM's Folders window): read the folder again at the next look.
    forget() {
      indexedAt = 0;
    },
    // What the pickers show, newest scan at most 30 seconds old.
    list(kind) {
      return [...scan().values()]
        .filter((item) => (!kind || item.kind === kind) && item.serves !== false)
        .map(({ id, kind: itemKind, group, name, video, race, cls, gender, pair, unlike }) => ({ id, kind: itemKind, group, name, video, ...(pair ? { race, cls, gender, pair } : {}), ...(unlike ? { unlike: true } : {}) }))
        .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
    },
    // Only files the scan found are served: an id is never a free path. One deleted since: read again at once.
    // A picture in an art pack: { mime, read() } (its bytes, read from the pack), no path.
    file(id) {
      const item = scan().get(String(id));
      if (item?.pack) return { mime: item.mime, pack: item.pack, entry: item.entry, read: () => require("./artPacks.cjs").read(item.pack, item.entry) };
      if (item && !fs.existsSync(item.file)) {
        indexedAt = 0;
        scan();
        return null;
      }
      return item ? { path: item.file, mime: item.mime } : null;
    },
    // Told when what it holds changes (a rescan finds pictures added or deleted).
    onChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    has: (id) => scan().has(String(id)),
    // A creature's portrait and its token from the character art (any system's), by the race its name shows; the
    // same for the same seed (its record's id). null: none of its kind.
    creature(who, seed, kind = "token") {
      // who: the creature's record ({ name, data }: its text, save and kind are read too) or its name.
      const name = typeof who === "string" ? who : String(who?.name ?? "");
      const key = `${name}|${seed}|${typeof who === "string" ? "" : `${String(who?.data?.saveas ?? "")}|${String(who?.data?.text ?? "").length}`}`;
      const index = scan();
      if (creatures.index !== index) creatures.index = index, creatures.picks.clear();
      if (!creatures.picks.has(key)) {
        const shared = require("../shared/characters/art.mjs");
        const portraits = [...index.values()].filter((item) => item.kind === "portrait" && item.pair);
        // Its kind's face from the character art (a goblin's); else a token of its name from the GM's token
        // folders (Forgotten Adventures' Dire Wolf), as its portrait too.
        const pair = portraits.length ? shared.creaturePair(portraits, who, seed) : null;
        // Its kind's token (a zombie lord's: Zombie), else one of its own name.
        const kindToken = shared.creatureProfile(who).kind?.token;
        const all = [...index.values()];
        // A picture made for it by name (its portrait and token in the art folders) comes before anything else.
        const ownToken = shared.creatureToken(all.filter((item) => !item.pair), name, seed, "token");
        const ownPortrait = shared.creatureToken(all.filter((item) => !item.pair), name, seed, "portrait");
        const exactly = (id) => id && shared.tokenCreature(String(index.get(id)?.name ?? "")).replace(/[^a-z()]+/g, "").replace(/(portrait|token)$/, "") === name.toLowerCase().replace(/[^a-z()]+/g, "");
        // The shipped creature art (games/creatures) by its name's words, before a face its record's words suggest
        // (a Giant Bat whose text speaks of vampire bats is a bat).
        const bookToken = shared.creatureToken(all.filter((item) => String(item.id).startsWith("creatures/")), name, seed, "token");
        const bookPortrait = bookToken ? [...index.values()].find((item) => item.kind === "portrait" && item.name === String(index.get(bookToken)?.name ?? "").replace(/_token$/i, "_Portrait"))?.id : null;
        if (exactly(ownToken) || exactly(ownPortrait)) {
          creatures.picks.set(key, { portrait: exactly(ownPortrait) ? ownPortrait : ownToken, token: exactly(ownToken) ? ownToken : ownPortrait });
        } else if (bookToken) {
          creatures.picks.set(key, { portrait: bookPortrait ?? bookToken, token: bookToken });
        } else {
          const token = pair ? null : (kindToken ? shared.creatureToken(all, kindToken, seed) : null) ?? shared.creatureToken(all, name, seed);
          // A token that has a portrait of its own beside it (games/creatures: <Name>_Token, <Name>_Portrait) brings it.
          const partner = token && /_token$/i.test(String(index.get(token)?.name ?? "")) ? [...index.values()].find((item) => item.kind === "portrait" && item.name === String(index.get(token).name).replace(/_token$/i, "_Portrait"))?.id : null;
          creatures.picks.set(key, pair ?? (token ? { portrait: partner ?? token, token } : null));
        }
      }
      const pair = creatures.picks.get(key);
      return pair ? pair[kind === "portrait" ? "portrait" : "token"] : null;
    },
    // The id of a file in a root (a picture just added), read again first.
    idOf(file) {
      index = null;
      const wanted = path.resolve(file);
      return [...scan().values()].find((item) => item.file && path.resolve(item.file) === wanted)?.id ?? null;
    },
  };
}

module.exports = { createArtLibrary, defaultRoots };
