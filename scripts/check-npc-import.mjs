// FG's Import NPC from text, for 5E: a pasted stat block (2014 or 2024 layout) becomes an NPC record as the books
// keep theirs.
//  - a 2014 goblin and a 2024 adult red dragon, every field
//  - every creature of the SRD 5.2.1 Creatures book written back as a 2024 stat block and read again: the same
//    AC, HP, speed, abilities and saves, CR and XP, and the same traits, actions, bonus actions, reactions and
//    legendary actions by name
//  - an imported creature on the tracker attacks with its own actions; the GM alone imports (the host's check)
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseStatBlock } from "../shared/dnd5e/statblock.mjs";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const content = require("../electron/content.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const GOBLIN = `Goblin
Small humanoid (goblinoid), neutral evil
Armor Class 15 (leather armor, shield)
Hit Points 7 (2d6)
Speed 30 ft.
STR DEX CON INT WIS CHA
8 (−1) 14 (+2) 10 (+0) 10 (+0) 8 (−1) 8 (−1)
Saving Throws Dex +4
Skills Stealth +6
Senses darkvision 60 ft., passive Perception 9
Languages Common, Goblin
Challenge 1/4 (50 XP)
Nimble Escape. The goblin can take the Disengage or Hide action as a bonus action on each of its
turns.
Actions
Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.
Shortbow. Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.`;
const DRAGON = `Adult Red Dragon
Huge Dragon (Chromatic), Chaotic Evil
AC 19 Initiative +14 (24)
HP 256 (19d12 + 133)
Speed 40 ft., Climb 40 ft., Fly 80 ft.
MOD SAVE MOD SAVE MOD SAVE
Str 27 +8 +8 Dex 10 +0 +6 Con 25 +7 +7
Int 16 +3 +3 Wis 13 +1 +7 Cha 23 +6 +6
Skills Perception +13, Stealth +6
Immunities Fire; Frightened
Senses Blindsight 60 ft., Darkvision 120 ft.; Passive Perception 23
Languages Common, Draconic
CR 17 (XP 18,000, or 20,000 in lair; PB +6)
Traits
Legendary Resistance (3/Day, or 4/Day in Lair). If the dragon fails a saving throw, it can choose to succeed instead.
Actions
Multiattack. The dragon makes three Rend attacks.
Rend. Melee Attack Roll: +14, reach 10 ft. Hit: 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire
damage.
Fire Breath (Recharge 5–6). Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone. Failure: 59 (17d6) Fire damage. Success: Half damage.
Legendary Actions
Pounce. The dragon moves up to half its Speed, and it makes one Rend attack.`;

// 1. The two samples.
const goblin = parseStatBlock(GOBLIN);
const g = goblin.data;
assert(goblin.version === "2014" && !goblin.problems.length && g.size === "Small" && g.type === "humanoid (goblinoid)" && g.alignment === "neutral evil" && g.ac === 15 && g.hp === 7 && g.hd === "(2d6)", `the goblin's header: ${JSON.stringify(goblin)}`);
assert(g.abilities.dexterity.score === 14 && g.abilities.dexterity.bonus === 2 && g.abilities.dexterity.savemodifier === 2 && g.savingthrows === "Dex +4" && g.cr === "1/4" && g.xp === 50 && g.skills === "Stealth +6", `the goblin's numbers: ${JSON.stringify(g)}`);
assert(Object.values(g.traits).map((row) => row.name).join() === "Nimble Escape" && /each of its turns\.$/.test(g.traits["id-00001"].desc) && Object.values(g.actions).map((row) => row.name).join() === "Scimitar,Shortbow", `the goblin's entries: ${JSON.stringify([g.traits, g.actions])}`);
const dragon = parseStatBlock(DRAGON);
const d = dragon.data;
assert(dragon.version === "2024" && !dragon.problems.length && d.ac === 19 && d.hp === 256 && d.initiative.misc === 14 && d.savingthrows === "Dex +6, Wis +7" && d.damageimmunities === "Fire" && d.conditionimmunities === "Frightened" && d.cr === "17" && d.xp === 18000, `the dragon's header: ${JSON.stringify(d)}`);
assert(Object.values(d.actions).map((row) => row.name).join("|") === "Multiattack|Rend|Fire Breath (Recharge 5-6)" && /plus 5 \(2d4\) Fire damage\.$/.test(d.actions["id-00002"].desc) && d.legendaryactions["id-00001"].name === "Pounce", `the dragon's entries: ${JSON.stringify([d.actions, d.legendaryactions])}`);
assert(/Paste a stat block/.test((() => { try { parseStatBlock("  "); return ""; } catch (error) { return String(error); } })()), "nothing pasted: said so");
done.push("a 2014 goblin and a 2024 dragon");

// 2. The SRD's creatures, written back out as 2024 stat blocks and read again.
const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const agent = server.agent;
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Creatures"));
const signed = (n) => `${n >= 0 ? "+" : ""}${n}`;
const LISTS = [["traits", "Traits"], ["actions", "Actions"], ["bonusactions", "Bonus Actions"], ["reactions", "Reactions"], ["legendaryactions", "Legendary Actions"]];
const asText = (record) => {
  const x = record.data;
  const ab = (key, short) => `${short} ${x.abilities[key].score} ${signed(x.abilities[key].bonus)} ${signed(x.abilities[key].bonus + (Number(x.abilities[key].savemodifier) || 0))}`;
  return [
    record.name,
    `${x.size} ${x.type}, ${x.alignment || "Unaligned"}`,
    `AC ${x.ac} Initiative ${signed(x.abilities.dexterity.bonus + (Number(x.initiative?.misc) || 0))}`,
    `HP ${x.hp} ${x.hd || ""}`.trim(),
    `Speed ${x.speed}`,
    "MOD SAVE MOD SAVE MOD SAVE",
    `${ab("strength", "Str")} ${ab("dexterity", "Dex")} ${ab("constitution", "Con")}`,
    `${ab("intelligence", "Int")} ${ab("wisdom", "Wis")} ${ab("charisma", "Cha")}`,
    x.skills ? `Skills ${x.skills}` : "",
    x.damageresistances ? `Resistances ${x.damageresistances}` : "",
    x.damageimmunities || x.conditionimmunities ? `Immunities ${[x.damageimmunities, x.conditionimmunities].filter(Boolean).join("; ")}` : "",
    x.senses ? `Senses ${x.senses}` : "",
    `Languages ${x.languages || "None"}`,
    `CR ${x.cr} (XP ${x.xp})`,
    ...LISTS.flatMap(([key, title]) => (x[key] && Object.keys(x[key]).length ? [title, ...Object.values(x[key]).map((row) => `${row.name}. ${String(row.desc).replace(/\s+/g, " ")}`)] : [])),
  ]
    .filter(Boolean)
    .join("\n");
};
const creatures = agent.records.list({ type: "npc" });
const misses = [];
for (const record of creatures) {
  let parsed;
  try {
    parsed = parseStatBlock(asText(record));
  } catch (error) {
    misses.push(`${record.name}: ${error}`);
    continue;
  }
  const x = record.data;
  const p = parsed.data;
  const names = (data, key) => Object.values(data[key] ?? {}).map((row) => String(row.name).replace(/[–—]/g, "-")).join("|");
  const wrong = [];
  if (p.ac !== x.ac || p.hp !== x.hp || p.cr !== String(x.cr) || p.xp !== x.xp || p.speed !== x.speed) wrong.push("header");
  for (const stat of ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]) if (p.abilities[stat].score !== x.abilities[stat].score || p.abilities[stat].savemodifier !== (Number(x.abilities[stat].savemodifier) || 0)) wrong.push(stat);
  for (const [key] of LISTS) if (names(p, key) !== names(x, key)) wrong.push(`${key}: ${names(p, key)} vs ${names(x, key)}`);
  if (wrong.length) misses.push(`${record.name}: ${wrong.join("; ")}`);
}
assert(creatures.length > 100, `the book's creatures: ${creatures.length}`);
assert(misses.length === 0, `${misses.length} of ${creatures.length} read back differently:\n${misses.slice(0, 12).join("\n")}`);
done.push(`all ${creatures.length} SRD creatures read back`);

