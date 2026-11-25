// D&D 5E's house rules (the game's manifest settings, FG 5E's options of the same keys), played on the tracker:
//  - the defaults (FG's): auto death saves, ranged next to an enemy at disadvantage, the 2024 rules
//  - HRST: a dying character's death save rolls itself as its turn starts
//  - attacks: DISATK and Prone, and HRFFM (a ranged attack with an enemy within 5 feet), advantage and disadvantage
//  - NPCD fixed: an NPC's damage dice their average ([FIXED])
//  - HRMD: massive damage asks a DC 15 Constitution save; a failure rolls the system shock table
//  - HRHE: brought back from dying, Exhaustion levels
//  - exhaustion's effect by GAVE (2024 -2 a level; 2014 the six levels) and HREX (its own modifier per level)
//  - rests: 2024 gives back every Hit Point Die on a long rest, 2014 half; HRHV slow heals no hit points
//  - HRFL: a reliable skill roll counts a d20 under 10 as 10
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const book = (name) => path.join(ROOT, "games", "modules", name);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];

const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const ctx = { table: () => server };
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, ctx);
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
for (const name of ["Descending Darkness Player's Handbook", "Descending Darkness Bestiary"]) importModule(agent.records, agent.seat, book(name));
const ct = (args) => tool("kraken_combat", args);
const view = async () => ct({ action: "view" });
const raw = (id) => agent.combat.entries().find((item) => item.id === id);
const force = (...values) => agent.dice.force(values);
const lastRoll = (pattern) => [...agent.chatLog(400)].reverse().find((line) => line.roll && pattern.test(line.roll.label ?? ""));
const said = (pattern) => agent.chatLog(400).some((line) => pattern.test(line.text ?? ""));
const rules = (patch) => tool("kraken_table_options", { rules: patch });
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

