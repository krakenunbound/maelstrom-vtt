const fs = require("fs");
const path = require("path");
const { strFromU8 } = require("fflate");
const { DOMParser } = require("@xmldom/xmldom");
const { readModule, modulePicture } = require("./importers/fgModule.cjs");
const packs = require("./packs.cjs");

// The GM's books, as FG's Library: the Fantasy Grounds modules on this
// computer (the GM's own, read in place, never copied or shipped). A module
// with a reference manual is a book to read: its chapters, sections and pages
// (FG's refmanualindex and refmanualdata), with pictures and links; its
// pictures and maps are FG's Images & Maps. Players read only what the GM
// shares (the table server decides).
//
// The list is cached by file, size and time, so the folder is read in full
// once (about 5 s for 13 GB) and then only what changed.

const PICTURES = /\.(png|webp|jpe?g|gif)$/i;

// Which FG rulesets' modules fit a Kraken campaign's ruleset: the ruleset
// decides the books. A module for "Any" (or CoreRPG, or none named) fits every
// campaign; Worldbuilding (no rules) takes those, and the books of games
// Kraken has no rules for yet (Pathfinder, Savage Worlds...: their pages, story and
// maps), never the books of another of Kraken's games.
const FG_RULESETS = {
  "Castles & Crusades": ["SiegeCore", "CnCRPG"],
  // FG's 5E ruleset's modules (the SRD 5.2.1's player book, bestiary, magic
  // items), Kraken's own SRD 5.2.1 books among them (games/srd-5e: ruleset 5E).
  "D&D 5E": ["5E"],
  // The 3.5E ruleset's modules (FG's own and the GM's, Kraken35E's too).
  "D&D 3.5E": ["3.5E", "Kraken35E", "d20"],
  // FG's AD&D 2E ruleset's modules (the GM's B-series, Greyhawk, pregens).
  "AD&D 2E": ["2E"],
  // FG's Mongoose Traveller 2E ruleset's modules.
  Traveller: ["MGT2"],
  // Kraken's own games, with their books shipped in the app (games/modules).
  "Descending Darkness": ["Descending Darkness"],
  "Apeira Astra": ["Apeira Astra"],
  // Cairn Second Edition (CC BY-SA 4.0), its books shipped in the app (games/modules).
  Cairn: ["Cairn"],
  // Ironsworn (with Delve) and Ironsworn: Starforged (their CC BY 4.0 parts), shipped in the app (games/modules).
  Ironsworn: ["Ironsworn"],
  Starforged: ["Starforged"],
  // Basic Fantasy RPG 4th Edition (CC BY-SA 4.0), its books shipped in the app.
  "Basic Fantasy": ["Basic Fantasy"],
  // Fate Core and Fate Accelerated (CC BY 3.0), their books shipped in the app
  // (games/modules): each its own book, the toolkit and the scenario ("Fate") both.
  "Fate Core": ["Fate Core", "Fate"],
  "Fate Accelerated": ["Fate Accelerated", "Fate"],
  // Forged in the Dark (the Blades in the Dark SRD, CC BY 3.0), its books shipped in the app.
  "Forged in the Dark": ["Forged in the Dark"],
  Worldbuilding: [],
};
const ANY = new Set(["", "any", "corerpg"]);
const PLAYED = new Set(Object.entries(FG_RULESETS).flatMap(([name, fg]) => (name === "Worldbuilding" ? [] : [name, ...fg])).map((name) => name.toLowerCase()));
// A game defined by a pack (shared/packgame) is played: its books are its own, not Worldbuilding's.
function playedName(name) {
  const lower = String(name ?? "").toLowerCase();
  if (PLAYED.has(lower)) return true;
  try {
    return require("../shared/rulesets/registry.mjs").packGames().some((game) => game.name.toLowerCase() === lower);
  } catch {
    return false;
  }
}
function fitsRuleset(info, ruleset) {
  // A Kraken pack says which Kraken ruleset it is for.
  // (A pack made before Kraken played its game names the game as FG did: "2E".)
  if (info?.kraken) return info.kraken === "Any" || info.kraken === ruleset || (FG_RULESETS[ruleset] ?? []).some((name) => name.toLowerCase() === info.kraken.toLowerCase()) || (ruleset === "Worldbuilding" && !playedName(info.kraken) && !playedName(info.ruleset));
  if (ruleset === "Worldbuilding") {
    const theirs = String(info.ruleset ?? "").toLowerCase();
    return ANY.has(theirs) || !PLAYED.has(theirs);
  }
  const wanted = FG_RULESETS[ruleset] ?? [String(ruleset ?? "")];
  const theirs = String(info.ruleset ?? "").toLowerCase();
  return ANY.has(theirs) || wanted.some((name) => name.toLowerCase() === theirs);
}

// An adventure (a module, a one-shot, a scenario) is the GM's alone: it is
// never opened to the players as a book; the GM shows them its pictures and
// maps, one at a time. Of the other books, a players' book (a Player's
// Handbook, a player's guide, gear and characters) starts open to the players
// when made active; the GM's (monsters, the GM's guide) starts closed, and
// the GM may open it.
function isAdventure(info) {
  const words = `${info.title} ${info.category}`;
  if (/player'?s'? (guide|handbook)/i.test(words)) return false;
  // Where the shelf files it (a pack says, else shared/packs/organize.mjs works it out from its category and
  // title, and only then from story entries): a rules book with story entries (2E's Complete handbooks, a
  // DM's guide) is still a book.
  const { organize } = require("../shared/packs/organize.mjs");
  return organize(info).kind === "adventure";
}
const GM_ONLY = /monster|bestiary|creature|codex|keeper|dungeon ?master|\bdm\b|\bgm\b|game ?master|\badventures?\b|module|encounter|scenario|campaign|one-shot|treasure|developer/i;
const PLAYERS = /player|handbook|adventurer|backpack|common room|character|pregen/i;
function forPlayers(info) {
  // A pack that says (one exported from a campaign): as it says.
  if (typeof info.players === "boolean") return info.players;
  const words = `${info.title} ${info.category}`;
  const guide = /player'?s'? (guide|handbook|reference|core)/i.test(words);
  return guide || (PLAYERS.test(words) && !GM_ONLY.test(words));
}

