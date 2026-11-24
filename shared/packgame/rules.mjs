// @ts-check
// The core's rules for a game defined by its books (docs/pack-games.md). Nothing here is one game's: the game's
// definition (definition.mjs readGame) says how a roll works; the numbers come from the pack's records: each class's
// levels (experience, hit dice, to-hit, saves, spells a day, turning, skills), each monster's line, each item.
//
// lib, given by the host (and the wizard): { game: PackGame, classes: class records, tables: the books' tables,
// items: item records }. Every function takes it; none keeps anything between calls.
import { monsterAttacks } from "../bfrpg/rules.mjs";

/** @typedef {import("./definition.mjs").PackGame} PackGame */
/** @typedef {{ game: PackGame, classes?: any[], tables?: any[], items?: any[] }} Lib */

/** @param {unknown} value @param {number} [fallback] */
export const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
/** @param {number} n */
export const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
/** @param {unknown} value */
const slug = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/** @param {unknown} value @returns {[string, any][]} */
const rows = (value) => (value && typeof value === "object" ? Object.entries(value).filter(([, row]) => row && typeof row === "object") : []);

// Whether a record (or a data.ruleset) is this game's.
/** @param {PackGame} game @param {any} thing */
export const isGame = (game, thing) => (typeof thing === "string" ? thing === game.id || thing === game.name : thing?.ruleset === game.id || thing?.data?.ruleset === game.id);

// --- Abilities --------------------------------------------------------------------------------------------------------
/** @param {PackGame} game @param {unknown} score */
export function abilityMod(game, score) {
  const value = Math.round(num(score, 10));
  for (const [from, to, mod] of game.abilityModifiers) if (value >= from && value <= to) return mod;
  const sorted = [...game.abilityModifiers].sort((a, b) => a[0] - b[0]);
  if (!sorted.length) return 0;
  return value < sorted[0][0] ? sorted[0][2] : sorted[sorted.length - 1][2];
}
/** @param {any} data @param {PackGame} game @param {string} key */
const modOf = (data, game, key) => (key ? abilityMod(game, data?.abilities?.[key]?.score) : 0);

