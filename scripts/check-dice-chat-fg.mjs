// Dice and chat beside FG's:
//  - speech bubble time (each person's, 0 = as long as it takes to read) kept by the host's prefs
//  - dice by type: a damage roll's dice in its damage type's colours, a creature's in its creature type's (the
//    table's typedDice, on by default); off, the roller's own set
//  - the party sheet's roll for one member (members)
//  - manual dice for the sheet's and the tracker's rolls: the faces typed in are the roll's, marked [MANUAL]; faces
//    not used never reach the next roll; a line with some of the host's dice says so
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { cleanPrefs } = require("../electron/prefs.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function connect(port, join) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const lines = [];
    const inbox = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      inbox.push(msg);
      if (msg.type === "chat") lines.push(msg);
      if (msg.type === "no") reject(new Error(`join refused: ${msg.reason}`));
      if (msg.type === "ok") resolve({ ws, lines, inbox, send: (body) => ws.send(JSON.stringify(body)) });
    });
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", ...join })));
  });
}
const settle = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const done = [];
const OWN = { theme: "classic", body: "#ffffff", ink: "#000000" };

// 0. The games declare which rolls their manual die is for (2E, BFRPG, C&C initiative and Cairn's attacks are not d20s).
const { rulesetFor } = await import("../shared/rulesets/registry.mjs");
assert(rulesetFor("D&D 5E").manualDie === "1d20" && !rulesetFor("D&D 5E").manualKinds, "5E: every roll");
assert(!rulesetFor("AD&D 2E").manualKinds.includes("init") && rulesetFor("AD&D 2E").manualKinds.includes("attack"), "2E: not its d10 initiative");
assert(!rulesetFor("Cairn").manualKinds.includes("attack"), "Cairn: not its attacks");
done.push("manual dice kinds by game");

// 1. Speech bubble time.
assert(cleanPrefs({ speechSeconds: 5 }, {}).speechSeconds === 5, "five seconds kept");
assert(cleanPrefs({ speechSeconds: 7 }, {}).speechSeconds === undefined, "an odd time dropped");
done.push("speech bubble time");