function elements(node) {
  const out = [];
  for (let child = node.firstChild; child; child = child.nextSibling) if (child.nodeType === 1) out.push(child);
  return out;
}

function parse(text) {
  const doc = new DOMParser({ errorHandler: { warning: () => undefined, error: () => undefined, fatalError: () => undefined } }).parseFromString(text.replace(/^﻿/, ""), "text/xml");
  return doc?.documentElement ?? null;
}

// Whether a pack has a page to read: a page record, or a page kept inside its contents (read once: the shelf
// keeps the answer with the rest of its description).
// A book's chapters from its contents record: data.chapters, or (B3, A4...) inside the one <category> FG wraps
// the whole contents in (refmanualindex > category > chapters).
function chaptersOf(data) {
  if (data?.chapters && typeof data.chapters === "object") return data.chapters;
  const wrapped = data?.category?.chapters;
  return wrapped && typeof wrapped === "object" ? wrapped : {};
}

function packHasPages(file) {
  try {
    const records = JSON.parse(Buffer.from(packs.readEntries(file, (name) => name === "records.json")["records.json"]).toString("utf8"));
    if (records.some((record) => record.type === "refpage")) return true;
    const index = records.find((record) => record.type === "refindex");
    return Object.values(chaptersOf(index?.data)).some((chapter) =>
      Object.values(chapter?.subchapters ?? {}).some((section) => Object.values(section?.refpages ?? {}).some((page) => page?.blocks || typeof page?.text === "string" || page?.listlink)),
    );
  } catch {
    return true;
  }
}

