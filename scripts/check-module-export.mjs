// FG's module export: a campaign's own records into a pack another campaign makes active.
//  - exported: its creatures, gear, a character (pregenerated), its story (pages as text), an encounter, a table and
//    a parcel, kept as a book keeps them, the encounter's and the table's links pointing into the pack
//  - another campaign of the game: the module is on its shelf (an adventure, the GM's), made active its creatures
//    and gear load, its encounter goes on the tracker with the goblin, its story reads, its table rolls the goblin
//  - for the players (they may read it), for any game; a converted book is never written over; the GM's alone
import "./loopback.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-export-"));
const packsDir = path.join(dir, "Packs");
const modulesDir = path.join(dir, "modules");
fs.mkdirSync(packsDir, { recursive: true });
fs.mkdirSync(modulesDir, { recursive: true });
process.env.KRAKEN_PACKS = packsDir;
const { createTableServer } = require("../electron/tableServer.cjs");
const { createBookShelf } = require("../electron/books.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const content = require("../electron/content.cjs");
const packs = require("../electron/packs.cjs");
const library = require("../electron/library.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const shelf = () => createBookShelf({ folder: modulesDir, packsFolder: packsDir });
const first = createTableServer({ books: shelf(), ruleset: "D&D 5E" });
await first.listen({ port: 0, password: "" });
const tool = async (server, name, args) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
let second;
try {
  const a = first.agent;
  const goblin = a.records.create({ type: "npc", name: "Den Goblin", data: { ac: 15, hp: 7, xp: 50, abilities: { dexterity: { score: 14, bonus: 2 } } } }, a.seat);
  const blade = a.records.create({ type: "item", name: "Den Blade", data: { type: "Weapon", damage: "1d6 Slashing", cost: "10 GP" } }, a.seat);
  const hero = a.records.create({ type: "character", name: "Pregen Pat", data: { level: 1 } }, a.seat);
  const link = `<link class="npc" recordname="kraken:${encodeURIComponent(JSON.stringify({ kind: "record", record: goblin.id, label: "Den Goblin" }))}">Den Goblin</link>`;
  const story = a.records.create({ type: "story", name: "The Den", data: { blocks: [{ kind: "header", text: "Into the den" }, { kind: "text", text: `<p>A ${link} waits.</p>` }] } }, a.seat);
  const battle = a.records.create({ type: "battle", name: "Den Fight", data: { npclist: { "id-00001": { name: "Den Goblin", count: "2", faction: "foe", link: { class: "npc", recordname: goblin.id } } } } }, a.seat);
  const tableRecord = a.records.create({ type: "table", name: "Den Foes", data: { dice: "d1", tablerows: { "id-00001": { fromrange: 1, torange: 1, results: { "id-00001": { result: "A goblin", resultlink: { class: "npc", recordname: goblin.id } } } } } } }, a.seat);
  const parcel = a.records.create({ type: "treasureparcel", name: "Den Hoard", data: { itemlist: { "id-00001": { name: "Den Blade", count: 1 } }, coinlist: { "id-00001": { amount: 30, description: "GP" } } } }, a.seat);
  a.records.create({ type: "note", name: "Not exportable", data: {} }, a.seat);

  // 1. Exported.
  const made = await tool(first, "kraken_module_export", { name: "Goblin Den", author: "The GM", types: ["npc", "item", "character", "story", "battle", "table", "treasureparcel", "note"] });
  const file = path.join(packsDir, "D&D 5E", "Goblin Den.kpack");
  assert(made.file === file && fs.existsSync(file) && made.records === 7, `the pack: ${JSON.stringify(made)}`);
  const pack = packs.readPack(file);
  const types = pack.records.map((record) => record.type).sort().join();
  assert(types === "battle,encounter,item,npc,pregencharsheet,tables,treasureparcels", `kept as a book keeps them: ${types}`);
  const of = (type) => pack.records.find((record) => record.type === type);
  const npcPath = of("npc").data.fgPath;
  assert(npcPath === "npc.id-00001@Goblin Den" && of("battle").data.npclist["id-00001"].link.recordname === npcPath && of("tables").data.tablerows["id-00001"].results["id-00001"].resultlink.recordname === npcPath, `links into the pack: ${JSON.stringify(of("battle").data)}`);
  assert(/<h>Into the den<\/h>/.test(of("encounter").data.text) && of("encounter").data.text.includes(encodeURIComponent(`"record":"Goblin Den|${npcPath}"`)), `the story as text, its link the book's: ${of("encounter").data.text}`);
  assert(packs.readManifest(file).author === "The GM" && pack.records.every((record) => record.source === "Goblin Den" && record.visibility === "gm"), "its author; the GM's");
  done.push("exported as a book keeps its records, links into it");

  // 2. Another campaign of the game.
  second = createTableServer({ books: shelf(), ruleset: "D&D 5E" });
  await second.listen({ port: 0, password: "" });
  const b = second.agent;
  const listed = (await tool(second, "kraken_books", { action: "list" })).find((book) => book.name === "Goblin Den");
  assert(listed && listed.adventure && !listed.forPlayers, `on the shelf, an adventure: ${JSON.stringify(listed)}`);
  await tool(second, "kraken_books", { action: "activate", book: listed.id });
  const loaded = b.records.list({ source: "Goblin Den" }).map((record) => record.type).sort().join();
  assert(loaded === "item,npc,pregencharsheet", `made active, its rules records load: ${loaded}`);
  const fights = library.list("Goblin Den", "battle");
  assert(fights.length === 1 && fights[0].npcs === "2 Den Goblin", `its encounter: ${JSON.stringify(fights)}`);
  const fight = await library.addBattle(b, fights[0].path, { place: false });
  assert(fight.added.length === 2 && fight.added.every((name) => /Den Goblin/.test(name)), `on the tracker: ${JSON.stringify(fight)}`);
  const entry = library.storyEntry(library.list("Goblin Den", "story")[0].path);
  assert(/Into the den/.test(entry.html) && /waits/.test(entry.html), `its story reads: ${entry.html}`);
  assert(library.list("Goblin Den", "parcel")[0]?.summary === "Den Blade, 30 GP", "its parcel");
  const rolled = await tool(second, "kraken_table", { action: "roll", path: library.list("Goblin Den", "table")[0].path });
  assert(JSON.stringify(rolled).includes("A goblin"), `its table rolls: ${JSON.stringify(rolled).slice(0, 200)}`);
  done.push("another campaign makes it active: creatures, gear, a pregenerated character; the encounter fights, the story reads, the table rolls");

  // 3. For the players, any game; a converted book kept; the GM's alone.
  const open = await tool(first, "kraken_module_export", { name: "Den Handbook", types: ["item"], forPlayers: true, anyGame: true });
  assert(open.file === path.join(packsDir, "Any", "Den Handbook.kpack"), `any game's: ${open.file}`);
  const handbook = (await tool(second, "kraken_books", { action: "list" })).find((book) => book.name === "Den Handbook");
  assert(handbook && handbook.forPlayers && !handbook.adventure, `the players may read it: ${JSON.stringify(handbook)}`);
  assert(packs.readPack(open.file).records.every((record) => record.visibility === "all"), "its records the players'");
  const again = await tool(first, "kraken_module_export", { name: "Goblin Den", ids: [goblin.id] });
  assert(again.records === 1, "exported again, written over");
  fs.copyFileSync(file, path.join(packsDir, "D&D 5E", "Converted.kpack"));
  const converted = path.join(packsDir, "D&D 5E", "Converted.kpack");
  const { zipSync, strToU8, unzipSync, strFromU8 } = await import("fflate");
  const parts = unzipSync(fs.readFileSync(converted));
  const manifest = JSON.parse(strFromU8(parts["kraken-pack.json"]));
  manifest.from = { kind: "fg-module", name: "Converted" };
  fs.writeFileSync(converted, zipSync({ ...parts, "kraken-pack.json": strToU8(JSON.stringify(manifest)) }));
  let kept = "";
  try {
    await tool(first, "kraken_module_export", { name: "Converted", types: ["npc"] });
  } catch (error) {
    kept = String(error);
  }
  assert(/not exported from a campaign/.test(kept) && packs.readManifest(converted).from.kind === "fg-module", `a converted book is kept: ${kept}`);
  let refused = "";
  try {
    await content.message(a, { type: "module-export", name: "X", types: ["npc"] }, { seat: { role: "player", name: "Ann" } });
  } catch (error) {
    refused = String(error);
  }
  assert(/GM's/.test(refused), "a player may not export");
  void [blade, hero, story, battle, tableRecord, parcel];
  done.push("for the players and any game; a converted book never written over; the GM's alone");

  // 4. A map: the GM's own picture with its walls (a window, a door), a torch and the grid, exported, opened in
  //    another campaign as the same map.
  const zlib = await import("node:zlib");
  const png = (width, height) => {
    const chunk = (type, body) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(body.length);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), body])) >>> 0);
      return Buffer.concat([length, Buffer.from(type), body, crc]);
    };
    const head = Buffer.alloc(13);
    head.writeUInt32BE(width, 0);
    head.writeUInt32BE(height, 4);
    head.set([8, 2, 0, 0, 0], 8);
    const rows = Buffer.alloc((width * 3 + 1) * height);
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
  };
  const mapsDir = path.join(dir, "Maps");
  fs.mkdirSync(mapsDir, { recursive: true });
  fs.writeFileSync(path.join(mapsDir, "Den Cave.png"), png(400, 300));
  const third = createTableServer({ books: shelf(), ruleset: "D&D 5E", ownMaps: { folder: () => mapsDir } });
  await third.listen({ port: 0, password: "" });
  try {
    const t = third.agent;
    const cave = t.records.create({ type: "image", name: "Den Cave", visibility: "gm", data: { own: true, file: "Den Cave.png" } }, t.seat);
    t.map.seed("own-den-cave", { own: { walls: [{ x1: 10, y1: 10, x2: 200, y2: 10, kind: "window" }, { x1: 200, y1: 10, x2: 200, y2: 120, kind: "door" }], lights: [{ x: 100, y: 80, bright: 20, dim: 40, color: "#ff8a3d", animation: "torch" }], grid: { size: 70 } } });
    const exported = await tool(third, "kraken_module_export", { name: "Den Maps", types: ["image"] });
    assert(exported.maps === 1, `a map exported: ${JSON.stringify(exported)}`);
    const mapPack = packs.readPack(exported.file);
    const record = mapPack.records[0];
    assert(record.type === "image" && record.data.image.layers.layer[0].bitmap === "images/den-cave.png" && mapPack.images.includes("images/den-cave.png") && record.data.kraken.walls.length === 2, `its image record and picture: ${JSON.stringify(record.data).slice(0, 300)}`);
    // Another campaign opens it from the module.
    const fourth = createTableServer({ books: shelf(), ruleset: "D&D 5E" });
    const opened = await fourth.listen({ port: 0, password: "" });
    try {
      await tool(fourth, "kraken_books", { action: "activate", book: "Den Maps" });
      const { WebSocket } = await import("ws");
      const gm = await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${opened.port}`);
        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "ok") resolve({ ws, you: msg.you });
        });
        ws.on("error", reject);
        ws.on("open", () => ws.send(JSON.stringify({ type: "join", name: "GM", hostToken: opened.hostToken })));
      });
      const reply = await fetch(`http://127.0.0.1:${opened.port}/table/fg-maps?module=${encodeURIComponent("Den Maps")}&token=${gm.you.assetToken}`);
      assert(reply.status === 200, `the map opens from the module: ${reply.status} ${await reply.clone().text()}`);
      const { unzipSync, strFromU8: text } = await import("fflate");
      const bundle = unzipSync(new Uint8Array(await reply.arrayBuffer()));
      const scene = JSON.parse(text(bundle["bundle.json"])).adventureData.scenes[0];
      assert(scene.name === "Den Cave" && scene.width === 400 && scene.height === 300, `the scene: ${JSON.stringify({ name: scene.name, width: scene.width })}`);
      const state = fourth.persisted().map;
      const walls = state.walls[scene._id] ?? [];
      const lights = state.lights[scene._id] ?? [];
      assert(walls.map((wall) => wall.kind).join() === "window,door" && walls[0].x2 === 200, `its walls as they were: ${JSON.stringify(walls)}`);
      assert(lights.length === 1 && lights[0].animation === "torch" && lights[0].bright === 20 && lights[0].color === "#ff8a3d", `its light as it was: ${JSON.stringify(lights)}`);
      assert(state.settings[scene._id]?.grid?.size === 70, `its grid: ${JSON.stringify(state.settings[scene._id])}`);
      gm.ws.close();
    } finally {
      await fourth.stop?.();
    }
    void cave;
  } finally {
    await third.stop?.();
  }
  done.push("a map with its picture, walls (a window, a door), light and grid opens in another campaign as it was");
} finally {
  await first.stop?.();
  await second?.stop?.();
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`ok module export: ${done.join("; ")}`);
process.exit(0);
