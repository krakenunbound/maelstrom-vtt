// A Legacy (2014) class's starting equipment, as the 5E rules give it (the SRD 5.1's Starting Equipment, our own
// table): a 2014 book's class record holds no kit, so the ruleset carries it (FG's 5E ruleset does the same). Items are
// found by name in the active books (the first of the names a book uses: "Leather" or "Leather Armor"); a "kind" is
// any item of that sort the books hold (any simple weapon, a holy symbol). Rolling starting wealth instead gives no kit.
//
// Each class: { included: [entry], choices: [[option, option...]] }; an option is [entry...]; an entry is
// { item: [names], count } or { kind, count }.

const item = (names, count = 1) => ({ item: [].concat(names), count });
const kind = (what, count = 1) => ({ kind: what, count });
const LEATHER = ["Leather", "Leather Armor"];
const BOLTS = ["Crossbow Bolts (20)", "Bolts (20)", "Crossbow Bolt"];
const ARROWS = ["Arrows (20)", "Arrow"];
const LIGHT_CROSSBOW = ["Crossbow, Light", "Light Crossbow"];

export const LEGACY_KITS = {
  barbarian: {
    included: [item("Explorer's Pack"), item("Javelin", 4)],
    choices: [[[item("Greataxe")], [kind("martial melee weapon")]], [[item("Handaxe", 2)], [kind("simple weapon")]]],
  },
  bard: {
    included: [item(LEATHER), item("Dagger")],
    choices: [
      [[item("Rapier")], [item("Longsword")], [kind("simple weapon")]],
      [[item("Diplomat's Pack")], [item("Entertainer's Pack")]],
      [[item("Lute")], [kind("musical instrument")]],
    ],
  },
  cleric: {
    included: [item("Shield"), kind("holy symbol")],
    choices: [
      [[item("Mace")], [item("Warhammer")]],
      [[item("Scale Mail")], [item(LEATHER)], [item("Chain Mail")]],
      [[item(LIGHT_CROSSBOW), item(BOLTS)], [kind("simple weapon")]],
      [[item("Priest's Pack")], [item("Explorer's Pack")]],
    ],
  },
  druid: {
    included: [item(LEATHER), item("Explorer's Pack"), kind("druidic focus")],
    choices: [
      [[item(["Shield", "Wooden Shield"])], [kind("simple weapon")]],
      [[item("Scimitar")], [kind("simple melee weapon")]],
    ],
  },
  fighter: {
    included: [],
    choices: [
      [[item("Chain Mail")], [item(LEATHER), item("Longbow"), item(ARROWS)]],
      [[kind("martial weapon"), item("Shield")], [kind("martial weapon", 2)]],
      [[item(LIGHT_CROSSBOW), item(BOLTS)], [item("Handaxe", 2)]],
      [[item("Dungeoneer's Pack")], [item("Explorer's Pack")]],
    ],
  },
  monk: {
    included: [item("Dart", 10)],
    choices: [[[item("Shortsword")], [kind("simple weapon")]], [[item("Dungeoneer's Pack")], [item("Explorer's Pack")]]],
  },
  paladin: {
    included: [item("Chain Mail"), kind("holy symbol")],
    choices: [
      [[kind("martial weapon"), item("Shield")], [kind("martial weapon", 2)]],
      [[item("Javelin", 5)], [kind("simple melee weapon")]],
      [[item("Priest's Pack")], [item("Explorer's Pack")]],
    ],
  },
  ranger: {
    included: [item("Longbow"), item("Quiver"), item(ARROWS)],
    choices: [
      [[item("Scale Mail")], [item(LEATHER)]],
      [[item("Shortsword", 2)], [kind("simple melee weapon", 2)]],
      [[item("Dungeoneer's Pack")], [item("Explorer's Pack")]],
    ],
  },
  rogue: {
    included: [item(LEATHER), item("Dagger", 2), item("Thieves' Tools")],
    choices: [
      [[item("Rapier")], [item("Shortsword")]],
      [[item("Shortbow"), item("Quiver"), item(ARROWS)], [item("Shortsword")]],
      [[item("Burglar's Pack")], [item("Dungeoneer's Pack")], [item("Explorer's Pack")]],
    ],
  },
  sorcerer: {
    included: [item("Dagger", 2)],
    choices: [
      [[item(LIGHT_CROSSBOW), item(BOLTS)], [kind("simple weapon")]],
      [[item("Component Pouch")], [kind("arcane focus")]],
      [[item("Dungeoneer's Pack")], [item("Explorer's Pack")]],
    ],
  },
  warlock: {
    included: [item(LEATHER), kind("simple weapon"), item("Dagger", 2)],
    choices: [
      [[item(LIGHT_CROSSBOW), item(BOLTS)], [kind("simple weapon")]],
      [[item("Component Pouch")], [kind("arcane focus")]],
      [[item("Scholar's Pack")], [item("Dungeoneer's Pack")]],
    ],
  },
  wizard: {
    included: [item("Spellbook")],
    choices: [
      [[item("Quarterstaff")], [item("Dagger")]],
      [[item("Component Pouch")], [kind("arcane focus")]],
      [[item("Scholar's Pack")], [item("Explorer's Pack")]],
    ],
  },
};

