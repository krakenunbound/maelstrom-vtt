// A creature on the map and on the combat tracker stay one (FG's): a token shown or hidden on the map is shown or
// hidden on the tracker too (and the other way, as before); a creature the GM gave its own picture from the art
// library (a generated token for an adventure's monster) shows it on the tracker as on the map.
import "./loopback.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { WebSocket } from "ws";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { createArtLibrary } = require("../electron/artLibrary.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-creature-sync-"));
const playerArt = path.join(folder, "player-art");
fs.mkdirSync(path.join(playerArt, "tokens", "GM"), { recursive: true });
const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
fs.writeFileSync(path.join(playerArt, "tokens", "GM", "Centipede.png"), PNG);
const roots = ["portrait", "token"].map((kind) => ({ dir: path.join(playerArt, `${kind}s`), kind, group: "Players", prefix: `players/${kind}s/` }));
const server = createTableServer({ ruleset: "D&D 5E", art: createArtLibrary({ base: folder, roots }), playerArt: { folder: (kind) => path.join(playerArt, `${kind}s`) } });
const scene = { id: "room", name: "Room", width: 500, height: 300, padding: 0, backgroundColor: "#000", grid: { size: 50, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, lights: [], tokens: [], walls: [] };
const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
function connect(port, join) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "ok") resolve({ ws, you: msg.you, send: (body) => ws.send(JSON.stringify(body)) });
    });
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", ...join })));
  });
}
let gm;
try {
  const { port, hostToken } = await server.listen({ port: 0, password: "" });
  gm = await connect(port, { name: "GM", hostToken });
  gm.send({ type: "scene", scene });
  await settle();
  const agent = server.agent;
  const crawler = agent.records.create({ type: "npc", name: "Giant Centipede", data: { ac: 13, hp: 4, token: "players/tokens/GM/Centipede.png" } }, agent.seat);
  gm.send({ type: "ct", action: "add", recordId: crawler.id, hidden: true });
  await settle();
  const entry = agent.combat.entries().find((item) => item.recordId === crawler.id);
  let token = agent.map.tokens().find((item) => item.recordId === crawler.id);
  if (!token) {
    token = agent.map.place({ recordId: crawler.id, name: entry.name, x: 125, y: 125, hidden: true }, agent.seat);
    agent.combat.update(entry.id, { tokenId: token.id }, agent.seat);
  }
  agent.combat.update(entry.id, { hidden: true }, agent.seat);
  token = agent.map.tokens().find((item) => item.id === token.id);
  assert(agent.combat.entries().find((item) => item.id === entry.id).hidden && token.hidden, `hidden from the tracker, the token too: ${token.hidden}`);

  // Shown on the map: shown on the tracker.
  agent.map.update(token.id, { hidden: false }, agent.seat);
  assert(agent.combat.entries().find((item) => item.id === entry.id).hidden === false, "the token shown: its tracker entry shown");
  agent.map.update(token.id, { hidden: true }, agent.seat);
  assert(agent.combat.entries().find((item) => item.id === entry.id).hidden === true, "hidden again: hidden on the tracker");
  // The tracker still leads the token.
  agent.combat.update(entry.id, { hidden: false }, agent.seat);
  assert(agent.map.tokens().find((item) => item.id === token.id).hidden === false, "shown from the tracker: the token shown");
  done.push("a token shown or hidden on the map is shown or hidden on the tracker, and the other way");

  // Its own picture from the art library, on the tracker (the record's art) as on the map.
  const art = await fetch(`http://127.0.0.1:${port}/table/record-art?${new URLSearchParams({ token: gm.you.assetToken, record: crawler.id })}`);
  const bytes = Buffer.from(await art.arrayBuffer());
  assert(art.ok && bytes.equals(PNG), `the creature's library picture served: ${art.status} ${bytes.length}`);
  done.push("a creature's own picture from the art library shows on the tracker");
} finally {
  gm?.ws.close();
  await server.stop?.();
  fs.rmSync(folder, { recursive: true, force: true });
}
console.log(`ok creature token sync: ${done.join("; ")}`);
process.exit(0);
