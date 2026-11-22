// A token's move on a square grid walks round the walls, square by square, as a turn's movement is counted: a player's
// drop past a wall takes the shortest walk through the gap (not stopped at the wall, not through it), kept as one move
// with its path; the drag's preview is the host's (a player is never sent the walls); a locked table's request carries
// the walk, the GM sees it and Accept walks it; Alt (no snap) keeps the straight line and its stop; no way round: a
// player stops at the wall, the GM goes straight. The walk counts by the table's diagonal rule.
import "./loopback.mjs";
import { createRequire } from "node:module";
import { WebSocket } from "ws";
import { pathDistance, routeSquares } from "../shared/map/geometry.mjs";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
// A room 600 x 300, 50 px squares; a wall down x = 300 from the top to y = 250 (a gap in the bottom row).
const scene = { id: "room", name: "Room", width: 600, height: 300, padding: 0, backgroundColor: "#000", grid: { size: 50, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, lights: [], tokens: [], walls: [] };

function connect(port, join) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const inbox = [];
    ws.on("message", (data) => inbox.push(JSON.parse(data.toString())));
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", ...join })));
    const start = Date.now();
    const poll = setInterval(() => {
      if (inbox.some((m) => m.type === "ok")) {
        clearInterval(poll);
        resolve({ ws, inbox, send: (body) => ws.send(JSON.stringify(body)) });
      } else if (Date.now() - start > 4000) {
        clearInterval(poll);
        reject(new Error("join timed out"));
      }
    }, 10);
  });
}
const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// The walk itself, on its own.
{
  const walls = [{ x1: 300, y1: 0, x2: 300, y2: 250, move: 20 }];
  const walk = routeSquares(scene, walls, {}, { x: 75, y: 125 }, { x: 475, y: 125 });
  assert(walk && walk.at(-1).x === 475 && walk.at(-1).y === 125, "a walk reaches the far side");
  assert(walk.some((point) => point.y === 275 && point.x === 275) && walk.some((point) => point.y === 275 && point.x === 325), `through the gap: ${JSON.stringify(walk)}`);
  const feet = pathDistance(scene, walk.flatMap((point) => [point.x, point.y]), 1).total;
  assert(feet === 40, `counted square by square, a diagonal 5 ft: ${feet}`);
  const sameWay = pathDistance(scene, walk.flatMap((point) => [point.x, point.y]), 1.5).total;
  assert(sameWay > feet, `5-10-5 counts the second diagonal double: ${sameWay}`);
  assert(routeSquares(scene, [{ x1: 300, y1: 0, x2: 300, y2: 300, move: 20 }], {}, { x: 75, y: 125 }, { x: 475, y: 125 }) === null, "no gap: no walk");
  assert(routeSquares(scene, [{ x1: 0, y1: 150, x2: 600, y2: 150, move: 20 }], {}, { x: 25, y: 25 }, { x: 25, y: 275 }) === null, "never round a wall by the far side of the map");
  // A diagonal never squeezes past a wall's corner.
  const corner = routeSquares(scene, [{ x1: 100, y1: 100, x2: 100, y2: 150, move: 20 }, { x1: 100, y1: 100, x2: 150, y2: 100, move: 20 }], {}, { x: 75, y: 75 }, { x: 125, y: 125 });
  assert(corner && corner.length > 2, `no cutting a corner: ${JSON.stringify(corner)}`);
  done.push("the walk: through the gap, counted by the diagonal rule, never off the map or past a corner");
}

