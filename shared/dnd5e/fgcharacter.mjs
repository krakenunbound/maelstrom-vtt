// A Fantasy Grounds 5E character (its XML, read: the <character> node) as a Maelstrom 5E sheet, as FG's own
// /importchar brings one in whole: classes and levels (its subclass), scores and saving throw proficiencies, skills
// (proficient, expertise, half), languages, proficiencies, feats, features, traits, spells (prepared), gear, coins, hit
// points and dice, the description. The numbers are then worked out again (rules.derive), so they follow Maelstrom's
// rules from the same choices.
const num = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null ? Number(value) : fallback);
const rows = (node) => Object.values(node && typeof node === "object" ? node : {}).filter((row) => row && typeof row === "object");
const names = (node) => [...new Set(rows(node).map((row) => String(row.name ?? "").trim()).filter(Boolean))];
const STATS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

/** Is this FG character a 5E one (its abilities with saving throw proficiencies, its classes)? */
export function isFg5eCharacter(character) {
  return Boolean(character && typeof character === "object" && character.abilities?.strength && (character.classes || character.skilllist) && !character.attributes);
}

/**
 * @param {Record<string, any>} ch FG's character node
 * @param {{ skillKey: (name: string) => string; spellSlug: (name: string) => string; rulesetId: string }} rules
 */
export function fromFg5eCharacter(ch, rules) {
  const classes = rows(ch.classes);
  const packages = Object.fromEntries(
    classes.map((row, index) => [
      `id-${String(index + 1).padStart(5, "0")}`,
      {
        name: String(row.name ?? ""),
        packagetype: "Class",
        level: Math.max(1, Math.round(num(row.level, 1))),
        hitdie: num(/d(\d+)/.exec(String(row.hddie ?? ""))?.[1], 8),
        ...(row.specialization ? { subclass: String(row.specialization) } : {}),
      },
    ]),
  );
  const level = classes.reduce((sum, row) => sum + Math.max(1, Math.round(num(row.level, 1))), 0) || Math.max(1, Math.round(num(ch.level, 1)));
  const abilities = Object.fromEntries(STATS.map((stat) => [stat, { score: num(ch.abilities?.[stat]?.score, 10), saveprof: num(ch.abilities?.[stat]?.saveprof) > 0 ? 1 : 0 }]));
  const skills = {};
  for (const row of rows(ch.skilllist)) {
    const key = rules.skillKey(row.name);
    const prof = Math.round(num(row.prof));
    if (key && prof > 0) skills[key] = { prof, ...(num(row.misc) ? { misc: num(row.misc) } : {}) };
  }
  // FG's proficiency rows: "Armor: Light armor", "Weapon: Daggers", "Tool: Playing Card Set".
  const proficiencylist = { armor: [], weapons: [], tools: [] };
  for (const name of names(ch.proficiencylist)) {
    const match = /^(armor|weapons?|tools?)\s*:\s*(.+)$/i.exec(name);
    const kind = match ? (/^armor/i.test(match[1]) ? "armor" : /^weapon/i.test(match[1]) ? "weapons" : "tools") : "tools";
    proficiencylist[kind].push((match ? match[2] : name).trim());
  }
  // Spells: the powers in a "Spells (...)" group; those prepared ticked.
  const spellRows = rows(ch.powers).filter((row) => /^spells/i.test(String(row.group ?? "")));
  const spells = [...new Set(spellRows.map((row) => String(row.name ?? "").trim()).filter(Boolean))];
  const prepared = Object.fromEntries(spellRows.filter((row) => num(row.level) > 0 && num(row.prepared) > 0).map((row) => [rules.spellSlug(String(row.name)), 1]));
  const languages = names(ch.languagelist).filter((name) => !/^choice$/i.test(name));
  const used = classes.reduce((sum, row) => sum + Math.max(0, Math.round(num(row.hdused))), 0);
  const text = (key) => (typeof ch[key] === "string" ? ch[key] : "");
  return {
    ruleset: rules.rulesetId,
    name: String(ch.name ?? "").trim() || "Imported character",
    level,
    species: String(ch.race ?? ch.racename ?? ""),
    race: String(ch.race ?? ch.racename ?? ""),
    background: text("background"),
    alignment: text("alignment"),
    deity: text("deity"),
    gender: text("gender"),
    age: text("age"),
    height: text("height"),
    weight: text("weight"),
    size: text("size") || "Medium",
    senses: text("senses"),
    exp: num(ch.exp),
    inspiration: num(ch.inspiration),
    abilities,
    skills,
    proficiencylist: Object.fromEntries(Object.entries(proficiencylist).map(([kind, list]) => [kind, list])),
    languages,
    feats: names(ch.featlist),
    features: names(ch.featurelist),
    traits: names(ch.traitlist),
    packages,
    hitdice: { die: num(rows(ch.classes)[0] && /d(\d+)/.exec(String(rows(ch.classes)[0].hddie ?? ""))?.[1], 8), total: level, used },
    hp: { total: Math.max(1, num(ch.hp?.total, 1)), wounds: Math.max(0, num(ch.hp?.wounds)), ...(num(ch.hp?.temporary) ? { temporary: num(ch.hp.temporary) } : {}) },
    deathsaves: { success: num(ch.hp?.deathsavesuccess), fail: num(ch.hp?.deathsavefail) },
    ...(num(ch.defenses?.ac?.misc) ? { ac: { misc: num(ch.defenses.ac.misc) } } : {}),
    ...(num(ch.initiative?.misc) ? { initiative: { misc: num(ch.initiative.misc) } } : {}),
    speed: `${num(ch.speed?.base, 30)} ft.`,
    inventorylist: Object.fromEntries(rows(ch.inventorylist).map((row, index) => [`id-${String(index + 1).padStart(5, "0")}`, Object.fromEntries(Object.entries(row).filter(([key]) => !["locked", "shortcut"].includes(key)))])),
    coins: Object.fromEntries(rows(ch.coins).map((row, index) => [`id-${String(index + 1).padStart(5, "0")}`, { name: String(row.name ?? ""), amount: num(row.amount) }])),
    spells,
    prepared,
    notes: text("notes"),
  };
}
