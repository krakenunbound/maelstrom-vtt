// Maps and tokens beside FG's:
//  - the GM renames a token on the map
//  - share with chosen players: the map opens for Ann alone; Bob is sent none; everyone again after a plain share
//  - a tracker side dropped on the map (FG's faction chip): every foe placed, three across
//  - a pointer: a drawing that fades after a few seconds (FG's right-drag pointers)
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
const last = (seat, type) => [...seat.inbox].reverse().find((msg) => msg.type === type);
const done = [];
const server = createTableServer({ ruleset: "D&D 5E" });
const { port, hostToken } = await server.listen({ port: 0, password: "" });
const ctx = { table: () => server };
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, ctx);
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
const gm = await connect(port, { name: "GM", hostToken });
const ann = await connect(port, { name: "Ann" });
const bob = await connect(port, { name: "Bob" });
try {
  gm.send({ type: "scene", scene: { id: "hall", name: "Hall", width: 1000, height: 1000, padding: 0, backgroundColor: "#000", grid: { size: 100, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, walls: [], lights: [], tokens: [] } });
  await wait(300);

  // Rename.
  const token = await tool("kraken_token_place", { name: "Goblin", col: 1, row: 1 });
  await tool("kraken_token_update", { id: token.id, name: "Goblin chief" });
  assert(agent.map.tokens().find((item) => item.id === token.id).name === "Goblin chief", "renamed");
  done.push("a token renamed");

  // Share with Ann alone.
  await tool("kraken_map", { share: false });
  await wait(200);
  gm.send({ type: "map-share", to: ["Ann"] });
  await wait(400);
  assert(last(ann, "scene")?.scene?.id === "hall" && last(ann, "map-share"), `Ann has it: ${JSON.stringify(last(ann, "scene")?.scene?.id)}`);
  assert(last(bob, "scene")?.scene === null && !bob.inbox.some((msg) => msg.type === "map-share") && !(last(bob, "map")?.tokens ?? []).length, `Bob has none: ${JSON.stringify({ scene: last(bob, "scene")?.scene, map: last(bob, "map")?.tokens?.length })}`);
  gm.send({ type: "map-share" });
  await wait(400);
  assert(last(bob, "scene")?.scene?.id === "hall", "a plain share: everyone");
  done.push("shared with Ann alone, then everyone");

  // Formation: three foes and a friend; the foes go three across from the drop.
  for (const name of ["Orc A", "Orc B", "Orc C"]) await tool("kraken_combat", { action: "add", entry: { name, faction: "foe", hp: 10, ac: 12, init: 0 } });
  await tool("kraken_combat", { action: "add", entry: { name: "Ally", faction: "friend", hp: 10, ac: 12, init: 0 } });
  gm.send({ type: "ct", action: "place-faction", faction: "foe", x: 450, y: 450 });
  await wait(400);
  const orcs = agent.map.tokens().filter((item) => /^Orc/.test(item.name));
  const rows = new Set(orcs.map((item) => item.y));
  assert(orcs.length === 3 && rows.size === 1 && !agent.map.tokens().some((item) => item.name === "Ally"), `three across, the friend not placed: ${JSON.stringify(orcs.map((item) => [item.name, item.x, item.y]))}`);
  const linked = (await tool("kraken_combat", { action: "view" })).entries.filter((item) => /^Orc/.test(item.name)).every((item) => item.tokenId);
  assert(linked, "each tied to its tracker row");
  done.push("a side placed in formation");

  // A pointer: Ann draws an arrow that fades.
  ann.send({ type: "draw", points: [100, 100, 300, 300], shape: "arrow", width: 3, fade: true });
  await wait(300);
  const shown = (last(gm, "map")?.drawings ?? []).length;
  assert(shown >= 1, `the pointer is seen: ${shown}`);
  await wait(6200);
  assert((last(gm, "map")?.drawings ?? []).length === shown - 1, `and gone: ${(last(gm, "map")?.drawings ?? []).length}`);
  done.push("a pointer that fades");
} finally {
  for (const seat of [gm, ann, bob]) seat.ws.close();
  await server.stop?.();
}
console.log(`ok map fg: ${done.join("; ")}`);
process.exit(0);
