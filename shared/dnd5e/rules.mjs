// D&D Fifth Edition, from the System Reference Document 5.2.1 (CC-BY-4.0):
// Kraken's second ruleset, to prove the core is neutral. The rules here are
// plain functions (no Node, no DOM), used by the host (building, combat,
// checks) and by the 5E sheet. FG's 5E ruleset is the model for how they
// play: d20 + ability modifier (+ proficiency) for checks, saves and attacks;
// initiative d20 + Dexterity; a natural 20 is a critical hit (the damage dice
// rolled twice), a natural 1 always misses; creatures at 0 hit points die, a
// character falls Dying (death saves) and dies outright when the damage left
// over is at least its hit point maximum.
//
// A 5E character's record data keeps the keys the core already reads (hp
// {total, wounds}, ac {total}, level, exp, expnext, coins, inventorylist,
// packages with the class as packagetype Class), and its own:
//   ruleset "dnd5e", species, background, abilities {stat: {score, bonus,
//   saveprof, save}}, prof, skills {key: {prof 0|1|2, total}}, attacks {key:
//   {name, bonus, damage, dmgtype, type}}, initiative {total}, speed, senses,
//   spellcasting {stat, dc, attack}, slots {l1: {max, used}}, spells [names],
//   deathsaves {success, failure}, hitdice {die, total, used}.

import { backgroundKit2014, legacyKit, legacyKitItems } from "./kits2014.mjs";
import { ancestriesOf, subclassesOf, parseSkillsField, backgroundInfo, classInfo, currenciesOf, gearCost, mainCurrency, payFrom, speciesInfo, totalWealth } from "./wizard.mjs";

export const RULESET = "dnd5e";
export const RULESET_NAME = "D&D 5E";

// The games built on this engine (the d20 family): D&D 5E from the SRD, and
// Kraken's own Descending Darkness (dark fantasy: Defense and Health, a
// harsher array, levels 1-10, bleeding out at 0 Health, Dread). A record's
// data.ruleset says which; the campaign's ruleset name picks it for a new one.
export const PROFILES = {
  dnd5e: {
    id: "dnd5e",
    name: "D&D 5E",
    standardArray: [15, 14, 13, 12, 10, 8],
    xp: [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000],
    maxLevel: 20,
    labels: { ac: "AC", acLong: "Armor Class", hp: "Hit Points", hpShort: "HP", species: "Race", game: "5E", hitDice: "Hit Dice" },
    dying: "saves",
    dread: false,
    dcs: [5, 10, 15, 20, 25, 30],
  },
  descending: {
    id: "descending",
    name: "Descending Darkness",
    standardArray: [17, 14, 14, 13, 12, 8],
    xp: [0, 250, 750, 1750, 3500, 6500, 11000, 17000, 25000, 35000],
    maxLevel: 10,
    labels: { ac: "Defense", acLong: "Defense", hp: "Health", hpShort: "Health", species: "Kin", game: "Descending Darkness", hitDice: "Recovery Dice" },
    // At 0 Health: dying, a Health lost at the end of each of its turns; dead at minus its maximum.
    dying: "bleed",
    // Dread 0-6: 3 or more, disadvantage on Wisdom; 6, the character breaks.
    dread: true,
    dcs: [10, 12, 15, 18],
  },
};
export const profileFor = (thing) => {
  const key = typeof thing === "string" ? thing : thing?.ruleset;
  return PROFILES[key] ?? Object.values(PROFILES).find((profile) => profile.name === key) ?? PROFILES.dnd5e;
};
export const isD20 = (thing) => Boolean(PROFILES[typeof thing === "string" ? thing : thing?.ruleset] ?? Object.values(PROFILES).find((profile) => profile.name === thing));
export const STATS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
export const SHORT = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };

// The eighteen skills and their abilities (SRD 5.2.1, Playing the Game).
export const SKILLS = {
  acrobatics: ["Acrobatics", "dexterity"],
  animalhandling: ["Animal Handling", "wisdom"],
  arcana: ["Arcana", "intelligence"],
  athletics: ["Athletics", "strength"],
  deception: ["Deception", "charisma"],
  history: ["History", "intelligence"],
  insight: ["Insight", "wisdom"],
  intimidation: ["Intimidation", "charisma"],
  investigation: ["Investigation", "intelligence"],
  medicine: ["Medicine", "wisdom"],
  nature: ["Nature", "intelligence"],
  perception: ["Perception", "wisdom"],
  performance: ["Performance", "charisma"],
  persuasion: ["Persuasion", "charisma"],
  religion: ["Religion", "intelligence"],
  sleightofhand: ["Sleight of Hand", "dexterity"],
  stealth: ["Stealth", "dexterity"],
  survival: ["Survival", "wisdom"],
};
export const skillKey = (name) => String(name ?? "").toLowerCase().replace(/[^a-z]/g, "");

// Experience for each level (SRD: Character Advancement).
export const XP = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const mod = (score) => Math.floor((Number(score) - 10) / 2);
export const proficiency = (level) => 2 + Math.floor((Math.max(1, Number(level) || 1) - 1) / 4);
export const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const rows = (value) => (value && typeof value === "object" ? Object.entries(value) : []);
const statOf = (word) => STATS.find((stat) => String(word ?? "").trim().toLowerCase().startsWith(stat.slice(0, 3))) ?? null;

// Spellcasting classes: their ability and how fast slots come (SRD class tables).
export const CASTERS = {
  bard: { stat: "charisma", kind: "full" },
  cleric: { stat: "wisdom", kind: "full" },
  druid: { stat: "wisdom", kind: "full" },
  sorcerer: { stat: "charisma", kind: "full" },
  wizard: { stat: "intelligence", kind: "full" },
  paladin: { stat: "charisma", kind: "half" },
  ranger: { stat: "wisdom", kind: "half" },
  warlock: { stat: "charisma", kind: "pact" },
};
// Spell slots of a full caster by level (1..20), levels 1..9.
const FULL = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
// A half caster (2024 SRD) has slots from level 1, as a full caster of half its level, rounded up.
// A warlock's Pact Magic: slots all of one level.
const PACT = [[1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5]];
export function slotsFor(className, level) {
  const caster = CASTERS[skillKey(className)];
  const at = Math.min(20, Math.max(1, Math.round(num(level, 1))));
  if (!caster) return {};
  if (caster.kind === "pact") {
    const [count, slotLevel] = PACT[at - 1];
    return { [`l${slotLevel}`]: { max: count, used: 0 } };
  }
  const row = FULL[(caster.kind === "half" ? Math.ceil(at / 2) : at) - 1] ?? [];
  return Object.fromEntries(row.map((count, index) => [`l${index + 1}`, { max: count, used: 0 }]));
}

