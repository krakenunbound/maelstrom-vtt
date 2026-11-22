// FG's power rows and upcast (5E):
//  - a spell's action rows in words (cast, attack, save, damage, heal, effect; how a higher slot or the caster's
//    level scales them)
//  - a slot chosen: spent at that level, the spell scaled by it; a level below the spell's refused
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spellRows } from "../shared/dnd5e/spellrows.mjs";

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
const agent = server.agent;
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Player's Rules"));
try {
  // 1. The rows in words.
  const spell = (name) => agent.records.list({ type: "spell" }).find((record) => record.name === name);
  const fireball = spellRows(spell("Fireball").data.actions, { dc: 15, attack: 7 }).map((row) => row.text);
  assert(JSON.stringify(fireball) === JSON.stringify(["Cast at a 20 ft sphere; a higher slot does more", "Save: Dexterity DC 15, half on a success", "Damage: 8d6 fire (+1d6 a slot above)"]), `Fireball: ${JSON.stringify(fireball)}`);
  const bolt = spellRows(spell("Fire Bolt").data.actions, { dc: 15, attack: 7 }).map((row) => row.text);
  assert(bolt.includes("Attack (ranged) +7") && bolt.includes("Damage: 1d10 fire (more at 5th, 11th, 17th)"), `Fire Bolt: ${JSON.stringify(bolt)}`);
  const cure = spellRows(spell("Cure Wounds").data.actions).map((row) => row.text);
  assert(cure.includes("Heal: 2d8 + casting modifier (+2d8 a slot above)"), `Cure Wounds: ${JSON.stringify(cure)}`);
  assert(spellRows(spell("Bless").data.actions).some((row) => row.text === "Effect: Bless; ATK: 1d4; SAVE: 1d4 (1 minute)"), "Bless's effect");
  done.push("a spell's rows in words");

  // 2. Upcast: Magic Missile with a level 3 slot, five darts.
  const built = await tool("kraken_build_character", { spec: { name: "Mage", species: "Human", class: "Wizard", level: 5, scores: { strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 12, charisma: 10 } } });
  const mage = agent.records.get(built.id);
  agent.records.update(mage.id, { data: { spells: [...new Set([...(mage.data.spells ?? []), "Magic Missile"])] } }, agent.seat);
  const goblin = agent.records.create({ type: "npc", name: "Goblin", data: { ac: 15, hp: 40, abilities: {} } }, agent.seat);
  await tool("kraken_combat", { action: "add", recordId: mage.id });
  await tool("kraken_combat", { action: "add", recordId: goblin.id });
  const entries = (await tool("kraken_combat", { action: "view" })).entries;
  const me = entries.find((entry) => entry.recordId === mage.id);
  const foe = entries.find((entry) => entry.recordId === goblin.id);
  await tool("kraken_combat", { action: "target", id: me.id, targetId: foe.id, on: true });
  await tool("kraken_combat", { action: "set-turn", id: me.id }).catch(() => {});
  const before = agent.records.get(mage.id).data.slots;
  await tool("kraken_combat", { action: "cast", recordId: mage.id, power: "Magic Missile", slot: 3 });
  const after = agent.records.get(mage.id).data.slots;
  assert(after.l3.used === (before.l3.used ?? 0) + 1 && (after.l1.used ?? 0) === (before.l1.used ?? 0), `the level 3 slot spent: ${JSON.stringify({ before, after })}`);
  const lines = agent.chatLog(20).map((line) => `${line.text ?? ""} ${line.roll?.label ?? ""}`);
  assert(lines.some((line) => /Magic Missile \(level 3 slot\)/.test(line)), `said: ${lines.join(" | ")}`);
  const darts = lines.filter((line) => /Magic Missile \(dart \d\)/.test(line)).length;
  assert(darts === 5, `five darts: ${darts}: ${lines.join(" | ")}`);
  const refused = await tool("kraken_combat", { action: "cast", recordId: mage.id, power: "Fireball", slot: 2 }).then(() => "cast", (error) => error.message);
  assert(/level 3 slot or higher|does not have/.test(refused), `a slot below: ${refused}`);
  done.push("upcast: the slot chosen spent, five darts");
} finally {
  await server.stop?.();
}
console.log(`ok upcast fg: ${done.join("; ")}`);
process.exit(0);
