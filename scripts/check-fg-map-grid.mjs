// An FG map's grid on the table: FG's grid offset is from the picture's top left (y down) and its square measures
// FG's scale ("10ft"); and the GM's grid settings (opacity, colour, style, offset, size) stick to the map: saved with
// the campaign, and kept when the same book map is opened again.
import "./loopback.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { zipSync, strToU8, unzipSync, strFromU8 } from "fflate";

const require = createRequire(import.meta.url);
const { fgModuleBundle } = require("../electron/importers/fgMaps.cjs");
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
// A 2850 x 2000 picture's header is all the importer reads for its size.
const wide = Buffer.from(PNG);
wide.writeUInt32BE(2850, 16);
wide.writeUInt32BE(2000, 20);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-fg-grid-"));
const db = `<root><image><id-00001><name type="string">Village</name><scale type="string">10ft</scale><image type="image"><grid>on</grid><gridsize>25,25</gridsize><gridoffset>3,2</gridoffset><layers><layer><name>village.png</name><id>0</id><type>image</type><bitmap>village.png</bitmap><matrix>1,0,0,0,0,1,0,0,0,0,1,0,1425,-1000,0,1</matrix></layer></layers></image></id-00001></image></root>`;
const modulePath = path.join(dir, "Grid.mod");
const definition = strToU8("<root><name>Grid</name><ruleset>2E</ruleset></root>");
const open = (xml = db) => {
  fs.writeFileSync(modulePath, zipSync({ "definition.xml": definition, "db.xml": strToU8(xml), "village.png": wide }));
  const bundle = fgModuleBundle(modulePath, { all: true });
  const scene = JSON.parse(strFromU8(unzipSync(bundle.bytes)["bundle.json"])).adventureData.scenes[0];
  return { scene, extra: bundle.extras[scene._id] };
};
const first = open();
assert(first.extra.gridOffset.x === 3 && first.extra.gridOffset.y === 2, `FG's offset from the top left: ${JSON.stringify(first.extra.gridOffset)}`);
assert(first.scene.grid.size === 25 && first.scene.grid.distance === 10 && first.scene.grid.units === "ft", `FG's square and its scale: ${JSON.stringify(first.scene.grid)}`);

const nativeDistance = db.replace("<grid>on</grid>", "<grid>on</grid><distancebaseunit>15</distancebaseunit>");
assert(open(nativeDistance).scene.grid.distance === 10, "the explicit scale takes precedence over the image distance");
const distanceOnly = nativeDistance.replace('<scale type="string">10ft</scale>', "");
const importedDistance = open(distanceOnly).scene.grid;
assert(importedDistance.distance === 15 && importedDistance.units === "ft", "FG's image distance sets the scale when there is no explicit scale");
assert(open(distanceOnly.replace(">15</distancebaseunit>", ">0</distancebaseunit>")).scene.grid.distance === 5, "an invalid FG image distance uses the default");

const server = createTableServer();
await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => JSON.parse((await callTool(name, args, { table: () => server })).content[0].text);
const put = (table, { scene, extra }) => {
  // As kraken_open_fg_module: the map's extras seeded, then the scene opened.
  table.agent.map.seed(scene._id, extra);
  table.agent.map.setScene(JSON.parse(JSON.stringify({ ...scene, id: scene._id, walls: [], lights: [] })));
};
put(server, first);
const seeded = (await tool("kraken_scene_settings", {})).grid;
assert(seeded.offsetX === 3 && seeded.offsetY === 2, `the map opens with FG's offset: ${JSON.stringify(seeded)}`);
await tool("kraken_scene_settings", { grid: { alpha: 0.6, color: "#aa3311", style: "dashed", thickness: 3, offsetX: 4, size: 50 } });
const saved = server.persisted().map;
await server.stop();

// The campaign opened again, and the same map opened again from its book: the GM's settings stand.
const again = createTableServer({ saved: { map: saved } });
await again.listen({ port: 0, password: "" });
const toolAgain = async (name, args = {}) => JSON.parse((await callTool(name, args, { table: () => again })).content[0].text);
put(again, open());
const kept = (await toolAgain("kraken_scene_settings", {})).grid;
assert(kept.alpha === 0.6 && kept.color === "#aa3311" && kept.style === "dashed" && kept.thickness === 3 && kept.offsetX === 4 && kept.offsetY === 2 && kept.size === 50, `the grid settings stick to the map: ${JSON.stringify(kept)}`);
await again.stop();

// A campaign that opened the map before the fix: the offset worked out from the centre and one pin. Opened again,
// the offset is put right (the GM had not moved it) and the FG pins it lacked join it.
const old = open();
const legacy = old.extra.legacyGridOffset;
assert(legacy && (legacy.x !== 3 || legacy.y !== 2), `the old offset differs: ${JSON.stringify(legacy)}`);
const before = createTableServer();
await before.listen({ port: 0, password: "" });
before.agent.map.seed(old.scene._id, { ...old.extra, gridOffset: legacy, legacyGridOffset: null, pins: old.extra.pins.slice(0, 1) });
before.agent.map.setScene(JSON.parse(JSON.stringify({ ...old.scene, id: old.scene._id, walls: [], lights: [] })));
const oldSave = before.persisted().map;
await before.stop();
const after = createTableServer({ saved: { map: oldSave } });
await after.listen({ port: 0, password: "" });
put(after, open());
const fixed = JSON.parse((await callTool("kraken_scene_settings", {}, { table: () => after })).content[0].text).grid;
assert(fixed.offsetX === 3 && fixed.offsetY === 2, `an old campaign's offset is put right: ${JSON.stringify(fixed)}`);
await after.stop();