// "1d8 Slashing" -> { dice: "1d8", type: "slashing" }; "1d4 + 2 Piercing" too.
export function parseDamage(text) {
  const raw = String(text ?? "").trim();
  const match = /^(\d*d\d+(?:\s*[+-]\s*\d+)?|\d+)\s*([a-z]+)?/i.exec(raw);
  if (!match) return null;
  return { dice: match[1].replace(/\s+/g, ""), type: (match[2] ?? "").toLowerCase() };
}

// A weapon item (FG's 5E item): melee or ranged, finesse, its damage, its versatile die.
export function weaponInfo(item) {
  const properties = String(item?.properties ?? "");
  const subtype = String(item?.subtype ?? "");
  const damage = parseDamage(item?.damage);
  return {
    ranged: /ranged/i.test(subtype),
    finesse: /finesse/i.test(properties),
    thrown: /thrown/i.test(properties),
    damage,
    versatile: /versatile\s*\((\d*d\d+)\)/i.exec(properties)?.[1] ?? null,
    martial: /martial/i.test(subtype),
    light: /\blight\b/i.test(properties),
  };
}
// Proficiency with a weapon: simple ones always; martial ones when the class
// has them all (true), or only those with a property (SRD 5.2.1: a Monk's
// "Martial weapons that have the Light property", a Rogue's "Finesse or Light").
function proficientWith(data, info, item = null) {
  // FG's own tick on the weapon (its weapon row's prof: 0 not proficient, 1 proficient), where it was set.
  if (item && (item.prof === 0 || item.prof === "0")) return false;
  if (item && (item.prof === 1 || item.prof === "1")) return true;
  if (!info.martial) return true;
  const martial = data.proficiencies?.martial;
  if (martial === true || martial === 1 || martial === "all") return true;
  // The character's weapon proficiencies by name: "Martial weapons", or the weapon itself ("Longswords").
  const listed = (Array.isArray(data.proficiencylist?.weapons) ? data.proficiencylist.weapons : String(data.proficiencylist?.weapons ?? "").split(/[,;\n]/)).map((name) => String(name).trim().toLowerCase().replace(/s$/, "")).filter(Boolean);
  const own = String(item?.name ?? "").trim().toLowerCase().replace(/,.*$/, "").replace(/s$/, "");
  if (listed.some((name) => /^martial/.test(name) || (own && (name === own || own.endsWith(` ${name}`))))) return true;
  if (typeof martial !== "string" || !martial) return false;
  return (/light/.test(martial) && info.light) || (/finesse/.test(martial) && info.finesse);
}
export const isWeapon = (item) => /weapon/i.test(String(item?.type ?? "")) && Boolean(parseDamage(item?.damage));
export const isArmor = (item) => /armor/i.test(String(item?.type ?? ""));
const equipped = (item) => num(item?.carried, 1) === 2;