const lower = (value) => String(value ?? "").toLowerCase();
const magic = (record) => /magic/i.test(String(record.data?.properties ?? "")) || Boolean(record.data?.rarity && !/common|mundane/i.test(String(record.data.rarity)));
// The items of a kind the books hold: by the item's sort (FG's subtype: "Simple Melee Weapons", "Holy Symbol").
const KIND = {
  "simple weapon": (record) => lower(record.data?.type) === "weapon" && /^simple/.test(lower(record.data?.subtype)),
  "simple melee weapon": (record) => lower(record.data?.type) === "weapon" && /^simple melee/.test(lower(record.data?.subtype)),
  "martial weapon": (record) => lower(record.data?.type) === "weapon" && /^martial/.test(lower(record.data?.subtype)),
  "martial melee weapon": (record) => lower(record.data?.type) === "weapon" && /^martial( melee)? weapons?$/.test(lower(record.data?.subtype)),
  "musical instrument": (record) => /musical instrument/.test(lower(record.data?.subtype)),
  "holy symbol": (record) => /holy symbol/.test(lower(record.data?.subtype)),
  "arcane focus": (record) => /arcane focus/.test(lower(record.data?.subtype)),
  "druidic focus": (record) => /druidic focus/.test(lower(record.data?.subtype)),
};
export const KIND_LABEL = { "simple weapon": "any simple weapon", "simple melee weapon": "any simple melee weapon", "martial weapon": "any martial weapon", "martial melee weapon": "any martial melee weapon", "musical instrument": "any musical instrument", "holy symbol": "a holy symbol", "arcane focus": "an arcane focus", "druidic focus": "a druidic focus" };

/**
 * A 2014 class's kit, its entries found in the books' items. null when the class has none here (or is a 2024 one:
 * its book holds its kits).
 * @returns {{ included: Entry[], choices: Entry[][][] } | null}
 *   Entry: { name, count, data } (an item) or { kind, label, count, options: names } (the player picks one)
 */
