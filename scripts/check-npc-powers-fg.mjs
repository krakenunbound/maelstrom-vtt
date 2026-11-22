// An NPC's actions in combat as FG plays them (PowerManager.parseNPCPower, compared side by side with the 2014 Monster
// Manual's 465 creatures):
//  - a weapon's every damage ("plus 7 (2d6) fire damage"), each type on its own: resisted by its own type
//  - a save asked for an action is remembered against it: its damage lands halved ("half as much damage on a
//    successful one") or not at all on those who saved, its condition only on those who failed, for its time
//  - the words read: half on a save, a condition and its time ("be frightened for 1 minute"), flat damage and
//    healing ("regains 1 hit point"), a two-handed alternative not counted twice
import "./loopback.mjs";
import { createRequire } from "node:module";
import { clausesOf } from "../src/combat/clauses.ts";
import { npcAttacks } from "../shared/dnd5e/rules.mjs";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const clauses = (words) => clausesOf(words).filter((piece) => piece.clause).map((piece) => piece.clause);

// 1. The words.
const breath = clauses("Each creature in that area must make a DC 21 Dexterity saving throw, taking 63 (18d6) fire damage on a failed save, or half as much damage on a successful one.");
assert(breath.some((c) => c.kind === "save" && c.dc === 21 && c.stat === "dexterity" && c.half) && breath.some((c) => c.kind === "damage" && c.formula === "18d6" && c.damageType === "fire"), `the breath: ${JSON.stringify(breath)}`);
const fear = clauses("Each creature of the dragon's choice must succeed on a DC 19 Wisdom saving throw or become frightened for 1 minute.");
assert(fear.some((c) => c.kind === "effect" && c.condition === "Frightened" && c.duration === 1 && c.units === "minute"), `frightened for a minute: ${JSON.stringify(fear)}`);
assert(!clauses("The drow has advantage on saving throws against being charmed, and magic can't put the drow to sleep.").some((c) => c.kind === "effect"), "a ward is no condition");
assert(!clauses("If the target is grappled, it takes 5 (1d10) damage.").some((c) => c.kind === "effect"), "a test is no condition");
assert(clauses("Hit: 1 piercing damage plus 7 (3d4) poison damage.").some((c) => c.kind === "damage" && c.formula === "1" && c.damageType === "piercing"), "flat damage");
assert(clauses("The vampire regains 1 hit point.").some((c) => c.kind === "heal" && c.formula === "1"), "flat healing");
const azer = npcAttacks({ actions: { a: { name: "Warhammer", desc: "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) bludgeoning damage plus 3 (1d6) fire damage, or 8 (1d10 + 3) bludgeoning damage plus 3 (1d6) fire damage if used with two hands to make a melee attack." } } }).a;
assert(azer.damage === "1d8+3" && azer.extra?.length === 1 && azer.extra[0].type === "fire", `a two-handed alternative not counted twice: ${JSON.stringify(azer)}`);
done.push("the words (half on a save, a condition and its time, wards and tests left out, flat damage and healing, extra damage once)");

