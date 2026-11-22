// A 5E stat block pasted as text (FG's Import NPC from text): the 2014 layout ("Armor Class 15 (leather armor)",
// "STR DEX CON..." then "8 (-1) 14 (+2)...", "Challenge 1/4 (50 XP)") and the 2024 one ("AC 15 Initiative +2 (12)",
// "Str 8 -1 -1 Dex 15 +2 +2...", "CR 1/4 (XP 50; PB +2)"), into an NPC record's data as the books' NPCs keep it.

const STATS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const SHORT = { str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma" };
// The sections a stat block's entries fall into, and the record's list for each.
const SECTIONS = [
  [/^traits$/i, "traits"],
  [/^actions$/i, "actions"],
  [/^bonus actions$/i, "bonusactions"],
  [/^reactions$/i, "reactions"],
  [/^legendary actions$/i, "legendaryactions"],
  [/^lair actions$/i, "lairactions"],
  [/^mythic actions$/i, "mythicactions"],
];
const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];

/** @param {string} value */
const signedNumber = (value) => Number(String(value).replace(/[−–—]/g, "-").replace(/\s+/g, ""));
const bonusOf = (/** @type {number} */ score) => Math.floor((score - 10) / 2);
/** @param {string} text */
const clean = (text) =>
  String(text ?? "")
    .replace(/\r/g, "")
    .replace(/[−–—]/g, (dash) => (dash === "—" ? "—" : "-"))
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n");
// XP by challenge rating (the SRD's table), for a block that gives no XP.
const XP = { 0: 10, "1/8": 25, "1/4": 50, "1/2": 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };

/**
 * @param {string} input the pasted stat block
 * @returns {{ name: string; data: Record<string, any>; version: "2014" | "2024"; problems: string[] }}
 */
