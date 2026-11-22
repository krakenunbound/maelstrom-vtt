// NPCs on the tracker beside FG's:
//  - condition immunities: a condition the creature is immune to is left out of an effect (its record's, an IMMUNE:
//    effect's), an effect of nothing else not put on, said [IMMUNE]
//  - Remove on miss (RMMT): multi (the default) drops a missed target when the attack had several; on always; off
//  - an encounter's creatures' CR
//  - clause rolls: every SRD creature's actions read into attack, damage, heal and save clauses (2014 and 2024 words)
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { clausesOf } from "../src/combat/clauses.ts";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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
try {
  importModule(a.records, a.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Creatures"));
  const npc = (name) => a.records.list({ type: "npc" }).find((record) => record.name === name);
  await new Promise((resolve) => setTimeout(resolve, 300));

  // 1. Condition immunities (a Zombie: Poisoned; Exhaustion).
  const zombie = npc("Zombie");
  assert(/poisoned/i.test(zombie.data.conditionimmunities), `the zombie's: ${zombie.data.conditionimmunities}`);
  await tool("kraken_combat", { action: "add", recordId: zombie.id });
  const view = async () => (await tool("kraken_combat", { action: "view" })).entries;
  const z = (await view()).find((entry) => entry.recordId === zombie.id);
  const refused = await tool("kraken_combat", { action: "effect", id: z.id, effect: { label: "Poisoned", duration: 1 } });
  assert(!(await view()).find((entry) => entry.id === z.id).effects.some((effect) => /poisoned/i.test(effect.label)) && a.chatLog(3).some((line) => /\[IMMUNE\]/.test(line.text ?? "")), `poisoned refused: ${JSON.stringify(refused)}`);
  await tool("kraken_combat", { action: "effect", id: z.id, effect: { label: "Poisoned; Prone", duration: 1 } });
  const labels = (await view()).find((entry) => entry.id === z.id).effects.map((effect) => effect.label);
  assert(labels.includes("Prone") && !labels.some((label) => /poisoned/i.test(label)), `the rest put on: ${labels}`);
  done.push("condition immunities");

  // 2. Remove on miss.
  const goblin = npc("Goblin Warrior") ?? npc("Goblin");
  await tool("kraken_combat", { action: "add", recordId: goblin.id });
  await tool("kraken_combat", { action: "add", entry: { name: "Tank", faction: "friend", hp: 30, ac: 30, init: 0 } });
  await tool("kraken_combat", { action: "add", entry: { name: "Mark", faction: "friend", hp: 30, ac: 1, init: 0 } });
  const entries = await view();
  const gob = entries.find((entry) => entry.recordId === goblin.id);
  const tank = entries.find((entry) => entry.name === "Tank");
  const mark = entries.find((entry) => entry.name === "Mark");
  const weapon = gob.attacks[0].key;
  const swing = async (ids, rolls) => {
    await tool("kraken_combat", { action: "clear-targets", id: gob.id }).catch(() => undefined);
    for (const id of ids) await tool("kraken_combat", { action: "target", id: gob.id, targetId: id, on: true });
    a.dice.force(rolls);
    await tool("kraken_combat", { action: "attack", id: gob.id, weapon });
    return (await view()).find((entry) => entry.id === gob.id).targets;
  };
  let left = await swing([tank.id, mark.id], [5, 5]);
  assert(left.join() === mark.id, `multi: the missed Tank dropped: ${left}`);
  left = await swing([tank.id], [5]);
  assert(left.join() === tank.id, `multi, one target: kept: ${left}`);
  await tool("kraken_table_options", { removeOnMiss: "on" });
  left = await swing([tank.id], [5]);
  assert(left.length === 0, `on: dropped: ${left}`);
  await tool("kraken_table_options", { removeOnMiss: "off" });
  left = await swing([tank.id, mark.id], [5, 5]);
  assert(left.length === 2, `off: kept: ${left}`);
  done.push("remove on miss: multi, on, off");

  // 3. An encounter's CR.
  const battle = await tool("kraken_encounter", { action: "create", name: "Graveyard" });
  await tool("kraken_encounter", { action: "add-npc", id: battle.id, npc: zombie.id, count: "2" });
  const xp = await tool("kraken_encounter", { action: "xp", id: battle.id });
  assert(Object.values(xp.crs).join() === String(zombie.data.cr), `the CR: ${JSON.stringify(xp)}`);
  done.push("an encounter's CR");

  // 4. Clauses in every SRD creature's actions.
  let counts = { attack: 0, damage: 0, heal: 0, save: 0 };
  let attacksWithout = [];
  for (const record of a.records.list({ type: "npc" })) {
    for (const key of ["actions", "bonusactions", "reactions", "legendaryactions"]) {
      for (const row of Object.values(record.data[key] ?? {})) {
        const pieces = clausesOf(String(row.desc ?? ""));
        for (const piece of pieces) if (piece.clause) counts[piece.clause.kind] += 1;
        assert(pieces.map((piece) => piece.text).join("") === String(row.desc ?? ""), `the words kept whole: ${record.name} ${row.name}`);
        if (/Attack Roll:/.test(String(row.desc)) && !pieces.some((piece) => piece.clause?.kind === "attack")) attacksWithout.push(`${record.name}: ${row.name}`);
      }
    }
  }
  assert(counts.attack > 300 && counts.damage > 300 && counts.save > 100 && counts.heal >= 1 && !attacksWithout.length, `clauses: ${JSON.stringify(counts)} ${attacksWithout.slice(0, 5)}`);
  const sample = clausesOf("Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage. The target must succeed on a DC 13 Constitution saving throw. It regains 10 (3d6) hit points.");
  const kinds = sample.filter((piece) => piece.clause).map((piece) => JSON.stringify(piece.clause));
  assert(kinds.join("|") === '{"kind":"attack","bonus":4}|{"kind":"damage","formula":"1d6+2","damageType":"slashing"}|{"kind":"save","dc":13,"stat":"constitution"}|{"kind":"heal","formula":"3d6"}', `the 2014 words: ${kinds}`);
  done.push(`clauses in the SRD's actions: ${JSON.stringify(counts)}`);
} finally {
  await server.stop?.();
}
console.log(`ok npc tracker fg: ${done.join("; ")}`);
process.exit(0);
