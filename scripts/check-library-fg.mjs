// The library beside FG's:
//  - record list groups (the GM's own categories): kept with the campaign, nonsense dropped
//  - Send to chat on a record: the GM's posts its link and its text, with no words typed
import "./loopback.mjs";
import { createRequire } from "node:module";
import { WebSocket } from "ws";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function connect(port, join) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const inbox = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      inbox.push(msg);
      if (msg.type === "ok") resolve({ ws, inbox, send: (body) => ws.send(JSON.stringify(body)) });
    });
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", ...join })));
  });
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const done = [];
const server = createTableServer({ ruleset: "D&D 5E" });
const { port, hostToken } = await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
const gm = await connect(port, { name: "GM", hostToken });
const ann = await connect(port, { name: "Ann" });
try {
  const orc = agent.records.create({ type: "npc", name: "Orc", visibility: "all", data: { description: "A brute with an axe." } }, agent.seat);
  const set = await tool("kraken_table_options", { groupNames: { npc: ["Act 1 foes", "Act 1 foes", "", "Act 2"], "Bad List!": ["x"] }, recordGroups: { [orc.id]: "Act 1 foes", nothing: "" } });
  const options = set.options ?? set;
  assert(JSON.stringify(options.groupNames) === JSON.stringify({ npc: ["Act 1 foes", "Act 2"] }) && options.recordGroups[orc.id] === "Act 1 foes" && !("nothing" in options.recordGroups), `groups kept and cleaned: ${JSON.stringify({ names: options.groupNames, groups: options.recordGroups })}`);
  done.push("record list groups kept with the campaign");

  // Send to chat: no words, the record's link and its text.
  gm.send({ type: "chat", text: "", link: { kind: "record", record: orc.id, label: "Orc" }, share: true });
  await wait(300);
  const line = [...ann.inbox].reverse().find((msg) => msg.type === "chat" && msg.link?.record === orc.id);
  assert(line && (line.share || /brute/.test(JSON.stringify(line))), `Ann sees the record in chat: ${JSON.stringify(line)}`);
  done.push("Send to chat");
} finally {
  gm.ws.close();
  ann.ws.close();
  await server.stop?.();
}
console.log(`ok library fg: ${done.join("; ")}`);
process.exit(0);
