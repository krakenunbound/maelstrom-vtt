// AD&D 2E morale on the tracker (the DMG's): 2d10 against the creature's morale rating, the first number of its
// block's "Average (8-10)"; over it the creature breaks (Morale broken: flees or surrenders); a bonus moves the
// rating; Fearless (19 or more) never breaks; a creature with no rating is refused.
import "./loopback.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const server = createTableServer({ ruleset: "AD&D 2E" });
await server.listen({ port: 0, password: "" });
const ctx = { table: () => server };
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, ctx);
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
const npc = (name, morale) => agent.records.create({ type: "npc", name, visibility: "gm", data: { ac: 7, hd: "1/2", thaco: 20, morale } }, agent.seat);
try {
  const kobold = npc("Kobold", "Average (8-10)");
  const golem = npc("Golem", "Fearless (19-20)");
  const statue = npc("Statue", "");
  const added = async (record) => (await tool("kraken_combat", { action: "add", recordId: record.id })).entries.find((entry) => entry.recordId === record.id);
  const k = await added(kobold);
  const g = await added(golem);
  const s = await added(statue);
  const morale = async (id, bonus = 0, faces) => {
    agent.dice.force(faces);
    return (await tool("kraken_combat", { action: "morale", id, bonus })).morale;
  };
  const stands = await morale(k.id, 0, [3, 5]);
  assert(stands.stands === true && stands.score === 8 && stands.total === 8, `8 on 2d10 against 8: stands (${JSON.stringify(stands)})`);
  const line = [...agent.chatLog(50)].reverse().find((item) => /\[MORALE\]/.test(item.roll?.label ?? ""));
  assert(/Kobold \[MORALE 8\] \[STANDS 8 vs 8\]/.test(line.roll.label) && /2d10/.test(line.roll.formula), `the chat line: ${line.roll.label} ${line.roll.formula}`);
  const breaks = await morale(k.id, 0, [6, 3]);
  assert(breaks.stands === false && agent.combat.entries().find((entry) => entry.id === k.id).effects.some((effect) => /Morale broken/.test(effect.label)), "9 against 8: breaks, Morale broken on it");
  const helped = await morale(k.id, 2, [6, 3]);
  assert(helped.score === 10 && helped.stands === true, `a +2 bonus: 9 against 10 stands (${JSON.stringify(helped)})`);
  const fearless = await morale(g.id, 0, [10, 10]);
  assert(fearless.stands === true && fearless.score === 19, "Fearless never breaks");
  let refused = "";
  try {
    await morale(s.id, 0, [1, 1]);
  } catch (error) {
    refused = error.message;
  }
  assert(/no morale rating/.test(refused), `no rating: refused (${refused})`);
  console.log("ok 2e morale: 2d10 at or under the block's rating stands, over breaks (Morale broken), a bonus moves the rating, Fearless never breaks, no rating refused");
} finally {
  await server.stop();
}
