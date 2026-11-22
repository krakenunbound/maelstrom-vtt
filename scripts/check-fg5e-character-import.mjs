// An FG 5E character brought into a 5E campaign whole (FG's /importchar), not mapped to another game, and its
// numbers worked out again equal FG's own: a made-up FG 5E character XML (FG's layout), FG's totals written in it.
import "./loopback.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const ability = (stat, score, prof) => `<${stat}><score type="number">${score}</score><saveprof type="number">${prof}</saveprof></${stat}>`;
const skill = (id, name, prof) => `<${id}><name type="string">${name}</name><prof type="number">${prof}</prof></${id}>`;
const listOf = (names) => names.map((name, index) => `<id-${String(index + 1).padStart(5, "0")}><name type="string">${name}</name></id-${String(index + 1).padStart(5, "0")}>`).join("");
const power = (id, name, group, level, prepared) => `<${id}><name type="string">${name}</name><group type="string">${group}</group><level type="number">${level}</level><prepared type="number">${prepared}</prepared></${id}>`;
const xml = `<?xml version="1.0" encoding="utf-8"?><root version="5.1"><character>
  <name type="string">Maelis Testtide</name><race type="string">Half-Elf</race><background type="string">Noble</background><alignment type="string">Chaotic Good</alignment>
  <abilities>${ability("strength", 8, 0)}${ability("dexterity", 16, 0)}${ability("constitution", 14, 1)}${ability("intelligence", 14, 0)}${ability("wisdom", 10, 0)}${ability("charisma", 17, 1)}</abilities>
  <classes><id-00001><name type="string">Sorcerer</name><level type="number">1</level><hddie type="dice">1d6</hddie><hdused type="number">0</hdused><specialization type="string">Wild Magic</specialization></id-00001></classes>
  <skilllist>${skill("id-00001", "Perception", 1)}${skill("id-00002", "Arcana", 1)}${skill("id-00003", "Persuasion", 1)}${skill("id-00004", "Stealth", 0)}</skilllist>
  <languagelist>${listOf(["Common", "Elvish", "Choice"])}</languagelist>
  <proficiencylist>${listOf(["Weapon: Daggers", "Weapon: Longswords", "Tool: Playing Card Set"])}</proficiencylist>
  <featurelist>${listOf(["Position of Privilege"])}</featurelist><traitlist>${listOf(["Darkvision", "Fey Ancestry"])}</traitlist>
  <powers>${power("id-00001", "Tides of Chaos", "Class (Sorcerer)", 0, 1)}${power("id-00002", "Fire Bolt", "Spells (Sorcerer)", 0, 0)}${power("id-00003", "Sleep", "Spells (Sorcerer)", 1, 1)}</powers>
  <hp><total type="number">8</total><wounds type="number">0</wounds></hp>
  <coins><id-00001><name type="string">GP</name><amount type="number">24</amount></id-00001></coins>
  <inventorylist><id-00001><name type="string">Dagger</name><type type="string">Weapon</type><damage type="string">1d4 piercing</damage><properties type="string">Finesse, light, thrown (range 20/60)</properties><carried type="number">2</carried><count type="number">1</count><weight type="number">1</weight></id-00001>
    <id-00002><name type="string">Longsword</name><type type="string">Weapon</type><subtype type="string">Martial Melee Weapons</subtype><damage type="string">1d8 slashing</damage><properties type="string">Versatile (1d10)</properties><carried type="number">2</carried><count type="number">1</count></id-00002>
    <id-00003><name type="string">Greataxe</name><type type="string">Weapon</type><subtype type="string">Martial Melee Weapons</subtype><damage type="string">1d12 slashing</damage><properties type="string">Heavy, two-handed</properties><carried type="number">2</carried><count type="number">1</count></id-00003>
    <id-00004><name type="string">Club</name><type type="string">Weapon</type><subtype type="string">Simple Melee Weapons</subtype><damage type="string">1d4 bludgeoning</damage><properties type="string">Light</properties><carried type="number">2</carried><count type="number">1</count></id-00004></inventorylist>
  <weaponlist><id-00001><name type="string">Club</name><prof type="number">0</prof><shortcut type="windowreference"><class>item</class><recordname>....inventorylist.id-00004</recordname></shortcut></id-00001></weaponlist>
</character></root>`;

const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const done = [];
try {
  const result = await callTool("kraken_character_import", { text: xml }, { table: () => server });
  if (result.isError) throw new Error(result.content[0].text);
  const made = JSON.parse(result.content[0].text);
  assert(!/C&C/.test(made.report ?? ""), `a 5E character, not mapped to C&C: ${made.report}`);
  const data = server.agent.records.get(made.id).data;
  assert(data.ruleset === "dnd5e" && data.packages["id-00001"].name === "Sorcerer" && data.packages["id-00001"].subclass === "Wild Magic" && data.level === 1, `its class: ${JSON.stringify(data.packages)}`);
  done.push("a 5E character, its class and subclass");
  // FG's own numbers for this sheet: proficiency +2, CHA save +5, CON save +4, DEX save +3, Persuasion +5, Arcana +4,
  // Stealth +3, initiative +3, AC 13 (10 + DEX), passive Perception 12, hit points 8.
  const want = { prof: 2, chaSave: 5, conSave: 4, dexSave: 3, persuasion: 5, arcana: 4, stealth: 3, init: 3, ac: 13, passive: 12, hp: 8 };
  const got = { prof: data.prof, chaSave: data.abilities.charisma.save, conSave: data.abilities.constitution.save, dexSave: data.abilities.dexterity.save, persuasion: data.skills.persuasion?.total, arcana: data.skills.arcana?.total, stealth: data.skills.stealth?.total, init: data.initiative?.total, ac: data.ac?.total, passive: data.passive, hp: data.hp.total };
  for (const key of Object.keys(want)) assert(got[key] === want[key], `${key}: FG ${want[key]}, Maelstrom ${got[key]} (${JSON.stringify(got)})`);
  done.push("its numbers equal FG's (saves, skills, initiative, AC, passive Perception, hit points)");
  assert(data.spells.includes("Fire Bolt") && data.spells.includes("Sleep") && !data.spells.includes("Tides of Chaos") && data.prepared.sleep === 1, `spells: ${JSON.stringify({ spells: data.spells, prepared: data.prepared })}`);
  assert(JSON.stringify(data.languages) === JSON.stringify(["Common", "Elvish"]) && data.proficiencylist.weapons.includes("Daggers") && data.traits.includes("Fey Ancestry") && data.features.includes("Position of Privilege"), "languages, proficiencies, traits, features");
  done.push("spells (prepared), languages, proficiencies, traits, features");
  // Weapon proficiency: the list's "Longswords" (+2 proficiency, STR -1: +1); a greataxe, not on the list (-1); a club
  // FG marks not proficient (-1).
  const attackOf = (name) => Object.values(data.attacks ?? {}).find((attack) => attack.name === name)?.bonus;
  assert(attackOf("Longsword") === 1 && attackOf("Greataxe") === -1 && attackOf("Club") === -1, `weapon proficiency: ${JSON.stringify({ longsword: attackOf("Longsword"), greataxe: attackOf("Greataxe"), club: attackOf("Club") })}`);
  done.push("weapon proficiency: the list's own weapons, FG's tick on a weapon");
} finally {
  await server.stop?.();
}
console.log(`ok fg5e character import: ${done.join("; ")}`);
process.exit(0);