// --- Classes, from the pack's class records -----------------------------------------------------------------------------
// One class, its levels merged across the books (the Basic set's 1-3, the Expert set's 4-14): a later book adds levels.
/** @param {Lib} lib */
export function classesOf(lib) {
  /** @type {Map<string, any>} */
  const byName = new Map();
  for (const record of lib.classes ?? []) {
    const data = record?.data ?? {};
    const name = String(record?.name ?? data.name ?? "").trim();
    if (!name) continue;
    const key = slug(name);
    const was = byName.get(key) ?? { name, levels: {}, abilities: {} };
    const merged = { ...data, ...was, name: was.name || name, levels: { ...was.levels }, abilities: { ...was.abilities } };
    // A field the first book left empty ({} or [] too: Basic's xpbonus for an Elf) is filled by a later book's.
    const empty = (/** @type {unknown} */ value) => value === undefined || value === null || value === "" || (Array.isArray(value) ? value.length === 0 : typeof value === "object" && Object.keys(/** @type {object} */ (value)).length === 0);
    for (const [field, value] of Object.entries(data)) if (field !== "levels" && field !== "abilities" && (empty(merged[field]) || empty(was[field]))) merged[field] = value;
    for (const [level, row] of Object.entries(data.levels ?? {})) if (Number(level) > 0 && row && typeof row === "object") merged.levels[String(Number(level))] = { ...(merged.levels[String(Number(level))] ?? {}), ...row };
    for (const [id, row] of rows(data.abilities)) merged.abilities[`${record.id ?? name}:${id}`] = row;
    for (const [rank, row] of rows(data.attackranks)) merged.attackranks = { ...(merged.attackranks ?? {}), [rank]: row };
    byName.set(key, merged);
  }
  return [...byName.values()];
}
/** @param {Lib} lib @param {unknown} name */
export const classOf = (lib, name) => classesOf(lib).find((cls) => slug(cls.name) === slug(name)) ?? null;
// The highest level the books give the class.
/** @param {any} cls @param {PackGame} game */
export const topLevel = (cls, game) => Math.min(game.maxLevel, num(cls?.maxlevel, 0) || Math.max(1, ...Object.keys(cls?.levels ?? {}).map(Number)));
// Dice and a bonus as one ("1d8+8" and 2: "1d8+10"; "1d6" and -1: "1d6-1").
/** @param {string} dice @param {number} plus */
const withPlus = (dice, plus) => {
  const m = /^(.*?\d+d\d+)([+-]\d+)?$/i.exec(dice);
  const total = (m?.[2] ? Number(m[2]) : 0) + plus;
  return m ? `${m[1]}${total ? signed(total) : ""}` : `${dice}${plus ? signed(plus) : ""}`;
};
// The weapon mastery levels, in order (BECMI's Master set).
export const MASTERY = ["basic", "skilled", "expert", "master", "grandmaster"];
// A weapon's mastery at the character's level with it (its inventory row's masterylevel; basic when not set):
// { level, damage (the primary target's), special }, or null for a weapon with no mastery table.
/** @param {any} item */
export function masteryOf(item) {
  const table = item?.mastery;
  if (!table || typeof table !== "object") return null;
  const level = MASTERY.includes(String(item.masterylevel ?? "")) ? String(item.masterylevel) : "basic";
  const row = table[level];
  if (!row || typeof row !== "object") return null;
  const text = String(row.damage ?? "").trim();
  const primary = /^P\s+([^;]+)/i.exec(text)?.[1]?.trim() ?? text;
  if (!/\d*d\d+|^\d+$/.test(primary)) return null;
  return { level, damage: primary, special: String(row.special ?? "").trim() };
}
// A demi-human's attack rank (attackranks: { "C": { xp, thac0, saves } }): at the class's last level, the highest rank
// whose experience it has; else null.
/** @param {any} cls @param {number} exp @param {number} level @param {number} top */
export function attackRankOf(cls, exp, level, top) {
  const ranks = Object.entries(cls?.attackranks ?? {}).filter(([, row]) => row && typeof row === "object" && Number.isFinite(Number(row.xp)));
  if (!ranks.length || level < top) return null;
  const reached = ranks.filter(([, row]) => num(exp, 0) >= Number(row.xp)).sort((a, b) => Number(a[1].xp) - Number(b[1].xp)).at(-1);
  return reached ? { rank: reached[0], ...reached[1] } : null;
}
// A level's row: its own, else the nearest below it that the books give (a table by level ranges).
/** @param {any} cls @param {number} level */
export function levelRow(cls, level) {
  const levels = cls?.levels ?? {};
  for (let at = Math.round(level); at >= 1; at -= 1) if (levels[String(at)]) return levels[String(at)];
  return {};
}
// A value of a level's row, the nearest level below giving it (a book that prints saves every three levels).
/** @param {any} cls @param {number} level @param {string} field */
function levelValue(cls, level, field) {
  const levels = cls?.levels ?? {};
  for (let at = Math.round(level); at >= 1; at -= 1) {
    const row = levels[String(at)];
    if (row && row[field] !== undefined && row[field] !== null && row[field] !== "") return row[field];
  }
  return undefined;
}
/** @param {any} cls @param {number} level */
export const xpFor = (cls, level) => num(cls?.levels?.[String(level)]?.xp, level <= 1 ? 0 : Infinity);
/** @param {any} cls @param {PackGame} game @param {number} xp */
export function levelForXp(cls, game, xp) {
  let level = 1;
  for (let at = 2; at <= topLevel(cls, game); at += 1) if (num(xp, 0) >= xpFor(cls, at)) level = at;
  return level;
}
// The hit die ("d8") and, past the level the ability adds to, the fixed hit points a level ("9d8+2" at 10th: +2).
/** @param {any} cls */
export const hitDie = (cls) => Math.max(1, num(/d(\d+)/i.exec(String(cls?.hitdie ?? levelValue(cls, 1, "hitdice") ?? "d6"))?.[1], 6));
/** @param {any} cls @param {number} level */
const fixedHp = (cls, level) => num(/[+](\s*\d+)\s*$/.exec(String(levelValue(cls, level, "hitdice") ?? ""))?.[1], 0);
// The prime requisite's experience bonus, in percent: the row for the highest score it reaches.
/** @param {any} cls @param {any} data */
export function xpBonusOf(cls, data) {
  // Two prime requisites (BECMI's Elf, Halfling): a list of rules, each its minimum scores, all of them or any one,
  // and its bonus; the best that holds. [{ "all": { "strength": 13, "intelligence": 16 }, "bonus": 10 }]
  if (Array.isArray(cls?.xpbonus)) {
    const scoreOf = (/** @type {string} */ key) => num(data?.abilities?.[slug(key)]?.score, 0);
    let best = 0;
    for (const rule of cls.xpbonus) {
      const all = Object.entries(rule?.all ?? {});
      const any = Object.entries(rule?.any ?? {});
      const holds = all.every(([key, min]) => scoreOf(key) >= num(min, 99)) && (!any.length || any.some(([key, min]) => scoreOf(key) >= num(min, 99)));
      if ((all.length || any.length) && holds) best = Math.max(best, num(rule.bonus, 0));
    }
    return best;
  }
  const prime = slug(cls?.primerequisite);
  const score = num(data?.abilities?.[prime]?.score, 0);
  let bonus = 0;
  for (const [from, percent] of Object.entries(cls?.xpbonus ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]))) if (score >= Number(from)) bonus = num(percent, 0);
  return bonus;
}
// What keeps a character out of a class (its minimum scores).
/** @param {any} cls @param {Record<string, number>} scores */
export function classProblems(cls, scores) {
  return Object.entries(cls?.requirements ?? {}).filter(([stat, least]) => num(scores[slug(stat)], 0) < num(least, 0)).map(([stat, least]) => `${cls.name} needs ${stat[0].toUpperCase()}${stat.slice(1)} ${least} or more.`);
}

