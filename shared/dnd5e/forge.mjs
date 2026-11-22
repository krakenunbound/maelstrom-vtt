// 5E's Item Forge (FG's forge.magicitem, scripts/manager_forge_item.lua): base items and templates (magic item
// templates, or any item or spell used as one) merged into new items. The rules follow FG's:
//  - each base item gets every template in turn; with no base item the first template is the base and the
//    result is a template itself
//  - type and subtype fill in when empty; a weapon or armor template adds its properties and Magic; a weapon
//    template's damage is added ("plus"); armor keeps the better AC and fills in Dex, Strength and Stealth
//  - rarity: the rarer of the two; bonus (armor, weapons, rods, staffs, wands): summed, from the bonus field, the
//    name's ", +1" or the description's "+1 bonus to attack rolls / AC", then put back on the name
//  - the name: the template's word for its kind (Weapon, Sword, Armor, Potion, Ring...) replaced by the base's
//    name ("Weapon of Warning" on a Longsword: "Longsword of Warning"); a wondrous item's "of ..." appended; a
//    second "of" becomes "and"; otherwise "[Template]" after the name, as the books' own forged items are named
//    ("Longsword [Flame Tongue]", "Longsword [Holy Avenger], +3")
//  - the description: the template's appended under "<Template> Notes"; the cost: summed when both have one
//  - a spell is a template: its level's rarity, its text; on a scroll it names the scroll ("Spell Scroll of
//    Fireball")
// Beyond FG's: the SRD's "+1, +2, or +3" items take a chosen bonus (and the rarity it names); a template with no
// cost keeps the base's cost (FG's sets "0 gp"); Magic is not listed twice; a mix that does not go together is
// said (it is still forged, as FG does).

const BONUSED = ["armor", "weapon", "rod", "staff", "wand"];
const NAMED = [...BONUSED, "spell"];
const CP = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

const str = (value) => String(value ?? "").trim();
const lower = (value) => str(value).toLowerCase();
/** The rarity's place (0 unknown, 1 common ... 5 legendary); "very rare" before "rare". */
export function rarityValue(rarity) {
  const text = lower(rarity);
  if (/legendary/.test(text)) return 5;
  if (/very rare/.test(text)) return 4;
  if (/rare/.test(text)) return 3;
  if (/uncommon/.test(text)) return 2;
  if (/common/.test(text)) return 1;
  return 0;
}
/** A spell scroll's rarity by the spell's level (SRD 5.2.1, Spell Scroll). */
export const rarityForLevel = (level) => (level <= 1 ? "Common" : level <= 3 ? "Uncommon" : level <= 5 ? "Rare" : level <= 8 ? "Very Rare" : "Legendary");

// "+1, +2, or +3" (the SRD's), and the rarity for one of them: "Uncommon (+1), Rare (+2), or Very Rare (+3)".
const CHOICE = /,?\s*\+1,\s*\+2,?\s*or\s*\+3$/i;
export const hasBonusChoice = (name) => CHOICE.test(str(name));
const rarityFor = (rarity, bonus) => new RegExp(String.raw`([A-Za-z][A-Za-z ]*?)\s*\(\+${bonus}\)`).exec(str(rarity))?.[1]?.replace(/^(or|and)\s+/i, "").trim() ?? str(rarity);

/** "15 GP", "1,500 gp", "5-10 sp" into copper; null when there is no cost. */
export function costInCopper(cost) {
  const text = lower(cost).replace(/,/g, "");
  const range = /(\d+)\s*-\s*(\d+)\s*([csegp]p)/.exec(text);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2) * CP[range[3]];
  const one = /(\d+(?:\.\d+)?)\s*([csegp]p)?/.exec(text);
  return one ? Number(one[1]) * CP[one[2] ?? "gp"] : null;
}
const withCommas = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** Copper as the largest of gp, sp, cp that holds it whole (5E prices in gold). */
export function costText(copper, upper = false) {
  const [unit, size] = [["gp", 100], ["sp", 10], ["cp", 1]].find(([, size]) => copper % Number(size) === 0) ?? ["cp", 1];
  return `${withCommas(Math.round(copper / Number(size)))} ${upper ? unit.toUpperCase() : unit}`;
}