const server = createTableServer();
const sockets = [];
try {
  const info = await server.listen({ port: 0, password: "" });
  const tool = async (name, args = {}) => {
    const result = await callTool(name, args, { table: () => server });
    if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
    return JSON.parse(result.content[0].text);
  };
  const dm = await connect(info.port, { name: "DM", password: "", hostToken: info.hostToken });
  const player = await connect(info.port, { name: "Tester", password: "" });
  sockets.push(dm.ws, player.ws);
  dm.send({ type: "scene", scene });
  await settle();
  const map = server.agent.map;
  const gm = server.agent.seat;
  const playerSeat = { role: "player", name: "Tester" };
  await tool("kraken_wall", { action: "add", points: [300, 0, 300, 250] });
  await tool("kraken_line_of_sight", { on: true });
  const hero = map.place({ name: "Hero", x: 75, y: 125 }, gm);
  map.update(hero.id, { owner: "Tester" }, gm);

  // The preview, asked over the wire as the player's drag does.
  player.send({ type: "token-route", id: hero.id, x: 470, y: 130, req: 7 });
  await settle();
  const preview = player.inbox.find((m) => m.type === "op-result" && m.req === 7);
  assert(preview?.ok && preview.result.routed && preview.result.points.at(-1).x === 475, `the drag's preview walks round: ${JSON.stringify(preview)}`);
  player.send({ type: "token-route", id: "nobody", x: 470, y: 130, req: 8 });
  await settle();
  assert(player.inbox.find((m) => m.type === "op-result" && m.req === 8)?.ok === false, "only the seat's own tokens");
  const asked = await tool("kraken_token_move", { id: hero.id, col: 9, row: 2, route: true });
  assert(asked.routed && asked.points.at(-1).x === 475 && asked.total === 40, `the agent's route: ${JSON.stringify(asked).slice(0, 200)}`);
  done.push("the drag's walk shown from the host (and the agent's kraken_token_move route)");

  // Free movement: the drop walks round, one move with its path.
  player.send({ type: "token-move", id: hero.id, x: 475, y: 125, snap: true });
  await settle();
  let now = map.tokens().find((token) => token.id === hero.id);
  assert(now.x === 475 && now.y === 125, `the player's drop walked round the wall: ${now.x}, ${now.y}`);
  const log = map.path(hero.id);
  assert(log.length > 3 && new Set(log.map((move) => move.drag)).size === 1 && log.some((move) => move.to.y === 275), `kept as one move with its path: ${JSON.stringify(log)}`);
  done.push("free movement: the drop walks round the wall, kept as one move with its path");

  // Alt (no snap): the straight line, stopped at the wall as before.
  map.move(hero.id, { x: 75, y: 125 }, gm, { snap: false });
  player.send({ type: "token-move", id: hero.id, x: 475, y: 125, snap: false });
  await settle();
  now = map.tokens().find((token) => token.id === hero.id);
  assert(now.x < 300, `Alt: straight, stopped at the wall: ${now.x}`);
  done.push("Alt keeps the straight line and its stop");

  // Locked: the request carries the walk; Accept walks it.
  map.move(hero.id, { x: 75, y: 125 }, gm, { snap: false });
  await tool("kraken_map", {}).catch(() => undefined);
  dm.send({ type: "lock", on: true });
  await settle();
  player.send({ type: "token-move", id: hero.id, x: 475, y: 125, snap: true });
  await settle();
  const waiting = map.moveRequests();
  assert(waiting.length === 1 && (waiting[0].via ?? []).length > 3, `the request carries the walk: ${JSON.stringify(waiting)}`);
  assert(map.tokens().find((token) => token.id === hero.id).x === 75, "it waits for the GM");
  map.approveMoves([hero.id], true, gm);
  now = map.tokens().find((token) => token.id === hero.id);
  assert(now.x === 475 && now.y === 125, `Accept walks it: ${now.x}, ${now.y}`);
  dm.send({ type: "lock", on: false });
  await settle();
  done.push("locked: the request carries the walk and Accept walks it");

  // No way round: a player stops at the wall; the GM goes straight.
  await tool("kraken_wall", { action: "add", points: [300, 250, 300, 300] });
  map.move(hero.id, { x: 75, y: 125 }, gm, { snap: false });
  assert(map.move(hero.id, { x: 475, y: 125 }, playerSeat).blocked, "no way round: the player stops at the wall");
  map.move(hero.id, { x: 475, y: 125 }, gm);
  assert(map.tokens().find((token) => token.id === hero.id).x === 475, "the GM goes straight");
  done.push("no way round: the player stops, the GM goes straight");
} finally {
  for (const ws of sockets) ws.close();
  await server.stop?.();
}
console.log(`ok move route: ${done.join("; ")}`);
process.exit(0);