try {
  // The defaults, as FG 5E's.
  const start = await tool("kraken_table_options", {});
  assert(start.houseRules?.HRST === true && start.houseRules.HRFFM === true && start.houseRules.GAVE === "2024" && start.houseRules.NPCD === "off", `FG's defaults: ${JSON.stringify(start.houseRules)}`);
  const refused = await rules({ GAVE: "1999" });
  assert(refused.houseRules.GAVE === "2024", "a choice the game does not offer falls back to its default");
  done.push("house rules with FG's defaults, held to the game's choices");

  const build = async (name, cls, extra = {}) => tool("kraken_build_character", { owner: "Ann", spec: { name, species: "Human", class: cls, level: 3, scores: { strength: 14, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 14, charisma: 10 }, ...extra } });
  const ranger = await build("Ranger", "Fighter", { gear: [["Shortbow", 1], ["Arrows", 20]], skills: ["Perception", "Athletics"] });
  const cleric = await build("Cleric", "Cleric");
  const rogue = await build("Rogue", "Fighter");
  const sentinel = agent.records.list({ type: "npc" }).find((record) => record.name === "Bone Sentinel");
  for (const who of [ranger, cleric, rogue]) await ct({ action: "add", recordId: who.id });
  await ct({ action: "add", recordId: sentinel.id });
  const list = (await view()).entries;
  const id = (name) => list.find((item) => item.name === name).id;
  const [R, C, G, S] = ["Ranger", "Cleric", "Rogue", "Bone Sentinel"].map(id);
  const record = (who) => agent.records.get(who.id);

  // A map: the ranger beside the sentinel, the cleric across the room.
  agent.map.setScene({ id: "room", name: "Room", width: 1000, height: 500, padding: 0, backgroundColor: "#000", grid: { size: 50, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, lights: [], tokens: [], walls: [] });
  const gm = { role: "dm", name: "GM" };
  const place = (entryId, x, y) => ct({ action: "place-token", id: entryId, x, y });
  await place(R, 125, 125);
  await place(S, 175, 125);
  await place(C, 725, 125);
  await place(G, 825, 425);

  // Attacks: a ranged attack next to an enemy has disadvantage (HRFFM, on by default); from afar it is a plain roll.
  const bow = Object.entries(record(ranger).data.inventorylist ?? {}).find(([, item]) => /shortbow/i.test(item.name))?.[0];
  assert(bow, "the ranger has a shortbow");
  await ct({ action: "target", id: R, targetId: S, on: true });
  await ct({ action: "attack", recordId: ranger.id, weapon: bow });
  const near = lastRoll(/\[ATTACK\].*Shortbow/);
  assert(/\[DISADVANTAGE\]/.test(near.roll.label) && /RANGED ATTACK NEXT TO ENEMY/.test(near.roll.label) && /2d20kl1/.test(near.roll.formula), `a bow next to the sentinel: ${near.roll.label} ${near.roll.formula}`);
  await rules({ HRFFM: false });
  await ct({ action: "attack", recordId: ranger.id, weapon: bow });
  assert(!/DISADVANTAGE/.test(lastRoll(/\[ATTACK\].*Shortbow/).roll.label), "the house rule off: no disadvantage");
  await rules({ HRFFM: true });
  await place(R, 525, 125);
  await ct({ action: "attack", recordId: ranger.id, weapon: bow });
  assert(!/DISADVANTAGE/.test(lastRoll(/\[ATTACK\].*Shortbow/).roll.label), "no enemy within 5 feet: a plain roll");
  // A character's tracker row attacks with the character's weapons (as its record does; it was read as an NPC's block: "No such attack").
  const shots = () => agent.chatLog(400).filter((line) => /\[ATTACK\].*Shortbow/.test(line.roll?.label ?? "")).length;
  const before = shots();
  await ct({ action: "attack", id: R, weapon: bow });
  assert(shots() === before + 1, "the ranger's tracker row shoots its shortbow");
  // The agent's tracker rolls speak as the GM's tracker buttons do (Combat), not as "Agent".
  assert(lastRoll(/\[ATTACK\].*Shortbow/).from === "Combat", `the agent's attack line: ${lastRoll(/\[ATTACK\].*Shortbow/).from}`);
  // A Prone target: disadvantage at range; DISATK on the attacker and GRANTADVATK on the target cancel.
  await ct({ action: "effect", id: S, effect: { label: "Prone", duration: 0 } });
  await ct({ action: "attack", recordId: ranger.id, weapon: bow });
  assert(/\[DISADVANTAGE\]/.test(lastRoll(/\[ATTACK\].*Shortbow/).roll.label), "a prone target at range: disadvantage");
  await ct({ action: "clear-effects" });
  await ct({ action: "effect", id: R, effect: { label: "Shaken; DISATK", duration: 0 } });
  await ct({ action: "attack", recordId: ranger.id, weapon: bow });
  assert(/\[DISADVANTAGE\]/.test(lastRoll(/\[ATTACK\].*Shortbow/).roll.label), "DISATK on the attacker");
  await ct({ action: "effect", id: S, effect: { label: "Faerie Fire; GRANTADVATK", duration: 0 } });
  await ct({ action: "attack", recordId: ranger.id, weapon: bow });
  const both = lastRoll(/\[ATTACK\].*Shortbow/).roll;
  assert(!/ADVANTAGE/.test(both.label) && both.formula.startsWith("1d20"), `advantage and disadvantage cancel: ${both.label} ${both.formula}`);
  await ct({ action: "clear-effects" });
  done.push("5E attacks: DISATK, GRANTADVATK, Prone, and a ranged attack next to an enemy (HRFFM)");

  // NPCD fixed: the sentinel's damage dice their average.
  const attacks = (await view()).entries.find((item) => item.id === S).attacks;
  const swing = attacks[0];
  await rules({ NPCD: "fixed" });
  await ct({ action: "clear-targets", id: S });
  await ct({ action: "damage-roll", id: S, weapon: swing.key });
  const fixedRoll = lastRoll(/\[DAMAGE\]/);
  assert(/\[FIXED\]/.test(fixedRoll.roll.label) && !/d\d/.test(fixedRoll.roll.formula), `fixed NPC damage: ${fixedRoll.roll.label} ${fixedRoll.roll.formula} (from ${swing.damage})`);
  await rules({ NPCD: "off" });
  done.push(`NPCD fixed: ${swing.damage} -> ${fixedRoll.roll.formula}`);

  // HRMD: half its hit points in one blow asks a DC 15 Constitution save; a failure rolls the table (5: stunned).
  await rules({ HRMD: true });
  const half = Math.ceil(record(cleric).data.hp.total / 2);
  force(2, 5);
  await ct({ action: "damage", id: C, amount: half });
  assert(raw(C).effects.some((effect) => /System Shock; Stunned/.test(effect.label)), `system shock stuns: ${JSON.stringify(raw(C).effects.map((effect) => effect.label))}`);
  await ct({ action: "clear-effects" });
  await ct({ action: "heal", id: C, amount: 99 });
  await rules({ HRMD: false });
  done.push("HRMD: massive damage, the system shock table");

  // HRST and HRHE: the rogue falls; on its turn its death save rolls itself; healed, it gains Exhaustion.
  await ct({ action: "damage", id: G, amount: record(rogue).data.hp.total });
  assert((await view()).entries.find((item) => item.id === G).health.status === "Dying", "the rogue is dying");
  // Next turn until the rogue's: its death save rolls itself as the turn starts (a 15 forced for it).
  await ct({ action: "init", which: "all" });
  for (let step = 0; step < 6 && (await view()).active !== G; step++) {
    const order = (await view()).entries.map((item) => item.id);
    const nextUp = (await view()).active ? order[(order.indexOf((await view()).active) + 1) % order.length] : order[0];
    if (nextUp === G) force(15);
    await ct({ action: "next" });
  }
  await settle();
  assert(record(rogue).data.deathsaves?.success === 1, `the death save rolled itself at the turn's start: ${JSON.stringify(record(rogue).data.deathsaves)}`);
  await rules({ HRHE: "2" });
  await ct({ action: "heal", id: G, amount: 5 });
  assert(record(rogue).data.exhaustion === 2, `back from dying, Exhaustion 2: ${record(rogue).data.exhaustion}`);
  done.push("HRST: auto death saves; HRHE: exhaustion when healed from dying");

  // Exhaustion's effect by the rules version and HREX.
  const exhaustionLabel = () => raw(G).effects.find((effect) => /^Exhaustion/.test(effect.label))?.label ?? "";
  await settle();
  assert(/ATK: -4/.test(exhaustionLabel()), `2024: -2 a level: ${exhaustionLabel()}`);
  await rules({ GAVE: "2014" });
  agent.records.update(rogue.id, { data: { exhaustion: 3 } }, gm);
  await settle();
  assert(/DISATK/.test(exhaustionLabel()) && /DISCHK/.test(exhaustionLabel()), `2014: the levels' disadvantages: ${exhaustionLabel()}`);
  await rules({ HREX: "-1" });
  agent.records.update(rogue.id, { data: { exhaustion: 2 } }, gm);
  await settle();
  assert(/ATK: -2/.test(exhaustionLabel()) && !/DIS/.test(exhaustionLabel()), `HREX -1: -1 a level: ${exhaustionLabel()}`);
  await rules({ HREX: "", GAVE: "2024" });
  done.push("exhaustion by the rules version (2024, 2014) and HREX");

  // Rests: 2024 every Hit Point Die back on a long rest, 2014 half; slow healing heals no hit points.
  const spent = (count, wounds) => agent.records.update(cleric.id, { data: { hitdice: { used: count }, hp: { wounds } } }, gm);
  spent(3, 5);
  await tool("kraken_rest", { id: cleric.id, kind: "long" });
  assert(record(cleric).data.hitdice.used === 0 && record(cleric).data.hp.wounds === 0, `2024 long rest: every die back: ${JSON.stringify(record(cleric).data.hitdice)}`);
  await rules({ GAVE: "2014" });
  spent(3, 5);
  await tool("kraken_rest", { id: cleric.id, kind: "long" });
  assert(record(cleric).data.hitdice.used === 2, `2014 long rest: half back (1 of 3): ${JSON.stringify(record(cleric).data.hitdice)}`);
  await rules({ GAVE: "2024", HRHV: "slow" });
  spent(3, 5);
  await tool("kraken_rest", { id: cleric.id, kind: "long" });
  assert(record(cleric).data.hp.wounds === 5 && record(cleric).data.hitdice.used === 2, `slow healing: no hit points, half the dice: ${JSON.stringify([record(cleric).data.hp, record(cleric).data.hitdice])}`);
  await rules({ HRHV: "" });
  done.push("rests by the rules version and HRHV");

  // HRFL: reliable Perception counts a 3 as a 10.
  await rules({ HRFL: "passive" });
  force(3);
  const check = await tool("kraken_siege_check", { id: ranger.id, kind: "skill", skill: "Perception" });
  const reliableRoll = lastRoll(/Perception/);
  assert(/\[RELIABLE\]/.test(reliableRoll.roll.label) && reliableRoll.roll.total >= 10, `reliable Perception: ${reliableRoll.roll.label} ${reliableRoll.roll.total} ${JSON.stringify(check).slice(0, 120)}`);
  await rules({ HRFL: "" });
  done.push("HRFL: reliable skill rolls");
} finally {
  await server.stop?.();
}
console.log(`ok 5e house rules: ${done.join("; ")}`);
process.exit(0);
