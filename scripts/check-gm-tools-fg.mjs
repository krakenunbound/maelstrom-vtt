// GM tools beside FG's:
//  - a table's output: a new story (its results as text) or a new encounter (the NPCs it names, counted)
//  - story templates: [Table name], [1d6] and [2x] rolled into a new story
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
const agent = server.agent;
try {
  const goblin = agent.records.create({ type: "npc", name: "Goblin", data: { xp: 50 } }, agent.seat);
  const foes = await tool("kraken_table", { action: "import", name: "Foes", text: "1  3 Goblins\n2  3 Goblins" });
  // Both rows link the goblin.
  const rows = foes.data.tablerows;
  agent.records.update(foes.id, { data: { tablerows: Object.fromEntries(Object.keys(rows).map((key) => [key, { results: { "id-00001": { resultlink: { class: "npc", recordname: goblin.id } } } }])) } }, agent.seat);
  await tool("kraken_table", { action: "import", name: "Tavern Names", text: "1  The Prancing Pony\n2  The Prancing Pony" });

  // Output: an encounter with 3 goblins; a story with the result.
  const enc = await tool("kraken_table", { action: "roll", id: foes.id, output: "encounter" });
  const battle = agent.records.get(enc.encounter);
  const row = Object.values(battle?.data?.npclist ?? {})[0];
  assert(battle?.type === "battle" && row?.link?.recordname === goblin.id && row.count === "3", `an encounter of 3 goblins: ${JSON.stringify(battle?.data)}`);
  const told = await tool("kraken_table", { action: "roll", id: foes.id, output: "story" });
  const story = agent.records.get(told.story);
  assert(story?.type === "story" && /3 Goblins/.test(JSON.stringify(story.data.blocks)), `a story of the result: ${JSON.stringify(story?.data)}`);
  done.push("a table's output into a new encounter and a new story");

  // A story template.
  agent.dice.force([1, 4]);
  const made = await tool("kraken_story", { action: "generate", name: "Tonight", template: "The tavern is [Tavern Names].\n\nTonight [1d6] guests and [2x][Tavern Names] signs." });
  const words = JSON.stringify(made.data.blocks);
  assert(made.name === "Tonight" && /The tavern is The Prancing Pony\./.test(words) && /Tonight 4 guests/.test(words) && /The Prancing Pony, The Prancing Pony signs/.test(words), `the template filled: ${words}`);
  done.push("a story from a template");
} finally {
  await server.stop?.();
}
console.log(`ok gm tools fg: ${done.join("; ")}`);
process.exit(0);