const server = createTableServer({ ruleset: "D&D 5E" });
const { port, hostToken } = await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "Descending Darkness Player's Handbook"));
const gm = await connect(port, { name: "GM", hostToken });
const ann = await connect(port, { name: "Ann" });
const lastRoll = (seat, pattern) => seat.lines.filter((line) => line.roll && pattern.test(line.roll.label ?? "")).at(-1);
try {
  // 2. Dice by type.
  gm.send({ type: "roll", formula: "2d6", label: "[DAMAGE] Fire Bolt [TYPE: fire]", look: OWN });
  await settle();
  assert(lastRoll(gm, /Fire Bolt/)?.roll.look?.body === "#b3261e", `fire damage in fire's colours: ${JSON.stringify(lastRoll(gm, /Fire Bolt/)?.roll.look)}`);
  agent.records.create({ type: "npc", name: "Zombie", data: { type: "undead", ac: 8, hp: 22 } }, agent.seat);
  gm.send({ type: "roll", formula: "1d20", label: "Slam", as: "Zombie", look: OWN });
  await settle();
  assert(lastRoll(gm, /^Slam/)?.roll.look?.body === "#18181f", `an undead's dice in its colours: ${JSON.stringify(lastRoll(gm, /^Slam/)?.roll)}`);
  await tool("kraken_table_options", { typedDice: false });
  gm.send({ type: "roll", formula: "2d6", label: "[DAMAGE] Fire Bolt again [TYPE: fire]", look: OWN });
  await settle();
  assert(lastRoll(gm, /Fire Bolt again/)?.roll.look?.body === "#ffffff", "off: the roller's own set");
  await tool("kraken_table_options", { typedDice: true });
  // The tracker's own rolls from the GM's seat: a Zombie's attack in an undead's colours, its damage in its type's.
  const zombie = agent.records.list({ type: "npc" }).find((record) => record.name === "Zombie");
  await tool("kraken_combat", { action: "add", recordId: zombie.id });
  await tool("kraken_combat", { action: "add", entry: { name: "Post", faction: "friend", hp: 50, ac: 5, init: 0 } });
  let fight = (await tool("kraken_combat", { action: "view" })).entries;
  const walker = fight.find((entry) => entry.name.startsWith("Zombie"));
  await tool("kraken_combat", { action: "target", id: walker.id, targetId: fight.find((entry) => entry.name === "Post").id, on: true });
  agent.records.update(zombie.id, { data: { actions: { "id-00001": { name: "Claw", desc: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) necrotic damage." } } } }, agent.seat);
  fight = (await tool("kraken_combat", { action: "view" })).entries;
  const claw = fight.find((entry) => entry.id === walker.id).attacks[0].key;
  agent.dice.force([18]);
  gm.send({ type: "ct", action: "attack", id: walker.id, weapon: claw, look: OWN });
  await settle(400);
  const swing = lastRoll(gm, /^\[ATTACK\]/);
  assert(swing?.roll.look?.body === "#18181f", `the tracker's attack in an undead's colours: ${JSON.stringify(swing?.roll)}`);
  gm.send({ type: "ct", action: "damage-roll", id: walker.id, weapon: claw, look: OWN });
  await settle(400);
  const hurt = lastRoll(gm, /^\[DAMAGE\]/);
  assert(hurt?.roll.look?.body === "#18181f" && /\[TYPE: necrotic\]/.test(hurt.roll.label), `its necrotic damage in necrotic's colours: ${JSON.stringify(hurt?.roll)}`);
  await tool("kraken_combat", { action: "end", removeNpcs: true }).catch(() => {});
  done.push("dice by type (damage, creature, off; the tracker's own attack and damage)");

  // 3. The party sheet's roll for one member.
  const hero = await tool("kraken_build_character", { owner: "Ann", spec: { name: "Hero", species: "Human", class: "Fighter", level: 3, scores: { strength: 14, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 } } });
  const sage = await tool("kraken_build_character", { owner: "Ann", spec: { name: "Sage", species: "Human", class: "Wizard", level: 3, scores: { strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 12, charisma: 10 } } });
  await tool("kraken_party_edit", { members: [hero.id, sage.id] });
  let mark = gm.lines.length;
  gm.send({ type: "party-group", kind: "check", attribute: "strength", dc: 10, mode: "roll", members: [hero.id] });
  await settle(400);
  const rolled = gm.lines.slice(mark).filter((line) => line.roll);
  assert(rolled.length === 1 && /Hero/.test(`${rolled[0].from} ${rolled[0].roll.label}`), `one member's roll: ${JSON.stringify(rolled.map((line) => [line.from, line.roll.label]))}`);
  done.push("the party sheet's roll for one member");

  // 4. Manual dice: a sheet's roll.
  ann.send({ type: "siege-check", id: hero.id, attribute: "strength", kind: "check", label: "Strength check", manual: [17] });
  await settle(400);
  const check = lastRoll(ann, /Strength/);
  assert(check && /\[MANUAL\]/.test(check.roll.label) && JSON.stringify(check.roll).includes("17"), `the sheet's check with its typed face: ${JSON.stringify(check?.roll)}`);
  // Faces not used are dropped.
  ann.send({ type: "siege-check", id: hero.id, attribute: "dexterity", kind: "check", label: "Dexterity check", manual: [3, 3, 3] });
  await settle(400);
  agent.dice.force([11]);
  ann.send({ type: "siege-check", id: hero.id, attribute: "wisdom", kind: "check", label: "Wisdom check" });
  await settle(400);
  const after = lastRoll(ann, /Wisdom/);
  assert(after && !/\[MANUAL\]/.test(after.roll.label) && JSON.stringify(after.roll).includes("11"), `the next roll is its own: ${JSON.stringify(after?.roll)}`);
  // Fewer faces than the roll needs (advantage on the host's side): the line says some were the host's.
  ann.send({ type: "modifiers", action: "key", key: "adv", on: true });
  await settle();
  ann.send({ type: "siege-check", id: hero.id, attribute: "charisma", kind: "check", label: "Charisma check", manual: [5] });
  await settle(400);
  const mixed = lastRoll(ann, /Charisma/);
  assert(mixed && /\[MANUAL, some dice the host's\]/.test(mixed.roll.label), `a typed face and a host's die: ${JSON.stringify(mixed?.roll?.label)}`);
  done.push("manual dice: the sheet's roll, faces not used dropped, a line with the host's dice says so");

  // 5. Manual dice: the tracker's attack.
  const bandit = agent.records.create({ type: "npc", name: "Bandit", data: { ac: 12, hp: 11, abilities: { strength: { score: 12, bonus: 1 }, dexterity: { score: 12, bonus: 1 } }, actions: { "id-00001": { name: "Scimitar", desc: "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) slashing damage." } } } }, agent.seat);
  await tool("kraken_combat", { action: "add", recordId: bandit.id });
  await tool("kraken_combat", { action: "add", recordId: hero.id });
  const entries = (await tool("kraken_combat", { action: "view" })).entries;
  const foe = entries.find((entry) => entry.name.startsWith("Bandit"));
  const me = entries.find((entry) => entry.recordId === hero.id);
  await tool("kraken_combat", { action: "target", id: foe.id, targetId: me.id, on: true });
  mark = gm.lines.length;
  gm.send({ type: "ct", action: "attack", id: foe.id, weapon: foe.attacks[0].key, manual: [20] });
  await settle(500);
  const attack = gm.lines.slice(mark).find((line) => /\[ATTACK\]/.test(line.roll?.label ?? ""));
  assert(attack && /\[MANUAL\]/.test(attack.roll.label) && attack.roll.total === 23, `the tracker's attack with its typed face: ${JSON.stringify(attack?.roll)}`);
  done.push("manual dice: the tracker's attack");
} finally {
  gm.ws.close();
  ann.ws.close();
  await server.stop?.();
}
console.log(`ok dice chat fg: ${done.join("; ")}`);
process.exit(0);