// 3. Imported, on the tracker, attacking.
try {
  const made = await content.npcImport(agent, { text: GOBLIN });
  assert(agent.records.get(made.id)?.type === "npc" && agent.records.get(made.id).visibility === "gm", "a campaign NPC, the GM's");
  await callTool("kraken_combat", { action: "add", recordId: made.id }, { table: () => server });
  await callTool("kraken_combat", { action: "add", entry: { name: "Hero", faction: "friend", hp: 20, ac: 12, init: 0 } }, { table: () => server });
  const view = JSON.parse((await callTool("kraken_combat", { action: "view" }, { table: () => server })).content[0].text);
  const me = view.entries.find((entry) => entry.name.startsWith("Goblin"));
  const hero = view.entries.find((entry) => entry.name === "Hero");
  assert(me?.attacks?.length >= 2 && me.attacks.some((attack) => /Scimitar/.test(attack.name)), `its attacks: ${JSON.stringify(me?.attacks)}`);
  await callTool("kraken_combat", { action: "target", id: me.id, targetId: hero.id, on: true }, { table: () => server });
  const swing = await callTool("kraken_combat", { action: "attack", id: me.id, weapon: me.attacks.find((attack) => /Scimitar/.test(attack.name)).key }, { table: () => server });
  assert(!swing.isError && agent.chatLog(5).some((line) => /\[ATTACK\].*Scimitar/.test(line.roll?.label ?? "")), `it attacks: ${swing.content[0].text.slice(0, 200)}`);
  let refused = "";
  try {
    await content.message(agent, { type: "npc-import", text: GOBLIN }, { seat: { role: "player", name: "Ann" } });
  } catch (error) {
    refused = String(error);
  }
  assert(/GM's/.test(refused), "a player may not import");
  done.push("imported, it attacks on the tracker; the GM's alone");
} finally {
  await server.stop?.();
}
console.log(`ok npc import: ${done.join("; ")}`);
process.exit(0);
