// Chat and dice beside FG's:
//  - "The GM is typing": the GM's hint reaches the players, a player's goes nowhere
//  - 5E's +5 and -5 keys: +5 stacks with +2 (a +7 on the next roll), -5 takes +5's place
import "./loopback.mjs";
import { createRequire } from "node:module";
import { WebSocket } from "ws";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");

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
const gm = await connect(port, { name: "GM", hostToken });
const ann = await connect(port, { name: "Ann" });
const bob = await connect(port, { name: "Bob" });
try {
  gm.send({ type: "typing", on: true });
  await wait(200);
  assert(ann.inbox.some((msg) => msg.type === "typing" && msg.on) && bob.inbox.some((msg) => msg.type === "typing" && msg.on) && !gm.inbox.some((msg) => msg.type === "typing"), "the players are told the GM is typing");
  const before = gm.inbox.length + bob.inbox.filter((msg) => msg.type === "typing").length;
  ann.send({ type: "typing", on: true });
  await wait(200);
  assert(gm.inbox.length + bob.inbox.filter((msg) => msg.type === "typing").length === before, "a player's typing goes nowhere");
  done.push("the GM is typing, to the players");

  // +2 and +5: a +7 on the next roll; then -5 takes +5's place.
  ann.send({ type: "modifiers", action: "key", key: "plus2", on: true });
  ann.send({ type: "modifiers", action: "key", key: "plus5", on: true });
  await wait(150);
  server.agent.dice.force([10]);
  ann.send({ type: "roll", formula: "1d20", label: "With keys" });
  await wait(300);
  const line = [...ann.inbox].reverse().find((msg) => msg.type === "chat" && /With keys/.test(msg.roll?.label ?? ""));
  assert(line?.roll?.total === 17, `+2 and +5 on a 10: ${JSON.stringify(line?.roll)}`);
  ann.send({ type: "modifiers", action: "key", key: "plus5", on: true });
  ann.send({ type: "modifiers", action: "key", key: "minus5", on: true });
  await wait(150);
  const keys = [...ann.inbox].reverse().find((msg) => msg.type === "modifiers")?.modifiers?.keys;
  assert(Array.isArray(keys) && keys.includes("minus5") && !keys.includes("plus5"), `-5 takes +5's place: ${JSON.stringify(keys)}`);
  done.push("+5 and -5 keys");
} finally {
  for (const seat of [gm, ann, bob]) seat.ws.close();
  await server.stop?.();
}
console.log(`ok chat fg: ${done.join("; ")}`);
process.exit(0);