/** What kind of thing an item is, for the mix check (FG's getCompatibilityType). */
function kindOf(item) {
  const name = lower(item.name);
  const type = lower(item.type);
  const sub = lower(item.subtype);
  if (type === "armor") return "armor";
  if (type === "weapon" || (type === "adventuring gear" && sub === "ammunition")) return "weapon";
  if (["rod", "staff", "wand"].includes(type) || /spellcasting focus|arcane focus/.test(sub)) return "arcane focus";
  if (type === "ring") return "ring";
  if (type === "potion" || (type === "adventuring gear" && /potion|bottle|flask|vial|oil/.test(name))) return "potion";
  if (type === "scroll" || (type === "adventuring gear" && /scroll|paper/.test(name))) return "scroll";
  if (type === "spell") return "spell";
  if (type === "wondrous item" || type === "adventuring gear") return "adventuring gear";
  return "";
}

/** A spell as a template (FG's addSpellAsTemplate): its level's rarity, its block as the description. */
export function spellTemplate(spell) {
  const level = Number(spell.level) || 0;
  const subtype = `${str(spell.school)} (${level === 0 ? "Cantrip" : `Level ${level}`})`;
  const line = (label, value) => (str(value) ? `<p><b>${label}:</b> ${str(value)}</p>` : "");
  const body = str(spell.description).replace(/^<p><i>[^<]*<\/i><\/p>/, "");
  return {
    name: str(spell.name),
    type: "Spell",
    subtype,
    rarity: rarityForLevel(level),
    cost: "",
    level,
    description: `<h>${str(spell.name)}</h><p><i>${subtype}</i></p>${line("Casting Time", spell.castingtime)}${line("Range", spell.range)}${line("Components", spell.components)}${line("Duration", spell.duration)}${body}`,
  };
}

/** An item's numbers as the forge reads them (FG's getItemStats), with a chosen bonus for "+1, +2, or +3". */
function statsOf(item, chosen) {
  const out = { ...item, name: str(item.name), type: str(item.type), subtype: str(item.subtype), rarity: str(item.rarity), cost: str(item.cost), description: str(item.description), properties: str(item.properties) };
  if (!BONUSED.includes(lower(out.type))) return out;
  if (hasBonusChoice(out.name)) {
    const bonus = Math.min(3, Math.max(1, Number(chosen) || 1));
    out.name = out.name.replace(CHOICE, "");
    out.rarity = rarityFor(out.rarity, bonus);
    out.bonus = bonus;
    return out;
  }
  out.bonus = Number(item.bonus) || 0;
  if (!out.bonus) {
    const named = /,?\s\+(\d+)$/.exec(out.name);
    const said = /\+(\d+)\s+bonus\s+to\s+(?:the\s+)?(?:attack|ac\b|armor class)/i.exec(out.description.replace(/<[^>]+>/g, " "));
    out.bonus = Number(named?.[1] ?? said?.[1] ?? 0);
  }
  return out;
}
const stripBonus = (item) => (NAMED.includes(lower(item.type)) ? { ...item, name: item.name.replace(/,?\s\+\d+$/, "") } : item);

// The template's word for its kind, replaced by the base's name (first match, case kept off).
const WORDS = {
  weapon: ["weapon", "ammunition", "arrow", "axe", "dagger", "hammer", "javelin", "mace", "scimitar", "sword", "trident"],
  potion: ["elixir", "oil", "philter", "potion"],
  ring: ["ring"],
  rod: ["rod", "staff", "wand"],
  staff: ["rod", "staff", "wand"],
  wand: ["rod", "staff", "wand"],
};
function newName(item, template) {
  const type = lower(template.type);
  const tName = template.name;
  const swap = (words) => {
    const word = words.find((w) => new RegExp(`\\b${w}`, "i").test(tName));
    return word ? tName.replace(new RegExp(`\\b${word}`, "i"), () => item.name) : null;
  };
  if (WORDS[type]) return swap(WORDS[type]);
  if (type === "armor") return /\b(armor|shield)/i.test(tName) ? tName.replace(/\b(armor|shield)/i, () => item.name) : null;
  if (type === "spell") return lower(item.type) === "scroll" ? `${item.name.replace(/\s+of\s.*$/i, "")} of ${tName}` : null;
  if (type === "scroll") return /\bscroll/i.test(tName) ? tName.replace(/\bscroll/i, () => item.name) : /\bspell/i.test(tName) ? `Scroll of ${item.name}` : null;
  if (type === "wondrous item") {
    const at = tName.search(/ of /i);
    return at >= 0 ? item.name + tName.slice(at) : null;
  }
  return null;
}

/** Properties as a list without repeats (case not minded). */
function joinProperties(...lists) {
  const seen = new Map();
  for (const list of lists) for (const part of str(list).split(",").map((s) => s.trim()).filter(Boolean)) if (!seen.has(part.toLowerCase())) seen.set(part.toLowerCase(), part);
  return [...seen.values()].join(", ");
}

