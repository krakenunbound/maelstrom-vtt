// 5E items pasted as text (FG's Import Item, scripts/manager_import_item.lua), into item records as the books keep
// theirs. Two ways, as FG's window has two boxes:
//  - a table: its type on the first line ("Weapon"), its subtype on the second ("Martial Melee Weapons"), the column
//    names on the third ("Name | Damage | Properties | Mastery | Weight | Cost"), a row per item; columns split by
//    "|" or a tab (a table copied from a page or PDF). The descriptions box gives each its text: a line naming an
//    item (or "<h>Name</h>"), then its words.
//  - magic items as the books print them, no table: the name, then "Weapon (Any Melee Weapon), Rare (Requires
//    Attunement)", then the text; as many as are pasted.
// Beyond FG's: the 2024 armor table's "Armor Class (AC)" ("11 + Dex modifier (max 2)") into AC and the Dex cap;
// "½ lb." weights; the rarity from the text (FG's sets common); a name's ", +1" is the bonus; magic items' blocks.

const escape = (/** @type {string} */ text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plainLine = (/** @type {string} */ line) => line.replace(/<\/?(p|b|i|h)>/g, "").trim();
const paragraphs = (/** @type {string[]} */ lines) => lines.map((line) => `<p>${escape(plainLine(line))}</p>`).join("");
const key = (/** @type {string} */ name) => plainLine(name).replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();

// The table's column names, as the record's fields.
const COLUMNS = [
  [/^(name|item|armor|weapon|gear|tool|potion|mount|vehicle)s?$/i, "name"],
  [/^(armor class|ac)(\s*\(ac\))?$/i, "ac"],
  [/^damage$/i, "damage"],
  [/^properties$/i, "properties"],
  [/^mastery$/i, "mastery"],
  [/^strength$/i, "strength"],
  [/^stealth$/i, "stealth"],
  [/^weight$/i, "weight"],
  [/^(cost|price)$/i, "cost"],
  [/^rarity$/i, "rarity"],
  [/^bonus$/i, "bonus"],
  [/^speed$/i, "speed"],
  [/^(carrying )?capacity$/i, "capacity"],
];
const columnOf = (/** @type {string} */ name) => COLUMNS.find(([pattern]) => pattern.test(name.trim()))?.[1] ?? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
const RARITY = /\b(common|uncommon|rare|very rare|legendary|artifact|rarity varies)\b/i;
const MAGIC_TYPE = /^(armor|weapon|wondrous item|potion|ring|rod|scroll|staff|wand|ammunition)\b/i;
const titled = (/** @type {string} */ word) => word.replace(/\b\w/g, (letter) => letter.toUpperCase());

/** "8 lb.", "½ lb.", "1/4 lb.", "—" into pounds. */
export function weightOf(text) {
  const words = String(text ?? "").replace(/½/g, ".5").replace(/¼/g, ".25");
  const fraction = /(\d+)\s*\/\s*(\d+)/.exec(words);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const number = /\d*\.?\d+/.exec(words);
  return number ? Number(number[0]) : 0;
}

/** An armor's "Armor Class (AC)" cell: "11 + Dex modifier (max 2)" is AC 11, Dex capped at 2; "+2" a shield's. */
function armorClass(text) {
  const cell = String(text ?? "");
  const ac = Number(/\d+/.exec(cell)?.[0] ?? 0);
  const dexbonus = /dex/i.test(cell) ? (/max\s*(\d+)/i.exec(cell) ? `Max ${/max\s*(\d+)/i.exec(cell)?.[1]}` : "Yes") : /^\s*\+/.test(cell) ? "-" : "No";
  return { ac, dexbonus };
}

/** "Weapon (Any Melee Weapon), Rare (Requires Attunement)" into type, subtype, rarity, attunement; null if it is not one. */
export function magicLine(line) {
  const text = plainLine(line);
  if (!MAGIC_TYPE.test(text) || !RARITY.test(text)) return null;
  // The first comma outside brackets with a rarity after it ("Armor (Any Medium or Heavy, Except Hide Armor), Rare").
  let depth = 0;
  let at = -1;
  for (let i = 0; i < text.length && at < 0; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") depth -= 1;
    else if (text[i] === "," && depth === 0 && RARITY.test(text.slice(i))) at = i;
  }
  if (at < 0) return null;
  const left = text.slice(0, at);
  const right = text.slice(at).replace(/^,\s*/, "");
  const sub = /\(([^)]*)\)/.exec(left)?.[1] ?? "";
  const attune = /\((requires attunement[^)]*)\)/i.exec(right)?.[1] ?? "";
  return { type: titled(left.replace(/\s*\([^)]*\)/, "").trim()), subtype: sub, rarity: right.replace(/\s*\(requires attunement[^)]*\)/i, "").trim(), attunement: attune ? attune[0].toUpperCase() + attune.slice(1) : "" };
}

