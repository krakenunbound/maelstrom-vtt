// FG's Import Item, for 5E: items pasted as text become item records, as the books keep them.
//  - every magic item of the SRD 5.2.1 Magic Items book printed as the book prints it (name, type and rarity line,
//    text), all in one paste, read back: the same names, types, subtypes, rarities and attunement
//  - every weapon and armor of the Player's Rules as the books' tables (pipes, and tabs as a copied table has),
//    read back: the same damage, properties, mastery, AC and Dex cap, Strength, Stealth, weight and cost
//  - imported, a longsword attacks on a 5E sheet as the book's does; the GM alone imports; a game without an item
//    reader says so
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseItems } from "../shared/dnd5e/itemblock.mjs";
import { derive } from "../shared/dnd5e/rules.mjs";
import { plainOf } from "../shared/text/formatted.mjs";

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
try {
  importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Magic Items"));
  importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Player's Rules"));
  const lines = (html) => String(html ?? "").split(/<\/p>|<br\s*\/?>|<\/tr>|<\/h>/i).map((line) => plainOf(line).replace(/\s+/g, " ").trim()).filter(Boolean);

  // 1. The magic items, printed and pasted at once.
  const magic = agent.records.list({ type: "item" }).filter((record) => record.data.fgPath?.includes("Magic Items"));
  const printed = magic.map((record) => [record.name, ...lines(record.data.description)].join("\n")).join("\n");
  const read = parseItems({ text: printed });
  const byName = new Map(read.items.map((item) => [item.name, item.data]));
  const misses = [];
  for (const record of magic) {
    const back = byName.get(record.name);
    const x = record.data;
    if (!back) misses.push(`${record.name}: not found`);
    else if (back.type !== x.type || back.subtype !== (x.subtype ?? "") || back.rarity !== x.rarity || (back.attunement ?? "") !== (x.attunement ?? "")) misses.push(`${record.name}: ${JSON.stringify([back.type, back.subtype, back.rarity, back.attunement])} vs ${JSON.stringify([x.type, x.subtype, x.rarity, x.attunement])}`);
  }
  assert(magic.length > 200 && read.items.length === magic.length, `${read.items.length} read of ${magic.length}`);
  assert(!misses.length, `${misses.length} magic items read back differently:\n${misses.slice(0, 12).join("\n")}`);
  const tongue = byName.get("Flame Tongue");
  assert(/<p><i>Weapon \(Any Melee Weapon\), Rare \(Requires Attunement\)<\/i><\/p><p>While holding/.test(tongue.description) && tongue.properties === "Magic", `its text: ${tongue.description.slice(0, 160)}`);
  done.push(`all ${magic.length} SRD magic items read back from one paste`);

  // 2. The weapons and armor, as tables.
  const gear = agent.records.list({ type: "item" }).filter((record) => record.data.fgPath?.includes("Player's Rules") && /^(Weapon|Armor)$/.test(record.data.type));
  const groups = Map.groupBy(gear, (record) => `${record.data.type}|${record.data.subtype}`);
  const wrong = [];
  let count = 0;
  let tabs = false;
  for (const [group, records] of groups) {
    const [type, subtype] = group.split("|");
    const armor = type === "Armor";
    const acCell = (x) => (/shield/i.test(subtype) ? `+${x.ac}` : `${x.ac}${/^no/i.test(x.dexbonus) ? "" : ` + Dex modifier${/max/i.test(x.dexbonus) ? ` (max ${/\d/.exec(x.dexbonus)[0]})` : ""}`}`);
    const cols = armor ? ["Armor", "Armor Class (AC)", "Strength", "Stealth", "Weight", "Cost"] : ["Name", "Damage", "Properties", "Mastery", "Weight", "Cost"];
    const sep = tabs ? "\t" : " | ";
    tabs = !tabs;
    const row = (record) => {
      const x = record.data;
      const weight = x.weight === 0.5 ? "½ lb." : x.weight ? `${x.weight} lb.` : "—";
      return (armor ? [record.name, acCell(x), x.strength || "—", x.stealth || "—", weight, x.cost] : [record.name, x.damage, x.properties || "—", x.mastery, weight, x.cost]).join(sep);
    };
    const list = [type, subtype, cols.join(sep), ...records.map(row)].join("\n");
    const text = records.map((record) => [record.name, ...lines(record.data.description)].join("\n")).join("\n");
    const back = parseItems({ list, text });
    for (const record of records) {
      const x = record.data;
      const y = back.items.find((item) => item.name === record.name)?.data;
      count += 1;
      if (!y) {
        wrong.push(`${record.name}: not read`);
        continue;
      }
      const same = (a, b) => String(a ?? "").replace(/^[-—]$/, "") === String(b ?? "").replace(/^[-—]$/, "");
      const fields = armor ? ["ac", "strength", "stealth", "weight", "cost"] : ["damage", "properties", "mastery", "weight", "cost"];
      const off = fields.filter((field) => !same(y[field], x[field]));
      if (armor && !/shield/i.test(subtype) && (/^no/i.test(x.dexbonus) ? y.dexbonus !== "No" : /max/i.test(x.dexbonus) ? !/max/i.test(y.dexbonus) : y.dexbonus !== "Yes")) off.push(`dexbonus ${y.dexbonus} vs ${x.dexbonus}`);
      if (!y.description || plainOf(y.description).slice(0, 40) !== lines(x.description).join(" ").slice(0, 40)) off.push("description");
      if (y.type !== type || y.subtype !== subtype) off.push("type");
      if (off.length) wrong.push(`${record.name}: ${off.map((field) => `${field} ${JSON.stringify(y[field])} vs ${JSON.stringify(x[field])}`).join(", ")}`);
    }
  }
  assert(count > 40, `the gear: ${count}`);
  assert(!wrong.length, `${wrong.length} of ${count} read back differently:\n${wrong.slice(0, 12).join("\n")}`);
  done.push(`all ${count} SRD weapons and armor read back from their tables`);

  // 3. Imported.
  const made = JSON.parse((await callTool("kraken_item_import", { list: "Weapon\nMartial Melee Weapons\nName | Damage | Properties | Mastery | Weight | Cost\nLongsword | 1d8 Slashing | Versatile (1d10) | Sap | 3 lb. | 15 GP", text: "Longsword\nA long, straight blade." }, { table: () => server })).content[0].text);
  const sword = agent.records.get(made.made[0].id);
  assert(sword.type === "item" && sword.visibility === "gm" && sword.data.description === "<p>A long, straight blade.</p>" && sword.data.weight === 3, `the imported longsword: ${JSON.stringify(sword.data)}`);
  const book = agent.records.list({ type: "item" }).find((record) => record.name === "Longsword" && record.source);
  const swing = (item) => Object.values(derive({ abilities: { strength: { score: 16 } }, prof: 2, inventorylist: { "id-00001": { ...item, carried: 2 } } }).attacks)[0];
  assert(JSON.stringify(swing(sword.data)) === JSON.stringify(swing(book.data)), `it attacks as the book's: ${JSON.stringify([swing(sword.data), swing(book.data)])}`);
  let refused = "";
  try {
    await content.message(agent, { type: "item-import", text: "x" }, { seat: { role: "player", name: "Ann" } });
  } catch (error) {
    refused = String(error);
  }
  assert(/GM's/.test(refused), "a player may not import");
  let none = "";
  try {
    await content.itemImport({ ...agent, ruleset: () => "Worldbuilding" }, { text: "x" });
  } catch (error) {
    none = String(error);
  }
  assert(/no item import/.test(none), `Worldbuilding has none: ${none}`);
  done.push("imported, it attacks as the book's; the GM's alone, only where the game reads items");
} finally {
  await server.stop?.();
}
console.log(`ok item import: ${done.join("; ")}`);
process.exit(0);
