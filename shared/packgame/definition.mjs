// @ts-check
// A game defined by its books (docs/pack-games.md): a rules pack carries a game.json that says how the game plays
// (its abilities, saving throws, how Armor Class runs, how an attack hits, initiative, morale, skills, turning, coins),
// and Maelstrom's core sets itself up from it, as Fantasy Grounds' CoreRPG takes a ruleset. The numbers (each class's
// levels, each monster) are the pack's records; this file only reads the definition and fills in what it leaves out.

export const GAME_FORMAT = "maelstrom-game";
export const GAME_VERSION = 1;

/** @param {unknown} value @param {number} fallback */
const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
/** @param {unknown} value */
const text = (value) => (typeof value === "string" ? value.trim() : "");
/** @param {unknown} value */
const slug = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/** @param {unknown} value */
const list = (value) => (Array.isArray(value) ? value : []);

// The old-school defaults: what most of the d20 family's first games share. A definition overrides any of them.
const DEFAULT_ABILITIES = [
  ["strength", "Strength", "STR"],
  ["intelligence", "Intelligence", "INT"],
  ["wisdom", "Wisdom", "WIS"],
  ["dexterity", "Dexterity", "DEX"],
  ["constitution", "Constitution", "CON"],
  ["charisma", "Charisma", "CHA"],
];
const DEFAULT_MODS = [
  [3, 3, -3],
  [4, 5, -2],
  [6, 8, -1],
  [9, 12, 0],
  [13, 15, 1],
  [16, 17, 2],
  [18, 18, 3],
];
const DEFAULT_SAVES = [
  ["death", "Death Ray or Poison"],
  ["wands", "Magic Wands"],
  ["paralysis", "Paralysis or Turn to Stone"],
  ["breath", "Dragon Breath"],
  ["spells", "Rods, Staves or Spells"],
];

/**
 * A game.json read and filled in. Throws on what cannot be played (no id or name, an unknown format).
 * @param {any} raw
 */