// Armor Class (SRD: Armor table): unarmored 10 + DEX; light armor + DEX;
// medium + DEX (at most 2); heavy, no DEX; a shield adds its bonus. Only what is worn (carried 2) counts.
export function armorClass(data) {
  const dex = mod(data.abilities?.dexterity?.score ?? 10);
  // FG's AC details set by hand: the Dex cap ("" the armor's own, "none", "full", or 2, 3...) and a second ability
  // (a Monk's Wisdom, a Barbarian's Constitution, set by hand).
  const cap = String(data.ac?.dexcap ?? "");
  const capDex = (from) => (cap === "none" ? 0 : cap === "full" ? dex : /^\d$/.test(cap) ? Math.min(dex, Number(cap)) : from);
  const stat2 = STATS.includes(String(data.ac?.stat2 ?? "")) ? String(data.ac.stat2) : "";
  const second = stat2 ? mod(data.abilities?.[stat2]?.score ?? 10) : 0;
  let base = 10 + capDex(dex);
  let shield = 0;
  let wearing = "";
  for (const [, item] of rows(data.inventorylist)) {
    if (!isArmor(item) || !equipped(item)) continue;
    const subtype = String(item.subtype ?? "");
    if (/shield/i.test(subtype)) shield = Math.max(shield, num(item.ac, 2) + num(item.bonus, 0));
    else {
      const ac = num(item.ac, 10) + num(item.bonus, 0);
      const dexbonus = String(item.dexbonus ?? "Yes");
      const capped = /max\s*(\d+)/i.exec(dexbonus);
      const fromDex = /^no/i.test(dexbonus) || /heavy/i.test(subtype) ? 0 : capped ? Math.min(dex, Number(capped[1])) : dex;
      const value = ac + capDex(fromDex);
      if (!wearing || value > base) {
        base = value;
        wearing = String(item.name ?? "");
      }
    }
  }
  // Unarmored Defense (SRD 5.2.1): with no armor, a Barbarian is 10 + DEX + CON
  // (a shield still adds), a Monk 10 + DEX + WIS (and no shield either).
  if (!wearing) {
    const features = (Array.isArray(data.features) ? data.features : data.features && typeof data.features === "object" ? Object.values(data.features).map((row) => row?.name ?? row) : data.features ? [data.features] : []).map(String).join(" | ");
    const score = (stat) => mod(data.abilities?.[stat]?.score ?? 10);
    if (/Unarmored Defense \(Barbarian/i.test(features)) {
      base = Math.max(base, 10 + dex + score("constitution"));
      wearing = "Unarmored Defense";
    } else if (/Unarmored Defense \(Monk/i.test(features) && !shield) {
      base = Math.max(base, 10 + dex + score("wisdom"));
      wearing = "Unarmored Defense";
    }
  }
  return { total: base + shield + second + num(data.ac?.misc, 0), armor: wearing, shield, ...(cap ? { dexcap: cap } : {}), ...(stat2 ? { stat2, stat2bonus: second } : {}) };
}

// An equipment pack opened into what it holds (FG adds a pack's included items): FG's subitems list,
// else the SRD's own words ("contains the following items: Backpack, Caltrops, 2 flasks of Oil,
// 10 days of Rations, ..."). Each found in the item library by name; one not found is a plain item.
// Its contents go into the pack's own backpack (or sack) when it has one. null: not a pack.
const MEASURES = /^(?:flasks?|days?|pieces?|sheets?|sticks?|pints?|vials?|bags?|bundles?|bottles?|feet|pouches?|blocks?|cases?|bars?)\s+of\s+/i;
export function packContents(item, library = []) {
  if (!/equipment pack/i.test(`${item?.subtype ?? ""} ${item?.type ?? ""}`)) return null;
  const byName = (name) => {
    const want = String(name).trim().toLowerCase();
    const plain = (text) => String(text).toLowerCase();
    return library.find((entry) => plain(entry.name) === want) ?? library.find((entry) => plain(entry.name) === want.replace(/e?s$/, "")) ?? library.find((entry) => plain(entry.name).startsWith(want.replace(/e?s$/, ""))) ?? null;
  };
  let listed = [];
  const sub = item?.subitems && typeof item.subitems === "object" ? Object.values(item.subitems) : [];
  if (sub.length) listed = sub.map((row) => ({ name: String(row?.name ?? row?.link?.recordname ?? ""), count: Math.max(1, num(row?.count, 1)) })).filter((row) => row.name);
  else {
    const words = String(item?.description ?? item?.text ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const found = /contains? the following items?:\s*(.+?)(?:\.\s|\.$|$)/i.exec(words);
    if (!found) return null;
    listed = found[1]
      .split(/,\s*(?:and\s+)?|\s+and\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const counted = /^(\d+)\s+(.+)$/.exec(part);
        const count = counted ? Number(counted[1]) : 1;
        const name = (counted ? counted[2] : part).replace(MEASURES, "").trim();
        return { name, count };
      });
  }
  if (!listed.length) return null;
  const rows = listed.map(({ name, count }) => {
    const known = byName(name);
    return { name: known?.name ?? name.replace(/^./, (letter) => letter.toUpperCase()), count, data: known?.data ?? { name } };
  });
  const bag = rows.find((row) => /\b(backpack|sack)\b/i.test(row.name));
  return rows.map((row) => (bag && row !== bag ? { ...row, location: bag.name } : row));
}

// A character's weapon attack: proficiency (with its weapon kind), STR for
// melee, DEX for ranged, the better for finesse; damage the weapon's dice + that modifier.
export function weaponAttack(data, item, { hands = 1, thrown = false } = {}) {
  const info = weaponInfo(item);
  if (!info.damage) return null;
  // FG's hands: a versatile weapon in two hands rolls its larger die.
  const twoHanded = Boolean(info.versatile) && !thrown && num(hands, 1) === 2;
  // FG's off-hand attack (two-weapon fighting): its damage adds no positive ability modifier, unless the character
  // has the Two-Weapon Fighting style.
  const offHand = !thrown && num(hands, 1) === 3;
  const dice = twoHanded ? info.versatile : info.damage.dice;
  const str = mod(data.abilities?.strength?.score ?? 10);
  const dex = mod(data.abilities?.dexterity?.score ?? 10);
  const ability = info.ranged ? dex : info.finesse ? Math.max(str, dex) : str;
  const proficient = proficientWith(data, info, item);
  const bonus = ability + (proficient ? num(data.prof, 2) : 0) + num(item.bonus, 0);
  const style = /two[- ]weapon fighting/i.test([...(Array.isArray(data.features) ? data.features : []), ...Object.values(data.features && typeof data.features === "object" ? data.features : {}).map((row) => row?.name ?? row), ...(Array.isArray(data.feats) ? data.feats : [])].map(String).join(" | "));
  const dmg = (offHand && ability > 0 && !style ? 0 : ability) + num(item.bonus, 0);
  return {
    name: `${String(item.name ?? "Weapon")}${thrown ? " (thrown)" : offHand ? " (off hand)" : ""}`,
    bonus,
    damage: `${dice}${dmg ? signed(dmg) : ""}`,
    dice,
    damageBonus: dmg,
    dmgtype: info.damage.type,
    type: info.ranged || thrown ? "ranged" : "melee",
    ...(info.versatile && !thrown ? { versatile: info.versatile, hands: twoHanded ? 2 : 1 } : {}),
    ...(thrown ? { thrown: true } : {}),
  };
}

// An NPC's attacks from its actions' text (SRD stat blocks): "Melee Attack Roll:
// +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage." (and 2014's "Melee
// Weapon Attack: +4 to hit"). Keys are the action keys.
export function npcAttacks(data) {
  const out = {};
  for (const [key, action] of rows(data?.actions)) {
    const desc = String(action?.desc ?? "");
    const roll = /(Melee or Ranged|Melee|Ranged)\s*(?:Weapon |Spell )?Attack(?: Roll)?\s*:\s*([+-]\d+)/i.exec(desc);
    if (!roll) continue;
    // The hit's first damage, in its sentence ("Hit: The target takes 55 (10d10) piercing damage"); "bludgeoning or
    // slashing damage (claw's choice)": its first type; "slashing, magic damage": slashing.
    const diced = /Hit\s*:[^.]*?\b\d+\s*\(([^)]+)\)\s*(?:([A-Za-z]+)(?:,\s*magic)?(?:\s+or\s+[A-Za-z]+)?\s+)?damage/i.exec(desc);
    const plain = /Hit\s*:[^.]*?\b(\d+)\s+([A-Za-z]+)(?:,\s*magic)?(?:\s+or\s+[A-Za-z]+)?\s+damage/i.exec(desc);
    // Whichever comes first ("Hit: 1 piercing damage plus 7 (3d4) poison damage": the 1 piercing).
    const hit = diced && (!plain || diced[0].length <= plain[0].length) ? diced : null;
    const flat = hit ? null : plain;
    const damage = hit ? hit[1].replace(/\s+/g, "") : flat ? flat[1] : "";
    // FG reads every damage of the hit ("plus 7 (2d6) fire damage", "+ 7 (2d6) cold damage"): the rest, each with its
    // own type; a two-handed alternative ("or 8 (1d10 + 3) bludgeoning damage plus 3 (1d6) fire damage if used with two
    // hands") is left out, so its damage is not counted twice.
    const first = hit ?? flat;
    const after = first
      ? desc
          .slice((first.index ?? 0) + first[0].length)
          .split(/(?<=[.])\s/)[0]
          .replace(/,?\s*or\s+\d+\s*\([^)]*\)\s*[A-Za-z]+\s+damage(?:\s+(?:plus|\+)\s+\d+\s*\([^)]*\)\s*[A-Za-z]+\s+damage)?(?:\s+if\s[^,.]*)?/gi, "")
      : "";
    const extra = [...after.matchAll(/(?:\bplus|\+|\band)\s+\d+\s*\(([^)]+)\)\s*([A-Za-z]+)(?:,\s*magic)?(?:\s+or\s+[A-Za-z]+)?\s+damage/gi)].map((match) => ({ dice: match[1].replace(/\s+/g, ""), type: match[2].toLowerCase() }));
    out[key] = {
      name: String(action.name ?? "Attack"),
      bonus: Number(roll[2]),
      damage,
      dmgtype: String((hit ?? flat)?.[2] ?? "").toLowerCase(),
      ...(extra.length ? { extra } : {}),
      type: /^ranged/i.test(roll[1]) ? "ranged" : "melee",
    };
  }
  return out;
}

// An NPC's numbers for the tracker: its hit points as listed (FG's default),
// its AC, its initiative bonus (DEX, or the block's own initiative), its saves.
export function npcStats(data) {
  const dex = num(data?.abilities?.dexterity?.bonus, mod(data?.abilities?.dexterity?.score ?? 10));
  const ac = typeof data?.ac === "object" ? num(data.ac?.total, 10) : num(/^\d+/.exec(String(data?.ac ?? ""))?.[0], 10);
  return { hp: Math.max(1, Math.round(num(data?.hp, 1))), ac, init: num(data?.initiative?.total, dex + num(data?.initiative?.misc, 0)), hd: String(data?.hd ?? "").replace(/[()]/g, "") };
}
export function npcSave(data, stat) {
  const row = data?.abilities?.[stat] ?? {};
  return num(row.bonus, mod(row.score ?? 10)) + num(row.savemodifier, 0);
}
export function npcCheck(data, stat) {
  const row = data?.abilities?.[stat] ?? {};
  return num(row.bonus, mod(row.score ?? 10));
}