// --- Items ---------------------------------------------------------------------------------------------------------------
/** @param {any} item */
export const isWeapon = (item) => /weapon/i.test(`${item?.type ?? ""} ${item?.subtype ?? ""}`) && Boolean(String(item?.damage ?? "").trim());
/** @param {any} item */
export const isShield = (item) => /armou?r/i.test(`${item?.type ?? ""} ${item?.subtype ?? ""}`) && (/shield/i.test(String(item?.name ?? "")) || item?.acbonus !== undefined);
/** @param {any} item */
export const isArmor = (item) => /armou?r/i.test(`${item?.type ?? ""} ${item?.subtype ?? ""}`) && !isShield(item) && item?.ac !== undefined && item?.ac !== "";
/** @param {any} item */
const magicOf = (item) => num(item?.bonus, 0) || num(/\+(\d+)\s*$/.exec(String(item?.name ?? ""))?.[1], 0);
/** @param {any} item */
const isMissile = (item) => Boolean(item?.missile) || Boolean(String(item?.range ?? "").trim()) && !/thrown/i.test(String(item?.properties ?? ""));
// A weapon with a range that is not a launcher (a dagger, a hand axe, a spear): used in melee, and thrown.
/** @param {any} item */
const isThrown = (item) => !item?.missile && Boolean(String(item?.range ?? "").trim()) && !/bow|sling|blowgun/i.test(String(item?.name ?? ""));
// A price in the game's smallest coin: "10 gp" by the game's coins.
/** @param {PackGame} game @param {unknown} cost */
export function priceOf(game, cost) {
  const match = /^([\d.]+)\s*([a-z]+)\b/i.exec(String(cost ?? "").replace(/,/g, "").trim());
  if (!match) return null;
  const coin = game.coins.find((row) => row.key.toLowerCase() === match[2].toLowerCase());
  return coin ? Math.round(Number(match[1]) * coin.value) : null;
}

