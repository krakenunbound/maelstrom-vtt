// The Item Forge (5E): base items and templates merged into new campaign items.
//  - the SRD's "Weapon, +1, +2, or +3" on a Longsword: "Longsword, +2" at its rarity (Rare), Magic once, the
//    longsword's damage, cost and mastery kept; on the sheet it hits and harms at +2
//  - "Armor, +1, +2, or +3" on Chain Mail: AC 17 worn
//  - two templates on one base ("Longsword of Warning, +1"); two bases at once; a spell on a Spell Scroll
//    ("Spell Scroll of Fireball", Uncommon); two templates alone make an item template
//  - a book's records by { book, path }; a mix of kinds is said; a player may not forge; a game without a forge
//    says so
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { derive } from "../shared/dnd5e/rules.mjs";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const content = require("../electron/content.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const agent = server.agent;
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
try {
  importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Magic Items"));
  importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Player's Rules"));
  const find = (type, name) => {
    const record = agent.records.list({ type }).find((row) => row.name === name);
    assert(record, `the book's ${name}`);
    return record;
  };
  const longsword = find("item", "Longsword");
  const plus = find("item", "Weapon, +1, +2, or +3");

  // 1. A +2 longsword, and what it does on a sheet.
  const forged = await tool("kraken_item_forge", { base: [longsword.id], templates: [plus.id], bonus: 2 });
  const sword = agent.records.get(forged.made[0].id);
  const s = sword.data;
  assert(sword.type === "item" && sword.name === "Longsword, +2" && s.bonus === 2 && s.rarity === "Rare" && s.damage === "1d8 Slashing" && s.mastery === "Sap" && s.cost === "15 GP" && !forged.problems.length, `the +2 longsword: ${JSON.stringify({ name: sword.name, ...s, description: undefined })}`);
  assert(s.properties.split(", ").filter((p) => /^magic$/i.test(p)).length === 1 && /Versatile/.test(s.properties) && /Weapon Notes/.test(s.description) && !s.fgPath && sword.visibility === "gm", `its properties and notes: ${s.properties}`);
  const hero = (item) => derive({ abilities: { strength: { score: 16 }, dexterity: { score: 12 } }, prof: 2, inventorylist: { "id-00001": { ...item, carried: 2 } } });
  const plain = Object.values(hero(longsword.data).attacks)[0];
  const magic = Object.values(hero(s).attacks)[0];
  assert(magic.bonus === plain.bonus + 2 && magic.damage === "1d8+5" && plain.damage === "1d8+3", `the sheet's attack: ${JSON.stringify([plain, magic])}`);
  done.push("Longsword, +2 (Rare), +2 on the sheet");

  // 2. +1 chain mail: AC 17.
  const mail = await tool("kraken_item_forge", { base: [find("item", "Chain Mail").id], templates: [find("item", "Armor, +1, +2, or +3").id] });
  const armor = agent.records.get(mail.made[0].id);
  assert(armor.name === "Chain Mail, +1" && armor.data.rarity === "Rare" && armor.data.ac === 16 && armor.data.stealth === "Disadvantage", `the chain mail: ${JSON.stringify({ name: armor.name, ...armor.data, description: undefined })}`);
  assert(hero(armor.data).ac.total === 17, `AC worn: ${JSON.stringify(hero(armor.data).ac)}`);
  done.push("Chain Mail, +1 is AC 17");

  // 3. Two templates, two bases, a spell scroll, templates alone.
  const warning = find("item", "Weapon of Warning");
  const both = await tool("kraken_item_forge", { base: [longsword.id, find("item", "Dagger").id], templates: [plus.id, warning.id] });
  const names = both.made.map((row) => row.name);
  assert(names.join("|") === "Longsword of Warning, +1|Dagger of Warning, +1" && both.made[0].data.rarity === "Uncommon" && both.made[0].data.attunement === "Requires Attunement", `two templates on two bases: ${JSON.stringify(both.made.map((row) => [row.name, row.data.rarity, row.data.attunement]))}`);
  const tongue = await tool("kraken_item_forge", { base: [find("item", "Scimitar").id], templates: [find("item", "Flame Tongue").id] });
  assert(tongue.made[0].name === "Scimitar [Flame Tongue]" && tongue.made[0].data.rarity === "Rare" && tongue.made[0].data.cost === "25 GP", `the flame tongue: ${JSON.stringify([tongue.made[0].name, tongue.made[0].data.rarity, tongue.made[0].data.cost])}`);
  const scroll = await tool("kraken_item_forge", { base: [find("item", "Spell Scroll").id], templates: [find("spell", "Fireball").id] });
  const sc = scroll.made[0];
  assert(sc.name === "Spell Scroll of Fireball" && sc.data.rarity === "Uncommon" && /Fireball Notes/.test(sc.data.description) && /150 feet/.test(sc.data.description), `the scroll: ${JSON.stringify([sc.name, sc.data.rarity])}`);
  const alone = await tool("kraken_item_forge", { templates: [plus.id, warning.id] });
  assert(alone.made[0].type === "itemtemplate" && alone.made[0].name === "Weapon of Warning, +1", `templates alone: ${JSON.stringify([alone.made[0].type, alone.made[0].name])}`);
  done.push("two templates on two bases, Spell Scroll of Fireball, a template from templates");

  // 4. A book's records by path; a mix of kinds; a player; a game with no forge.
  let read = 0;
  const readBook = async (book, at) => {
    read += 1;
    const record = agent.records.list({}).find((row) => row.data?.fgPath === `${at}@${book}`);
    return record ? { ...record, id: "" } : null;
  };
  const booked = await content.itemForge(agent, { base: [{ book: "SRD 5.2.1 Player's Rules", path: "item.longsword" }], templates: [{ book: "SRD 5.2.1 Magic Items", path: "item.weapon12or3" }], bonus: 3 }, readBook);
  assert(read === 2 && booked.made[0].name === "Longsword, +3" && booked.made[0].data.rarity === "Very Rare", `from the books: ${JSON.stringify(booked.made[0]?.name)}`);
  const mixed = await tool("kraken_item_forge", { base: [find("item", "Chain Mail").id], templates: [plus.id] });
  assert(/not the templates' kind \(weapon\)/.test(mixed.problems.join()), `a mix is said: ${JSON.stringify(mixed.problems)}`);
  let refused = "";
  try {
    await content.message(agent, { type: "item-forge", base: [longsword.id], templates: [plus.id] }, { seat: { role: "player", name: "Ann" } });
  } catch (error) {
    refused = String(error);
  }
  assert(/GM's/.test(refused), "a player may not forge");
  let none = "";
  try {
    await content.itemForge({ ...agent, ruleset: () => "Worldbuilding" }, { base: [longsword.id], templates: [plus.id] });
  } catch (error) {
    none = String(error);
  }
  assert(/no Item Forge/.test(none), `Worldbuilding has no forge: ${none}`);
  done.push("book records by path, a mix said, the GM's alone, only where the game has a forge");
} finally {
  await server.stop?.();
}

// 5. A book's item templates load with its records, and a campaign whose active book was loaded before (no
//    templates yet) gets them once, its items kept.
{
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const os = await import("node:os");
  const { zipSync, strToU8 } = await import("fflate");
  const { createBookShelf } = require("../electron/books.cjs");
  const dir = mkdtempSync(path.join(os.tmpdir(), "kraken-forge-"));
  const db = '<root><item><id-00001><name type="string">Longsword</name><type type="string">Weapon</type><damage type="string">1d8 slashing</damage><cost type="string">15 gp</cost></id-00001></item><itemtemplate><id-00001><name type="string">Weapon, +1</name><type type="string">Weapon</type><bonus type="number">1</bonus><rarity type="string">Uncommon</rarity></id-00001></itemtemplate></root>';
  writeFileSync(path.join(dir, "Forge Book.mod"), zipSync({ "definition.xml": strToU8("<root><name>Forge Book</name><ruleset>5E</ruleset></root>"), "db.xml": strToU8(db) }));
  const books = createBookShelf({ folder: dir });
  const tool2 = async (table, args) => {
    const result = await callTool("kraken_item_forge", args, { table: () => table });
    if (result.isError) throw new Error(result.content[0].text);
    return JSON.parse(result.content[0].text);
  };
  const first = createTableServer({ books, ruleset: "D&D 5E" });
  await first.agent.activateBook("Forge Book");
  const kinds = (table) => table.agent.records.list({ source: "Forge Book" }).map((record) => record.type).sort().join();
  assert(kinds(first) === "item,itemtemplate", `made active, its item and its template: ${kinds(first)}`);
  // As saved before item templates loaded: the item only.
  const saved = first.persisted();
  saved.records = saved.records.filter((record) => record.type !== "itemtemplate");
  const again = createTableServer({ books, ruleset: "D&D 5E", saved });
  const item = again.agent.records.list({ source: "Forge Book" }).find((record) => record.type === "item");
  assert(kinds(again) === "item", `reopened as it was saved: ${kinds(again)}`);
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert(kinds(again) === "item,itemtemplate" && again.agent.records.get(item.id)?.name === "Longsword", `the template added once, the item kept: ${kinds(again)}`);
  const made = await content.itemForge(again.agent, { base: [item.id], templates: [again.agent.records.list({ type: "itemtemplate" })[0].id] });
  assert(made.made[0].name === "Longsword, +1", `forged from the book: ${made.made[0].name}`);
  // The book's own records by their paths (the tool's { book, path }), read from the book.
  const byPath = await tool2(again, { base: [{ book: "Forge Book", path: "item.id-00001@Forge Book" }], templates: [{ book: "Forge Book", path: "itemtemplate.id-00001@Forge Book" }] });
  assert(byPath.made[0].name === "Longsword, +1" && byPath.made[0].data.bonus === 1, `by book and path: ${JSON.stringify(byPath.made[0]?.name)}`);
  done.push("a book's templates load, and once for a campaign saved before");
}
console.log(`ok item forge: ${done.join("; ")}`);
process.exit(0);