export function readGame(raw) {
  if (!raw || typeof raw !== "object") throw new Error("game.json is not an object.");
  if (raw.format !== undefined && raw.format !== GAME_FORMAT) throw new Error(`game.json format is "${raw.format}", not "${GAME_FORMAT}".`);
  if (num(raw.version, GAME_VERSION) > GAME_VERSION) throw new Error(`game.json version ${raw.version} is newer than this Maelstrom reads (${GAME_VERSION}).`);
  const name = text(raw.name);
  if (!name) throw new Error("game.json has no name.");
  // The id a character's data.ruleset carries: the definition's, kept to letters and digits, never a built-in game's.
  const own = slug(raw.id || name);
  const id = (own.startsWith("pack") ? own : `pack${own}`).slice(0, 40);
  const abilities = list(raw.abilities).length
    ? list(raw.abilities).map((/** @type {any} */ row) => ({ key: slug(row.key ?? row.name), label: text(row.label ?? row.name) || String(row.key), short: text(row.short) || String(row.key).slice(0, 3).toUpperCase() })).filter((row) => row.key)
    : DEFAULT_ABILITIES.map(([key, label, short]) => ({ key, label, short }));
  const keys = new Set(abilities.map((row) => row.key));
  const ability = (/** @type {unknown} */ value, /** @type {string} */ fallback) => (keys.has(slug(value)) ? slug(value) : value === null || value === "" ? "" : keys.has(fallback) ? fallback : "");
  const mods = list(raw.abilityModifiers).length ? list(raw.abilityModifiers).map((/** @type {any} */ row) => [num(row.from ?? row[0], 0), num(row.to ?? row[1], 0), num(row.mod ?? row[2], 0)]) : DEFAULT_MODS;
  const saves = list(raw.saves).length ? list(raw.saves).map((/** @type {any} */ row) => ({ key: slug(row.key ?? row.name), label: text(row.label ?? row.name) || String(row.key), ability: ability(row.ability, "") })).filter((row) => row.key) : DEFAULT_SAVES.map(([key, label]) => ({ key, label, ability: key === "spells" ? "wisdom" : "" }));
  const ac = raw.armorClass ?? {};
  const attack = raw.attack ?? {};
  const init = raw.initiative ?? {};
  const morale = raw.morale ?? {};
  const turning = raw.turning ?? null;
  // The affected dice with n more dice ("2d6" and 1: "3d6").
  const more = (/** @type {number} */ n) => {
    const m = /^(\d+)d(\d+)$/i.exec(text(turning?.affected) || "2d6");
    return m ? `${Number(m[1]) + n}d${m[2]}` : "";
  };
  const skills = raw.skills ?? null;
  const hp = raw.hitPoints ?? {};
  const coins = list(raw.coins).length ? list(raw.coins).map((/** @type {any} */ row) => ({ key: text(row.key ?? row.name).toUpperCase(), name: text(row.name ?? row.key), value: num(row.value, 0) })).filter((row) => row.key && row.value > 0) : [
    { key: "PP", name: "Platinum", value: 500 },
    { key: "GP", name: "Gold", value: 100 },
    { key: "EP", name: "Electrum", value: 50 },
    { key: "SP", name: "Silver", value: 10 },
    { key: "CP", name: "Copper", value: 1 },
  ];
  return {
    format: GAME_FORMAT,
    version: GAME_VERSION,
    id,
    name,
    blurb: text(raw.blurb) || `${name}, played from its own books.`,
    abilities,
    abilityDice: text(raw.abilityDice) || "3d6",
    // How the wizard gets the scores: rolled (abilityDice, in order) or typed (an Immortal's, carried from the mortal).
    abilityEntry: raw.abilityEntry === "typed" ? "typed" : "rolled",
    // Whether the player may swap two rolled scores (the book's own rule; not in the old boxed sets).
    abilitySwap: Boolean(raw.abilitySwap),
    // The highest score (the modifier table's top, at least 18: an Immortal's 100).
    abilityMax: Math.max(18, num(raw.abilityMax, 0), ...list(raw.abilityModifiers).map((/** @type {any} */ row) => num(row?.to, 0))),
    abilityModifiers: mods,
    saves,
    save: { die: text(raw.saveDie) || "1d20", naturalFail: num(raw.saveNaturalFail, 1), naturalPass: num(raw.saveNaturalPass, 20) },
    // An ability check: the old way rolls d20 at or under the score; a book may give a die and a direction.
    abilityCheck: { die: text(raw.abilityCheck?.die) || "1d20", atMost: raw.abilityCheck?.atMost !== false },
    armorClass: { descending: ac.descending !== false, unarmored: num(ac.unarmored, ac.descending === false ? 10 : 9), dexterity: ability(ac.ability, "dexterity") },
    attack: {
      // thac0: d20 + bonuses at or above THAC0 - the target's AC; bonus: d20 + attack bonus at or above the AC.
      by: attack.by === "bonus" ? "bonus" : "thac0",
      melee: ability(attack.melee, "strength"),
      missile: ability(attack.missile, "dexterity"),
      damage: ability(attack.damage, "strength"),
      naturalHit: num(attack.naturalHit, 20),
      naturalMiss: num(attack.naturalMiss, 1),
      minimumDamage: num(attack.minimumDamage, 1),
      // A monster's attack "by weapon" (no dice of its own): this damage (the old games: every weapon 1d6).
      weaponDamage: text(attack.weaponDamage) || "1d6",
    },
    initiative: { die: text(init.die) || "1d6", bySide: init.by !== "creature", high: init.order !== "low", ability: ability(init.ability, "") },
    morale: { die: text(morale.die) || "2d6", atMost: morale.atMost !== false },
    hitPoints: { ability: ability(hp.ability, "constitution"), abilityTo: num(hp.abilityTo, 9), deadAt: num(hp.deadAt, 0), minimumPerDie: num(hp.minimumPerDie, 1) },
    skills: skills
      ? { die: text(skills.die) || "1d100", atMost: skills.atMost !== false, names: Object.fromEntries(Object.entries(skills.names ?? {}).map(([key, label]) => [slug(key), text(label) || key])) }
      : null,
    // affectedPlus: the hit dice a "D+" result reaches (BECMI: 3d6 instead of 2d6); else one die more than affected.
    turning: turning ? { die: text(turning.die) || "2d6", affected: text(turning.affected) || "2d6", affectedPlus: text(turning.affectedPlus) || more(1),
      // The hit dice each destroying mark reaches ("D+": one die more than affected, "D#": two more; or as given).
      affectedBy: { "D+": text(turning.affectedBy?.["D+"]) || text(turning.affectedPlus) || more(1), "D#": text(turning.affectedBy?.["D#"]) || more(2) }, duration: text(turning.duration), undead: list(turning.undead).map((/** @type {any} */ row) => ({ key: slug(row.key ?? row.name), names: list(row.names ?? [row.name ?? row.key]).map(String) })).filter((row) => row.key) } : null,
    coins,
    startingGold: text(raw.startingGold) || "3d6*10",
    encumbrance: { unit: text(raw.encumbrance?.unit) || "cn", coinsPer: num(raw.encumbrance?.coinsPer, 1) },
    alignments: list(raw.alignments).map(String).filter(Boolean).length ? list(raw.alignments).map(String).filter(Boolean) : ["Lawful", "Neutral", "Chaotic"],
    maxLevel: Math.max(1, Math.round(num(raw.maxLevel, 36))),
    // The record types the game reads, and the codes a monster's "Save As" uses ("F2", "MU5", "NM").
    classType: text(raw.classType) || "class",
    saveAsCodes: Object.fromEntries(Object.entries(raw.saveAs ?? { F: "Fighter", C: "Cleric", MU: "Magic-User", M: "Magic-User", T: "Thief", D: "Dwarf", E: "Elf", H: "Halfling", NM: "Normal Man" }).map(([code, cls]) => [String(code).toUpperCase(), String(cls)])),
    // Tables the game reads by name from its books, and the numbers they hold when a book has none.
    tables: { monsterAttack: text(raw.tables?.monsterAttack) || "Monster Attack Table", normalMan: text(raw.tables?.normalMan) || "Normal Man" },
    monsterThac0: list(raw.monsterThac0).map((/** @type {any} */ row) => ({ upTo: num(row.upTo ?? row[0], 0), thac0: num(row.thac0 ?? row[1], 19) })),
    normalMan: raw.normalMan && typeof raw.normalMan === "object" ? { thac0: num(raw.normalMan.thac0, 20), saves: raw.normalMan.saves ?? {} } : null,
    calendar: text(raw.calendar) || "gregorian",
  };
}
/** @typedef {ReturnType<typeof readGame>} PackGame */