// --- A character's numbers -----------------------------------------------------------------------------------------------
// Every number on the sheet from the scores, the class's row at the level, the gear worn and the misc boxes.
/** @param {any} input @param {Lib} lib */
export function derive(input, lib) {
  const game = lib.game;
  const data = { ...input, ruleset: game.id };
  const cls = classOf(lib, data.className ?? data.class);
  data.className = cls?.name ?? String(data.className ?? data.class ?? "");
  data.class = slug(data.className);
  if (cls?.race) data.race = String(cls.race);
  const top = cls ? topLevel(cls, game) : game.maxLevel;
  data.level = Math.max(1, Math.min(top, Math.round(num(data.level, 1))));
  const level = data.level;
  const row = levelRow(cls, level);
  data.leveltitle = String(row.title ?? "");
  data.exp = Math.max(0, Math.round(num(data.exp, 0)));
  data.expnext = cls && level < top && Number.isFinite(xpFor(cls, level + 1)) ? xpFor(cls, level + 1) : 0;
  data.levelReady = data.expnext > 0 && data.exp >= data.expnext;
  data.xpbonus = xpBonusOf(cls, data);
  // Abilities and their modifiers.
  const abilities = (data.abilities = { ...(data.abilities ?? {}) });
  for (const { key } of game.abilities) {
    const ability = (abilities[key] = { ...(abilities[key] ?? {}) });
    ability.score = Math.max(1, Math.min(25, Math.round(num(ability.score, 10))));
    ability.bonus = abilityMod(game, ability.score);
  }
  const mod = (/** @type {string} */ key) => modOf(data, game, key);
  // Hit points: each die rolled (kept), the ability's modifier on each to its level, the fixed gain after.
  const hp = (data.hp = { ...(data.hp ?? {}) });
  hp.wounds = Math.max(0, Math.round(num(hp.wounds, 0)));
  hp.misc = Math.round(num(hp.misc, 0));
  if (Array.isArray(hp.rolls) && hp.rolls.length) {
    const upTo = game.hitPoints.abilityTo;
    const rolled = hp.rolls.slice(0, Math.min(level, upTo)).reduce((/** @type {number} */ sum, /** @type {unknown} */ roll) => sum + Math.max(game.hitPoints.minimumPerDie, num(roll, 1) + mod(game.hitPoints.ability)), 0);
    hp.total = Math.max(1, rolled + (level > upTo ? fixedHp(cls, level) : 0) + hp.misc);
  } else hp.total = Math.max(1, Math.round(num(hp.total, 1)));
  // Armor Class: the worn armor's (or none), the shield, the Dexterity modifier, misc. Descending: lower is better.
  const items = rows(data.inventorylist);
  const worn = items.filter(([, item]) => num(item.carried, 1) === 2).map(([, item]) => item);
  const down = game.armorClass.descending ? -1 : 1;
  const armor = worn.filter(isArmor).sort((a, b) => down * (num(b.ac) - num(a.ac)))[0] ?? null;
  const shield = worn.find(isShield) ?? null;
  const ac = (data.ac = { ...(data.ac ?? {}) });
  ac.armor = armor ? num(armor.ac, game.armorClass.unarmored) + down * magicOf(armor) : game.armorClass.unarmored;
  ac.shield = shield ? num(shield.acbonus, 1) + magicOf(shield) : 0;
  ac.dex = mod(game.armorClass.dexterity);
  ac.misc = Math.round(num(ac.misc, 0));
  ac.total = ac.armor + down * (ac.shield + ac.dex + ac.misc);
  ac.worn = [armor?.name, shield?.name].filter(Boolean).join(", ");
  ac.descending = game.armorClass.descending;
  // Attack ranks (BECMI's demi-humans past their top level, Companion set): the highest rank whose experience the
  // character has, at the class's last level; its to-hit and saves replace the level's.
  const rank = attackRankOf(cls, data.exp, level, top);
  if (rank) {
    data.attackrank = rank.rank;
    // Shown with the title on the sheet: "Dwarven Lord, attack rank C".
    data.leveltitle = `${data.leveltitle ? `${data.leveltitle}, ` : ""}attack rank ${rank.rank}`;
  } else delete data.attackrank;
  // To hit: THAC0 from the class's row (the roll needed to hit AC 0), or an attack bonus.
  const thac0 = num(rank?.thac0 ?? levelValue(cls, level, "thac0"), 20);
  data.thac0 = thac0;
  data.ab = game.attack.by === "bonus" ? num(levelValue(cls, level, "attackbonus") ?? levelValue(cls, level, "ab"), 0) : 0;
  data.attack = { melee: data.ab + mod(game.attack.melee), missile: data.ab + mod(game.attack.missile) };
  // Initiative.
  data.initiative = { misc: Math.round(num(data.initiative?.misc, 0)), total: 0 };
  data.initiative.total = mod(game.initiative.ability) + data.initiative.misc;
  // Saving throws: the class's numbers at the level; an ability's modifier where the game says (Wisdom against spells).
  const baseSaves = rank?.saves ?? levelValue(cls, level, "saves") ?? {};
  const saves = (data.saves = { ...(data.saves ?? {}) });
  for (const { key, ability } of game.saves) {
    const save = (saves[key] = { ...(saves[key] ?? {}) });
    save.base = num(baseSaves[key], 20);
    save.ability = mod(ability);
    save.misc = Math.round(num(save.misc, 0));
    save.total = save.base - save.ability - save.misc;
  }
  // Attacks: each ready weapon, melee with its ability, missile with its own.
  /** @type {Record<string, any>} */
  const attacks = {};
  for (const [id, item] of items) {
    if (num(item.carried, 1) !== 2 || !isWeapon(item)) continue;
    const magic = magicOf(item);
    // Weapon mastery (BECMI's Master set): the level the character has with it (its row's masterylevel) gives the
    // damage (against the primary target: "P 1d8+8; S 1d8+6") and its special.
    const trained = masteryOf(item);
    const dice = (trained?.damage ?? String(item.damage)).replace(/\s+/g, "").split(/[/,]/)[0];
    const thrown = isThrown(item);
    const missile = isMissile(item) && !thrown;
    const bonus = (missile ? data.attack.missile : data.attack.melee) + magic;
    const plus = (missile ? 0 : mod(game.attack.damage)) + magic;
    attacks[id] = { name: String(item.name), item: id, type: missile ? "missile" : "melee", bonus, thac0, damage: withPlus(dice, plus), ...(item.range && missile ? { range: String(item.range) } : {}), ...(trained ? { mastery: trained.level, ...(trained.special ? { special: trained.special } : {}) } : {}) };
    // Thrown: a missile attack of its own (the missile ability to hit, no damage bonus but its magic).
    if (thrown) attacks[`${id}-thrown`] = { name: `${item.name} (thrown)`, item: id, type: "missile", bonus: data.attack.missile + magic, thac0, damage: withPlus(dice, magic), range: String(item.range) };
  }
  data.attacks = attacks;
  // A Thief's skills (or any class whose rows give them), by the game's names.
  const skillRow = levelValue(cls, level, "skills");
  if (skillRow && typeof skillRow === "object" && game.skills) {
    const skills = (data.thiefskills = { ...(data.thiefskills ?? {}) });
    for (const [key, base] of Object.entries(skillRow)) {
      const skill = (skills[key] = { ...(skills[key] ?? {}) });
      skill.name = game.skills.names[slug(key)] ?? key;
      // A chance in six as printed ("1-2": Hear Noise), rolled on a d6 at or under its top; else a percentage.
      const inSix = typeof base === "string" ? /^\s*1\s*-\s*([1-5])\s*$/.exec(base) : null;
      skill.base = inSix ? Number(inSix[1]) : typeof base === "number" ? base : num(String(base).replace(/%/g, ""), 0);
      skill.text = typeof base === "string" && /-|d\d/.test(base) ? base : "";
      skill.misc = Math.round(num(skill.misc, 0));
      if (inSix) {
        skill.die = "1d6";
        skill.total = Math.min(5, Math.max(1, skill.base + skill.misc));
        skill.shown = `1-${skill.total}`;
      } else {
        delete skill.die;
        skill.total = Math.min(99, Math.max(1, skill.base + skill.misc));
        skill.shown = `${skill.total}%`;
      }
    }
  } else delete data.thiefskills;
  // Turning the undead: the class's row at the level.
  const turning = levelValue(cls, level, "turning");
  data.turning = turning && typeof turning === "object" ? turning : null;
  data.turn = data.turning ? level : 0;
  // Spells a day, by spell level.
  const perday = levelValue(cls, level, "spells");
  if (perday && typeof perday === "object") {
    const most = Math.max(0, ...Object.keys(perday).map(Number));
    const counts = Array.from({ length: most }, (_, index) => Math.max(0, Math.round(num(perday[String(index + 1)], 0))));
    const used = Array.isArray(data.spellcasting?.used) ? data.spellcasting.used : [];
    data.spellcasting = { kind: /magic|arcane|elf/i.test(`${cls?.spellcasting ?? ""} ${cls?.name ?? ""}`) ? "arcane" : "divine", perday: counts, used: counts.map((max, index) => Math.max(0, Math.min(max, Math.round(num(used[index], 0))))) };
  } else delete data.spellcasting;
  data.spellbook = Array.isArray(data.spellbook) ? data.spellbook.map(String) : [];
  data.prepared = Array.isArray(data.prepared) ? data.prepared.map(String) : [];
  // What the class can do at this level (the books' abilities), named on the sheet.
  data.classabilities = Object.values(cls?.abilities ?? {}).filter((ability) => num(ability?.level, 1) <= level).map((ability) => String(ability.name ?? "")).filter(Boolean);
  // The load, in the game's unit (coins: every coin weighs one).
  let load = 0;
  for (const [, item] of items) if (num(item.carried, 1) > 0) load += num(item.encumbrance ?? item.weight, 0) * Math.max(1, num(item.count, 1));
  load += rows(data.coins).reduce((sum, [, coin]) => sum + num(coin.amount, 0), 0) / Math.max(1, game.encumbrance.coinsPer);
  data.load = Math.round(load * 10) / 10;
  data.loadunit = game.encumbrance.unit;
  data.loyalty = Math.round(num(data.loyalty, 7));
  return data;
}

