// Animated tokens (a .webm with its transparency, a .gif or an animated .webp): a token plays its animation on the
// map whichever way it got its picture (a character's or a creature's from the art library, a creature's from its
// book, a token picture of an imported adventure), the picture is served by the byte range a looping video asks
// for, and a token's picture may be drawn at its own scale (Foundry's texture scale: a top-down figure larger than
// its squares, over the ring), for that token or for every token of its record.
//   node scripts/check-animated-tokens.mjs
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
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-animated-"));
const tokens = path.join(folder, "player-art", "tokens", "Pack", "Creatures");
fs.mkdirSync(tokens, { recursive: true });
// A stand-in for a webm (the bytes are never decoded here): 64 KB, so a range is a real part of it.
const WEBM = Buffer.alloc(65536, 7);
WEBM.set([0x1a, 0x45, 0xdf, 0xa3], 0);
fs.writeFileSync(path.join(tokens, "Goblin-animated.webm"), WEBM);
fs.writeFileSync(path.join(tokens, "Bat.gif"), Buffer.from("GIF89a"));
const roots = [{ dir: path.join(folder, "player-art", "tokens"), kind: "token", group: "Players", prefix: "players/tokens/" }];
const server = createTableServer({ ruleset: "Worldbuilding", art: createArtLibrary({ base: folder, roots }) });
// An imported adventure's scene brings its tokens, each with the id of its picture (Foundry's token art).
const scene = { id: "room", name: "Room", width: 500, height: 300, padding: 0, backgroundColor: "#000", grid: { size: 50, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, lights: [], tokens: [{ id: "shade", sourceId: "foundry-token-1", name: "Shade", x: 225, y: 75, squares: 1 }], walls: [] };
const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
let gm;
try {
  const { port, hostToken } = await server.listen({ port: 0, password: "" });
  gm = await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "ok") resolve({ ws, you: msg.you, send: (body) => ws.send(JSON.stringify(body)) });
    });
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", name: "GM", hostToken })));
  });
  gm.send({ type: "scene", scene });
  await settle();
  const agent = server.agent;
  const seat = agent.seat;
  const view = () => agent.viewFor("GM");
  const tokenOf = (id) => view().tokens.find((token) => token.id === id);

  // A creature whose token is an animated picture from the art library; a bat whose token is a gif.
  const goblin = agent.records.create({ type: "npc", name: "Goblin", data: { token: "players/tokens/Pack/Creatures/Goblin-animated.webm" } }, seat);
  const bat = agent.records.create({ type: "npc", name: "Bat", data: { token: "players/tokens/Pack/Creatures/Bat.gif" } }, seat);
  const g = agent.map.place({ recordId: goblin.id, name: "Goblin", x: 75, y: 75 }, seat);
  const b = agent.map.place({ recordId: bat.id, name: "Bat", x: 125, y: 75 }, seat);
  assert(tokenOf(g.id).video === true && /\/art\/file/.test(tokenOf(g.id).art), `the goblin's .webm plays: ${JSON.stringify(tokenOf(g.id))}`);
  assert(!tokenOf(b.id).video && /Bat\.gif/.test(decodeURIComponent(tokenOf(b.id).art)), "a gif is a picture (it plays by itself)");
  // A creature's token from its book (a pack's tokens/x.webm) plays too.
  const book = agent.records.create({ type: "npc", name: "Wolf", data: { token: "tokens/wolf-animated.webm@Some Pack" } }, seat);
  const w = agent.map.place({ recordId: book.id, name: "Wolf", x: 175, y: 75 }, seat);
  assert(tokenOf(w.id).video === true && /record-art/.test(tokenOf(w.id).art), `a book's .webm token plays: ${JSON.stringify(tokenOf(w.id))}`);
  // An imported adventure's token picture (by its token id) that is a video.
  server.setTokenArt([{ id: "shade", bytes: WEBM, mime: "video/webm" }]);
  const f = agent.map.tokens().find((token) => token.name === "Shade");
  assert(f, `the scene's token: ${JSON.stringify(agent.map.tokens().map((token) => token.name))}`);
  assert(tokenOf(f.id).video === true && /\/table\/token/.test(tokenOf(f.id).art), `an imported token's .webm plays: ${JSON.stringify(tokenOf(f.id))}`);
  done.push("a .webm token plays whichever way it got its picture (art library, a book, an imported adventure); a gif is a picture");

  // The picture by the byte range a looping video asks for.
  // As the GM's browser asks for it (its own asset token).
  const at = (art) => {
    const url = new URL(`http://127.0.0.1:${port}${art}`);
    url.searchParams.set("token", gm.you.assetToken);
    return url.href;
  };
  const whole = await fetch(at(tokenOf(g.id).art));
  assert(whole.status === 200 && whole.headers.get("accept-ranges") === "bytes" && whole.headers.get("content-type") === "video/webm" && (await whole.arrayBuffer()).byteLength === WEBM.length, `whole: ${whole.status} ${whole.headers.get("content-type")}`);
  const part = await fetch(at(tokenOf(g.id).art), { headers: { Range: "bytes=1000-1999" } });
  assert(part.status === 206 && part.headers.get("content-range") === `bytes 1000-1999/${WEBM.length}` && (await part.arrayBuffer()).byteLength === 1000, `a range: ${part.status} ${part.headers.get("content-range")}`);
  const tail = await fetch(at(tokenOf(f.id).art), { headers: { Range: "bytes=-100" } });
  assert(tail.status === 206 && (await tail.arrayBuffer()).byteLength === 100, `the last bytes of an imported token: ${tail.status}`);
  done.push("served whole or by the byte range asked (art library, imported tokens)");

  // Its picture's scale: this token; then every token of its record (one placed later too).
  agent.map.update(g.id, { artScale: 2.4 }, seat);
  assert(tokenOf(g.id).artScale === 2.4, `this token at 2.4: ${tokenOf(g.id).artScale}`);
  const g2 = agent.map.place({ recordId: goblin.id, name: "Goblin 2", x: 75, y: 125 }, seat);
  assert(tokenOf(g2.id).artScale === undefined, "another goblin not yet");
  agent.map.update(g.id, { artScale: 2.4, forRecord: true }, seat);
  const g3 = agent.map.place({ recordId: goblin.id, name: "Goblin 3", x: 75, y: 175 }, seat);
  assert(tokenOf(g2.id).artScale === 2.4 && tokenOf(g3.id).artScale === 2.4 && agent.records.get(goblin.id).data.tokenScale === 2.4, "for all: every goblin, one placed later too");
  agent.map.update(g.id, { artScale: 1 }, seat);
  assert(tokenOf(g.id).artScale === 2.4, "this token back to its own 1: its record's scale again");
  agent.map.update(g.id, { artScale: 9 }, seat);
  assert(tokenOf(g.id).artScale === 4, "at most 4");
  let refused = "";
  try {
    agent.map.update(g.id, { artScale: 2 }, { role: "player", name: "Ann" });
  } catch (error) {
    refused = error.message;
  }
  assert(refused, "a player cannot change it");
  done.push("a token's picture at its own scale (GM's), or every token of its record (placed later too), at most 4");
} finally {
  gm?.ws.close();
  await server.stop?.();
  fs.rmSync(folder, { recursive: true, force: true });
}
console.log(`ok animated tokens: ${done.join("; ")}`);
process.exit(0);