// Pins: a map opened when it kept one FG pin gets the others when opened again; the pins it had (the GM may have
// renamed one) stay as they are.
const pinTable = createTableServer();
await pinTable.listen({ port: 0, password: "" });
const pin = (n, text) => ({ x: n * 10, y: n * 10, text, icon: "pin", size: 0.2, group: "Map keys", link: { kind: "fg", id: `encounter.id-0000${n}@Grid` } });
pinTable.agent.map.seed("fg-pins", { pins: [pin(1, "1. Gate")] });
const labelsOf = () => pinTable.persisted().map.labels["fg-pins"];
labelsOf()[0].text = "The front gate";
pinTable.agent.map.seed("fg-pins", { pins: [pin(1, "1. Gate"), pin(2, "2. Hall"), pin(3, "3. Vault")] });
const pins = labelsOf();
assert(pins.length === 3 && pins.map((item) => item.text).join("|") === "1. Gate|2. Hall|3. Vault".replace("1. Gate", pins[0].text), `the missing pins join, none twice: ${JSON.stringify(pins.map((item) => item.text))}`);
await pinTable.stop();

// A map's walls kept from a reading since put right (a newer FG module's fell a whole picture off, terrain as doors):
// opened again, they take the import's place and kind; a wall the GM moved by hand stays; a door keeps its state.
{
  const wallTable = createTableServer();
  const scene = (shift, terrainDoor) => ({ id: "fg-x-vault", name: "Vault", width: 200, height: 100, padding: 0, backgroundColor: "#000", grid: { size: 25, type: 1, distance: 5, units: "ft", color: "#000", alpha: 0.2 }, lights: [], tokens: [],
    walls: [
      ...[0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15].map((i) => ({ id: `fg-${i}-0`, x1: 10 + i * 20 + shift, y1: 20 - shift, x2: 20 + i * 20 + shift, y2: 20 - shift, sight: 20, light: 20, sound: 20, move: 20, dir: 0, door: 0, ds: 0 })),
      { id: "fg-8-0", x1: 10 + shift, y1: 60 - shift, x2: 40 + shift, y2: 60 - shift, sight: terrainDoor ? 20 : 10, light: terrainDoor ? 20 : 10, sound: 10, move: 0, dir: 0, door: terrainDoor ? 1 : 0, ds: 0 },
      { id: "fg-9-0", x1: 150 + shift, y1: 80 - shift, x2: 180 + shift, y2: 80 - shift, sight: 20, light: 20, sound: 20, move: 20, dir: 0, door: 1, ds: 0 },
    ] });
  wallTable.agent.map.setScene(scene(1850, true));
  const kept = () => wallTable.agent.map.walls?.() ?? wallTable.agent.map.state?.().walls?.["fg-x-vault"];
  const before = kept();
  const door = before.find((wall) => wall.id === "fg-9-0");
  door.ds = 2;
  const moved = before.find((wall) => wall.id === "fg-4-0");
  moved.x1 += 5;
  wallTable.agent.map.setScene(scene(0, false));
  const after = kept();
  assert(after.find((wall) => wall.id === "fg-0-0").x1 === 10, `walls put back on the picture: ${JSON.stringify(after.find((wall) => wall.id === "fg-0-0"))}`);
  assert(after.find((wall) => wall.id === "fg-8-0").kind === "terrain", `terrain read as terrain now: ${after.find((wall) => wall.id === "fg-8-0").kind}`);
  assert(after.find((wall) => wall.id === "fg-9-0").ds === 2, "a locked door stays locked");
  assert(after.find((wall) => wall.id === "fg-4-0").x1 === 10 + 80 + 1850 + 5, "a wall the GM moved stays where it is");
  // A map's own switches: movement locked the first time it opens; players' drawing refused, until the GM allows it.
  const gm = { role: "dm", name: "GM" };
  const ann = { role: "player", name: "Ann" };
  wallTable.agent.map.setScene({ ...scene(0, false), id: "fg-x-inn", tokenLock: true, playerDrawing: false });
  assert(wallTable.agent.map.lockedNow() === true, "the map's movement lock is on when it first opens");
  let refused = "";
  try {
    wallTable.agent.map.draw({ points: [10, 10, 40, 40], color: "#ff0000", width: 3 }, ann);
  } catch (error) {
    refused = error.message;
  }
  assert(/drawing off/.test(refused), `a player's drawing refused: ${refused}`);
  wallTable.agent.map.draw({ points: [10, 10, 40, 40], color: "#ff0000", width: 3 }, gm);
  wallTable.agent.map.updateSettings({ playerDrawing: true }, gm);
  wallTable.agent.map.draw({ points: [20, 20, 50, 50], color: "#00ff00", width: 3 }, ann);
  wallTable.agent.map.setLocked?.(false, gm);
}
fs.rmSync(dir, { recursive: true, force: true });
console.log("ok fg map grid: FG's offset from the picture's top left and its square's scale; the GM's grid settings saved with the map and kept when it is opened again");
process.exit(0);