// The hit die of a class record ("D10 per Fighter level").
export function hitDie(classRecord) {
  return Number(/d(\d+)/i.exec(String(classRecord?.data?.hp?.hitdice?.text ?? classRecord?.hitdie ?? "d8"))?.[1] ?? 8);
}
// Its saving throws ("Strength and Constitution").
export function classSaves(classRecord) {
  return String(classRecord?.data?.proficiencies?.savingthrows?.text ?? "")
    .split(/,|\band\b/i)
    .map(statOf)
    .filter(Boolean);
}
// The skills it lets a character choose from, and how many: read as the character wizard reads them
// (parseSkillsField: "Choose four from Acrobatics, ...", "Choose any three", a 2024 "Choose 2:"), so a spec is held to
// what the wizard offers.
export function classSkillChoices(classRecord) {
  const parsed = parseSkillsField(classRecord?.data?.proficiencies?.skills?.text ?? "", String(classRecord?.data?.version ?? "") === "2024");
  return { count: parsed.picks || 2, names: parsed.options.filter((key) => SKILLS[key]) };
}
// true for all martial weapons; "light" or "finesse light" when the class has
// only those (SRD 5.2.1 Monk and Rogue); false for none.
const martialClass = (classRecord) => {
  const text = String(classRecord?.data?.proficiencies?.weapons?.text ?? "");
  if (!/martial/i.test(text)) return false;
  const only = /martial weapons? (?:that|with) (?:have |has )?(?:the )?([a-z ,]+?) propert/i.exec(text);
  if (!only) return true;
  return ["finesse", "light"].filter((word) => new RegExp(`\\b${word}\\b`, "i").test(only[1])).join(" ") || true;
};