// 2. In combat.
const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
try {
  const dragon = agent.records.create({ type: "npc", name: "Test Dragon", data: { ac: 19, hp: 200, abilities: { dexterity: { score: 10, bonus: 0 } }, actions: {
    "id-00001": { name: "Bite", desc: "Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage plus 7 (2d6) fire damage." },
    "id-00002": { name: "Fire Breath", desc: "The dragon exhales fire in a 60-foot cone. Each creature in that area must make a DC 21 Dexterity saving throw, taking 63 (18d6) fire damage on a failed save, or half as much damage on a successful one." },
    "id-00003": { name: "Frightful Presence", desc: "Each creature of the dragon's choice must succeed on a DC 19 Wisdom saving throw or become frightened for 1 minute." },
  } } }, agent.seat);
  const plain = agent.records.create({ type: "npc", name: "Plain Knight", data: { ac: 10, hp: 300, abilities: { dexterity: { score: 10, bonus: 0 }, wisdom: { score: 10, bonus: 0 } } } }, agent.seat);
  const warded = agent.records.create({ type: "npc", name: "Fire Knight", data: { ac: 10, hp: 300, damageresistances: "fire", abilities: { dexterity: { score: 10, bonus: 0 }, wisdom: { score: 10, bonus: 0 } } } }, agent.seat);
  for (const record of [dragon, plain, warded]) await tool("kraken_combat", { action: "add", recordId: record.id });
  const view = async () => (await tool("kraken_combat", { action: "view" })).entries;
  let entries = await view();
  const d = entries.find((entry) => entry.name.startsWith("Test Dragon"));
  const p = entries.find((entry) => entry.name.startsWith("Plain Knight"));
  const w = entries.find((entry) => entry.name.startsWith("Fire Knight"));
  for (const target of [p, w]) await tool("kraken_combat", { action: "target", id: d.id, targetId: target.id, on: true });
  const hurt = async (entry) => (await view()).find((item) => item.id === entry.id).wounds;
  const bite = d.attacks.find((attack) => attack.name === "Bite");
  assert(bite.damage === "2d10+8 piercing + 2d6 fire", `the bite on the tracker: ${bite.damage}`);

  // The bite: 2d10+8 piercing (5, 5) = 18 to each; 2d6 fire (3, 3) = 6, 3 to the fire knight.
  agent.dice.force([18, 18]);
  await tool("kraken_combat", { action: "attack", id: d.id, weapon: bite.key });
  agent.dice.force([5, 5, 3, 3]);
  await tool("kraken_combat", { action: "damage-roll", id: d.id, weapon: bite.key });
  assert((await hurt(p)) === 24 && (await hurt(w)) === 21, `piercing and fire, fire resisted: ${await hurt(p)}, ${await hurt(w)}`);
  done.push("a bite's piercing and fire, the fire resisted by its own type");

  // The breath (a DC 15 here): the plain knight fails (2), the fire knight saves (20); 18d6 all 3s = 54: 54 and 54/2 = 27, resisted 13.
  agent.dice.force([2]);
  await tool("kraken_combat", { action: "save", id: p.id, attribute: "dexterity", cl: 15, source: d.id, power: "Fire Breath", half: true });
  agent.dice.force([20]);
  await tool("kraken_combat", { action: "save", id: w.id, attribute: "dexterity", cl: 15, source: d.id, power: "Fire Breath", half: true });
  agent.dice.force(Array(18).fill(3));
  await tool("kraken_combat", { action: "power-damage", id: d.id, power: "Fire Breath", formula: "18d6", damageType: "fire" });
  assert((await hurt(p)) === 24 + 54 && (await hurt(w)) === 21 + 13, `failed: all; saved: half, resisted: ${await hurt(p)}, ${await hurt(w)}`);
  done.push("a breath: full on a failed save, half on a success (then resisted)");

  // Frightful Presence: the plain knight fails, the fire knight saves; Frightened on the plain knight alone, a minute.
  agent.dice.force([1]);
  await tool("kraken_combat", { action: "save", id: p.id, attribute: "wisdom", cl: 19, source: d.id, power: "Frightful Presence" });
  agent.dice.force([19]);
  await tool("kraken_combat", { action: "save", id: w.id, attribute: "wisdom", cl: 19, source: d.id, power: "Frightful Presence" });
  await tool("kraken_combat", { action: "power-effect", id: d.id, power: "Frightful Presence", effect: { label: "Frightened", duration: 1, units: "minute" } });
  entries = await view();
  const fears = (entry) => entries.find((item) => item.id === entry.id).effects.filter((effect) => effect.label === "Frightened");
  assert(fears(p).length === 1 && fears(p)[0].duration === 10 && fears(w).length === 0, `frightened, the one who failed, a minute: ${JSON.stringify({ p: fears(p), w: fears(w) })}`);
  done.push("a condition on the one who failed, for its time");
} finally {
  await server.stop?.();
}
console.log(`ok npc powers fg: ${done.join("; ")}`);
process.exit(0);
