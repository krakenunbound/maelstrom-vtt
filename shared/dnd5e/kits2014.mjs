// A Legacy (2014) starting kit, read from the book's own words (FG's 5E store books keep no kit records for a 2014 class
// or background, only their text):
//  - a class's "You start with the following equipment ..." list: each "(a) ... or (b) ..." line a choice, each other
//    line what it always gives;
//  - a background's equipment sentence ("A holy symbol, a prayer book, 5 sticks of incense, vestments ... and a belt
//    pouch containing 15 gp").
// Each part is found in the active books' items by its words (the longest that fits: "a light crossbow" is "Crossbow,
// Light", "20 arrows" one "Arrows (20)"), with its count ("two handaxes", "five javelins"); a kind the player picks
// ("any simple weapon", "a holy symbol", "any other musical instrument") lists what the books sell of that sort; a part
// naming nothing the books sell (a letter, a trophy) gives nothing. Rolling starting wealth instead gives no kit.
//
// A kit: { included: [entry], choices: [[option, option...]] }; an option is [entry...]; an entry is
// { name, count, data } (an item) or { kind, label, count, options: names } (the player picks one).

const lower = (value) => String(value ?? "").toLowerCase();
const magic = (record) => /magic/i.test(String(record.data?.properties ?? "")) || Boolean(record.data?.rarity && !/common|mundane/i.test(String(record.data.rarity)));
const usableItems = (items) => items.filter((record) => !magic(record) && String(record.data?.version ?? "") !== "2024");

// The sorts of item a kit may leave to the player, by the item's sort in the books (FG's subtype: "Simple Melee
// Weapons", "Holy Symbol"); the words that name each in a kit's text, most particular first.
const weapon = (record) => lower(record.data?.type) === "weapon";
const subtype = (record) => lower(record.data?.subtype);
const KINDS = [
  { kind: "simple melee weapon", words: /simple melee weapons?/, label: "any simple melee weapon", test: (r) => weapon(r) && /^simple melee/.test(subtype(r)) },
  { kind: "simple ranged weapon", words: /simple ranged weapons?/, label: "any simple ranged weapon", test: (r) => weapon(r) && /^simple ranged/.test(subtype(r)) },
  { kind: "simple weapon", words: /simple weapons?/, label: "any simple weapon", test: (r) => weapon(r) && /^simple/.test(subtype(r)) },
  { kind: "martial melee weapon", words: /martial melee weapons?/, label: "any martial melee weapon", test: (r) => weapon(r) && /^martial( melee)? weapons?$/.test(subtype(r)) },
  { kind: "martial ranged weapon", words: /martial ranged weapons?/, label: "any martial ranged weapon", test: (r) => weapon(r) && /^martial ranged/.test(subtype(r)) },
  { kind: "martial weapon", words: /martial weapons?/, label: "any martial weapon", test: (r) => weapon(r) && /^martial/.test(subtype(r)) },
  { kind: "musical instrument", words: /musical instrument/, label: "any musical instrument", test: (r) => /musical instrument/.test(subtype(r)) },
  { kind: "holy symbol", words: /holy symbol/, label: "a holy symbol", test: (r) => /holy symbol/.test(subtype(r)) },
  { kind: "arcane focus", words: /arcane focus/, label: "an arcane focus", test: (r) => /arcane focus/.test(subtype(r)) },
  { kind: "druidic focus", words: /druidic focus/, label: "a druidic focus", test: (r) => /druidic focus/.test(subtype(r)) },
  { kind: "artisan's tools", words: /artisan'?s tools/, label: "artisan's tools of your choice", test: (r) => /artisan'?s tools/.test(subtype(r)) && !/^artisan'?s tools$/.test(lower(r.name)) },
  { kind: "gaming set", words: /gaming set|bone dice|deck of cards|playing card/, label: "a gaming set", test: (r) => /gaming set/.test(subtype(r)) },
];

// The words a book's item answers to: its name without what is in brackets ("Incense (One Block)": incense), a
// "Clothes, Common" or "Crossbow, Light" turned round ("common clothes", "light crossbow"), clothes by their sort alone
// ("vestments"), a bundle by its last word ("Crossbow Bolts (20)": bolts).
function itemWords(name) {
  const bare = lower(name).replace(/\s*\([^)]*\)/g, "").trim();
  const out = new Set([bare]);
  const comma = /^([^,]+),\s*(.+)$/.exec(bare);
  if (comma) {
    out.add(`${comma[2]} ${comma[1]}`);
    if (comma[1] === "clothes") out.add(comma[2]);
  }
  if (/\(\d+\)/.test(name)) out.add(bare.split(/\s+/).at(-1));
  return [...out].filter((word) => word.length > 2);
}
const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20 };
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Splits at the top level (a bracket's commas stay inside: "a trophy (a dagger, broken blade, or banner)").
function topLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    const rest = text.slice(at);
    const hit = depth === 0 ? separator.exec(rest) : null;
    if (hit && hit.index === 0) {
      parts.push(current);
      current = "";
      at += hit[0].length - 1;
    } else current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

// One part's entry: a kind to pick, or an item of the books with its count; null when the books sell no such thing.
function entryOf(raw, usable, words) {
  // A bracket listing alternatives ("(a dagger, broken blade, or piece of a banner)") is a story, not gear; one naming
  // the thing ("a belaying pin (club)") is kept; "(if proficient)" says nothing of the item.
  const part = lower(raw)
    .replace(/^\s*(and|or)\s+/, "")
    .replace(/\(([^)]*)\)/g, (whole, inside) => (/,|\bor\b|choice|proficient/.test(inside) ? " " : ` ${inside} `))
    .replace(/\s+/g, " ")
    .trim();
  if (!part) return null;
  const lead = /^(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twenty)\b/.exec(part)?.[1] ?? "1";
  const counted = /^\d+$/.test(lead) ? Number(lead) : NUMBER_WORDS[lead] ?? 1;
  const kind = KINDS.find((entry) => entry.words.test(part));
  if (kind) {
    const options = [...new Set(usable.filter(kind.test).map((record) => record.name))].sort();
    return options.length ? { kind: kind.kind, label: kind.label, count: counted, options } : null;
  }
  const hits = words.filter(({ word }) => new RegExp(`(^|[^a-z'])${escape(word)}(e?s)?($|[^a-z'])`).test(part));
  if (!hits.length) return null;
  const best = hits.sort((a, b) => b.word.length - a.word.length)[0].record;
  // "50 feet of silk rope" is one rope; "20 arrows" one Arrows (20); a pack, a set, clothes come one.
  const measured = /^\S+\s+(feet|foot|ft|pounds?|ounces?|gallons?)\b/.test(part);
  const bundle = Number(/\((\d+)\)/.exec(best.name)?.[1] ?? 0);
  const count = measured || /pack|set|clothes/.test(lower(best.name)) ? 1 : bundle && counted % bundle === 0 ? counted / bundle : counted;
  return { name: best.name, count, data: best.data };
}

