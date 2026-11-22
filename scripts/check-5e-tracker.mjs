// The 5E combat tracker beside FG's:
//  - the React? box: its owner marks the reaction spent; others may not; it comes back at the start of its turn
//  - Clear timed effects (FG's Clear Expiring Effects): effects with rounds left go, lasting ones stay
//  - an effect's ending: on a short or long rest, on a long rest only; GM-only effects never reach players;
//    an effect aimed at the creature's targets carries them
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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
const ctx = { table: () => server };
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, ctx);
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "Descending Darkness Player's Handbook"));
const combat = agent.combat;
const ann = { role: "player", name: "Ann" };
const gm = { role: "dm", name: "GM" };
try {
  const hero = await tool("kraken_build_character", { owner: "Ann", spec: { name: "Hero", species: "Human", class: "Fighter", level: 2, scores: { strength: 14, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 } } });
  await tool("kraken_combat", { action: "add", recordId: hero.id });
  await tool("kraken_combat", { action: "add", entry: { name: "Orc", faction: "foe", hp: 15, ac: 13, init: 0 } });
  const view = () => combat.viewFor(gm).entries;
  const H = view().find((item) => item.name === "Hero").id;
  const O = view().find((item) => item.name === "Orc").id;
  await tool("kraken_combat", { action: "update", id: H, patch: { initresult: 15 } });
  await tool("kraken_combat", { action: "update", id: O, patch: { initresult: 10 } });

  // React?: Ann spends her hero's reaction; she may not touch the orc's; it comes back at the hero's turn.
  combat.reaction(H, true, ann);
  assert(combat.viewFor(ann).entries.find((item) => item.id === H).reacted === true, "Ann sees her reaction spent");
  let refused = "";
  try { combat.reaction(O, true, ann); } catch (error) { refused = String(error); }
  assert(/not yours/.test(refused), "not hers to mark");
  combat.reaction(O, true, gm);
  assert(!combat.viewFor(ann).entries.find((item) => item.id === O).reacted, "the orc's is the GM's to see");
  await tool("kraken_combat", { action: "next" });
  const active = () => combat.viewFor(gm).active;
  for (let step = 0; step < 3 && active() !== H; step++) await tool("kraken_combat", { action: "next" });
  assert(active() === H && !view().find((item) => item.id === H).reacted, `back at its turn: ${JSON.stringify(view().find((item) => item.id === H))}`);
  done.push("the React? box: its owner's, back at the start of its turn");

  // Effects: timed and lasting; a rest-ending one; GM-only; aimed at targets.
  await tool("kraken_combat", { action: "effect", id: O, effect: { label: "Bless; ATK: 1d4", duration: 3 } });
  await tool("kraken_combat", { action: "effect", id: O, effect: { label: "Mage Armor", duration: 0 } });
  await tool("kraken_combat", { action: "effect", id: O, effect: { label: "Marked by the GM", duration: 0, gmOnly: true } });
  assert(!combat.viewFor(ann).entries.find((item) => item.id === O).effects.some((effect) => /Marked/.test(effect.label)), "GM-only never reaches Ann");
  await tool("kraken_combat", { action: "target", id: H, targetId: O, on: true });
  await tool("kraken_combat", { action: "effect", id: H, effect: { label: "Hunter's Mark", duration: 0, targets: [O] } });
  const stored = combat.entries().find((item) => item.id === H).effects.find((effect) => /Hunter/.test(effect.label));
  assert(stored?.targets?.includes(O) && /Orc/.test(view().find((item) => item.id === H).effects.find((effect) => /Hunter/.test(effect.label))?.label ?? ""), `aimed at its target: ${JSON.stringify(stored)}`);
  combat.clearTimedEffects(gm);
  const left = view().find((item) => item.id === O).effects.map((effect) => effect.label);
  assert(!left.some((label) => /Bless/.test(label)) && left.includes("Mage Armor"), `timed effects cleared, lasting kept: ${left}`);
  done.push("GM-only effects, effects on targets, Clear timed effects");

  // Ends on a rest: one on any rest, one on a long rest; a short rest takes the first only.
  await tool("kraken_combat", { action: "effect", id: H, effect: { label: "Second Wind glow", duration: 0, ends: "short" } });
  await tool("kraken_combat", { action: "effect", id: H, effect: { label: "Heroism", duration: 0, ends: "long" } });
  await tool("kraken_combat", { action: "end" });
  await tool("kraken_rest", { id: hero.id, kind: "short", hitDice: 0 }).catch(async () => agent.bookkeeping?.rest?.({ id: hero.id, kind: "short", hitDice: 0 }, gm));
  let labels = view().find((item) => item.id === H).effects.map((effect) => effect.label);
  assert(!labels.includes("Second Wind glow") && labels.includes("Heroism"), `a short rest: ${labels}`);
  await tool("kraken_rest", { id: hero.id, kind: "long" }).catch(async () => agent.bookkeeping?.rest?.({ id: hero.id, kind: "long" }, gm));
  labels = view().find((item) => item.id === H).effects.map((effect) => effect.label);
  assert(!labels.includes("Heroism"), `a long rest: ${labels}`);
  done.push("effects that end on a short or a long rest");
} finally {
  await server.stop?.();
}
console.log(`ok 5e tracker: ${done.join("; ")}`);
process.exit(0);
