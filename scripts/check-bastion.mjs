// Bastions (5E 2024; FG's party sheet Bastion tab):
//  - off until the house rule HRBASTION is on; a game without bastions says so
//  - a player names their character's bastion, adds facilities (by name, a location dropped in), gives orders (the
//    same order again: a turn more), takes one out; not another player's, and an order not the game's is refused
//  - the GM advances the bastion turn: the log gets each member's facilities, orders and turns left, every order
//    counts down, one at 0 is cleared; the GM clears an order, sets the turn count, clears the log; a player may not
//  - a player's request over the table (the Bastion tab's) is answered
import "./loopback.mjs";
import { createRequire } from "node:module";
import { WebSocket } from "ws";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { bastionAction } = require("../electron/bastion.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const server = createTableServer({ ruleset: "D&D 5E" });
const opened = await server.listen({ port: 0, password: "" });
const tool = async (name, args) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const refused = (fn) => {
  try {
    fn();
    return "";
  } catch (error) {
    return String(error);
  }
};
const a = server.agent;
const ann = { role: "player", name: "Ann" };
const bob = { role: "player", name: "Bob" };
const GM = { role: "dm", name: "GM" };
try {
  const mira = a.records.create({ type: "character", name: "Mira", owner: "Ann", data: { level: 5 } }, a.seat);
  const tor = a.records.create({ type: "character", name: "Tor", owner: "Bob", data: { level: 5 } }, a.seat);
  const { partyRecord, PARTY_ID } = require("../electron/party.cjs");
  partyRecord(a);
  a.records.update(PARTY_ID, { data: { members: [mira.id, tor.id] } }, a.seat);
  const keep = a.records.create({ type: "location", name: "The Old Keep", data: { type: "Bastion" } }, a.seat);

  // 1. Off until the house rule is on.
  assert(/Bastions are off/.test(refused(() => bastionAction(a, ann, { action: "add", character: mira.id, name: "Smithy" }))), "off by default");
  await tool("kraken_table_options", { rules: { HRBASTION: true } });
  assert(/no bastions/.test(refused(() => bastionAction({ ...a, ruleset: () => "Castles & Crusades" }, ann, { action: "log" }))), "C&C has none");
  done.push("off until the house rule; only where the game has them");

  // 2. A player's own bastion.
  bastionAction(a, ann, { action: "name", character: mira.id, name: "Mira's Hold" });
  bastionAction(a, ann, { action: "add", character: mira.id, name: "Smithy" });
  const linked = bastionAction(a, ann, { action: "add", character: mira.id, link: { kind: "record", record: keep.id, label: "The Old Keep" } });
  const [smithy, old] = Object.keys(linked.bastion.facilities);
  assert(linked.bastion.name === "Mira's Hold" && linked.bastion.facilities[old].link.record === keep.id && linked.bastion.facilities[old].name === "The Old Keep", `named, a location as a facility: ${JSON.stringify(linked)}`);
  bastionAction(a, ann, { action: "order", character: mira.id, facility: smithy, order: "craft" });
  const twice = bastionAction(a, ann, { action: "order", character: mira.id, facility: smithy, order: "Craft" });
  assert(twice.bastion.facilities[smithy].order === "Craft" && twice.bastion.facilities[smithy].duration === 2, `the same order again, a turn more: ${JSON.stringify(twice.bastion.facilities[smithy])}`);
  bastionAction(a, ann, { action: "order", character: mira.id, facility: old, order: "Research" });
  const other = bastionAction(a, ann, { action: "order", character: mira.id, facility: old, order: "Trade" });
  assert(other.bastion.facilities[old].order === "Trade" && other.bastion.facilities[old].duration === 1, "another order starts over");
  assert(/not your character/.test(refused(() => bastionAction(a, bob, { action: "order", character: mira.id, facility: smithy, order: "Trade" }))), "not another player's");
  assert(/An order is one of/.test(refused(() => bastionAction(a, ann, { action: "order", character: mira.id, facility: smithy, order: "Dance" }))), "only the game's orders");
  assert(/GM's/.test(refused(() => bastionAction(a, ann, { action: "clear", character: mira.id, facility: smithy }))) && /GM's/.test(refused(() => bastionAction(a, ann, { action: "advance" }))), "a player does not clear or advance");
  bastionAction(a, bob, { action: "add", character: tor.id, name: "Garden" });
  done.push("a player's bastion: named, facilities (a location too), orders, a turn more; not another's");

  // 3. The GM's bastion turn.
  const first = bastionAction(a, GM, { action: "advance" });
  const kept = a.records.get(mira.id).data.bastion.facilities;
  assert(first.turn === 1 && /BASTION TURN: 0/.test(first.log) && /Smithy - Craft - 1 TURNS LEFT/.test(first.log) && /The Old Keep - Trade - 0 TURNS LEFT/.test(first.log) && /Garden - No order/.test(first.log), `the log: ${first.log}`);
  assert(kept[smithy].duration === 1 && kept[smithy].order === "Craft" && kept[old].order === "" && kept[old].duration === 0, `the orders count down, a done one cleared: ${JSON.stringify(kept)}`);
  const second = bastionAction(a, GM, { action: "advance" });
  assert(second.turn === 2 && a.records.get(mira.id).data.bastion.facilities[smithy].order === "", "the next turn clears the last");
  bastionAction(a, ann, { action: "order", character: mira.id, facility: smithy, order: "Maintain" });
  assert(a.records.get(mira.id).data.bastion.facilities[smithy].order === "Maintain", "a new order");
  bastionAction(a, GM, { action: "clear", character: mira.id, facility: smithy });
  assert(a.records.get(mira.id).data.bastion.facilities[smithy].order === "", "the GM clears an order");
  assert((await tool("kraken_bastion", { action: "turn", turn: 7 })).turn === 7, "the turn set");
  assert((await tool("kraken_bastion", { action: "log-clear" })).text === "", "the log cleared");
  bastionAction(a, ann, { action: "remove", character: mira.id, facility: old });
  assert(!a.records.get(mira.id).data.bastion.facilities[old] && a.records.get(mira.id).data.bastion.facilities[smithy], "a facility taken out, the others kept");
  done.push("the GM's turn: the log, orders counting down; clear, the turn count, the log cleared");

  // 4. Over the table, as the Bastion tab asks.
  const player = await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${opened.port}`);
    const waits = new Map();
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "ok") resolve({ ws, ask: (body) => new Promise((done) => (waits.set(body.req, done), ws.send(JSON.stringify(body)))) });
      if (msg.type === "op-result" && waits.has(msg.req)) waits.get(msg.req)(msg);
    });
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", name: "Ann" })));
  });
  const reply = await player.ask({ type: "party-bastion", req: 1, action: "add", character: mira.id, name: "Library" });
  const denied = await player.ask({ type: "party-bastion", req: 2, action: "advance" });
  assert(reply.ok && Object.values(reply.result.bastion.facilities).some((row) => row.name === "Library") && !denied.ok && /GM's/.test(denied.error), `answered: ${JSON.stringify([reply, denied])}`);
  player.ws.close();
  done.push("a player's request over the table answered");
} finally {
  await server.stop?.();
}
console.log(`ok bastion: ${done.join("; ")}`);
process.exit(0);