function reader(items) {
  const usable = usableItems(items);
  const words = usable.flatMap((record) => itemWords(record.name).map((word) => ({ word, record })));
  return (text) => topLevel(text, /^(,\s*and\s+|,\s*|\s+and\s+)/).map((part) => entryOf(part, usable, words)).filter(Boolean);
}
const plainText = (html) => String(html ?? "").replace(/<li>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ");

/**
 * A Legacy (2014) class's kit, read from its text's "You start with the following equipment" list. null for a 2024
 * class (its book holds its kits) or a class whose text gives none.
 */
export function legacyKit(cls, items = []) {
  if (!cls || String(cls.data?.version ?? "") === "2024") return null;
  const html = String(cls.data?.text ?? "");
  const at = html.search(/you start with the following equipment/i);
  if (at < 0) return null;
  const end = html.indexOf("</list>", at);
  const lines = plainText(html.slice(at, end < 0 ? at + 3000 : end))
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean);
  const read = reader(items);
  const kit = { included: [], choices: [] };
  for (const line of lines) {
    if (/^\([a-z]\)/i.test(line)) {
      const options = line
        .split(/\([a-z]\)/i)
        .map((option) => option.replace(/,?\s*(or)?\s*$/i, "").trim())
        .filter(Boolean)
        .map(read)
        .filter((entries) => entries.length);
      // A line whose options are the same sort of thing (two packs) with more after the last ("(b) an explorer's
      // pack, shield and a holy symbol"): the rest comes with either, as the printed book has it on a line of its own.
      // "(a) chain mail or (b) leather, longbow, and 20 arrows" is a bundle: heavy and light armour are not one sort.
      const sortOf = (entry) => (entry.kind ? `kind:${entry.kind}` : `${lower(entry.data?.type)}/${lower(entry.data?.subtype)}`);
      const last = options.at(-1);
      if (options.length > 1 && last.length > 1 && options.slice(0, -1).every((option) => option.length === 1 && sortOf(option[0]) === sortOf(last[0]))) kit.included.push(...last.splice(1));
      if (options.length) kit.choices.push(options);
    } else kit.included.push(...read(line));
  }
  return kit.included.length || kit.choices.length ? kit : null;
}

/**
 * A Legacy (2014) background's kit, read from its equipment sentence. Its coin is the background's gold.
 */
export function backgroundKit2014(text, items = []) {
  const sentence = plainText(text);
  if (!sentence.trim()) return null;
  const included = [];
  for (const entry of reader(items)(sentence)) if (entry.kind || !included.some((other) => other.name === entry.name)) included.push(entry);
  return included.length ? { included, choices: [] } : null;
}

// An entry as words: "2 Handaxe", "any simple weapon".
export const entryText = (entry) => (entry.kind ? (entry.count > 1 ? `${entry.count} × ${entry.label}` : entry.label) : entry.count > 1 ? `${entry.count} ${entry.name}` : entry.name);

/**
 * The items a 2014 kit gives for the player's choices: picks { "c0": option index, "c0:1": the item picked for the
 * option's second entry (a kind), "i2": the item picked for the second included entry }.
 * @returns {{ items: { name: string; count: number; data: any }[]; open: string[] }} open: what is still to choose
 */
export function legacyKitItems(kit, picks = {}, items = []) {
  const out = [];
  const open = [];
  const byName = (name) => items.find((record) => lower(record.name) === lower(name));
  const take = (entry, key, what) => {
    if (!entry.kind) return out.push({ name: entry.name, count: entry.count, data: entry.data });
    const chosen = picks[key];
    if (!chosen || !entry.options.includes(chosen)) return open.push(what);
    out.push({ name: chosen, count: entry.count, data: byName(chosen)?.data ?? { name: chosen } });
  };
  kit.included.forEach((entry, index) => take(entry, `i${index}`, entry.label));
  kit.choices.forEach((choice, index) => {
    const picked = Number(picks[`c${index}`]);
    if (!Number.isInteger(picked) || !choice[picked]) return open.push(`Choice ${index + 1}`);
    choice[picked].forEach((entry, at) => take(entry, `c${index}:${at}`, `Choice ${index + 1}: ${entry.label}`));
  });
  return { items: out, open };
}
