// FG's combat display options (CoreRPG), on Maelstrom's tracker:
//  - players' tracker health: allies' hit points, enemies' status words by default (FG's SHPC, SHNPC); each can be
//    hit points, status or nothing
//  - players' turn order (CTSI): everyone, allies only, none (then allies first, by name)
//  - wound categories (WNDC) simple or detailed, health colours (BARC) gradient or tiered
//  - skip hidden creatures (CTSH)
//  - the turn notice's effects (RSHE): the GM's line with every effect, the players' (an ally's) without the GM's own
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
const ctx = { table: () => server };
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, ctx);
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
const ct = (args) => tool("kraken_combat", args);
const options = (patch) => tool("kraken_table_options", patch);
const ann = { role: "player", name: "Ann" };
const playerView = () => agent.combat.viewFor(ann);
const gmView = () => agent.combat.viewFor({ role: "dm", name: "GM" });
const of = (view, name) => view.entries.find((item) => item.name === name);

try {
  await ct({ action: "add", entry: { name: "Ally", faction: "friend", hp: 20, ac: 14, init: 0 } });
  await ct({ action: "add", entry: { name: "Orc", faction: "foe", hp: 20, ac: 13, init: 0 } });
  await ct({ action: "add", entry: { name: "Ghoul", faction: "foe", hp: 20, ac: 12, init: 0 } });
  const id = (name) => of(gmView(), name).id;
  await ct({ action: "update", id: id("Ally"), patch: { initresult: 15 } });
  await ct({ action: "update", id: id("Orc"), patch: { initresult: 18 } });
  await ct({ action: "update", id: id("Ghoul"), patch: { initresult: 9 } });
  await ct({ action: "damage", id: id("Orc"), amount: 6 });

  // Health on the players' tracker: an ally's hit points, an enemy's status words (FG's defaults).
  let view = playerView();
  assert(of(view, "Ally").hp === 20 && of(view, "Orc").hp === undefined && of(view, "Orc").health.status === "Wounded", `defaults: ${JSON.stringify([of(view, "Ally"), of(view, "Orc")].map((item) => [item.hp, item.health.status]))}`);
  await options({ ctHealthNpc: "detailed", ctHealthPc: "off" });
  view = playerView();
  assert(of(view, "Orc").hp === 20 && of(view, "Orc").wounds === 6 && of(view, "Ally").hp === undefined && of(view, "Ally").health.status === "", `enemies' hit points, allies' nothing: ${JSON.stringify([of(view, "Ally"), of(view, "Orc")].map((item) => [item.hp, item.health.status]))}`);
  await options({ ctHealthNpc: "status", ctHealthPc: "detailed" });
  done.push("players' tracker health: allies and enemies, hit points, status or nothing");

  // Turn order: allies only; none (allies first, then by name).
  await options({ turnOrder: "friend" });
  view = playerView();
  assert(of(view, "Ally").initresult === 15 && of(view, "Orc").initresult === undefined && view.entries[0].name === "Ally", `allies' initiative alone, listed first: ${JSON.stringify(view.entries.map((item) => [item.name, item.initresult]))}`);
  await options({ turnOrder: "off" });
  view = playerView();
  assert(view.entries.every((item) => item.initresult === undefined) && view.entries.map((item) => item.name).join(",") === "Ally,Ghoul,Orc", `no initiative: allies first, by name: ${JSON.stringify(view.entries.map((item) => item.name))}`);
  assert(gmView().entries.map((item) => item.name).join(",") === "Orc,Ally,Ghoul" && of(gmView(), "Orc").initresult === 18, "the GM sees the order as it is");
  await options({ turnOrder: "on" });
  done.push("players' turn order: everyone, allies only, none");

  // Wound categories and colours.
  assert(of(gmView(), "Orc").health.status === "Wounded", "simple: Wounded");
  await options({ woundCategories: "detailed", healthColors: "tiered" });
  assert(of(gmView(), "Orc").health.status === "Moderate" && of(gmView(), "Orc").health.color === "#FFC000", `detailed: 6 of 20 is Moderate, tiered colour: ${JSON.stringify(of(gmView(), "Orc").health)}`);
  await ct({ action: "damage", id: id("Orc"), amount: 10 });
  assert(of(gmView(), "Orc").health.status === "Critical" && of(gmView(), "Orc").health.color === "#FF0000", `16 of 20: Critical: ${JSON.stringify(of(gmView(), "Orc").health)}`);
  await options({ woundCategories: "simple", healthColors: "gradient" });
  assert(of(gmView(), "Orc").health.status === "Heavy", "simple again: Heavy");
  done.push("wound categories and health colours");

  // Skip hidden: the hidden ghoul gets no turn.
  await ct({ action: "update", id: id("Ghoul"), patch: { hidden: true } });
  await options({ skipHidden: true });
  const turns = [];
  for (let step = 0; step < 4; step++) {
    await ct({ action: "next" });
    turns.push(gmView().entries.find((item) => item.id === gmView().active)?.name);
  }
  assert(!turns.includes("Ghoul"), `the hidden ghoul skipped: ${turns}`);
  await options({ skipHidden: false });
  done.push("skip hidden creatures");

  // The turn notice: the ally prone (everyone's) and marked (the GM's own); the GM's line has both, the players' Prone alone.
  await ct({ action: "effect", id: id("Ally"), effect: { label: "Prone", duration: 0 } });
  await ct({ action: "effect", id: id("Ally"), effect: { label: "Marked for death", duration: 0, gmOnly: true } });
  await options({ turnEffects: "all" });
  await ct({ action: "set-round", round: 1 });
  const activeName = () => gmView().entries.find((item) => item.id === gmView().active)?.name;
  for (let step = 0; step < 4 && activeName() === "Ally"; step++) await ct({ action: "next" });
  for (let step = 0; step < 4 && activeName() !== "Ally"; step++) await ct({ action: "next" });
  const lines = agent.chatLog(40).filter((line) => /^\[TURN\] Ally/.test(line.text ?? ""));
  const gmLine = lines.at(-2);
  const playerLine = lines.at(-1);
  assert(gmLine?.secret && /Prone/.test(gmLine.text) && /Marked for death/.test(gmLine.text), `the GM's notice: ${JSON.stringify(gmLine)}`);
  assert(playerLine?.playersOnly && /Prone/.test(playerLine.text) && !/Marked/.test(playerLine.text), `the players' notice: ${JSON.stringify(playerLine)}`);
  done.push("the turn notice's effects, the GM's and the players'");
} finally {
  await server.stop?.();
}
console.log(`ok combat display: ${done.join("; ")}`);
process.exit(0);
