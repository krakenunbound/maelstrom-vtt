// Effects beside FG's:
//  - units: minutes, hours, days counted in rounds (a minute is 10)
//  - inactive: kept, counting for nothing; skip once: counting from the next turn on
//  - Apply: gone after the one roll it counted on, after the action (an attack and its damage), or a single use
//  - the Effects window's own effect keeps Apply and Units and puts them on
import "./loopback.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const a = server.agent;
const GM = { role: "dm", name: "GM" };
try {
  await a.effects.ready;
  const npc = a.records.create({ type: "npc", name: "Bandit", data: { ac: 12, hp: 11, abilities: { strength: { score: 12, bonus: 1 }, dexterity: { score: 12, bonus: 1 } }, actions: { "id-00001": { name: "Scimitar", desc: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) slashing damage." } } } }, a.seat);
  await tool("kraken_combat", { action: "add", recordId: npc.id });
  await tool("kraken_combat", { action: "add", entry: { name: "Wall", faction: "friend", hp: 50, ac: 30, init: 0 } });
  const view = async () => (await tool("kraken_combat", { action: "view" })).entries;
  let entries = await view();
  const bandit = entries.find((entry) => entry.name.startsWith("Bandit"));
  const wall = entries.find((entry) => entry.name === "Wall");
  const weapon = bandit.attacks[0].key;
  await tool("kraken_combat", { action: "target", id: bandit.id, targetId: wall.id, on: true });
  const effects = async () => (await view()).find((entry) => entry.id === bandit.id).effects;
  const lastAttack = () => a.chatLog(6).filter((line) => /\[ATTACK\]/.test(line.roll?.label ?? "")).at(-1);
  const attack = async (die) => {
    a.dice.force([die]);
    await tool("kraken_combat", { action: "attack", id: bandit.id, weapon });
    return lastAttack();
  };

  // 1. Units.
  await tool("kraken_combat", { action: "effect", id: bandit.id, effect: { label: "Blessed", duration: 1, units: "minute" } });
  const blessed = (await effects()).find((effect) => effect.label === "Blessed");
  assert(blessed.duration === 10 && blessed.units === "minute", `a minute is 10 rounds: ${JSON.stringify(blessed)}`);
  done.push("units");

  // 2. Inactive and skip once.
  await tool("kraken_combat", { action: "effect", id: bandit.id, effect: { label: "Sharp; ATK: 5" } });
  const sharp = (await effects()).find((effect) => effect.label === "Sharp; ATK: 5");
  const counted = await attack(10);
  assert(counted.roll.total === 10 + 3 + 5, `active: +5: ${counted.roll.total}`);
  await a.effects.update({ to: { entryId: bandit.id }, effectId: sharp.id, patch: { inactive: true } }, GM);
  assert((await attack(10)).roll.total === 13, "inactive: nothing");
  await a.effects.update({ to: { entryId: bandit.id }, effectId: sharp.id, patch: { inactive: false, skip: true } }, GM);
  assert((await attack(10)).roll.total === 13, "skipped once: nothing yet");
  await tool("kraken_combat", { action: "next" });
  assert((await attack(10)).roll.total === 18, "from the next turn: +5 again");
  await tool("kraken_combat", { action: "effect-remove", id: bandit.id, effectId: sharp.id });
  done.push("inactive and skip once");

  // 3. Apply.
  await tool("kraken_combat", { action: "effect", id: bandit.id, effect: { label: "Guided; ATK: 2", apply: "roll" } });
  assert((await attack(10)).roll.total === 15 && !(await effects()).some((effect) => effect.label.startsWith("Guided")), "one roll: used, gone");
  await tool("kraken_combat", { action: "effect", id: bandit.id, effect: { label: "Hex; ATK: 1; DMG: 3", apply: "action" } });
  await attack(19);
  assert((await effects()).some((effect) => effect.label.startsWith("Hex")), "one action: still on after the attack");
  await tool("kraken_combat", { action: "damage", id: bandit.id, weapon }).catch(() => tool("kraken_combat", { action: "damage-roll", id: bandit.id, weapon }));
  assert(!(await effects()).some((effect) => effect.label.startsWith("Hex")), `one action: gone after its damage: ${JSON.stringify(await effects())}`);
  await tool("kraken_combat", { action: "effect", id: bandit.id, effect: { label: "Lucky; ATK: 4", apply: "once" } });
  await tool("kraken_combat", { action: "effect", id: bandit.id, effect: { label: "Steady; AC: 2", apply: "once" } });
  const used = await attack(10);
  assert(used.roll.total === 17, `single use: counted: ${used.roll.total} ${used.roll.label}`);
  const after = (await effects()).map((effect) => effect.label);
  assert(!after.some((label) => label.startsWith("Lucky")) && after.some((label) => label.startsWith("Steady")), `single use: the one used gone, the other kept: ${after}`);
  assert(a.chatLog(20).some((line) => /\[EFFECT\] Lucky on Bandit/.test(line.text ?? "")), "said");
  done.push("apply: a roll, an action, a single use");

  // 4. The Effects window's own effect.
  await a.effects.save({ label: "Warding Rune; AC: 2", kind: "buff", icon: "buff", duration: 10, apply: "", units: "minute" }, GM);
  const own = a.effects.list(GM).find((item) => item.label === "Warding Rune; AC: 2");
  assert(own && own.units === "minute", `kept: ${JSON.stringify(own)}`);
  await a.effects.apply({ to: { entryId: wall.id }, preset: own.id }, GM);
  const onWall = (await view()).find((entry) => entry.id === wall.id).effects.find((effect) => effect.label.startsWith("Warding Rune"));
  assert(onWall.duration === 100 && onWall.units === "minute", `ten minutes: ${JSON.stringify(onWall)}`);
  done.push("the Effects window's own effect");
} finally {
  await server.stop?.();
}
console.log(`ok effects fg: ${done.join("; ")}`);
process.exit(0);
