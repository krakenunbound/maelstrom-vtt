// FG's token display options, on what the host sends each seat:
//  - TGMH: what the GM sees of health on tokens (dot by default; bar, off...)
//  - TGME, TNPCE, TPCE: effects on tokens for the GM, and for players on creatures and on characters: icons,
//    on hover, one mark, a mark on hover, off (off sends no signs at all; what can be seen stays)
//  - TFAC, TASG, INITIND: the facing arrow, the token's fill, the turn mark (table options every seat reads)
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
try {
  agent.map.setScene({ id: "room", name: "Room", width: 500, height: 500, padding: 0, backgroundColor: "#000", grid: { size: 50, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, walls: [], lights: [], tokens: [] });
  const hero = agent.records.create({ type: "character", name: "Hero", owner: "Ann", visibility: "owner", data: { hp: { total: 10, wounds: 3 } } }, agent.seat);
  const orcRecord = agent.records.create({ type: "npc", name: "Orc", data: { hp: { total: 15, wounds: 5 } } }, agent.seat);
  const heroToken = await tool("kraken_token_place", { recordId: hero.id, col: 1, row: 1 });
  const orcToken = await tool("kraken_token_place", { recordId: orcRecord.id, col: 3, row: 1 });
  await tool("kraken_combat", { action: "add", entry: { name: "Hero", faction: "friend", hp: 10, ac: 14, init: 0, recordId: hero.id, tokenId: heroToken.id } });
  await tool("kraken_combat", { action: "add", entry: { name: "Orc", faction: "foe", hp: 15, ac: 13, init: 0, recordId: orcRecord.id, tokenId: orcToken.id } });
  const entries = (await tool("kraken_combat", { action: "view" })).entries;
  for (const name of ["Hero", "Orc"]) await tool("kraken_combat", { action: "effect", id: entries.find((item) => item.name === name).id, effect: { label: "Prone", duration: 0 } });
  const of = (view, id) => view.tokens.find((token) => token.id === id);
  const gm = () => agent.map.viewFor({ role: "dm", name: "GM" }, "");
  const ann = () => agent.viewFor("Ann");

  // TGMH: the GM's dot by default; a bar; off sends no health.
  assert(of(gm(), orcToken.id).healthShow === "dot" && of(gm(), orcToken.id).health, `the GM's dot: ${JSON.stringify(of(gm(), orcToken.id).healthShow)}`);
  await tool("kraken_table_options", { healthGm: "bar" });
  assert(of(gm(), orcToken.id).healthShow === "bar", "the GM's bar");
  await tool("kraken_table_options", { healthGm: "off" });
  assert(!of(gm(), orcToken.id).health && of(ann(), orcToken.id).health, "the GM's off; players keep theirs");
  await tool("kraken_table_options", { healthGm: "dot" });
  done.push("the GM's health on tokens");

  // Effects: icons for all by default.
  assert(of(ann(), orcToken.id).effectsShow === "on" && of(ann(), orcToken.id).effects?.badges.length, `icons by default: ${JSON.stringify(of(ann(), orcToken.id).effects)}`);
  // TNPCE off: players get no signs on the orc, still on the hero; the GM keeps them.
  await tool("kraken_table_options", { effectsNpc: "off" });
  assert(!of(ann(), orcToken.id).effects?.badges?.length && of(ann(), orcToken.id).effectsShow === "off", `players: no signs on the orc: ${JSON.stringify(of(ann(), orcToken.id).effects)}`);
  assert(of(ann(), heroToken.id).effects?.badges.length, "the hero's still shown");
  assert(of(gm(), orcToken.id).effects?.badges.length && of(gm(), orcToken.id).effectsShow === "on", "the GM still sees the orc's");
  // TPCE mark on hover; TGME mark.
  await tool("kraken_table_options", { effectsPc: "markhover", effectsGm: "mark" });
  assert(of(ann(), heroToken.id).effectsShow === "markhover" && of(gm(), orcToken.id).effectsShow === "mark", "a mark on hover for players on characters, a mark for the GM");
  await tool("kraken_table_options", { effectsNpc: "on", effectsPc: "on", effectsGm: "on" });
  done.push("effects on tokens: the GM's, on creatures, on characters (icons, hover, mark, off)");

  // TFAC, TASG, INITIND are stored and cleaned.
  const set = await tool("kraken_table_options", { facingIndicator: false, tokenFill: "100", initIndicator: "ring" });
  const options = set.options ?? set;
  assert(options.facingIndicator === false && options.tokenFill === "100" && options.initIndicator === "ring", `stored: ${JSON.stringify({ f: options.facingIndicator, t: options.tokenFill, i: options.initIndicator })}`);
  const bad = await tool("kraken_table_options", { tokenFill: "55", initIndicator: "sparkles" }).catch((error) => ({ error: String(error) }));
  const after = bad.options ?? bad;
  assert(after.error || (after.tokenFill === "80" && after.initIndicator === "glow"), `nonsense falls back: ${JSON.stringify(after)}`);
  done.push("facing arrows, token fill and the turn mark");
} finally {
  await server.stop?.();
}
console.log(`ok token display: ${done.join("; ")}`);
process.exit(0);