export function parseStatBlock(input) {
  const text = clean(input).trim();
  if (!text) throw new Error("Paste a stat block.");
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const problems = [];
  const data = { name: "", size: "", type: "", alignment: "", ac: 10, hp: 1, hd: "", speed: "30 ft.", abilities: {}, initiative: { misc: 0 }, skills: "", damageresistances: "", damagevulnerabilities: "", damageimmunities: "", conditionimmunities: "", senses: "", languages: "", cr: "0", xp: 0 };
  const name = lines.shift() ?? "";
  data.name = name.replace(/\s+/g, " ").trim();
  // "Small Humanoid (Goblinoid), Neutral Evil"
  const kind = lines[0] && SIZES.some((size) => lines[0].toLowerCase().startsWith(size)) ? lines.shift() : "";
  if (kind) {
    const [left, ...alignment] = kind.split(",");
    const words = left.trim().split(" ");
    const sizeWords = [];
    while (words.length && (SIZES.includes(words[0].toLowerCase()) || words[0].toLowerCase() === "or")) sizeWords.push(words.shift());
    data.size = sizeWords.join(" ");
    data.type = words.join(" ");
    data.alignment = alignment.join(",").trim();
  } else problems.push("No size, type and alignment line.");

  let version = /** @type {"2014" | "2024"} */ ("2014");
  // The header's lines until the first section or entry: AC, HP, speed, abilities, the rest.
  const header = [];
  while (lines.length && !SECTIONS.some(([pattern]) => pattern.test(lines[0])) && !(header.some((line) => /^(challenge|cr)\b/i.test(line)) && /^[A-Z][^.]{0,70}\.\s/.test(lines[0]))) header.push(lines.shift());
  const joined = header.join("\n");

  // Armor class (2014 "Armor Class 15 (leather armor)"; 2024 "AC 15 Initiative +2 (12)").
  const ac = /(?:armor class|^ac)\s*(\d+)/im.exec(joined);
  if (ac) data.ac = Number(ac[1]);
  else problems.push("No Armor Class.");
  const init = /initiative\s*([+-]\s*\d+)/i.exec(joined);
  if (init) version = "2024";
  const hp = /(?:hit points|^hp)\s*(\d+)\s*(\([^)]*\))?/im.exec(joined);
  if (hp) {
    data.hp = Number(hp[1]);
    data.hd = hp[2] ? hp[2].replace(/\s+/g, " ") : "";
  } else problems.push("No hit points.");
  const speed = /^speed\s+(.+)$/im.exec(joined);
  if (speed) data.speed = speed[1].trim();

  // Abilities: 2024 "Str 8 -1 -1" (score, mod, save), 2014 the STR..CHA header then "8 (-1) 14 (+2)...".
  const saves = {};
  const modern = [...joined.matchAll(/\b(str|dex|con|int|wis|cha)\s+(\d{1,2})\s+([+-]\s*\d+)\s+([+-]\s*\d+)/gi)];
  if (modern.length >= 6) {
    version = "2024";
    for (const match of modern) {
      const stat = SHORT[match[1].toLowerCase()];
      const score = Number(match[2]);
      const save = signedNumber(match[4]);
      data.abilities[stat] = { score, bonus: bonusOf(score), savemodifier: save - bonusOf(score) };
      if (save !== bonusOf(score)) saves[stat] = save;
    }
  } else {
    const scores = [...joined.matchAll(/(\d{1,2})\s*\(\s*([+-]\s*\d+)\s*\)/g)].slice(0, 6);
    if (scores.length === 6) STATS.forEach((stat, index) => (data.abilities[stat] = { score: Number(scores[index][1]), bonus: bonusOf(Number(scores[index][1])), savemodifier: 0 }));
    else {
      problems.push("No ability scores (STR to CHA).");
      for (const stat of STATS) data.abilities[stat] = { score: 10, bonus: 0, savemodifier: 0 };
    }
    // "Saving Throws Dex +5, Wis +3"
    const listed = /^saving throws\s+(.+)$/im.exec(joined);
    for (const match of listed ? listed[1].matchAll(/\b(str|dex|con|int|wis|cha)\w*\s*([+-]\s*\d+)/gi) : []) {
      const stat = SHORT[match[1].toLowerCase().slice(0, 3)];
      saves[stat] = signedNumber(match[2]);
      data.abilities[stat].savemodifier = saves[stat] - data.abilities[stat].bonus;
    }
  }
  for (const stat of STATS) data.abilities[stat] ??= { score: 10, bonus: 0, savemodifier: 0 };
  const saveWords = Object.entries(saves).map(([stat, value]) => `${stat[0].toUpperCase()}${stat.slice(1, 3)} ${value >= 0 ? "+" : ""}${value}`);
  if (saveWords.length) data.savingthrows = saveWords.join(", ");
  if (init) data.initiative = { misc: signedNumber(init[1]) - data.abilities.dexterity.bonus };

  // The labelled lines.
  const field = (/** @type {RegExp} */ label) => label.exec(joined)?.[1]?.trim() ?? "";
  data.skills = field(/^skills\s+(.+)$/im);
  data.damagevulnerabilities = field(/^(?:damage )?vulnerabilities\s+(.+)$/im);
  data.damageresistances = field(/^(?:damage )?resistances\s+(.+)$/im);
  // 2024 "Immunities Fire; Charmed, Frightened": damage before the semicolon, conditions after.
  const immunities = field(/^immunities\s+(.+)$/im);
  if (immunities) {
    const [damage, conditions] = immunities.split(";");
    data.damageimmunities = (damage ?? "").trim();
    data.conditionimmunities = (conditions ?? "").trim();
  }
  data.damageimmunities ||= field(/^damage immunities\s+(.+)$/im);
  data.conditionimmunities ||= field(/^condition immunities\s+(.+)$/im);
  const gear = field(/^gear\s+(.+)$/im);
  if (gear) data.gear = gear;
  data.senses = field(/^senses\s+(.+)$/im);
  data.languages = field(/^languages\s+(.+)$/im);
  // "Challenge 1/4 (50 XP)" or "CR 1/4 (XP 50; PB +2)"
  const cr = /^(?:challenge|cr)\s+([\d/]+)\s*(?:\(([^)]*)\))?/im.exec(joined);
  if (cr) {
    data.cr = cr[1];
    const xp = /([\d,]+)\s*xp|xp\s*([\d,]+)/i.exec(cr[2] ?? "");
    data.xp = xp ? Number((xp[1] ?? xp[2]).replace(/,/g, "")) : XP[/** @type {keyof typeof XP} */ (cr[1])] ?? 0;
  } else problems.push("No challenge rating.");

  // The entries: "Name. Text..." (a line beginning so starts the next one), under their sections; before any section
  // (2014's traits come straight after the header) they are traits.
  let list = "traits";
  /** @type {Record<string, { name: string; desc: string }[]>} */
  const entries = {};
  for (const line of lines) {
    const section = SECTIONS.find(([pattern]) => pattern.test(line));
    if (section) {
      list = section[1];
      continue;
    }
    const start = /^([A-Z][^.:]{0,80}?(?:\([^)]{0,40}\))?)[.:]\s+(.*)$/.exec(line);
    const bucket = (entries[list] ??= []);
    if (start && (bucket.length === 0 || /[.!?)"]$/.test(bucket.at(-1)?.desc ?? "") || !/^[a-z]/.test(start[1]))) bucket.push({ name: start[1].trim(), desc: start[2].trim() });
    else if (bucket.length) bucket.at(-1).desc = `${bucket.at(-1).desc} ${line}`.replace(/(\w)- (\w)/g, "$1$2");
    else bucket.push({ name: "", desc: line });
  }
  for (const [key, rows] of Object.entries(entries)) {
    const kept = rows.filter((row) => row.name || row.desc);
    if (kept.length) data[key] = Object.fromEntries(kept.map((row, index) => [`id-${String(index + 1).padStart(5, "0")}`, row]));
  }
  if (!data.name) problems.push("No name on the first line.");
  return { name: data.name || "Imported creature", data, version, problems };
}
