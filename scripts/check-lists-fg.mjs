// The lists beside FG's: Revert (a book's record as its book has it again, the GM's changes dropped; a campaign
// record has none to go back to).
import "./loopback.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const content = require("../electron/content.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const agent = server.agent;
try {
  const original = { type: "npc", name: "Goblin", data: { fgPath: "npc.id-00001", ac: 15, hp: 7, version: "2024" } };
  const goblin = agent.records.create({ ...original, source: "Test Bestiary" }, agent.seat);
  agent.records.update(goblin.id, { name: "Goblin Boss", data: { hp: 21 } }, agent.seat);
  assert(agent.records.get(goblin.id).data.hp === 21, "edited");
  const asked = [];
  const readBook = async (book, bookPath) => (asked.push([book, bookPath]), { type: "npc", name: original.name, data: original.data });
  const back = await content.revertRecord(agent, { id: goblin.id }, readBook);
  assert(back.name === "Goblin" && back.data.hp === 7 && back.source === "Test Bestiary" && JSON.stringify(asked) === JSON.stringify([["Test Bestiary", "npc.id-00001"]]), `as the book has it: ${JSON.stringify({ back, asked })}`);
  done.push("a book's record reverted");

  const own = agent.records.create({ type: "npc", name: "Bandit", data: { hp: 11 } }, agent.seat);
  const said = await callTool("kraken_record_revert", { id: own.id }, { table: () => server }).then((result) => (result.isError ? result.content[0].text : "reverted"), (error) => error.message);
  assert(/campaign's own/.test(said), `the campaign's own: ${said}`);
  done.push("the campaign's own has none");
} finally {
  await server.stop?.();
}
console.log(`ok lists fg: ${done.join("; ")}`);
process.exit(0);
