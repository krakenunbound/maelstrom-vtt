// A natural 20 or 1 is cheered (the die's flare, the fanfare or the trombone) only where a player would cheer it: on the
// game's tests (5E: attacks, saves, ability and skill checks, death saves, concentration), or a free d20 with no tag;
// never on initiative or a table's roll. The labels are the host's own, from real rolls.
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { naturalCheered } from "../shared/rulesets/naturals.mjs";
import { rulesetFor } from "../shared/rulesets/registry.mjs";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const tests = rulesetFor("D&D 5E").naturalTests;
assert(Array.isArray(tests) && tests.includes("ATTACK") && !tests.includes("INIT"), "5E names its tests");
assert(naturalCheered("[INIT] Goblin", undefined), "a game that names none: as before");

const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Player's Rules"));
const seen = {};
try {
  const hero = await tool("kraken_build_character", { spec: { name: "Brand", species: "Human", class: "Fighter", level: 1, scores: { strength: 15, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 } } });
  const last = () => agent.chatLog(5).filter((line) => line.roll).at(-1)?.roll.label ?? "";
  for (const [kind, extra] of [["check", { attribute: "strength" }], ["save", { attribute: "wisdom" }], ["skill", { skill: "Athletics", attribute: "strength" }], ["init", {}]]) {
    await tool("kraken_siege_check", { id: hero.id, kind, ...extra });
    seen[kind] = last();
  }
  const goblin = agent.records.create({ type: "npc", name: "Goblin", data: { ac: 15, hp: 7, abilities: { dexterity: { score: 14, bonus: 2 } }, actions: { "id-00001": { name: "Scimitar", desc: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage." } } } }, agent.seat);
  await tool("kraken_combat", { action: "add", recordId: goblin.id });
  await tool("kraken_combat", { action: "add", recordId: hero.id });
  const entries = (await tool("kraken_combat", { action: "view" })).entries;
  const g = entries.find((entry) => entry.name.startsWith("Goblin"));
  const b = entries.find((entry) => entry.recordId === hero.id);
  await tool("kraken_combat", { action: "target", id: g.id, targetId: b.id, on: true });
  await tool("kraken_combat", { action: "attack", id: g.id, weapon: g.attacks[0].key });
  seen.attack = agent.chatLog(8).filter((line) => /\[ATTACK\]/.test(line.roll?.label ?? "")).at(-1)?.roll.label ?? "";
  await tool("kraken_combat", { action: "init", which: "all" });
  seen.trackerInit = agent.chatLog(8).filter((line) => /\[INIT\]/.test(line.roll?.label ?? "")).at(-1)?.roll.label ?? "";
} finally {
  await server.stop?.();
}
for (const kind of ["check", "save", "skill", "attack"]) assert(naturalCheered(seen[kind], tests), `${kind} cheered: ${seen[kind]}`);
for (const kind of ["init", "trackerInit"]) assert(!naturalCheered(seen[kind], tests), `${kind} not cheered: ${seen[kind]}`);
assert(naturalCheered("Strength", tests) && naturalCheered("", tests), "a free d20 cheered");
assert(!naturalCheered("[TABLE] Wild Magic Surge", tests), "a table's roll not cheered");
console.log(`ok naturals: cheered on ${["check", "save", "skill", "attack"].map((kind) => JSON.stringify(seen[kind])).join(", ")} and a free d20; not on ${JSON.stringify(seen.init)}, ${JSON.stringify(seen.trackerInit)} or a table's roll`);
process.exit(0);