/** @param {any} data @param {PackGame} game */
export function healthOf(data, game) {
  const current = num(data?.hp?.total, 0) - num(data?.hp?.wounds, 0);
  return { current, dead: current <= game.hitPoints.deadAt };
}

// A save's key from a word ("poison", "Dragon Breath"): the game's own keys, else the first whose name has the word.
/** @param {PackGame} game @param {unknown} key */
export function saveKey(game, key) {
  const word = String(key ?? "").toLowerCase();
  const exact = game.saves.find((save) => save.key === slug(word));
  if (exact) return exact.key;
  const named = game.saves.find((save) => save.label.toLowerCase().includes(word) || word.includes(save.key));
  return (named ?? game.saves[game.saves.length - 1]).key;
}

// A test for the sheet and the host: a save, an ability check, a skill or a retainer's loyalty.
/** @param {any} data @param {string} kind @param {string} key @param {PackGame} game */
export function testOf(data, kind, key, game) {
  if (kind === "save") {
    const save = saveKey(game, key);
    const label = game.saves.find((row) => row.key === save)?.label ?? save;
    return { die: game.save.die, target: num(data.saves?.[save]?.total, 20), high: true, label: `Save vs. ${label}`, natural: true };
  }
  if (kind === "skill") {
    const row = data.thiefskills?.[key];
    if (!row) throw new Error("No such skill.");
    if (row.die) return { die: row.die, target: num(row.total, 0), high: false, label: row.name };
    return { die: game.skills?.die ?? "1d100", target: num(row.total, 0), high: !(game.skills?.atMost ?? true), label: row.name };
  }
  if (kind === "morale") return { die: game.morale.die, target: num(data.loyalty, 7), high: !game.morale.atMost, label: "Loyalty (morale)" };
  const stat = game.abilities.some((row) => row.key === key) ? key : game.abilities[0].key;
  const label = game.abilities.find((row) => row.key === stat)?.label ?? stat;
  return { die: game.abilityCheck.die, target: num(data.abilities?.[stat]?.score, 10), high: !game.abilityCheck.atMost, label: `${label} check` };
}