/** One template on the item being forged (FG's createMagicItem loop body). */
function apply(item, templateIn) {
  const template = stripBonus(templateIn);
  const type = lower(template.type);
  const out = { ...item };
  if (!out.type) out.type = template.type;
  if (!out.subtype) out.subtype = template.subtype;
  if (type === "weapon") {
    if (!str(out.damage)) out.damage = str(template.damage);
    else if (str(template.damage)) out.damage = `${out.damage} plus ${str(template.damage)}`;
  }
  if (type === "armor") {
    out.ac = Math.max(Number(out.ac) || 0, Number(template.ac) || 0);
    for (const key of ["dexbonus", "stealth", "strength"]) if (!str(out[key])) out[key] = str(template[key]);
  }
  if (type === "weapon" || type === "armor") out.properties = joinProperties(out.properties, template.properties, "Magic");
  if (rarityValue(out.rarity) < rarityValue(template.rarity)) out.rarity = template.rarity;
  if (!str(out.attunement) && str(template.attunement)) out.attunement = template.attunement;
  if (BONUSED.includes(lower(out.type))) out.bonus = (Number(out.bonus) || 0) + (Number(template.bonus) || 0);

  if (!out.name) out.name = template.name;
  else {
    let made = newName(out, template);
    if (made) {
      const at = made.search(/ of /i);
      if (at >= 0) made = made.slice(0, at + 4) + made.slice(at + 4).replace(/ of /gi, " and ");
      out.name = made;
    } else if (!out.name.toLowerCase().includes(template.name.toLowerCase())) {
      out.name = template.name.toLowerCase().includes(out.name.toLowerCase()) ? template.name : `${out.name} [${template.name}]`;
    }
    const brackets = out.name.match(/ \[[^\]]+\]/g) ?? [];
    if (brackets.length) out.name = `${out.name.replace(/ \[[^\]]+\]/g, "")}${brackets.join("")}`;
  }

  if (!out.description) out.description = template.description;
  else out.description = `${out.description}<p><b>${template.name} Notes</b></p>${template.description.replace(/<h>Description<\/h>/g, "")}`;

  const a = costInCopper(out.cost);
  const b = costInCopper(template.cost);
  if (a !== null && b !== null) out.cost = costText(a + b, /[A-Z]P/.test(out.cost));
  else if (b !== null) out.cost = template.cost;
  return out;
}

/**
 * Forge: every base item with every template. Items are record data (name, type, subtype, rarity, cost,
 * description, bonus, damage, properties, ac...); a spell (a record of type spell) is turned into a template.
 * @param {{ bases?: Record<string, any>[]; templates?: Record<string, any>[]; spells?: Record<string, any>[]; bonus?: number }} input
 * @returns {{ made: { type: "item" | "itemtemplate"; name: string; data: Record<string, any> }[]; problems: string[] }}
 */
export function forgeItems({ bases = [], templates = [], spells = [], bonus = 1 }) {
  const problems = [];
  let items = bases.map((item) => stripBonus(statsOf(item, bonus)));
  let list = [...templates.map((item) => statsOf(item, bonus)), ...spells.map(spellTemplate)];
  if (!list.length || (!items.length && list.length < 2)) throw new Error("Put a base item and a template in the forge (or two templates).");
  const allTemplates = !items.length;
  if (allTemplates) {
    items = [stripBonus(list[0])];
    list = list.slice(1);
  }
  // The mix: every template of one kind (spells go with any), every base item of that kind.
  const kinds = [...new Set(list.map(kindOf).filter((kind) => kind !== "spell"))];
  const wrong = items.filter((item) => kinds.length === 1 && kindOf(item) !== kinds[0]).map((item) => item.name);
  if (kinds.length > 1) problems.push(`The templates are of different kinds (${kinds.join(", ")}).`);
  else if (wrong.length) problems.push(`${wrong.join(", ")} ${wrong.length > 1 ? "are not" : "is not"} the templates' kind (${kinds[0]}).`);

  const made = items.map((base) => {
    let item = { ...base };
    for (const template of list) item = apply(item, template);
    if (BONUSED.includes(lower(item.type)) && Number(item.bonus)) item.name = `${item.name}, +${item.bonus}`;
    const { level: _level, ...data } = item;
    return { type: /** @type {"item" | "itemtemplate"} */ (allTemplates ? "itemtemplate" : "item"), name: item.name, data };
  });
  return { made, problems };
}
