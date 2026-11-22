// The map beside FG's:
//  - the mask's freehand brush: a stroke reveals (or hides again) what lies along it, no further
//  - waypoints while dragging a token: it goes through each in turn, each leg stopped by walls
//  - a token's size past 4 squares
import "./loopback.mjs";
import { createRequire } from "node:module";
import { WebSocket } from "ws";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
// An empty room, 600 x 300, 50 px squares.
const scene = { id: "room", name: "Room", width: 600, height: 300, padding: 0, backgroundColor: "#000", grid: { size: 50, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, lights: [], tokens: [], walls: [] };
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
const settle = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const done = [];
const server = createTableServer();
const info = await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const dm = await connect(info.port, { name: "DM", hostToken: info.hostToken });
const player = await connect(info.port, { name: "Tester" });
try {
  dm.send({ type: "scene", scene });
  await settle(300);
  const map = server.agent.map;
  const seat = server.agent.seat;
  const playerSeat = { role: "player", name: "Tester" };
  const hero = map.place({ name: "Hero", x: 75, y: 125 }, seat);
  map.update(hero.id, { owner: "Tester" }, seat);
  const orc = map.place({ name: "Orc", x: 475, y: 125 }, seat);
  const goblin = map.place({ name: "Goblin", x: 475, y: 275 }, seat);
  const sees = (token) => map.viewFor(playerSeat, "").tokens.some((item) => item.id === token.id);

  // 1. The mask's brush: a stroke along the orc's row reveals the orc, not the goblin two rows down.
  await tool("kraken_mask", { action: "on" });
  assert(!sees(orc) && !sees(goblin), "under the mask: neither");
  await tool("kraken_mask", { action: "reveal", points: [300, 125, 550, 125], width: 60 });
  assert(sees(orc) && !sees(goblin), "the stroke reveals the orc alone");
  dm.send({ type: "mask", action: "hide", points: [475, 125], width: 40 });
  await settle();
  assert(!sees(orc), "a dab of the brush hides it again");
  const shapes = map.viewFor(playerSeat, "").mask.shapes;
  assert(shapes.length === 2 && shapes.every((shape) => shape.width > 0), `the player gets the strokes to draw: ${JSON.stringify(shapes)}`);
  await tool("kraken_mask", { action: "off" });
  await tool("kraken_mask", { action: "clear" });
  done.push("the mask's brush");

  // 2. Waypoints: right along row 2, down to row 4, then left; a wall across the last leg stops it there.
  const squareOf = (id) => map.squareOf(map.tokens().find((token) => token.id === id));
  player.send({ type: "token-move", id: hero.id, x: 75, y: 225, via: [{ x: 175, y: 125 }, { x: 175, y: 225 }] });
  await settle();
  const path = map.path(hero.id).map((move) => [move.to.x, move.to.y]);
  assert(JSON.stringify(squareOf(hero.id)) === JSON.stringify({ col: 1, row: 4 }) && JSON.stringify(path.slice(-3)) === JSON.stringify([[175, 125], [175, 225], [75, 225]]), `through its waypoints: ${JSON.stringify({ at: squareOf(hero.id), path })}`);
  // Undo takes back the whole drag, not one leg.
  await tool("kraken_token_move", { id: hero.id, undo: true });
  assert(JSON.stringify(squareOf(hero.id)) === JSON.stringify({ col: 1, row: 2 }), `undo: the whole drag: ${JSON.stringify(squareOf(hero.id))}`);
  await tool("kraken_wall", { action: "add", points: [250, 0, 250, 300] });
  await tool("kraken_token_move", { id: hero.id, col: 9, row: 2, via: [{ col: 3, row: 4 }], asPlayer: true });
  const stopped = squareOf(hero.id);
  assert(stopped.col < 5, `a wall stops the leg: ${JSON.stringify(stopped)}`);
  done.push("waypoints while dragging, each leg stopped by walls, undone as one");

  // 3. A gargantuan's six squares.
  await tool("kraken_token_update", { id: orc.id, squares: 6 });
  assert(map.tokens().find((token) => token.id === orc.id).squares === 6, "six squares");
  done.push("a token's size past 4");
} finally {
  dm.ws.close();
  player.ws.close();
  await server.stop?.();
}
console.log(`ok map fg extras: ${done.join("; ")}`);
process.exit(0);
