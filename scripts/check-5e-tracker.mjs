// The 5E combat tracker beside FG's:
//  - the React? box: its owner marks the reaction spent; others may not; it comes back at the start of its turn
//  - Clear timed effects (FG's Clear Expiring Effects): effects with rounds left go, lasting ones stay
//  - an effect's ending: on a short or long rest, on a long rest only; GM-only effects never reach players;
//    an effect aimed at the creature's targets carries them
//  - FG's advance rounds, typed wounds and temp, initiative swap, [USED] with recharge, unidentified names to players
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

  // FG's Next round menu: 5 rounds at once.
  await tool("kraken_combat", { action: "next" });
  const round = combat.viewFor(gm).round;
  await tool("kraken_combat", { action: "advance-rounds", count: 5 });
  assert(combat.viewFor(gm).round === round + 5, `five rounds on: ${round} -> ${combat.viewFor(gm).round}`);
  done.push("advance five rounds");

  // Wnd and Tmp typed: the orc's wounds on its row, the hero's on the sheet with temporary hit points.
  await tool("kraken_combat", { action: "set-health", id: O, wounds: 4 });
  await tool("kraken_combat", { action: "set-health", id: H, wounds: 3, temp: 5 });
  const heroData = agent.records.get(hero.id).data;
  assert(view().find((item) => item.id === O).wounds === 4 && heroData.hp.wounds === 3 && heroData.hp.temp === 5, `typed health: ${JSON.stringify({ orc: view().find((item) => item.id === O).wounds, hero: heroData.hp })}`);
  done.push("wounds and temporary hit points typed");

  // Initiative swapped by a drag.
  await tool("kraken_combat", { action: "update", id: H, patch: { initresult: 18 } });
  await tool("kraken_combat", { action: "update", id: O, patch: { initresult: 7 } });
  await tool("kraken_combat", { action: "swap-init", id: H, otherId: O });
  assert(view().find((item) => item.id === H).initresult === 7 && view().find((item) => item.id === O).initresult === 18, "initiative swapped");
  done.push("initiative swapped");

  // [USED] and recharge: a 1 at the orc's turn keeps it used, a 6 brings it back.
  const breath = "Fire Breath (Recharge 5-6)";
  await tool("kraken_combat", { action: "spend", id: O, name: breath });
  assert(view().find((item) => item.id === O).spent?.includes(breath) && !combat.viewFor(ann).entries.find((item) => item.id === O).spent, "used, the GM's to see");
  agent.dice.clearForced?.();
  for (let step = 0; step < 4 && combat.viewFor(gm).active !== H; step++) await tool("kraken_combat", { action: "next" });
  agent.dice.force([1]);
  await tool("kraken_combat", { action: "next" });
  agent.dice.clearForced?.();
  assert(combat.viewFor(gm).active === O && view().find((item) => item.id === O).spent?.includes(breath), `a 1: still used: ${JSON.stringify({ active: combat.viewFor(gm).active, spent: view().find((item) => item.id === O).spent })}`);
  await tool("kraken_combat", { action: "next" });
  for (let step = 0; step < 4 && combat.viewFor(gm).active !== H; step++) await tool("kraken_combat", { action: "next" });
  agent.dice.force([6]);
  await tool("kraken_combat", { action: "next" });
  agent.dice.clearForced?.();
  assert(!view().find((item) => item.id === O).spent?.includes(breath), `a 6: ready again: ${JSON.stringify(view().find((item) => item.id === O).spent)}`);
  assert(agent.chatLog(20).some((line) => /\[RECHARGE\] Orc: Fire Breath \(Recharge 5-6\) is ready again/.test(line.text ?? "") && line.secret), "the GM is told");
  done.push("[USED] and recharge at its turn");

  // An unidentified creature: players' tracker and turn notice call it by its token's name.
  agent.map.setScene({ id: "cave", name: "Cave", width: 500, height: 500, padding: 0, backgroundColor: "#000", grid: { size: 50, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, walls: [], lights: [], tokens: [] });
  const token = await tool("kraken_token_place", { name: "Orc", col: 2, row: 2 });
  await tool("kraken_token_update", { id: token.id, unidentified: "Hulking brute" });
  await tool("kraken_combat", { action: "update", id: O, patch: { tokenId: token.id } });
  assert(combat.viewFor(ann).entries.find((item) => item.id === O).name === "Hulking brute" && view().find((item) => item.id === O).name === "Orc", `the players' name: ${combat.viewFor(ann).entries.find((item) => item.id === O).name}`);
  for (let step = 0; step < 4 && combat.viewFor(gm).active !== H; step++) await tool("kraken_combat", { action: "next" });
  const before = agent.chatLog(200).length;
  await tool("kraken_combat", { action: "next" });
  const notices = agent.chatLog(200).slice(before).filter((line) => /^\[TURN\]/.test(line.text ?? ""));
  assert(notices.some((line) => line.playersOnly && /Hulking brute/.test(line.text)) && !notices.some((line) => !line.secret && !line.playersOnly && /\[TURN\] Orc/.test(line.text)), `turn notices: ${JSON.stringify(notices.map((line) => [line.text, line.secret, line.playersOnly]))}`);
  done.push("an unidentified creature's name to players, on the tracker and its turn notice");
} finally {
  await server.stop?.();
}
console.log(`ok 5e tracker: ${done.join("; ")}`);
process.exit(0);