// Every media file a book holds, each with its kind by how the book uses it: a map record's picture is a Map, a
// creature's or an encounter's token a Token, a portrait a Portrait, a handout a Handout, another picture record an
// Image; sounds, music and video by their type; anything else by its folder's words, else Images or Other.
const MEDIA = /\.(webm|mp4|ogg|mp3|wav|m4a)$/i;
const AUDIO = /\.(ogg|mp3|wav|m4a)$/i;
function mediaOf(book) {
  const files = (book.module.images ?? []).filter((name) => PICTURES.test(name) || MEDIA.test(name));
  const own = new Map(files.map((name) => [name.toLowerCase(), name]));
  const kind = new Map();
  const mark = (reference, as, strong = true) => {
    const name = own.get(String(reference ?? "").split("@")[0].replace(/^\/+/, "").replaceAll("\\", "/").toLowerCase());
    if (name && (strong || !kind.has(name))) kind.set(name, as);
  };
  for (const record of book.records.values()) {
    const data = record.data ?? {};
    if (record.type === "image") {
      // A grid or walls make a map; else the words, a handout's first ("Handouts - Scenes (Map Adventurer)").
      const words = `${data.fgCategory ?? ""} ${record.name}`;
      const played = data.image?.grid === "on" || /occluder/.test(JSON.stringify(data.image ?? {}).slice(0, 20000));
      const as = played ? "Maps" : /handouts?/i.test(words) ? "Handouts" : /\bmaps?\b/i.test(words) ? "Maps" : "Images";
      const bitmap = bitmapIn(data.image);
      if (bitmap) mark(bitmap, as, as === "Maps");
      continue;
    }
    // Tokens and portraits wherever a record names them (a creature, an encounter's creatures, a character).
    const text = JSON.stringify(data);
    for (const hit of text.matchAll(/"(token|token3d)"\s*:\s*"([^"]+)"/g)) mark(hit[2], "Tokens");
    // A creature's or character's picture is its portrait; an item's (or anything else's) picture is an image.
    const portrait = /^(npc|charsheet|character|pregencharsheet|encounter|battle)$/.test(record.type) ? "Portraits" : "Images";
    for (const hit of text.matchAll(/"(picture|portrait)"\s*:\s*"([^"]+)"/g)) mark(hit[2], portrait, false);
  }
  const byFolder = (name) => {
    const words = name.toLowerCase();
    if (AUDIO.test(name)) return /\bmusic\b|\/music\//.test(words) ? "Music" : "Sounds";
    if (/\.(webm|mp4)$/i.test(name)) return /maps?\//.test(words) ? "Maps" : "Video";
    if (/(^|\/)maps?\//.test(words) || /battle ?maps?/.test(words)) return "Maps";
    if (/(^|\/)tokens?\//.test(words) || /pogs?\//.test(words)) return "Tokens";
    if (/(^|\/)portraits?\//.test(words)) return "Portraits";
    if (/handouts?/.test(words)) return "Handouts";
    if (/^thumbnail\.|(^|\/)cover\./.test(words)) return "Covers";
    return "Images";
  };
  return files.map((file) => ({ file, kind: kind.get(file) ?? byFolder(file) }));
}

// A book's contents record (its chapters, sections and pages).
const indexOf = (book) => [...book.records.values()].find((record) => record.type === "refindex" && String(record.data?.fgPath ?? record.id ?? "").includes("reference.refmanualindex"));

// A pack with no cover of its own: the picture whose name says cover, title or front, else its first picture.
function coverAmong(pictures) {
  const list = (Array.isArray(pictures) ? pictures : []).map(String).filter((name) => /\.(png|webp|jpe?g)$/i.test(name));
  return list.find((name) => /(^|[\/_ -])(thumbnail|cover|title|front)[^\/]*$/i.test(name)) ?? list[0] ?? "";
}

// A pack's game.json (a game defined by its books), read whole; none, or one that does not parse: nothing.
function gameIn(file) {
  try {
    const raw = packs.readEntries(file, ["game.json"])["game.json"];
    if (!raw) return {};
    const game = JSON.parse(strFromU8(raw));
    return game && typeof game === "object" && typeof game.name === "string" ? { game } : {};
  } catch {
    return {};
  }
}

// What a module is, from its definition.xml (and whether it has a book); a
// Kraken pack, from its own description.
const DESCRIBED = 8;
function describe(file) {
  if (packs.isPack(file)) {
    const manifest = packs.readManifest(file);
    return {
      id: path.basename(file).slice(0, -packs.EXTENSION.length),
      name: String(manifest.name ?? ""),
      title: String(manifest.title || manifest.name || ""),
      category: String(manifest.category || "Other"),
      ruleset: String(manifest.from?.ruleset ?? ""),
      kraken: String(manifest.ruleset || "Any"),
      author: String(manifest.author ?? ""),
      // A book only when it has pages to read (a module that says it has a book, with empty contents, has none).
      hasBook: Boolean(manifest.hasBook) && (manifest.contents ? Number(manifest.contents.pages) > 0 || packHasPages(file) : packHasPages(file)),
      hasStory: manifest.hasStory !== undefined ? Boolean(manifest.hasStory) : packHasStory(file),
      // Its picture in the lists: the pack's thumbnail, else its cover, else the picture most like a cover.
      cover: String(manifest.thumbnail || manifest.cover || coverAmong(manifest.pictures) || ""),
      // Where it is filed (format 3; shared/packs/organize.mjs works it out for older packs): its kind, group in it,
      // order in the group, and the pack it is a part of.
      ...(typeof manifest.kind === "string" ? { kind: manifest.kind } : {}),
      ...(typeof manifest.group === "string" ? { group: manifest.group } : {}),
      ...(typeof manifest.order === "string" || typeof manifest.order === "number" ? { order: String(manifest.order) } : {}),
      ...(typeof manifest.parent === "string" ? { parent: manifest.parent } : {}),
      // The world's calendar it brings (shared/calendars.mjs settingCalendar).
      calendar: typeof manifest.calendar === "string" ? manifest.calendar : "",
      // The game it defines (docs/pack-games.md): a rules book that teaches Maelstrom a game carries a game.json.
      ...gameIn(file),
      // Made from a PDF (its battles' spots are about where a room is, not exact): placed onto the map's floor.
      ...(manifest.from?.kind === "pdf" ? { fromPdf: true } : {}),
      // Whether the players may read it, when the pack says (exported from a campaign).
      ...(typeof manifest.forPlayers === "boolean" ? { players: manifest.forPlayers } : {}),
      pack: true,
    };
  }
  const stat = fs.statSync(file);
  let get;
  if (stat.isDirectory()) {
    get = (name) => {
      const at = path.join(file, name);
      return fs.existsSync(at) ? fs.readFileSync(at) : null;
    };
  } else {
    const zip = packs.readEntries(file, (name) => /^(definition|db|client)\.xml$|^thumbnail\.(png|jpg|webp)$/i.test(name));
    get = (name) => zip[name] ?? null;
  }
  const definition = get("definition.xml");
  if (!definition) return null;
  const root = parse(strFromU8(definition));
  if (!root) return null;
  const field = (tag) => (elements(root).find((node) => node.tagName === tag)?.textContent ?? "").trim();
  const name = field("name") || path.basename(file, ".mod");
  const hasBook = ["db.xml", "client.xml"].some((part) => {
    const bytes = get(part);
    return bytes ? strFromU8(bytes).includes("<refmanualindex") : false;
  });
  // Story entries (FG's encounter records): the module is an adventure, whatever its name.
  const hasStory = ["db.xml", "client.xml"].some((part) => {
    const bytes = get(part);
    return bytes ? /<encounter[\s>]/.test(strFromU8(bytes)) : false;
  });
  const cover = ["thumbnail.png", "thumbnail.jpg", "thumbnail.webp"].find((item) => get(item)) ?? "";
  return {
    id: path.basename(file).replace(/\.mod$/i, ""),
    name,
    title: field("displayname") || name,
    category: field("category") || "Other",
    ruleset: field("ruleset"),
    author: field("author"),
    hasBook,
    hasStory,
    cover,
  };
}
// A pack made before packs said so: whether its records hold story entries.
function packHasStory(file) {
  try {
    return packs.readPack(file).records.some((record) => record.type === "encounter");
  } catch {
    return false;
  }
}

// FG's formatted text, as HTML Kraken shows: only these tags, text escaped,
// and links turned into Kraken's own (a page, a picture, or plain text).
const TAGS = { p: "p", b: "b", strong: "b", i: "i", em: "i", u: "u", h: "h3", list: "ul", li: "li", table: "table", tr: "tr", td: "td", th: "th", frame: "blockquote", linklist: "ul", sup: "sup", sub: "sub" };
const escape = (text) => String(text).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);

// A book's text that carries a superscript, subscript or line break as
// typed text ("Quarterstaff<sup>2</sup>", escaped in the module): shown as
// one, as the book meant (a fixed few, so nothing else gets through).
const typeset = (escaped) => escaped.replace(/&lt;(\/?)(sup|sub)&gt;/gi, (_, close, tag) => `<${close}${tag.toLowerCase()}>`).replace(/&lt;br\s*\/?&gt;/gi, "<br>");
// Where on a map a link opens: the middle of the spots (FG's, from the picture's centre, y down) and
// how far they spread, as "x,y,r" (data-at), so the map opens on that lair, not the whole picture.
function aroundOf(spots) {
  if (!spots?.length) return "";
  const x = spots.reduce((sum, [px]) => sum + px, 0) / spots.length;
  const y = spots.reduce((sum, [, py]) => sum + py, 0) / spots.length;
  const r = Math.max(...spots.map(([px, py]) => Math.hypot(px - x, py - y)));
  return `${Math.round(x)},${Math.round(y)},${Math.round(r)}`;
}
// found: an array that takes the maps the text's encounters stand on (the page's map, see page()).
function toHtml(formatted, resolve, found = null) {
  const root = parse(`<root>${formatted ?? ""}</root>`);
  const maps = new Set(); // an encounter's map, linked once
  if (!root) return `<p>${escape(formatted ?? "")}</p>`;
  const walk = (node) => {
    let out = "";
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3 || child.nodeType === 4) out += typeset(escape(child.nodeValue));
      if (child.nodeType !== 1) continue;
      const tag = child.tagName;
      if (tag === "br") {
        out += "<br>";
        continue;
      }
      if (tag === "link") {
        const linkClass = child.getAttribute("class") || "";
        const recordname = child.getAttribute("recordname") || "";
        const text = walk(child) || "Link";
        // FG's sound links (Syrinscape's: ss|id|mood or element|type|name): a
        // sound of Kraken's own plays from them (matched by kind and name, or
        // the one the GM drops on it); FG's "Sound: Context" has no use here.
        if (linkClass === "soundplay") {
          const [, , type = "", subtype = "", ...name] = recordname.split("|");
          const kind = type === "mood" ? "ambience" : subtype === "music" ? "music" : type === "oneshot" ? "oneshots" : "sfx";
          out += `<a class="book-link sound" data-sound-key="${escape(recordname || text)}" data-sound-kind="${kind}" data-sound-name="${escape(name.join("|") || text)}">${text}</a>`;
          continue;
        }
        // A web link (FG's url class): the browser opens it (http and https only).
        if (linkClass === "url") {
          if (/^https?:\/\//i.test(recordname)) out += `<a class="book-link url" href="${escape(recordname)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
          else out += `<span class="book-link dead" data-kind="url">${text}</span>`;
          continue;
        }
        if (linkClass === "sound_context") {
          out += `<span class="book-link dead sound-context">${text}</span>`;
          continue;
        }
        const target = resolve(linkClass, recordname);
        if (target?.page) out += `<a class="book-link" data-book="${escape(target.book)}" data-page="${escape(target.page)}">${text}</a>`;
        else if (target?.file) out += `<a class="book-link picture" data-book="${escape(target.book)}" data-file="${escape(target.file)}" data-name="${escape(target.name)}">${text}</a>`;
        else if (target?.record) {
          out += `<a class="book-link record" data-book="${escape(target.book)}" data-record="${escape(target.record)}" data-kind="${escape(linkClass)}" data-name="${escape(target.name)}">${text}</a>`;
          // An encounter on a map: the map, beside it (the book keeps one map for many rooms; the page names it).
          const map = target.map;
          if (map) found?.push(map);
          if (map && !maps.has(map.file) && !String(formatted).includes(`"${map.path.split("@")[0]}@`)) {
            maps.add(map.file);
            const at = aroundOf(map.spots);
            out += `<a class="book-link picture encounter-map" data-book="${escape(map.book)}" data-file="${escape(map.file)}" data-name="${escape(map.name)}"${at ? ` data-at="${at}"` : ""}><b>Map: </b>${escape(map.name)}</a>`;
          }
        }
        else out += `<span class="book-link dead" data-kind="${escape(linkClass)}">${text}</span>`;
        continue;
      }
      const html = TAGS[tag];
      if (!html) {
        out += walk(child);
        continue;
      }
      const span = tag === "td" && /^\d+$/.test(child.getAttribute("colspan") || "") ? ` colspan="${child.getAttribute("colspan")}"` : "";
      const className = tag === "frame" ? ' class="frame"' : tag === "linklist" ? ' class="links"' : "";
      const inner = walk(child);
      out += tag === "linklist" ? `<ul${className}>${inner.replace(/(<a [^]*?<\/a>|<span class="book-link dead"[^>]*>[^]*?<\/span>)/g, "<li>$1</li>")}</ul>` : `<${html}${className}${span}>${inner}</${html}>`;
    }
    return out;
  };
  return walk(root);
}

// The first picture file anywhere under an FG image value (its layers).
function bitmapIn(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.bitmap === "string" && PICTURES.test(value.bitmap)) return value.bitmap;
  for (const inner of Object.values(value)) {
    const found = bitmapIn(inner);
    if (found) return found;
  }
  return "";
}