/**
 * @param {{ list?: string; text?: string }} input
 * @returns {{ items: { name: string; data: Record<string, any> }[]; problems: string[] }}
 */
export function parseItems({ list = "", text = "" } = {}) {
  const problems = [];
  const lines = (/** @type {string} */ block) =>
    String(block ?? "")
      .replace(/\r/g, "")
      .replace(/<\/h>/g, "</h>\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, "").replace(/^\s+/, ""))
      .filter(Boolean);
  const rows = lines(list);
  const words = lines(text);
  /** @type {{ name: string; data: Record<string, any> }[]} */
  const items = [];
  const withBonus = (/** @type {Record<string, any>} */ data) => {
    const bonus = /,\s*\+(\d)$/.exec(String(data.name ?? ""));
    if (bonus && !data.bonus) data.bonus = Number(bonus[1]);
    return data;
  };

  if (rows.length) {
    // The table.
    if (rows.length < 4) throw new Error("A table: its type, its subtype, the column names (Name | Cost | ...), then a row per item.");
    const [type, subtype, header, ...body] = rows;
    const split = (/** @type {string} */ row) => (row.includes("|") ? row.split("|") : row.split("\t")).map((cell) => cell.trim());
    const columns = split(header).map(columnOf);
    if (!columns.includes("name")) columns[0] = "name";
    for (const row of body) {
      const cells = split(row);
      if (cells.length < 2 || !cells[0]) continue;
      /** @type {Record<string, any>} */
      const data = { name: cells[columns.indexOf("name")] ?? cells[0], type: plainLine(type), subtype: plainLine(subtype), version: "2024" };
      columns.forEach((column, index) => {
        const cell = cells[index] ?? "";
        if (column === "name" || cell === "") return;
        if (column === "weight") data.weight = weightOf(cell);
        else if (column === "ac") Object.assign(data, /armor/i.test(type) ? armorClass(cell) : { ac: Number(/\d+/.exec(cell)?.[0] ?? 0) });
        else if (column === "bonus") data.bonus = Number(/\d+/.exec(cell)?.[0] ?? 0);
        else data[column] = /^[—–-]$/.test(cell) ? "" : cell;
      });
      data.rarity ||= "Common";
      if (/armor/i.test(type) && data.strength) data.strength = String(data.strength).replace(/^str\s*/i, "");
      items.push({ name: data.name, data: withBonus(data) });
    }
    // Their descriptions: a line naming one of them starts its text.
    const byName = new Map(items.map((item) => [key(item.name), item]));
    /** @type {{ name: string; data: Record<string, any> } | null} */
    let current = null;
    /** @type {Map<any, string[]>} */
    const said = new Map();
    for (const line of words) {
      const heading = /^<h>(.*)<\/h>$/.exec(line)?.[1] ?? line;
      const found = byName.get(key(heading));
      if (found && (line.startsWith("<h>") || heading.length < 80)) {
        current = found;
        said.set(found, []);
      } else if (current) said.get(current)?.push(line);
    }
    for (const [item, text] of said) item.data.description = paragraphs(text);
    const unnamed = words.length && !said.size;
    if (unnamed) problems.push("No description names an item of the table (a line with the item's name starts its text).");
    if (!items.length) problems.push("No rows under the column names.");
    return { items, problems };
  }

  // Magic items as printed: a name, then the type and rarity line.
  for (let index = 0; index < words.length; index += 1) {
    const found = magicLine(words[index + 1] ?? "");
    if (found && !magicLine(words[index])) {
      const name = plainLine(/^<h>(.*)<\/h>$/.exec(words[index])?.[1] ?? words[index]);
      const body = [];
      let next = index + 2;
      while (next < words.length && !(magicLine(words[next + 1] ?? "") && !magicLine(words[next]))) body.push(words[next++]);
      /** @type {Record<string, any>} */
      const data = { name, type: found.type, subtype: found.subtype, rarity: found.rarity, version: "2024", description: `<p><i>${escape(plainLine(words[index + 1]))}</i></p>${paragraphs(body)}` };
      if (found.attunement) data.attunement = found.attunement;
      if (/^(weapon|armor|ammunition)$/i.test(found.type)) data.properties = "Magic";
      items.push({ name, data: withBonus(data) });
      index = next - 1;
    }
  }
  if (!items.length) throw new Error(text.trim() ? "No item found: a magic item's name, then a line like \"Weapon (Longsword), Rare (Requires Attunement)\"; or paste a table." : "Paste a table of items, or magic items' text.");
  return { items, problems };
}