export function legacyKit(cls, items = []) {
  if (!cls || String(cls.data?.version ?? "") === "2024") return null;
  const table = LEGACY_KITS[lower(cls.name)];
  if (!table) return null;
  const usable = items.filter((record) => !magic(record) && String(record.data?.version ?? "") !== "2024");
  const resolve = (entry) => {
    if (entry.kind) {
      const options = [...new Set(usable.filter(KIND[entry.kind] ?? (() => false)).map((record) => record.name))].sort();
      return { kind: entry.kind, label: KIND_LABEL[entry.kind] ?? entry.kind, count: entry.count, options };
    }
    for (const name of entry.item) {
      const found = usable.find((record) => lower(record.name) === lower(name));
      if (found) return { name: found.name, count: entry.count, data: found.data };
    }
    return { name: entry.item[0], count: entry.count, data: { name: entry.item[0] } };
  };
  return { included: table.included.map(resolve), choices: table.choices.map((choice) => choice.map((option) => option.map(resolve))) };
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

// The words a book's item answers to in an equipment sentence: its name without what is in brackets ("Incense (One
// Block)": incense), and a "Clothes, Common" or "Pot, Iron" turned round ("common clothes", "iron pot"); clothes by
// their sort alone too ("vestments", "a costume").
function itemWords(name) {
  const bare = lower(name).replace(/\s*\([^)]*\)/g, "").trim();
  const out = new Set([bare]);
  const comma = /^([^,]+),\s*(.+)$/.exec(bare);
  if (comma) {
    out.add(`${comma[2]} ${comma[1]}`);
    if (comma[1] === "clothes") out.add(comma[2]);
  }
  return [...out].filter((word) => word.length > 2);
}
const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
// The kinds a background names, the player picks the item ("a holy symbol", "a set of artisan's tools (one of your
// choice)", "a musical instrument", "a set of bone dice or deck of cards").
const BACKGROUND_KINDS = [
  [/holy symbol/, "holy symbol"],
  [/artisan'?s tools/, "artisan's tools"],
  [/musical instrument/, "musical instrument"],
  [/gaming set|bone dice|deck of cards|playing card/, "gaming set"],
];
KIND["artisan's tools"] = (record) => /artisan'?s tools/.test(lower(record.data?.subtype)) && !/^artisan'?s tools$/.test(lower(record.name));
KIND["gaming set"] = (record) => /gaming set/.test(lower(record.data?.subtype));
KIND_LABEL["artisan's tools"] = "artisan's tools of your choice";
KIND_LABEL["gaming set"] = "a gaming set";

/**
 * A Legacy (2014) background's kit, read from its equipment sentence ("A holy symbol (a gift...), a prayer book or
 * prayer wheel, 5 sticks of incense, vestments, a set of common clothes, and a belt pouch containing 15 gp"): each
 * part's item found in the books by its words (the longest that fits), its count ("5 sticks"), a kind to pick; a
 * part naming nothing the books sell (a letter, a trophy) gives nothing. Its coin is the background's gold.
 */
export function backgroundKit2014(text, items = []) {
  const sentence = String(text ?? "").replace(/<[^>]+>/g, " ");
  if (!sentence.trim()) return null;
  // Parts at the top level (a bracket's commas stay inside: "a trophy (a dagger, broken blade, or banner)").
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of sentence) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  const usable = items.filter((record) => !magic(record) && String(record.data?.version ?? "") !== "2024");
  const words = usable.flatMap((record) => itemWords(record.name).map((word) => ({ word, record })));
  const included = [];
  for (const raw of parts) {
    // A bracket listing alternatives ("(a dagger, broken blade, or piece of a banner)") is a story, not gear; one
    // naming the thing ("a belaying pin (club)") is kept.
    const part = lower(raw).replace(/^\s*and\s+/, "").replace(/\(([^)]*)\)/g, (whole, inside) => (/,|\bor\b|choice/.test(inside) ? " " : ` ${inside} `)).trim();
    if (!part) continue;
    const kindFound = BACKGROUND_KINDS.find(([pattern]) => pattern.test(part));
    if (kindFound) {
      const options = [...new Set(usable.filter(KIND[kindFound[1]]).map((record) => record.name))].sort();
      if (options.length) included.push({ kind: kindFound[1], label: KIND_LABEL[kindFound[1]], count: 1, options });
      continue;
    }
    const hits = words.filter(({ word }) => new RegExp(`(^|[^a-z'])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?($|[^a-z'])`).test(part));
    if (!hits.length) continue;
    const best = hits.sort((a, b) => b.word.length - a.word.length)[0].record;
    const lead = /^(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/.exec(part)?.[1] ?? "1";
    // "50 feet of silk rope" is one rope.
    const measured = /^\S+\s+(feet|foot|ft|pounds?|ounces?|gallons?)\b/.test(part);
    const count = measured ? 1 : /^\d+$/.test(lead) ? Number(lead) : NUMBER_WORDS[lead] ?? 1;
    if (!included.some((entry) => entry.name === best.name)) included.push({ name: best.name, count: /pack|set|clothes/.test(lower(best.name)) ? 1 : count, data: best.data });
  }
  return included.length ? { included, choices: [] } : null;
}