// --- Monsters ------------------------------------------------------------------------------------------------------------
// Hit dice as printed: "3*", "5+1**", "1-1", "1/2", "11+3": the dice to roll, the level to look up the to-hit by, the stars.
/** @param {unknown} text */
export function hitDiceOf(text) {
  const raw = String(text ?? "").replace(/[–—]/g, "-").trim();
  const stars = (raw.match(/\*/g) ?? []).length;
  const clean = raw.replace(/\*/g, "").replace(/\s+/g, "");
  if (/^1\/2$|^½$/.test(clean)) return { dice: "1d4", level: 0.5, plus: 0, stars };
  const match = /^(\d+)(?:\s*([+-])\s*(\d+))?/.exec(clean);
  if (!match) return { dice: "1d8", level: 1, plus: 0, stars };
  const count = Number(match[1]);
  const plus = match[2] ? (match[2] === "-" ? -1 : 1) * Number(match[3]) : 0;
  return { dice: `${count}d8${plus ? signed(plus) : ""}`, level: count + (plus > 0 ? 0.5 : 0), plus, stars };
}
// A monster's THAC0 from its hit dice: the books' Monster Attack Table (rows by hit dice), else the definition's.
/** @param {Lib} lib @param {{ level: number }} hd */
export function monsterThac0(lib, hd) {
  const game = lib.game;
  const table = (lib.tables ?? []).find((record) => String(record?.name ?? "").toLowerCase() === game.tables.monsterAttack.toLowerCase());
  const at = Math.ceil(hd.level * 2) / 2;
  if (table) {
    for (const [, row] of rows(table.data?.tablerows ?? table.tablerows)) {
      const from = num(row.fromrange, 0);
      const to = num(row.torange, from);
      const result = num(Object.values(row.results ?? {})[0]?.result, NaN);
      // The column a monster falls in: up to 1, 1+ to 2, 2+ to 3: hit dice with a plus are the next column.
      const level = hd.level % 1 ? Math.floor(hd.level) + 1 : hd.level;
      if (Number.isFinite(result) && level >= from && level <= to) return result;
    }
  }
  const rowFor = game.monsterThac0.find((row) => at <= row.upTo);
  if (rowFor) return rowFor.thac0;
  return Math.max(2, 19 - Math.floor(Math.max(0, hd.level - 1)));
}
// The "Save As" code ("F2", "MU5", "NM") read: the class and the level whose saves the monster uses.
/** @param {Lib} lib @param {unknown} text @param {number} hdLevel */
export function savesAs(lib, text, hdLevel) {
  const game = lib.game;
  const raw = String(text ?? "").toUpperCase().replace(/\s+/g, "");
  const match = /^([A-Z]+?)[:]?(\d+)?$/.exec(raw);
  const code = match?.[1] ?? "";
  const level = Math.max(1, num(match?.[2], Math.max(1, Math.round(hdLevel))));
  const className = game.saveAsCodes[code] ?? (raw ? "" : "Fighter");
  if (/normal\s*man/i.test(className) || code === "NM") {
    // The books' Normal Man table: a row a value, "death: 14", "thac0: 20".
    const table = (lib.tables ?? []).find((record) => String(record?.name ?? "").toLowerCase() === game.tables.normalMan.toLowerCase());
    /** @type {Record<string, number>} */
    const results = {};
    for (const [, row] of rows(table?.data?.tablerows ?? table?.tablerows)) {
      for (const [, cell] of rows(row.results)) {
        const pair = /^\s*([^:=]+?)\s*[:=]\s*(-?\d+)/.exec(String(cell.result ?? ""));
        if (pair) results[slug(pair[1])] = Number(pair[2]);
      }
    }
    const saves = Object.fromEntries(game.saves.map(({ key }) => [key, num(results[key] ?? game.normalMan?.saves?.[key], 20)]));
    // Its to-hit too (the table's "thac0: 20" row, else the definition's).
    const thac0 = num(results.thac0 ?? game.normalMan?.thac0, NaN);
    return { cls: "Normal Man", level: 0, saves, ...(Number.isFinite(thac0) ? { thac0 } : {}) };
  }
  const cls = classOf(lib, className);
  const saves = levelValue(cls, level, "saves") ?? {};
  return { cls: cls?.name ?? className, level, saves: Object.fromEntries(game.saves.map(({ key }) => [key, num(saves[key], 20)])) };
}
// An NPC record's numbers for the tracker.
/** @param {any} data @param {Lib} lib */
export function npcStats(data = {}, lib) {
  const hd = hitDiceOf(data.hd ?? data.hitdice);
  const ac = num(/-?\d+/.exec(String(data.ac ?? ""))?.[0], lib.game.armorClass.unarmored);
  const avg = /^(\d+)d(\d+)([+-]\d+)?$/.exec(hd.dice);
  const hp = num(data.hp, 0) || (avg ? Math.max(1, Math.floor((Number(avg[1]) * (Number(avg[2]) + 1)) / 2) + num(avg[3], 0)) : 1);
  const saves = savesAs(lib, data.saveas ?? data.saveAs, hd.level);
  // A Normal Man attacks as one (the books' Normal Man numbers), else by its hit dice.
  // A THAC0 the record gives (0 and below too: a huge dragon's), else a Normal Man's, else by hit dice.
  const own = data.thac0 === null || data.thac0 === undefined || data.thac0 === "" ? NaN : Number(data.thac0);
  const thac0 = Number.isFinite(own) ? own : saves.cls === "Normal Man" && "thac0" in saves && Number.isFinite(saves.thac0) ? saves.thac0 : monsterThac0(lib, hd);
  // An attack "by weapon" with no dice of its own rolls the game's weapon damage (BECMI: 1d6).
  const attacks = monsterAttacks(data.attacks, data.damage, 0).map((/** @type {any} */ attack) => (!attack.damage && /weapon/i.test(`${attack.name} ${data.damage ?? ""}`) ? { ...attack, damage: lib.game.attack.weaponDamage } : attack));
  return {
    ac,
    hd,
    hp,
    dice: hd.dice,
    thac0,
    ab: 0,
    attacks: (attacks.length ? attacks : [{ name: "Attack", bonus: 0, damage: "1d6" }]).map((/** @type {any} */ attack) => ({ ...attack, thac0 })),
    saves: saves.saves,
    savesas: saves.cls ? `${saves.cls}${saves.level ? ` ${saves.level}` : ""}` : "",
    morale: num(/(\d+)/.exec(String(data.morale ?? ""))?.[1], 0),
    xp: num(String(data.xp ?? "").replace(/,/g, ""), 0),
    init: 0,
  };
}
// The number an attack needs on the die: THAC0 minus the target's (descending) AC, or the AC itself (ascending).
/** @param {PackGame} game @param {{ thac0?: number }} attacker @param {number} targetAc */
export const hitNumber = (game, attacker, targetAc) => (game.attack.by === "thac0" ? num(attacker.thac0, 20) - num(targetAc, game.armorClass.unarmored) : num(targetAc, game.armorClass.unarmored));

// --- Turning the undead --------------------------------------------------------------------------------------------------
// Which of the game's undead kinds a monster is: its record's own word, else its name.
/** @param {PackGame} game @param {any} data @param {string} name */
export function undeadKind(game, data, name) {
  if (!game.turning) return null;
  const own = slug(data?.undead ?? data?.turnas);
  if (own && game.turning.undead.some((row) => row.key === own)) return own;
  const words = String(name ?? data?.name ?? "").toLowerCase();
  return game.turning.undead.find((row) => row.names.some((word) => words.includes(String(word).toLowerCase())))?.key ?? null;
}
// The cleric's row against a kind: a number (roll it or more on the die), "T" turned, "D" destroyed, or none.
/** @param {any} turning @param {string} kind */
export function turnAgainst(turning, kind) {
  const value = String(turning?.[kind] ?? "").trim().toUpperCase();
  if (!value || value === "-" || value === "NO") return { can: false };
  if (value === "T") return { can: true, auto: "turned" };
  if (value === "D") return { can: true, auto: "destroyed" };
  // "D+", "D#": destroyed, and the turn reaches more hit dice (the definition's affectedBy: BECMI's 3d6 and 4d6).
  if (value === "D+" || value === "D#") return { can: true, auto: "destroyed", plus: true, mark: value };
  const need = num(value, NaN);
  return Number.isFinite(need) ? { can: true, need } : { can: false };
}