// Everything worked out from the base fields: modifiers, proficiency, saves,
// skills, AC, initiative, attacks, passive Perception, spellcasting, the next
// level's XP. Base fields are kept as they are.
// A spell's key for its prepared box: "Cure Wounds" -> "cure-wounds".
export const spellSlug = (/** @type {string} */ name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function derive(input) {
  const profile = profileFor(input?.ruleset in PROFILES ? input.ruleset : RULESET);
  const data = { ...input, ruleset: profile.id };
  // FG's Classes: a character's level is its classes' levels together (multiclass), else its own.
  const classRows = rows(data.packages).filter(([, pkg]) => String(pkg?.packagetype).toLowerCase() === "class");
  const classLevels = classRows.reduce((sum, [, pkg]) => sum + Math.max(1, Math.round(num(pkg.level, 1))), 0);
  const level = Math.min(profile.maxLevel, Math.max(1, Math.round(classRows.length > 1 ? classLevels : num(data.level, 1))));
  data.level = level;
  data.prof = proficiency(level);
  data.abilities = Object.fromEntries(
    STATS.map((stat) => {
      const row = data.abilities?.[stat] ?? {};
      const score = Math.min(30, Math.max(1, Math.round(num(row.score, 10))));
      const bonus = mod(score);
      const saveprof = num(row.saveprof, 0) ? 1 : 0;
      return [stat, { score, bonus, saveprof, save: bonus + (saveprof ? data.prof : 0) }];
    }),
  );
  data.skills = Object.fromEntries(
    Object.entries(SKILLS).map(([key, [name, stat]]) => {
      // FG's proficiency: none (0), proficient (1), double (2: expertise), half (3: Jack of All Trades, rounded down); misc on top.
      const prof = Math.min(3, Math.max(0, Math.round(num(data.skills?.[key]?.prof, 0))));
      const misc = Math.round(num(data.skills?.[key]?.misc, 0));
      const fromProf = prof === 3 ? Math.floor(data.prof / 2) : data.prof * prof;
      // FG's ability per skill, changeable (Strength for an Intimidation by force); the skill's own by default.
      const chosen = STATS.includes(String(data.skills?.[key]?.stat ?? "")) ? String(data.skills[key].stat) : stat;
      return [key, { name, stat: chosen, ...(chosen !== stat ? { ownstat: stat } : {}), prof, ...(misc ? { misc } : {}), total: data.abilities[chosen].bonus + fromProf + misc }];
    }),
  );
  data.ac = { ...armorClass(data), misc: num(data.ac?.misc, 0) };
  // FG's Hit Dice details: the ability (Constitution) added to a hit die rolled, a second one, and misc.
  {
    const hd = data.hitdice && typeof data.hitdice === "object" ? data.hitdice : {};
    const stat = STATS.includes(String(hd.stat ?? "")) ? String(hd.stat) : "constitution";
    const stat2 = STATS.includes(String(hd.stat2 ?? "")) ? String(hd.stat2) : "";
    const misc = Math.round(num(hd.misc, 0));
    data.hitdice = { ...hd, ...(hd.stat ? { stat } : {}), mod: data.abilities[stat].bonus + (stat2 ? data.abilities[stat2].bonus : 0) + misc };
  }
  data.initiative = { misc: num(data.initiative?.misc, 0), total: data.abilities.dexterity.bonus + num(data.initiative?.misc, 0) };
  // FG's speed: the base (the Speed box), heavy armor's -10 feet when Strength is under its requirement (SRD 5.2.1),
  // a misc adjustment, and special movement (fly, swim, climb) in words.
  {
    const baseSpeed = num(/\d+/.exec(String(data.speed ?? ""))?.[0], 30);
    const heavy = rows(data.inventorylist).find(([, item]) => isArmor(item) && equipped(item) && /heavy/i.test(String(item.subtype ?? "")) && num(/\d+/.exec(String(item.strength ?? ""))?.[0], 0) > num(data.abilities.strength.score, 10));
    const armorSpeed = heavy ? -10 : 0;
    const speedMisc = Math.round(num(data.speedmisc, 0));
    data.speedtotal = Math.max(0, baseSpeed + armorSpeed + speedMisc);
    data.speedarmor = armorSpeed;
  }
  data.passive = 10 + data.skills.perception.total;
  // The hands chosen on the sheet are kept (FG's hands button); a melee weapon with Thrown gets its own thrown line.
  const handsWas = Object.fromEntries(rows(data.attacks).map(([key, attack]) => [key, num(attack?.hands, 1)]));
  data.attacks = {};
  for (const [key, item] of rows(data.inventorylist)) {
    if (!isWeapon(item) || num(item.carried, 1) === 0) continue;
    const attack = weaponAttack(data, item, { hands: handsWas[key] ?? 1 });
    if (attack) data.attacks[key] = attack;
    const info = weaponInfo(item);
    if (attack && info.thrown && !info.ranged) data.attacks[`${key}-thrown`] = weaponAttack(data, item, { thrown: true });
  }
  const className = rows(data.packages).find(([, pkg]) => String(pkg.packagetype).toLowerCase() === "class")?.[1]?.name ?? "";
  const caster = CASTERS[skillKey(className)];
  // Multiclass (SRD 5.2.1): every casting class's DC and attack; slots from the full casters' levels and half the
  // half casters' (rounded up) together, on the full caster's table; Pact Magic its own slots.
  const casting = classRows.map(([, pkg]) => ({ name: String(pkg.name ?? ""), level: Math.max(1, Math.round(num(pkg.level, 1))), caster: CASTERS[skillKey(String(pkg.name ?? ""))] })).filter((row) => row.caster);
  if (classRows.length > 1 && casting.length) {
    const first = casting[0];
    const of = (row) => ({ name: row.name, stat: row.caster.stat, dc: 8 + data.prof + data.abilities[row.caster.stat].bonus, attack: data.prof + data.abilities[row.caster.stat].bonus });
    data.spellcasting = { ...of(first), ...(casting.length > 1 ? { classes: casting.map(of) } : {}), ...(first.caster.kind === "pact" && casting.length === 1 ? { pact: true } : {}) };
    const spellcasters = casting.filter((row) => row.caster.kind !== "pact");
    const pact = casting.find((row) => row.caster.kind === "pact");
    const keep = (fresh, old) => Object.fromEntries(Object.entries(fresh).map(([key, slot]) => {
      const extra = Math.round(num(old?.[key]?.extra, 0));
      const max = Math.max(0, slot.max + extra);
      return [key, { max, ...(extra ? { extra } : {}), used: Math.max(0, Math.min(max, Math.round(num(old?.[key]?.used, 0)))) }];
    }));
    let fresh = {};
    if (spellcasters.length === 1) fresh = slotsFor(spellcasters[0].name, spellcasters[0].level);
    else if (spellcasters.length > 1) {
      const casterLevel = spellcasters.reduce((sum, row) => sum + (row.caster.kind === "half" ? Math.ceil(row.level / 2) : row.level), 0);
      fresh = Object.fromEntries((FULL[Math.min(20, casterLevel) - 1] ?? []).map((count, index) => [`l${index + 1}`, { max: count, used: 0 }]));
    } else if (pact) fresh = slotsFor(pact.name, pact.level);
    data.slots = keep(fresh, data.slots);
    if (pact && spellcasters.length) data.pactslots = keep(slotsFor(pact.name, pact.level), data.pactslots);
    else delete data.pactslots;
  } else if (caster) {
    const bonus = data.abilities[caster.stat].bonus;
    data.spellcasting = { stat: caster.stat, dc: 8 + data.prof + bonus, attack: data.prof + bonus, ...(caster.kind === "pact" ? { pact: true } : {}) };
    const fresh = slotsFor(className, level);
    // FG's slot maximums set by hand: the class's, and an extra (a magic item, a feat) kept on top.
    data.slots = Object.fromEntries(
      Object.entries(fresh).map(([key, slot]) => {
        const extra = Math.round(num(data.slots?.[key]?.extra, 0));
        const max = Math.max(0, slot.max + extra);
        return [key, { max, ...(extra ? { extra } : {}), used: Math.max(0, Math.min(max, Math.round(num(data.slots?.[key]?.used, 0)))) }];
      }),
    );
  } else {
    delete data.spellcasting;
    data.slots = {};
  }
  if (classRows.length <= 1) delete data.pactslots;
  data.hp = { total: Math.max(1, Math.round(num(data.hp?.total, 1))), wounds: Math.max(0, Math.round(num(data.hp?.wounds, 0))), temp: Math.max(0, Math.round(num(data.hp?.temp, 0))) };
  data.exp = Math.max(0, Math.round(num(data.exp, 0)));
  data.expnext = profile.xp[level] ?? 0;
  data.deathsaves = { success: Math.max(0, Math.min(3, Math.round(num(data.deathsaves?.success, 0)))), failure: Math.max(0, Math.min(3, Math.round(num(data.deathsaves?.failure, 0)))) };
  if (data.hitdice && typeof data.hitdice === "object") data.hitdice = { ...data.hitdice, used: Math.max(0, Math.round(num(data.hitdice.used, 0))) };
  // FG's hit dice per class (multiclass): each class's die and how many of them are spent. A rest or a roll changes
  // the total spent; it is shared out to the classes, the largest die first (spent) or back first (recovered).
  if (classRows.length > 1) {
    const pools = classRows.map(([key, pkg]) => ({ key, name: String(pkg.name ?? ""), die: Math.round(num(pkg.hitdie, 8)), level: Math.max(1, Math.round(num(pkg.level, 1))), used: Math.max(0, Math.round(num(pkg.hdused, 0))) }));
    for (const pool of pools) pool.used = Math.min(pool.used, pool.level);
    const want = Math.max(0, Math.min(level, Math.round(num(data.hitdice?.used, pools.reduce((sum, pool) => sum + pool.used, 0)))));
    let diff = want - pools.reduce((sum, pool) => sum + pool.used, 0);
    const byDie = [...pools].sort((a, b) => b.die - a.die);
    for (const pool of byDie) {
      if (diff > 0) {
        const take = Math.min(diff, pool.level - pool.used);
        pool.used += take;
        diff -= take;
      } else if (diff < 0) {
        const back = Math.min(-diff, pool.used);
        pool.used -= back;
        diff += back;
      }
    }
    data.packages = { ...data.packages, ...Object.fromEntries(pools.map((pool) => [pool.key, { ...data.packages[pool.key], hdused: pool.used }])) };
    const open = byDie.find((pool) => pool.used < pool.level) ?? byDie[0];
    data.hitdice = { ...data.hitdice, die: open.die, total: level, used: want, pools: pools.map((pool) => ({ name: pool.name, die: pool.die, left: pool.level - pool.used, total: pool.level })) };
  }
  if (profile.dread) data.dread = Math.min(6, Math.max(0, Math.round(num(data.dread, 0))));
  // FG's attunement: an item whose rarity or text says it requires attunement may be attuned (its box); the count
  // is the attuned items, beside the class's and misc slots (the house rule HRAS gives the base).
  if (data.inventorylist && typeof data.inventorylist === "object") {
    data.inventorylist = Object.fromEntries(
      rows(data.inventorylist).map(([key, item]) => {
        const words = `${typeof item.rarity === "string" ? item.rarity : ""} ${typeof item.description === "string" ? item.description : ""} ${typeof item.text === "string" ? item.text : ""}`;
        const attunable = /requires attunement/i.test(words) ? 1 : 0;
        return [key, { ...item, attunable, attune: attunable && num(item.attune, 0) ? 1 : 0 }];
      }),
    );
  }
  // FG's prepared spells: ticked by their name (a slug), only those the character knows.
  const knownSlugs = new Set((Array.isArray(data.spells) ? data.spells : []).map((name) => spellSlug(String(name))));
  data.prepared = Object.fromEntries(Object.entries(data.prepared && typeof data.prepared === "object" ? data.prepared : {}).filter(([slug, on]) => knownSlugs.has(slug) && num(on, 0) > 0).map(([slug]) => [slug, 1]));
  // FG's class resources (Rage, Ki, Channel Divinity): a name, uses, how many used, back on a short or long rest.
  if (data.resources && typeof data.resources === "object") {
    data.resources = Object.fromEntries(
      rows(data.resources)
        .filter(([, row]) => String(row?.name ?? "").trim())
        .map(([key, row]) => {
          const max = Math.max(0, Math.round(num(row.max, 1)));
          return [key, { name: String(row.name).trim().slice(0, 60), max, used: Math.max(0, Math.min(max, Math.round(num(row.used, 0)))), period: row.period === "short" ? "short" : "long" }];
        }),
    );
  }
  data.attunement = {
    used: rows(data.inventorylist).filter(([, item]) => num(item.attune, 0) > 0).length,
    class: Math.max(0, Math.round(num(data.attunement?.class, 0))),
    misc: Math.round(num(data.attunement?.misc, 0)),
  };
  return data;
}

// A d20 test (check, save, skill) for a character: the modifier and its label.
export function testModifier(data, kind, key) {
  // Initiative: a Dexterity check with the sheet's initiative (its misc included), FG's Roll Initiative.
  if (kind === "init") return { modifier: num(data.initiative?.total, num(data.abilities?.dexterity?.bonus, 0)), label: "[INIT]" };
  if (kind === "save") return { modifier: num(data.abilities?.[key]?.save, 0), label: `[SAVE] ${titled(key)}` };
  if (kind === "skill") {
    const skill = data.skills?.[key];
    if (!skill) throw new Error(`No skill ${key}.`);
    return { modifier: num(skill.total, 0), label: `[SKILL] ${skill.name}` };
  }
  return { modifier: num(data.abilities?.[key]?.bonus, 0), label: `[CHECK] ${titled(key)}` };
}
// Descending Darkness: at 3 Dread or more, Wisdom checks and saves (and Wisdom
// skills) have disadvantage; chosen advantage cancels it to one die, as in 5E.
export function dreadAdvantage(data, kind, key, advantage = "") {
  if (!profileFor(data).dread || num(data?.dread, 0) < 3) return { advantage, dread: false };
  const stat = kind === "skill" ? SKILLS[skillKey(key)]?.[1] : String(key ?? "").toLowerCase();
  if (stat !== "wisdom") return { advantage, dread: false };
  return { advantage: advantage === "advantage" ? "" : "disadvantage", dread: true };
}
export const titled = (word) => String(word ?? "").replace(/^\w/, (letter) => letter.toUpperCase());

// Builds a character from a spec, as FG's 5E character wizard commits one
// (commitCharacter: basics, ability scores, skills, proficiencies, languages,
// feats, species, background, classes, spells, inventory, currency):
//   { name, species, ancestry, size, class, subclass, background, level,
//     scores {stat: score before the kin's adjustments}, increases {stat: n}
//     (a background's +2/+1, an Ability Score Improvement, misc),
//     skills [the class's choices], backgroundSkills, speciesSkills, expertise,
//     languages, tools, feats [names] (a background's own feat is added),
//     kits { class: "A" | "B" | "C", background: "A" | ... } (the books' starting
//     kits: items and wealth), gear [[item name, count]] (more items, free;
//     armor and shields worn, weapons in hand), coins { GP: n, ... } (custom),
//     wealth (a rolled Legacy starting wealth: kits then give nothing),
//     gold (the main coin, as before), spells [names], alignment, notes, warnings }
// lib: { classes, species, ancestries, backgrounds, subclasses, feats, items, spells }.
// Hit points: the hit die's maximum at level 1 plus CON, then the fixed value
// (half the die + 1) each level (FG's default; a level up from the sheet rolls).
// A kin's ability adjustments ("Dexterity +1, Constitution -1"): {stat: n}.
export function abilityAdjustments(speciesRecord) {
  const out = {};
  for (const match of String(speciesRecord?.data?.abilityadjust ?? "").matchAll(/([a-z]+)\s*([+-]\d+)/gi)) {
    const stat = statOf(match[1]);
    if (stat) out[stat] = (out[stat] ?? 0) + Number(match[2]);
  }
  return out;
}
// Extra hit points each level from the species (SRD 5E's dwarven toughness).
export const toughnessOf = (speciesRecord) => (/hit point maximum increases by 1/i.test(Object.values(speciesRecord?.data?.traits ?? {}).map((trait) => trait?.text ?? "").join(" ")) ? 1 : num(speciesRecord?.data?.hpperlevel, 0));

export function buildFromSpec(spec, lib, rulesetId = RULESET) {
  const profile = profileFor(rulesetId);
  const problems = [];
  const find = (list, name) => (list ?? []).find((record) => String(record.name).toLowerCase() === String(name ?? "").toLowerCase()) ?? null;
  const cls = find(lib.classes, spec.class);
  if (!cls) throw new Error(`No class ${spec.class} in the books (make a 5E Player's Handbook active in Modules).`);
  const species = spec.species || spec.race ? find(lib.species, spec.species ?? spec.race) : null;
  if ((spec.species || spec.race) && !species) problems.push(`No species ${spec.species ?? spec.race}.`);
  const ancestry = spec.ancestry ? find(ancestriesOf(species, lib.ancestries ?? []), spec.ancestry) ?? find(lib.ancestries, spec.ancestry) : null;
  if (spec.ancestry && !ancestry) problems.push(`No ancestry ${spec.ancestry}.`);
  const background = spec.background ? find(lib.backgrounds, spec.background) : null;
  if (spec.background && !background) problems.push(`No background ${spec.background}.`);
  const subclass = spec.subclass ? find(subclassesOf(cls, lib.subclasses ?? []), spec.subclass) ?? find(lib.subclasses, spec.subclass) : null;
  if (spec.subclass && !subclass) problems.push(`No subclass ${spec.subclass}.`);
  const level = Math.min(profile.maxLevel, Math.max(1, Math.round(num(spec.level, 1))));
  const kin = speciesInfo(species, ancestry);
  const bg = backgroundInfo(background, lib.items ?? []);
  const klass = classInfo(cls, level, subclass);
  // The scores chosen, the kin's adjustments (Descending Darkness's kin; SRD species have none), the increases.
  const adjust = abilityAdjustments(species);
  // A Legacy species' own increases count unless a 2024 background gives them (updateAbilities).
  if (!bg?.is2024) for (const [stat, n] of Object.entries(kin?.increases ?? {})) adjust[stat] = (adjust[stat] ?? 0) + n;
  const scores = Object.fromEntries(STATS.map((stat) => [stat, num(spec.scores?.[stat], 10) + (adjust[stat] ?? 0) + num(spec.increases?.[stat], 0)]));
  const saves = classSaves(cls);
  const abilities = Object.fromEntries(STATS.map((stat) => [stat, { score: num(scores[stat], 10), saveprof: saves.includes(stat) ? 1 : 0 }]));
  // Skills: the background's and the species' own and chosen, the class's choices (the spec's, else the first allowed), expertise.
  const skills = {};
  const listed = (value) => (Array.isArray(value) ? value : value ? [value] : []);
  for (const key of [...(bg?.skills.base ?? []), ...(kin?.skills.base ?? []), ...listed(spec.backgroundSkills).map(skillKey), ...listed(spec.speciesSkills).map(skillKey)]) if (SKILLS[key]) skills[key] = { prof: 1 };
  const choices = classSkillChoices(cls);
  const wanted = listed(spec.skills).map(skillKey).filter((key) => SKILLS[key] && !skills[key]);
  const allowed = wanted.filter((key) => choices.names.includes(key));
  for (const key of wanted.filter((key) => !choices.names.includes(key))) problems.push(`${SKILLS[key][0]} is not a ${cls.name} skill.`);
  for (const key of choices.names) if (allowed.length < choices.count && !skills[key] && !allowed.includes(key) && !wanted.length) allowed.push(key);
  for (const key of allowed.slice(0, choices.count)) skills[key] = { prof: 1 };
  for (const key of listed(spec.expertise).map(skillKey)) if (SKILLS[key]) skills[key] = { prof: 2 };
  // Inventory: the starting kits (FG's addCommitInventory: a 2024 class's kit,
  // or a Legacy class's when no wealth was rolled; the background's), then the
  // items added. Armor and shields worn, weapons in hand.
  const inventorylist = {};
  let n = 1;
  const add = (name, count, data, location = "") => {
    // An equipment pack is opened into what it holds (FG's), each into the pack's backpack.
    const opened = packContents({ ...data, name }, lib.items ?? []);
    if (opened) {
      for (let times = 0; times < Math.max(1, Math.round(num(count, 1))); times += 1) for (const row of opened) add(row.name, row.count, row.data, row.location ?? "");
      return;
    }
    const existing = Object.values(inventorylist).find((item) => String(item.name).toLowerCase() === String(name).toLowerCase());
    if (existing) {
      existing.count += Math.max(1, Math.round(num(count, 1)));
      return;
    }
    const copy = { ...data };
    delete copy.fgPath;
    delete copy.count;
    // A kit's copy of an item has no picture: the library's item of that name brings its own.
    if (!copy.picture) {
      const known = (lib.items ?? []).find((entry) => String(entry.name).toLowerCase() === String(name).toLowerCase());
      if (typeof known?.data?.picture === "string") copy.picture = known.data.picture;
    }
    inventorylist[`id-${String(n++).padStart(5, "0")}`] = { ...copy, name: copy.name ?? String(name), count: Math.max(1, Math.round(num(count, 1))), carried: isArmor(copy) || isWeapon(copy) ? 2 : 1, ...(location ? { location } : {}) };
  };
  const rolled = Math.max(0, Math.round(num(spec.wealth, 0)));
  const processKits = klass.kits.length > 0 || rolled === 0;
  const pickKit = (options, letter, what) => {
    if (!letter) return null;
    const option = options.find((item) => item.letter === String(letter).toUpperCase());
    if (!option) problems.push(`No ${what} kit ${letter}.`);
    return option ?? null;
  };
  const classKit = processKits ? pickKit(klass.kits, spec.kits?.class, `${cls.name}`) : null;
  const backgroundKit = processKits && bg ? pickKit(bg.kits, spec.kits?.background, `${bg.name}`) : null;
  for (const item of [...(classKit?.items ?? []), ...(backgroundKit?.items ?? [])]) add(item.name, item.count, item.data);
  // A Legacy (2014) class's kit (the ruleset's table) and background's (its equipment sentence), as the wizard chose.
  if (processKits && spec.kitPicks) {
    const legacyClass = klass.kits.length ? null : legacyKit(cls, lib.items ?? []);
    const legacyBackground = bg && !bg.is2024 && !bg.kits.length ? backgroundKit2014(background?.data?.equipment, lib.items ?? []) : null;
    for (const [kit, picks] of [[legacyClass, spec.kitPicks.class], [legacyBackground, spec.kitPicks.background]]) if (kit) for (const item of legacyKitItems(kit, picks ?? {}, lib.items ?? []).items) add(item.name, item.count, item.data);
  }
  for (const [name, count = 1] of spec.gear ?? []) {
    const item = find(lib.items, name);
    if (!item) problems.push(`No item ${name}.`);
    add(item?.name ?? String(name), count, item ? item.data : { name: String(name) });
  }
  // Coins (updateTotalWealth): custom amounts, the main coin plus the rolled wealth, or the kits' wealth.
  const main = mainCurrency(profile.id);
  const custom = { ...(spec.coins ?? {}) };
  const coinKey = (name) => currenciesOf(profile.id).find((coin) => coin.toLowerCase() === String(name).toLowerCase()) ?? String(name).toUpperCase();
  const customByCoin = {};
  for (const [name, amount] of Object.entries(custom)) customByCoin[coinKey(name)] = (customByCoin[coinKey(name)] ?? 0) + num(amount, 0);
  customByCoin[main] = (customByCoin[main] ?? 0) + Math.max(0, num(spec.gold, 0));
  const backgroundGold = processKits ? (backgroundKit?.wealth ?? 0) + (bg && !bg.kits.length ? bg.gold : 0) : 0;
  let totals = totalWealth({ custom: customByCoin, rolled, classGold: classKit?.wealth ?? 0, backgroundGold, profileId: profile.id });
  for (const [name, amount] of Object.entries(customByCoin)) if (!(name in totals)) totals[name] = amount;
  // payGear (the wizard's): the items bought are paid from the purse, as a shop would.
  if (spec.payGear) {
    const paid = payFrom(totals, gearCost(spec.gear, lib.items), profile.id);
    if (paid) totals = paid;
    else problems.push("Not enough coin for the items bought.");
  }
  const coins = {};
  let c = 1;
  for (const [name, amount] of Object.entries(totals)) if (Math.round(amount) > 0) coins[`id-${String(c++).padStart(5, "0")}`] = { name, amount: Math.round(amount) };
  // Feats: the background's own, then those chosen (species, background, class).
  const feats = [...new Set([...(bg?.feat ? [bg.feat] : []), ...listed(spec.feats).map(String)].filter(Boolean))];
  for (const feat of feats) if (lib.feats && !find(lib.feats, feat)) problems.push(`No feat ${feat}.`);
  // Languages: a 2024 species's Common and those chosen; tools.
  const languages = [...new Set([...(kin?.languages.base ?? []), ...(bg?.languages.base ?? []), ...listed(spec.languages).map(String)].filter(Boolean))];
  const tools = [...new Set([...(bg?.tools.base ?? []), ...listed(spec.tools).map(String)].filter(Boolean))];
  const die = hitDie(cls);
  const con = mod(abilities.constitution.score);
  const perLevel = toughnessOf(species) || toughnessOf(ancestry);
  const toughness = perLevel * level;
  const hp = die + con + (level - 1) * (Math.floor(die / 2) + 1 + con) + toughness;
  // Senses and speed as the species' traits give them (speciesInfo: a 2014 Dwarf's 25 feet, its darkvision's 60).
  const senses = kin?.darkvision ? `Darkvision ${kin.darkvision} ft` : "";
  const warnings = listed(spec.warnings).map(String).filter(Boolean);
  const data = derive({
    ruleset: profile.id,
    hpperlevel: perLevel,
    level,
    species: species?.name ?? String(spec.species ?? spec.race ?? ""),
    race: species?.name ?? String(spec.species ?? spec.race ?? ""),
    ...(ancestry ? { ancestry: ancestry.name } : {}),
    size: String(spec.size ?? kin?.size ?? "Medium"),
    background: background?.name ?? String(spec.background ?? ""),
    alignment: String(spec.alignment ?? spec.details?.alignment ?? ""),
    // The wizard's details: who they are (gender, age, looks, deity) and the background's traits, ideals, bonds, flaws.
    ...Object.fromEntries(["gender", "age", "height", "weight", "deity", "personalitytraits", "ideals", "bonds", "flaws"].map((key) => [key, String(spec.details?.[key] ?? "").slice(0, 2000)]).filter(([, value]) => value)),
    notes: [warnings.join("\n"), String(spec.notes ?? "")].filter(Boolean).join("\n\n"),
    abilities,
    skills,
    proficiencies: { martial: martialClass(cls) },
    // The class's armor and weapons, and those the race's traits give (an Elf's Weapon Training).
    proficiencylist: { armor: [klass.armor, ...(kin?.armor ?? [])].filter((part) => part && part !== "None").join(", ") || klass.armor, weapons: [klass.weapons, ...(kin?.weapons ?? [])].filter(Boolean).join(", "), tools },
    languages,
    feats,
    traits: (kin?.traits ?? []).map((trait) => String(trait.name)),
    features: klass.features.map((feature) => `${feature.name} (${feature.subclass || cls.name} ${feature.level})`),
    ...(subclass ? { subclass: subclass.name } : {}),
    packages: { "id-00001": { name: cls.name, packagetype: "Class", level, hitdie: die, ...(subclass ? { subclass: subclass.name } : {}) } },
    hitdice: { die, total: level, used: 0 },
    hp: { total: Math.max(1, hp), wounds: 0 },
    speed: species?.data?.speed ? String(species.data.speed).replace(/\s*feet/i, " ft.") : `${kin?.speed ?? 30} ft.`,
    senses,
    inventorylist,
    coins,
    spells: (spec.spells ?? []).map((name) => find(lib.spells, name)?.name ?? (problems.push(`No spell ${name}.`), null)).filter(Boolean),
    // The spells of a level chosen in the wizard are the ones it prepares (its "Prepared Spells" count): ticked.
    prepared: spec.prepared ?? Object.fromEntries((spec.spells ?? []).map((name) => find(lib.spells, name)).filter((spell) => spell && num(spell.data?.level, 0) > 0).map((spell) => [spellSlug(spell.name), 1])),
    exp: profile.xp[level - 1] ?? 0,
  });
  return { name: String(spec.name ?? "").trim() || "Adventurer", data, problems };
}


// A level up: the hit die rolled (rolled: the die's number) + CON, at least 1; the next level's numbers.
// "Fighter 3 / Wizard 2": a character's classes and levels (one class: "Fighter 5").
export function classLine(data) {
  const classes = rows(data?.packages).filter(([, item]) => String(item.packagetype).toLowerCase() === "class");
  if (classes.length <= 1) return classes.length ? `${classes[0][1].name} ${num(data.level, 1)}` : "";
  return classes.map(([, item]) => `${item.name} ${Math.max(1, Math.round(num(item.level, 1)))}`).join(" / ");
}

// One level more: in the class chosen (a class package's key, or its name), else the first; a class not yet
// taken (name and hit die given) joins at level 1 (FG's multiclass: a class dropped on the Classes list).
export function levelUp(input, rolled, choice = {}) {
  const data = derive(input);
  const top = profileFor(data).maxLevel;
  if (data.level >= top) throw new Error(`Already level ${top}.`);
  const classes = rows(data.packages).filter(([, item]) => String(item.packagetype).toLowerCase() === "class");
  const wanted = String(choice.key ?? choice.className ?? "").toLowerCase();
  let pkg = classes.find(([key, item]) => key.toLowerCase() === wanted || String(item.name).toLowerCase() === wanted) ?? (wanted && choice.className ? null : classes[0]);
  const fresh = !pkg && choice.className;
  const die = fresh ? Math.round(num(choice.hitdie, 8)) : num(pkg?.[1]?.hitdie, num(data.hitdice?.die, 8));
  const gain = Math.max(1, Math.round(num(rolled, Math.floor(die / 2) + 1)) + data.abilities.constitution.bonus + num(data.hpperlevel, /dwarf/i.test(String(data.species ?? "")) && data.ruleset === RULESET ? 1 : 0));
  const next = { ...data, level: data.level + 1, hp: { ...data.hp, total: data.hp.total + gain } };
  if (fresh) {
    const n = classes.length ? Math.max(...rows(data.packages).map(([key]) => Number(key.replace(/\D/g, "")) || 0)) + 1 : 1;
    // The first class's levels stay as they were (one package or more, the level is their sum from now on).
    const firstKey = classes[0]?.[0];
    next.packages = { ...data.packages, ...(firstKey ? { [firstKey]: { ...classes[0][1], level: Math.max(1, Math.round(num(classes[0][1].level, data.level))) } } : {}), [`id-${String(n).padStart(5, "0")}`]: { name: String(choice.className), packagetype: "Class", level: 1, hitdie: die } };
  } else if (pkg) next.packages = { ...data.packages, [pkg[0]]: { ...pkg[1], level: (classes.length > 1 ? Math.max(1, Math.round(num(pkg[1].level, 1))) : data.level) + 1 } };
  next.hitdice = { ...(data.hitdice ?? {}), die: classes.length > 1 || fresh ? data.hitdice?.die ?? die : die, total: data.level + 1, used: num(data.hitdice?.used, 0) };
  return { data: derive(next), gain, die, className: fresh ? String(choice.className) : String(pkg?.[1]?.name ?? "") };
}
