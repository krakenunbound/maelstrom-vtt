// FG's module export (/export, scripts/manager_export.lua): the campaign's own records, whole kinds or chosen ones,
// written into a Maelstrom pack (.kpack, Maelstrom's module) in the packs folder, under the game's folder, so any
// campaign of that game (or of any game) can make it active as a book.
//  - records keep the kinds a book's records have: the campaign's story becomes story entries (its pages as text),
//    its encounters, parcels and tables the book's, characters pregenerated characters
//  - links between exported records (an encounter's creatures, a table's results, links in text) point into the
//    pack; links to anything else are kept as they are
//  - pictures stay where they are (a book's "images/x.webp@Book", the art library's): the pack names them
//  - the name, title, category, author; for this game or any game; whether the players may read it
// A pack this did not make (a converted book) is never written over.
const fs = require("fs");
const path = require("path");
const { zipSync, strToU8 } = require("fflate");
const packs = require("./packs.cjs");

// The kinds a campaign record may be exported as, and what each is kept as in the book (shared/packs/exportable.mjs).
const { BOOK_TYPE, EXPORTABLE: KINDS } = require("../shared/packs/exportable.mjs");
const EXPORTABLE = new Set(KINDS);
const FROM = "campaign-export";

const escape = (text) => String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// A story's pages as FG's formatted text: text as it is, a header as a heading, pictures and pages named.
function storyText(data) {
  if (!Array.isArray(data.blocks)) return String(data.text ?? "");
  return data.blocks
    .map((block) => {
      if (block.kind === "header") return `<h>${escape(block.text)}</h>`;
      if (block.kind === "separator") return "<p>* * *</p>";
      const words = [block.text, block.kind === "columns" ? block.text2 : ""].filter(Boolean).join("");
      const linked = block.link?.label ? `<p><i>${escape(block.link.label)}</i></p>` : "";
      return `${linked}${words}`;
    })
    .join("");
}

/**
 * @param {{ records: any[]; name: string; title?: string; category?: string; author?: string; ruleset: string; anyGame?: boolean; forPlayers?: boolean; folder?: string }} input
 */
function exportPack({ records, name, title, category, author, ruleset, anyGame = false, forPlayers = false, folder = packs.packFolder() }) {
  const packName = String(name ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 100);
  if (!packName) throw new Error("Give the module a name.");
  const chosen = records.filter((record) => EXPORTABLE.has(record.type) && !record.source);
  if (!chosen.length) throw new Error("Nothing to export: choose some of the campaign's own records.");
  const game = anyGame ? "Any" : ruleset;
  const home = packs.gameFolder(folder, game);
  const target = path.join(home, packs.fileName(packName));
  if (fs.existsSync(target)) {
    let made = "";
    try {
      made = packs.readManifest(target).from?.kind ?? "";
    } catch {
      /* not a pack Maelstrom can read: not this one's either */
    }
    if (made !== FROM) throw new Error(`There is already a book ${path.basename(target)} that was not exported from a campaign: choose another name.`);
  }
  const bookId = path.basename(target, packs.EXTENSION);
  const prefix = packName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";
  // Each record's place in the pack, by kind: npc.id-00001@<name>.
  const counts = {};
  const placed = chosen.map((record) => {
    const type = BOOK_TYPE[record.type] ?? record.type;
    counts[type] = (counts[type] ?? 0) + 1;
    return { record, type, fgPath: `${type}.id-${String(counts[type]).padStart(5, "0")}@${packName}` };
  });
  // Links to exported records point into the pack: a record name (an encounter's creature, a table's result)
  // becomes its path; a Maelstrom link to a record opens the book's record.
  const rewrite = (json) => {
    let out = json;
    for (const { record, fgPath } of placed) {
      out = out.split(`"recordname":"${record.id}"`).join(`"recordname":"${fgPath}"`);
      out = out.split(`"record":"${record.id}"`).join(`"record":"${bookId}|${fgPath}"`);
      out = out.split(encodeURIComponent(`"record":"${record.id}"`)).join(encodeURIComponent(`"record":"${bookId}|${fgPath}"`));
    }
    return out;
  };
  const out = placed.map(({ record, type, fgPath }) => {
    const { fgPath: _old, ...data } = record.data ?? {};
    if (record.type === "story") data.text = storyText(data);
    return {
      id: `${prefix}:${fgPath.split("@")[0]}`,
      type,
      name: record.name,
      visibility: forPlayers ? "all" : "gm",
      source: packName,
      data: JSON.parse(rewrite(JSON.stringify({ ...data, fgPath, fgCategory: String(record.data?.category ?? data.fgCategory ?? "") }))),
    };
  });
  const hasStory = out.some((record) => record.type === "encounter");
  const manifest = {
    format: packs.FORMAT,
    version: packs.VERSION,
    name: packName,
    title: String(title ?? "").trim().slice(0, 120) || packName,
    category: String(category ?? "").trim().slice(0, 60) || "Campaign Exports",
    ruleset: game,
    // A players' book is a book they may read; else an adventure (its story) or the GM's book.
    kind: forPlayers ? "rules" : hasStory ? "adventure" : "other",
    forPlayers: Boolean(forPlayers),
    thumbnail: "",
    contents: packs.contentsOf(out),
    author: String(author ?? "").trim().slice(0, 120),
    cover: "",
    hasBook: false,
    hasStory,
    records: out.length,
    pictures: [],
    made: new Date().toISOString(),
    from: { kind: FROM, ruleset: "" },
  };
  fs.mkdirSync(home, { recursive: true });
  const temporary = `${target}.part`;
  fs.writeFileSync(temporary, zipSync({ "kraken-pack.json": strToU8(JSON.stringify(manifest, null, 1)), "records.json": strToU8(JSON.stringify(out)) }, { level: 6 }));
  fs.renameSync(temporary, target);
  return { file: target, book: bookId, name: packName, ruleset: game, records: out.length, contents: manifest.contents };
}

module.exports = { exportPack, EXPORTABLE, BOOK_TYPE };