// --- Making and raising characters ---------------------------------------------------------------------------------------
// spec: { name, class, abilities {key: score}, hpRoll (the hit die rolled at 1st level; else its most), gold (rolled),
// buy [[name, count]], spells, alignment, details }.
/** @param {any} spec @param {Lib} lib */
export function buildFromSpec(spec, lib) {
  const game = lib.game;
  const problems = [];
  const name = String(spec?.name ?? "").trim().slice(0, 80) || "Adventurer";
  const cls = classOf(lib, spec?.class ?? spec?.className) ?? classesOf(lib)[0] ?? null;
  if (!cls) problems.push("No classes: make the game's rules book active (Modules).");
  const abilities = Object.fromEntries(game.abilities.map(({ key }) => [key, { score: Math.max(3, Math.min(18, Math.round(num(spec?.abilities?.[key], 10)))) }]));
  const scores = Object.fromEntries(game.abilities.map(({ key }) => [key, abilities[key].score]));
  if (cls) problems.push(...classProblems(cls, scores));
  const die = hitDie(cls);
  const rolls = [Math.max(1, Math.min(die, Math.round(num(spec?.hpRoll, die))))];
  // Money: the gold rolled, in the smallest coin; then the shop.
  const smallest = Math.min(...game.coins.map((coin) => coin.value));
  const gold = game.coins.find((coin) => coin.key === "GP") ?? game.coins[0];
  const purse = Math.max(0, Math.round(num(spec?.gold, 0))) * gold.value;
  let spent = 0;
  /** @type {Record<string, any>} */
  const inventorylist = {};
  let next = 1;
  let armorWorn = false;
  let shieldWorn = false;
  let weaponsReady = 0;
  for (const [itemName, countIn] of Array.isArray(spec?.buy) ? spec.buy : []) {
    const count = Math.max(1, Math.min(99, Math.round(num(countIn, 1))));
    const found = (lib.items ?? []).find((item) => String(item.name).toLowerCase() === String(itemName).toLowerCase());
    if (!found) {
      problems.push(`${itemName} is not for sale.`);
      continue;
    }
    const price = priceOf(game, found.data?.cost);
    if (price === null) {
      problems.push(`${itemName} has no price.`);
      continue;
    }
    if (spent + price * count > purse) {
      problems.push(`Not enough money for ${itemName}.`);
      continue;
    }
    spent += price * count;
    const { fgPath: _path, ...copy } = found.data ?? {};
    let carried = 1;
    if (isArmor(copy) && !armorWorn) [carried, armorWorn] = [2, true];
    else if (isShield(copy) && !shieldWorn) [carried, shieldWorn] = [2, true];
    else if (isWeapon(copy) && weaponsReady < 2) [carried, weaponsReady] = [2, weaponsReady + 1];
    inventorylist[`id-${String(next++).padStart(5, "0")}`] = { ...copy, name: found.name, count, carried };
  }
  // What is left, in the game's coins, largest first (the rest in the smallest).
  let left = purse - spent;
  /** @type {Record<string, any>} */
  const coins = {};
  game.coins.forEach((coin, index) => {
    const take = coin.key === "PP" || coin.key === "EP" ? 0 : Math.floor(left / coin.value);
    left -= take * coin.value;
    coins[`id-${String(index + 1).padStart(5, "0")}`] = { name: coin.key, amount: take };
  });
  if (left > 0) {
    const last = Object.values(coins).find((coin) => game.coins.find((row) => row.key === coin.name)?.value === smallest);
    if (last) last.amount += left;
  }
  const text = (/** @type {string} */ field, max = 8000) => String(spec?.[field] ?? "").slice(0, max);
  const data = derive(
    {
      ruleset: game.id,
      className: cls?.name ?? "",
      level: 1,
      exp: 0,
      abilities,
      hp: { rolls, wounds: 0 },
      inventorylist,
      coins,
      spellbook: Array.isArray(spec?.spells) ? spec.spells.map(String) : [],
      prepared: [],
      alignment: game.alignments.includes(spec?.alignment) ? spec.alignment : game.alignments[Math.floor(game.alignments.length / 2)] ?? "",
      playername: text("playername", 80),
      appearance: text("appearance"),
      deity: text("deity", 120),
      notes: text("notes"),
      background: text("background"),
      gender: text("gender", 40),
      age: text("age", 20),
      height: text("height", 20),
      weight: text("weight", 20),
      languages: text("languages", 400),
      ...(typeof spec?.portrait === "string" ? { portrait: spec.portrait } : {}),
      ...(typeof spec?.token === "string" ? { token: spec.token } : {}),
    },
    lib,
  );
  return { name, data, problems, spent, left: purse - spent };
}
// A book's sample character (a pregencharsheet: class, level, the six scores, hp, ac, xp, equipment lines, coins)
// as the book made it. Each equipment line is matched to the books' items by name ("Chain mail & shield": Chain Mail
// Armor and Shield; "2 large sacks": 2 Large Sack); a line no item has stays as a plain carried thing, and is said.
/** @param {any} pregen @param {Lib} lib */
export function fromPregen(pregen, lib) {
  const game = lib.game;
  const src = pregen?.data ?? pregen ?? {};
  const problems = [];
  const names = new Map((lib.items ?? []).map((item) => [String(item.name).toLowerCase(), String(item.name)]));
  const findItem = (/** @type {string} */ words) => {
    const base = words.toLowerCase().replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    for (const name of [base, `${base} armor`, base.replace(/s$/, ""), base.replace(/es$/, ""), `${base.replace(/s$/, "")} armor`]) if (names.has(name)) return names.get(name);
    return null;
  };
  /** @type {[string, number][]} */
  const buy = [];
  /** @type {string[]} */
  const plain = [];
  for (const line of Array.isArray(src.equipment) ? src.equipment : String(src.equipment ?? "").split(/[,;\n]/)) {
    const text = String(line ?? "").trim();
    if (!text) continue;
    // The whole line an item ("12 Iron Spikes and Small Hammer"), else its parts joined by & or "and".
    const whole = findItem(text);
    const parts = whole ? [text] : text.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean);
    const found = parts.map((part) => {
      if (whole) return { count: 1, name: whole };
      const counted = /^(\d+)\s+(.+)$/.exec(part);
      return { count: counted ? Number(counted[1]) : 1, name: findItem(counted ? counted[2] : part) };
    });
    if (found.every((item) => item.name)) for (const item of found) buy.push([/** @type {string} */ (item.name), item.count]);
    else plain.push(text);
  }
  const cls = classOf(lib, src.class ?? src.className);
  if (!cls) problems.push(`${src.class ?? "Its class"} is not in the active books.`);
  const abilities = Object.fromEntries(game.abilities.map(({ key }) => [key, num(src[key] ?? src.abilities?.[key]?.score ?? src.abilities?.[key], 10)]));
  const hpWanted = num(src.hp, 0);
  const conMod = game.hitPoints.ability ? abilityMod(game, num(abilities[game.hitPoints.ability], 10)) : 0;
  const built = buildFromSpec({ name: src.name ?? pregen?.name, class: cls?.name, abilities, hpRoll: hpWanted ? hpWanted - conMod : undefined, gold: 1e7, buy, alignment: src.alignment }, lib);
  problems.push(...built.problems.filter((text) => !/money|for sale|price/i.test(text)));
  const data = built.data;
  // What no item is: carried as it is written.
  let next = Object.keys(data.inventorylist ?? {}).length + 1;
  for (const text of plain) data.inventorylist[`id-${String(next++).padStart(5, "0")}`] = { name: text, type: "Gear", count: 1, carried: 1 };
  if (plain.length) problems.push(`Not in the books' items, carried as written: ${plain.join("; ")}.`);
  // The coins it has (its own, not the shop's change).
  const coinsIn = src.coins && typeof src.coins === "object" ? src.coins : {};
  data.coins = Object.fromEntries(game.coins.map((coin, index) => [`id-${String(index + 1).padStart(5, "0")}`, { name: coin.key, amount: Math.max(0, Math.round(num(coinsIn[coin.key] ?? coinsIn[coin.key.toLowerCase()], 0))) }]));
  data.level = Math.max(1, Math.round(num(src.level, 1)));
  data.exp = Math.max(0, num(src.xp ?? src.exp, 0));
  if (hpWanted && data.hp) data.hp.rolls = [Math.max(1, hpWanted - conMod)];
  if (Array.isArray(src.spells)) data.spellbook = src.spells.map(String);
  const out = derive(data, lib);
  if (src.ac !== undefined && num(out.ac?.total, NaN) !== num(src.ac, NaN)) problems.push(`The book gives AC ${src.ac}; its gear makes ${out.ac?.total}.`);
  return { name: built.name, data: out, problems };
}
// The hit die a level up rolls (none past the level the ability adds to: the class's fixed gain).
/** @param {any} data @param {Lib} lib */
export const levelUpDie = (data, lib) => (Math.round(num(data?.level, 1)) + 1 <= lib.game.hitPoints.abilityTo ? hitDie(classOf(lib, data?.className ?? data?.class)) : 0);
// One level up: the die rolled (to the level the ability adds to) or the fixed gain after; every number again.
/** @param {any} input @param {number} rolled @param {Lib} lib */
export function levelUp(input, rolled, lib) {
  const data = derive(input, lib);
  const cls = classOf(lib, data.className);
  if (!cls) throw new Error("No such class in the active books.");
  if (data.level >= topLevel(cls, lib.game)) throw new Error(`${data.className} goes no higher in the active books (level ${topLevel(cls, lib.game)}).`);
  const before = data.hp.total;
  const rolls = Array.isArray(data.hp.rolls) && data.hp.rolls.length ? [...data.hp.rolls] : [Math.max(1, data.hp.total)];
  if (data.level + 1 <= lib.game.hitPoints.abilityTo) rolls.push(Math.max(1, Math.round(num(rolled, 1))));
  const out = derive({ ...data, level: data.level + 1, hp: { ...data.hp, rolls } }, lib);
  return { data: out, gain: out.hp.total - before };
}