const byOrder = (object) => Object.values(object && typeof object === "object" ? object : {}).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

// also: more folders of modules (the books Kraken ships, content/modules).
// packsFolder: the GM's Kraken packs (Documents/Kraken VTT/Packs).
// modulesShown false: the modules in \`folder\` (Fantasy Grounds' modules folder) are not books on the shelf, only
// files to make packs from (files()); the shelf is the packs and the books Maelstrom ships.
function createBookShelf({ folder, cache = "", also = [], packsFolder = "", modulesShown = true }) {
  let known = null;
  let every = [];
  const opened = new Map(); // id -> the read book, the last few

  // The folders' own times: a book copied in or taken out changes them, so
  // the shelf reads again (a pack dropped into the packs folder shows at once). The packs folders' game folders
  // too (Packs/D&D 5E): a pack written into one (a module exported from a campaign) changes only its time.
  const folders = () => [folder, ...also, ...(packsFolder ? [packsFolder] : [])];
  const timeOf = (dir) => {
    try {
      return Math.round(fs.statSync(dir).mtimeMs);
    } catch {
      return 0;
    }
  };
  const gameFolders = (dir) => {
    try {
      return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => timeOf(path.join(dir, entry.name)));
    } catch {
      return [];
    }
  };
  const stamp = () => [...folders().map(timeOf), ...[...also, ...(packsFolder ? [packsFolder] : [])].flatMap(gameFolders)].join("|");
  let stamped = "";
  function load() {
    if (known) {
      const now = stamp();
      if (now === stamped) return known;
      known = null;
      opened.clear();
    }
    stamped = stamp();
    let saved = {};
    try {
      saved = cache ? JSON.parse(fs.readFileSync(cache, "utf8")) : {};
    } catch {
      /* first time */
    }
    const next = {};
    const entries = [];
    for (const dir of folders()) {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) entries.push({ entry, dir });
      } catch {
        /* a folder not there */
      }
    }
    // Packs are kept in a folder per game (Packs/AD&D 2E, Packs/Any..., and the packs Maelstrom ships the same way):
    // their packs too, two levels down.
    for (const packsRoot of [...also, ...(packsFolder ? [packsFolder] : [])]) {
      const walk = (dir, depth) => {
        let found = [];
        try {
          found = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of found) {
          if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "Wizards") continue;
          const sub = path.join(dir, entry.name);
          for (const inner of fs.readdirSync(sub, { withFileTypes: true })) if (inner.isFile() && /\.kpack$/i.test(inner.name)) entries.push({ entry: inner, dir: sub });
          if (depth < 2) walk(sub, depth + 1);
        }
      };
      walk(packsRoot, 1);
    }
    for (const { entry, dir } of entries) {
      const file = path.join(dir, entry.name);
      if (!(entry.isFile() && /\.(mod|kpack)$/i.test(entry.name)) && !(entry.isDirectory() && fs.existsSync(path.join(file, "definition.xml")))) continue;
      let stat;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      // A folder module (Kraken's own books) changes inside: its XML files' times say so.
      const inner = entry.isDirectory() ? ["definition.xml", "db.xml", "client.xml"].map((name) => (fs.existsSync(path.join(file, name)) ? Math.round(fs.statSync(path.join(file, name)).mtimeMs) : 0)).join(".") : "";
      // DESCRIBED: what a description holds (a new field reads every book again).
      const key = `${DESCRIBED}|${entry.name}|${stat.size}|${Math.round(stat.mtimeMs)}${inner ? `|${inner}` : ""}`;
      if (saved[key]) {
        next[key] = saved[key];
        continue;
      }
      try {
        const info = describe(file);
        if (info) next[key] = { ...info, file, mtime: stat.mtimeMs };
      } catch {
        /* an unreadable module is left out */
      }
    }
    if (cache) {
      try {
        fs.mkdirSync(path.dirname(cache), { recursive: true });
        fs.writeFileSync(cache, JSON.stringify(next));
      } catch {
        /* the list still works */
      }
    }
    // A book that is both a Kraken pack and an FG module is shown once: the
    // pack, unless the module is newer (the GM changed it since).
    every = Object.values(next);
    const books = new Map();
    const fgFolder = path.resolve(folder) + path.sep;
    for (const info of every) {
      if (!modulesShown && !info.pack && path.resolve(info.file).startsWith(fgFolder)) continue;
      const other = books.get(info.name);
      if (!other) books.set(info.name, info);
      else {
        const [pack, module] = info.pack ? [info, other] : [other, info];
        if (pack.pack && !module.pack) books.set(info.name, packs.preferPack(pack.file, module.file) === pack.file ? pack : module);
      }
    }
    known = new Map([...books.values()].map((info) => [info.id, info]));
    return known;
  }

  // A book by its id (its file), or by its title or FG name, as the GM says it.
  const info = (id) => {
    const wanted = String(id ?? "");
    const all = load();
    return all.get(wanted) ?? [...all.values()].find((item) => item.title === wanted || item.name === wanted) ?? null;
  };
  // FG names a module by its own name (after "@"); Kraken by its file.
  const byName = (name) => [...load().values()].find((item) => item.name === name || item.id === name) ?? null;

  function read(id) {
    const found = info(id);
    if (!found) throw new Error(`No book "${id}".`);
    if (opened.has(found.id)) return opened.get(found.id);
    const module = readModule(found.file);
    const records = new Map(module.records.map((record) => [record.data.fgPath, record]));
    const book = { info: found, module, records };
    opened.set(found.id, book);
    if (opened.size > 3) opened.delete(opened.keys().next().value);
    return book;
  }

  // A record by its FG path: one of its own, or one kept inside another (a
  // 5E book's races in reference.racedata: reference.racedata.dwarf), found
  // under the container's categories too.
  function findRecord(book, fgPath) {
    const own = book.records.get(fgPath);
    if (own) return own;
    const [inner, moduleName = book.info.name] = String(fgPath).split("@");
    const cut = inner.lastIndexOf(".");
    if (cut < 0) return null;
    const container = book.records.get(`${inner.slice(0, cut)}@${moduleName}`);
    const key = inner.slice(cut + 1);
    const data = container?.data;
    if (!data || typeof data !== "object") return null;
    const groups = [data, ...[].concat(data.category ?? []).flatMap((group) => (group && typeof group === "object" ? [group] : []))];
    for (const group of groups) {
      const child = group[key];
      const title = child && typeof child === "object" ? child.name ?? child.description ?? child.title : null;
      if (typeof title === "string" && title.trim()) {
        const kind = inner.slice(0, cut).split(".").pop().replace(/data$|lists?$/, "") || container.type;
        return { id: `${container.id}:${key}`, type: kind, name: title.trim(), data: { ...child, fgPath: `${inner}@${moduleName}` } };
      }
    }
    return null;
  }
  // A link's target: a page of this book or another, or a picture.
  function resolver(book) {
    return (linkClass, recordname) => {
      const [inner, moduleName] = String(recordname).split("@");
      const other = moduleName ? byName(moduleName) : book.info;
      if (!other) return null;
      const page = /^reference\.refmanualdata\.([^.]+)$/.exec(inner);
      if (page) return { book: other.id, page: page[1] };
      if (/^image\./.test(inner) || linkClass === "imagewindow") {
        const target = other.id === book.info.id ? book : (() => {
          try {
            return read(other.id);
          } catch {
            return null;
          }
        })();
        const record = target?.records.get(`${inner}@${other.name}`);
        const file = bitmapIn(record?.data?.image);
        return file ? { book: other.id, file, name: record.name } : null;
      }
      // Any other record the book holds (a creature, spell, item, class, encounter, table): opened as FG opens it.
      const target = other.id === book.info.id ? book : (() => {
        try {
          return read(other.id);
        } catch {
          return null;
        }
      })();
      const record = target ? findRecord(target, `${inner}@${other.name}`) : null;
      if (!record) return null;
      return { book: other.id, record: record.data.fgPath, name: record.name, ...(linkClass === "battle" ? { map: encounterMap(target, other, record) } : {}) };
    };
  }
  // The map an encounter's creatures stand on (FG's maplink: the image it places them on), so the
  // page that links the encounter links its map too: { book, file, name, path, spots } or null.
  // spots: where they stand, FG's way ([x, y] from the picture's centre, y down), on that map only.
  // The picture layer's place in FG: 0 in an older module (origin the picture's centre), half the picture in a
  // newer one (origin its top left). Spots and pins are read from it.
  function baseOf(image) {
    const layers = [].concat(image?.layers?.layer ?? []).filter((layer) => layer && typeof layer === "object");
    const matrix = String(layers.find((layer) => layer.type === "image" && layer.bitmap)?.matrix ?? "").split(",").map(Number);
    return matrix.length === 16 && Number.isFinite(matrix[12]) && Number.isFinite(matrix[13]) ? { x: matrix[12], y: matrix[13] } : { x: 0, y: 0 };
  }
  function encounterMap(book, info, record) {
    const values = (object) => Object.values(object && typeof object === "object" ? object : {});
    let found = null;
    for (const row of values(record.data?.npclist))
      for (const spot of values(row?.maplink)) {
        const [inner, moduleName] = String(spot?.imageref?.recordname ?? "").split("@");
        // "@*" (FG: this module) is the book's own map.
        if (!inner || (moduleName && moduleName !== "*" && moduleName !== info.name)) continue;
        const path = `${inner.replace(/\.image$/, "")}@${info.name}`;
        if (!found) {
          const image = book.records.get(path);
          const file = bitmapIn(image?.data?.image);
          if (!file) continue;
          found = { book: info.id, file, name: image.name, path: image.data.fgPath ?? path, spots: [], base: baseOf(image.data.image) };
        }
        const x = Number(spot.imagex) - found.base.x;
        const y = Number(spot.imagey) + found.base.y;
        if (path === found.path && Number.isFinite(x) && Number.isFinite(y)) found.spots.push([x, y]);
      }
    return found;
  }
  // A section's map: the one its pages' encounters stand on most (a room with no encounter of its own,
  // "3. Food Storage Room", still names the map of its lair). Kept per book and section.
  const sectionMaps = new WeakMap();
  function sectionMap(book, c, s) {
    if (!sectionMaps.has(book)) sectionMaps.set(book, new Map());
    const kept = sectionMaps.get(book);
    const key = `${c}.${s}`;
    if (kept.has(key)) return kept.get(key);
    const section = byOrder(byOrder(chaptersOf(indexOf(book)?.data))[c]?.subchapters)[s];
    const resolve = resolver(book);
    const counts = new Map();
    for (const entry of byOrder(section?.refpages)) {
      const own = /refmanualdata\.([^.@]+)/.exec(entry.listlink?.recordname ?? "")?.[1];
      const data = (own && book.records.get(`reference.refmanualdata.${own}@${book.info.name}`)?.data) || entry;
      const words = [data.text, ...byOrder(data.blocks).flatMap((block) => [block.text, block.text2])].filter((text) => typeof text === "string").join(" ");
      for (const match of words.matchAll(/class="battle"\s+recordname="([^"]+)"/g)) {
        const map = resolve("battle", match[1].replaceAll("&amp;", "&"))?.map;
        if (map) counts.set(map.path, { map, spots: [...(counts.get(map.path)?.spots ?? []), ...map.spots] });
      }
    }
    // Only a section of one map (a lair): one whose encounters stand on several maps names none.
    // Its spots: every encounter of the section (the map opens on the whole lair).
    const one = counts.size === 1 ? [...counts.values()][0] : null;
    const best = one ? { ...one.map, spots: one.spots } : null;
    kept.set(key, best);
    return best;
  }
  // Every page's pin on the book's maps (FG's shortcuts to its pages, the map's keys): page id ->
  // { book, file, name, path, spots: [[x, y]] }, x and y from the picture's centre, y down (the shortcut's
  // matrix is y up). A page pinned on several maps: the one with the most walls (the battle map, not the
  // overview of the same place). Kept per book.
  const bookPins = new WeakMap();
  function pinsOf(book) {
    if (bookPins.has(book)) return bookPins.get(book);
    const found = new Map();
    for (const record of book.records.values()) {
      if (record.type !== "image") continue;
      const file = bitmapIn(record.data?.image);
      if (!file) continue;
      const walls = (JSON.stringify(record.data.image).match(/"points"/g) ?? []).length;
      const base = baseOf(record.data.image);
      const walk = (value) => {
        if (!value || typeof value !== "object") return;
        if (value.type === "shortcut" && value.shortcut && typeof value.shortcut === "object") {
          const page = /refmanualdata\.([^.@]+)/.exec(String(value.shortcut.record ?? value.shortcut.recordname ?? ""))?.[1];
          const matrix = String(value.matrix ?? "").split(",").map(Number);
          if (page && (found.get(page)?.walls ?? -1) < walls && matrix.length === 16 && Number.isFinite(matrix[12]) && Number.isFinite(matrix[13]))
            found.set(page, { book: book.info.id, file, name: record.name, path: record.data.fgPath, spots: [[matrix[12] - base.x, -(matrix[13] - base.y)]], walls });
        }
        for (const inner of Object.values(value)) walk(inner);
      };
      walk(record.data.image);
    }
    bookPins.set(book, found);
    return found;
  }
  // Where a page sits in the contents: [chapter, section] or null.
  function placeOf(book, pageId) {
    const at = /^~(\d+)\.(\d+)\.\d+$/.exec(String(pageId));
    if (at) return [Number(at[1]), Number(at[2])];
    const chapters = byOrder(chaptersOf(indexOf(book)?.data));
    for (let c = 0; c < chapters.length; c++) {
      const sections = byOrder(chapters[c].subchapters);
      for (let s = 0; s < sections.length; s++)
        if (byOrder(sections[s].refpages).some((entry) => /refmanualdata\.([^.@]+)/.exec(entry.listlink?.recordname ?? "")?.[1] === String(pageId))) return [c, s];
    }
    return null;
  }
  // One record of a book, by its FG path (a link's target): its name, type and fields.
  function bookRecord(id, fgPath) {
    const book = read(id);
    const record = findRecord(book, String(fgPath ?? ""));
    if (!record) return null;
    return { id: record.data.fgPath, type: record.type, name: record.name, source: book.info.title, data: record.data };
  }

  function publicInfo(id) {
    const found = info(id);
    if (!found) return null;
    const { file, playerBook, mtime, ...rest } = found;
    return { ...rest, adventure: isAdventure(rest), forPlayers: !isAdventure(rest) && forPlayers(rest) };
  }

  return {
    folder,
    // Every module, as FG's Modules window: by category, with its cover.
    list: () => [...load().values()].map(({ file, playerBook, mtime, ...rest }) => ({ ...rest, adventure: isAdventure(rest), forPlayers: !isAdventure(rest) && forPlayers(rest) })).sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title)),
    info: publicInfo,
    // Where a module is on this computer (to load its records).
    file: (id) => info(id)?.file ?? null,
    // Every book file found, packs and FG modules alike, before the two are
    // put together (for the Packs list: which modules have a pack).
    files: () => {
      load();
      return every.map((item) => ({ ...item }));
    },
    refresh() {
      known = null;
      opened.clear();
    },
    // A book's cover: kept on disk once read (beside the shelf's list), so the
    // Books window never opens every module again to show them.
    cover(id) {
      const found = info(id);
      if (!found?.cover) return null;
      const mime = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif" }[path.extname(found.cover).toLowerCase()];
      let kept = "";
      if (cache && mime) {
        try {
          const stat = fs.statSync(found.file);
          const name = require("crypto").createHash("sha1").update(`${found.file}|${stat.size}|${Math.round(stat.mtimeMs)}|${found.cover}`).digest("hex");
          kept = path.join(path.dirname(cache), "book-covers", `${name}${path.extname(found.cover).toLowerCase()}`);
          if (fs.existsSync(kept)) return { bytes: fs.readFileSync(kept), mime };
        } catch {
          kept = "";
        }
      }
      const picture = modulePicture(found.cover, found.file);
      if (picture && kept) {
        try {
          fs.mkdirSync(path.dirname(kept), { recursive: true });
          fs.writeFileSync(kept, picture.bytes);
        } catch {
          /* read from the module next time */
        }
      }
      return picture;
    },
    // The cover as a list's icon: a big picture (a map standing in for a cover) made small once, and kept.
    async coverSmall(id) {
      const picture = this.cover(id);
      if (!picture || picture.bytes.length <= 300 * 1024) return picture;
      const found = info(id);
      const stat = fs.statSync(found.file);
      const name = require("crypto").createHash("sha1").update(`small|${found.file}|${stat.size}|${Math.round(stat.mtimeMs)}|${found.cover}`).digest("hex");
      const kept = cache ? path.join(path.dirname(cache), "book-covers", `${name}.webp`) : "";
      if (kept && fs.existsSync(kept)) return { bytes: fs.readFileSync(kept), mime: "image/webp" };
      try {
        const bytes = await require("sharp")(picture.bytes, { limitInputPixels: 200_000_000 }).resize(192, 192, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
        if (kept) {
          fs.mkdirSync(path.dirname(kept), { recursive: true });
          fs.writeFileSync(kept, bytes);
        }
        return { bytes, mime: "image/webp" };
      } catch {
        return picture;
      }
    },
    // The book's contents: chapters, their sections, and the pages in each.
    contents(id) {
      const book = read(id);
      const index = indexOf(book);
      // A page is its own record (reference.refmanualdata.<id>), or (FG's newer layout) kept inside the contents
      // itself, with its blocks: then it is named by where it sits, "~chapter.section.page".
      const chapters = byOrder(chaptersOf(index?.data)).map((chapter, c) => ({
        name: String(chapter.name ?? ""),
        sections: byOrder(chapter.subchapters).map((section, s) => ({
          name: String(section.name ?? ""),
          pages: byOrder(section.refpages)
            .map((page, p) => {
              const own = /refmanualdata\.([^.@]+)/.exec(page.listlink?.recordname ?? "")?.[1] ?? "";
              const inline = page.blocks || typeof page.text === "string";
              const id = own && (book.records.has(`reference.refmanualdata.${own}@${book.info.name}`) || !inline) ? own : inline ? `~${c}.${s}.${p}` : "";
              return { id, name: String(page.name ?? ""), keywords: String(page.keywords ?? "") };
            })
            .filter((page) => page.id),
        })),
      }));
      const pictures = [...book.records.values()]
        .filter((record) => record.type === "image")
        .map((record) => ({ name: record.name, category: record.data.fgCategory ?? "", file: bitmapIn(record.data.image) }))
        .filter((item) => item.file);
      // Every picture file the book holds (an art pack's pictures too, record or not).
      const assets = (book.module.images ?? []).filter((name) => PICTURES.test(name));
      return { ...publicInfo(id), chapters, pictures, assets, media: mediaOf(book) };
    },
    // A book's sound or video file (the GM's Assets play them).
    media(id, file) {
      const found = info(id);
      return found && MEDIA.test(String(file)) ? modulePicture(String(file), found.file) : null;
    },
    // One page: its blocks, text as safe HTML, pictures by file.
    page(id, pageId) {
      const book = read(id);
      // Its own record, or a page kept inside the contents (contents() names those "~chapter.section.page").
      let record = book.records.get(`reference.refmanualdata.${pageId}@${book.info.name}`);
      const at = /^~(\d+)\.(\d+)\.(\d+)$/.exec(String(pageId));
      if (!record && at) {
        const chapter = byOrder(chaptersOf(indexOf(book)?.data))[Number(at[1])];
        const section = byOrder(chapter?.subchapters)[Number(at[2])];
        const entry = byOrder(section?.refpages)[Number(at[3])];
        if (entry) record = { name: String(entry.name ?? ""), data: entry };
      }
      // A link to a page by its own name whose words are kept inside the contents: found there.
      if (!record && !at) {
        for (const chapter of byOrder(chaptersOf(indexOf(book)?.data)))
          for (const section of byOrder(chapter.subchapters))
            for (const entry of byOrder(section.refpages))
              if (!record && /refmanualdata\.([^.@]+)/.exec(entry.listlink?.recordname ?? "")?.[1] === String(pageId) && (entry.blocks || typeof entry.text === "string")) record = { name: String(entry.name ?? ""), data: entry };
      }
      if (!record) throw new Error(`No page "${pageId}" in ${book.info.title}.`);
      const resolve = resolver(book);
      const blocks = [];
      const data = record.data;
      // Each block as FG's reference page has it (CoreRPG's six: text, two columns, header, image, image with
      // text beside it on the left or right), its words both as formatted text (to edit) and as HTML (to read).
      let n = 0;
      const blockId = () => `b${++n}`;
      const words = (value) => (typeof value === "string" ? value : "");
      const onMaps = []; // the maps this page's encounters stand on
      const textBlock = (formatted, frame = "") => ({ id: blockId(), kind: "text", text: formatted, html: toHtml(formatted, resolve, onMaps), frame });
      if (typeof data.text === "string") blocks.push(textBlock(data.text));
      for (const block of byOrder(data.blocks)) {
        const type = String(block.blocktype ?? "");
        const align = String(block.align ?? "").split(",").map((part) => part.trim());
        const file = bitmapIn(block.image) || (typeof block.picture === "string" ? block.picture : "");
        const link = block.imagelink?.recordname ? resolve("imagewindow", block.imagelink.recordname) : null;
        const picture = { file, caption: String(block.caption ?? ""), scale: Math.min(200, Math.max(10, Number(block.scale) || 100)), name: link?.name ?? String(block.caption ?? "") };
        const side = /left$/.test(type) || align[1] === "left" ? "left" : /right$/.test(type) || align[1] === "right" ? "right" : "";
        if (type === "header") blocks.push({ id: blockId(), kind: "header", text: words(block.text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
        else if (["dualtext", "dualsidebar", "sidebarleft", "sidebarright"].includes(type) && (words(block.text).trim() || words(block.text2).trim())) blocks.push({ id: blockId(), kind: "twocol", text: words(block.text), html: toHtml(words(block.text), resolve, onMaps), text2: words(block.text2), html2: toHtml(words(block.text2), resolve, onMaps) });
        else if (file && side && words(block.text).trim()) blocks.push({ id: blockId(), kind: "textpic", side, ...picture, text: words(block.text), html: toHtml(words(block.text), resolve, onMaps) });
        else {
          if (file) blocks.push({ id: blockId(), kind: "picture", ...picture, align: align[0] || "center" });
          for (const key of ["text", "text2"]) if (words(block[key]).trim()) blocks.push(textBlock(block[key], String(block.frame ?? "")));
        }
      }
      // The page's own pin on a map (FG's shortcut to it, a map key "3. Food Storage Room"): its map, opened on it.
      const pin = pinsOf(book).get(String(pageId)) ?? null;
      const linksTo = (map) => blocks.some((block) => `${block.text ?? ""}${block.text2 ?? ""}`.includes(`"${map.path.split("@")[0]}@`) || `${block.html ?? ""}${block.html2 ?? ""}`.includes(`data-file="${escape(map.file)}"`));
      const addMap = (map) => {
        const text = `<linklist><link class="imagewindow" recordname="${escape(map.path)}"><b>Map: </b>${escape(map.name)}</link></linklist>`;
        blocks.unshift({ id: "map", kind: "text", text, html: toHtml(text, resolve), frame: "" });
      };
      if (pin) {
        if (!linksTo(pin)) addMap(pin);
      } else if (!blocks.some((block) => /encounter-map|data-kind="battle"/.test(`${block.html ?? ""}${block.html2 ?? ""}`))) {
        // A room with no pin and no encounter of its own: its section's map, first, so every room of a lair names its map.
        const place = placeOf(book, pageId);
        // A section with no encounters (The Ravine, The Inner Bailey): its chapter's map, when the chapter has only one.
        const chapterMaps = () => {
          const found = new Map();
          for (let s = 0; s < byOrder(byOrder(chaptersOf(indexOf(book)?.data))[place[0]]?.subchapters).length; s++) {
            const each = sectionMap(book, place[0], s);
            if (each) found.set(each.path, each);
          }
          return found.size === 1 ? [...found.values()][0] : null;
        };
        const map = place ? sectionMap(book, ...place) ?? chapterMaps() : null;
        if (map && !linksTo(map)) addMap(map);
        // The section's map (a lair's): opened on the whole lair. A chapter's: on the whole map.
        const own = place ? sectionMap(book, ...place) : null;
        if (own?.spots?.length) onMaps.push(own);
      }
      // Every link on the page to that map (the book's own "Map" links too) opens it there: data-at,
      // the page's pin, else its first encounter, else its lair. An encounter's own map link keeps its encounter's.
      const focus = pin ?? onMaps.find((map) => map.spots?.length);
      if (focus) {
        const at = aroundOf(focus.spots);
        const mark = (html) => html.replace(/<a class="book-link picture([^"]*)"([^>]*?) data-file="([^"]*)"([^>]*)>/g, (whole, more, before, file, after) => (file === escape(focus.file) && !/data-at=/.test(whole) ? `<a class="book-link picture${more}"${before} data-file="${file}"${after} data-at="${at}">` : whole));
        for (const block of blocks) {
          if (typeof block.html === "string") block.html = mark(block.html);
          if (typeof block.html2 === "string") block.html2 = mark(block.html2);
        }
      }
      return { book: book.info.id, id: pageId, name: record.name, blocks };
    },
    // A page the GM changed (kept with the campaign): its formatted words as HTML, resolved in this book.
    render(id, blocks) {
      const resolve = resolver(read(id));
      return blocks.map((block) => ({
        ...block,
        ...(typeof block.text === "string" && block.kind !== "header" ? { html: toHtml(block.text, resolve) } : {}),
        ...(typeof block.text2 === "string" ? { html2: toHtml(block.text2, resolve) } : {}),
      }));
    },
    record: bookRecord,
    // A story entry's formatted words as HTML, its links resolved in its book as a page's are (the Story window).
    html(id, formatted) {
      const book = read(id);
      return toHtml(String(formatted ?? ""), resolver(book), []);
    },
    // A picture from a book (a page's, or one of its maps).
    picture(id, file) {
      const found = info(id);
      return found && PICTURES.test(String(file)) ? modulePicture(String(file), found.file) : null;
    },
  };
}

// The games whose books are on the shelf (the campaign screen offers only these): a game is there when a pack made
// for it (not one for any game) that is not an adventure is installed: its rules, its monsters, its setting. A
// game's adventures alone do not make it playable. Worldbuilding needs no books.
function installedGames(infos, names) {
  const books = infos.filter((info) => info.kraken && info.kraken !== "Any" && !ANY.has(String(info.kraken).toLowerCase()) && !isAdventure(info));
  return names.filter((name) => name === "Worldbuilding" || books.some((info) => fitsRuleset(info, name)));
}

module.exports = { chaptersOf, createBookShelf, toHtml, fitsRuleset, forPlayers, isAdventure, describe, installedGames };
