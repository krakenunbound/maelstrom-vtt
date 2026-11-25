// An FG map's repeated parts all come through: an older module's pins (image > shortcuts > shortcut, at picture
// pixels from the top left), each named by the entry it opens; and a weather layer's every mask shape (one <points>
// a shape; one shape alone too). Before, the importer kept only the last of each.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { zipSync, unzipSync, strToU8 } from "fflate";

const require = createRequire(import.meta.url);
const { fgModuleBundle } = require("../electron/importers/fgMaps.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
// A 1x1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-classic-maps-"));
const shortcut = (x, y, kind, record) => `<shortcut><x>${x}</x><y>${y}</y><class>${kind}</class><recordname>${record}</recordname></shortcut>`;
const db = `<root>
  <encounter><id-00001><name type="string">000.001.01 1. Gate</name></id-00001><id-00002><name type="string">2. Hall</name></id-00002></encounter>
  <battle><id-00001><name type="string">Goblin ambush</name></id-00001></battle>
  <image>
    <id-00001><name type="string">Keep (DM)</name><image type="image"><bitmap>keep.png</bitmap><gridsize>50,50</gridsize><shortcuts>${shortcut(10, 20, "encounter", "encounter.id-00001")}${shortcut(30, 40, "encounter", "encounter.id-00002")}${shortcut(50, 60, "battle", "battle.id-00001")}</shortcuts></image></id-00001>
    <id-00002><name type="string">Moor</name><image type="image"><grid>on</grid><layers><layer><name>moor.png</name><id>0</id><type>image</type><bitmap>moor.png</bitmap></layer><layer><name>Rain</name><id>1</id><type>fx</type><fx><type>rain</type><usemask>true</usemask><mask><points>0,0,10,0,10,10</points><points>20,20,30,20,30,30</points></mask></fx></layer><layer><name>Pond</name><id>2</id><type>fx</type><fx><type>water</type><usemask>true</usemask><mask><points>40,40,50,40,50,50</points></mask></fx></layer></layers></image></id-00002>
  </image>
</root>`;
fs.writeFileSync(path.join(dir, "Classic.mod"), zipSync({ "definition.xml": strToU8("<root><name>Classic</name><ruleset>2E</ruleset></root>"), "db.xml": strToU8(db), "keep.png": PNG, "moor.png": PNG }));
const bundle = fgModuleBundle(path.join(dir, "Classic.mod"), { all: true });
const extras = Object.values(bundle.extras);
const pins = extras.flatMap((extra) => extra.pins.filter((pin) => pin.link));
assert(pins.length === 3, `every pin of an older module's map: ${pins.length}`);
assert(pins.map((pin) => `${pin.x},${pin.y}`).join(" ") === "10,20 30,40 50,60", `at picture pixels from the top left: ${pins.map((pin) => `${pin.x},${pin.y}`)}`);
assert(pins.map((pin) => pin.text).join("|") === "1. Gate|2. Hall|Goblin ambush" && pins.every((pin) => pin.size >= 0.08 && pin.size <= 0.4), `named by the entry each opens: ${pins.map((pin) => pin.text)}`);
assert(pins[2].group === "Encounters" && pins[0].group === "Map keys" && pins[0].link.id === "encounter.id-00001@Classic", `a battle is an encounter, a story entry a map key, each linked: ${JSON.stringify(pins)}`);
const rain = extras.flatMap((extra) => extra.fx).find((fx) => fx.name === "Rain");
assert(rain?.mask.polygons.length === 2, `every shape of a weather mask: ${JSON.stringify(rain?.mask)}`);
// One shape (a single <points>, as B2's Caves of Chaos pond): kept, so the water stays in its pond.
const pond = extras.flatMap((extra) => extra.fx).find((fx) => fx.name === "Pond");
assert(pond?.mask.use === true && pond.mask.polygons.length === 1 && pond.mask.polygons[0].length === 6, `a weather mask of one shape: ${JSON.stringify(pond?.mask)}`);
// A newer module's map (Ghosts of Saltmarsh's): unnamed pins linked "@*" take the entry's name; terrain (FG marks
// it toggleable too) is a limited wall, never a door; a toggleable wall is still a door.
{
  const db = `<root><encounter><enc_1><name type="string">1. Dock</name></enc_1></encounter><image>
    <id-00003><name type="string">Ship</name><image type="image"><grid>on</grid><layers>
      <layer><name>ship.png</name><id>0</id><type>image</type><bitmap>ship.png</bitmap><occluders>
        <occluder><id>1</id><points>0,0,10,0,10,10</points><toggleable /><hidden /><single_sided /><terrain /><allow_move /><closed /><counterclockwise /></occluder>
        <occluder><id>2</id><points>20,0,30,0</points><toggleable /></occluder>
      </occluders></layer>
      <layer><id>1</id><type>shortcut</type><shortcut><class>encounter</class><record>encounter.enc_1@*</record></shortcut></layer>
    </layers></image></id-00003></image></root>`;
  fs.writeFileSync(path.join(dir, "Newer.mod"), zipSync({ "definition.xml": strToU8("<root><name>Newer</name><ruleset>5E</ruleset></root>"), "db.xml": strToU8(db), "ship.png": PNG }));
  const newer = fgModuleBundle(path.join(dir, "Newer.mod"), { all: true });
  const pin = Object.values(newer.extras).flatMap((extra) => extra.pins).find((item) => item.link);
  assert(pin?.text === "1. Dock" && pin.link.id === "encounter.enc_1@Newer", `an unnamed pin: the entry's name, linked to this book: ${JSON.stringify(pin)}`);
  const walls = JSON.parse(new TextDecoder().decode(unzipSync(newer.bytes)["bundle.json"])).adventureData.scenes[0].walls;
  const terrain = walls.filter((wall) => wall._id.startsWith("fg-1-"));
  assert(terrain.length === 3 && terrain.every((wall) => wall.sight === 10 && wall.light === 10 && wall.door === 0 && wall.move === 0), `terrain: limited, walkable, not a door: ${JSON.stringify(terrain)}`);
  assert(walls.find((wall) => wall._id.startsWith("fg-2-"))?.door === 1, "a toggleable wall is a door");
  const grid = JSON.parse(new TextDecoder().decode(unzipSync(newer.bytes)["bundle.json"])).adventureData.scenes[0].grid;
  assert(grid.size === 50 && grid.type === 1, `the grid on with no size written: FG's default 50 (${JSON.stringify(grid)})`);
  // A record naming a picture by another path and spelling (FG's campaign folder, a dash for a space) finds the book's.
  fs.writeFileSync(path.join(dir, "Named.mod"), zipSync({ "definition.xml": strToU8("<root><name>Named</name></root>"), "db.xml": strToU8("<root />"), "images/Sea Hag.png": PNG, "tokens/seahag.webp": PNG }));
  const { modulePicture } = require("../electron/importers/fgModule.cjs");
  const found = modulePicture("campaign/images/Sea-Hag.png", path.join(dir, "Named.mod"));
  assert(found?.mime === "image/png" && modulePicture("tokens/sea_hag.gif", path.join(dir, "Named.mod")) === null, `a picture by a near name, the same kind of file first; two of another kind: none (${found?.mime})`);
  assert(modulePicture("tokens/sea-hag.webp", path.join(dir, "Named.mod"))?.mime === "image/webp", "the token by its near name");
}
// A newer module's map (Saltmarsh's): its picture layer placed at half its size (FG's origin the picture's top
// left, y up), its walls in the image's coordinates, a pin by its layer's place, an encounter's spot from the
// top left: all land on the picture where FG has them.
{
  const WIDE = Buffer.from(PNG);
  WIDE.writeUInt32BE(200, 16);
  WIDE.writeUInt32BE(100, 20);
  const db = `<root><encounter><enc_9><name type="string">9. Vault</name></enc_9></encounter><image>
    <id-00004><name type="string">Vault</name><image type="image"><grid>on</grid><layers>
      <layer><id>0</id><type>image</type><bitmap>vault.png</bitmap><matrix>1,0,0,0,0,1,0,0,0,0,1,0,100,-50,0,1</matrix><occluders>
        <occluder><id>1</id><points>10,-20,190,-20</points></occluder>
      </occluders></layer>
      <layer><id>1</id><type>shortcut</type><matrix>1,0,0,0,0,1,0,0,0,0,1,0,30,-60,0,1</matrix><shortcut><class>encounter</class><record>encounter.enc_9@*</record></shortcut></layer>
    </layers></image></id-00004></image></root>`;
  fs.writeFileSync(path.join(dir, "Top.mod"), zipSync({ "definition.xml": strToU8("<root><name>Top</name><ruleset>5E</ruleset></root>"), "db.xml": strToU8(db), "vault.png": WIDE }));
  const top = fgModuleBundle(path.join(dir, "Top.mod"), { all: true });
  const scene = JSON.parse(new TextDecoder().decode(unzipSync(top.bytes)["bundle.json"])).adventureData.scenes[0];
  const extra = Object.values(top.extras)[0];
  const pin = extra.pins.find((item) => item.link);
  assert(JSON.stringify(scene.walls[0].c) === JSON.stringify([10, 20, 190, 20]), `walls from the picture's top left: ${JSON.stringify(scene.walls[0].c)}`);
  assert(pin.x === 30 && pin.y === 60 && pin.text === "9. Vault", `a pin where its layer is: ${JSON.stringify(pin)}`);
  assert(extra.frame.base.x === 100 && extra.frame.base.y === -50, `the frame keeps the picture layer's place for encounters: ${JSON.stringify(extra.frame)}`);
}

// FG's lighting: off is daylight; on with no ambient light is dark (lights and darkvision only); ambient light sets
// the darkness by its colour and tints the map; with an ambient mask it falls only inside the mask.
{
  const map = (id, image) => `<id-${id}><name type="string">L${id}</name><image type="image"><grid>on</grid>${image}<layers><layer><id>0</id><type>image</type><bitmap>l.png</bitmap>${id === "00013" ? "<ambientmask><points>-50,50,50,50,50,-50,-50,-50</points></ambientmask>" : ""}</layer></layers></image></id-${id}>`;
  const WIDE = Buffer.from(PNG);
  WIDE.writeUInt32BE(200, 16);
  WIDE.writeUInt32BE(200, 20);
  const db = `<root><image>${map("00010", "")}${map("00011", "<uselighting>on</uselighting>")}${map("00012", '<uselighting>on</uselighting><ambient><on type="number">1</on><ambientcolor>#91C9E7FF</ambientcolor></ambient>')}${map("00013", '<uselighting>on</uselighting><ambient><on type="number">1</on><useambientmask>on</useambientmask><ambientcolor>#FFFFF7E6</ambientcolor></ambient>')}</image></root>`;
  fs.writeFileSync(path.join(dir, "Lit.mod"), zipSync({ "definition.xml": strToU8("<root><name>Lit</name></root>"), "db.xml": strToU8(db), "l.png": WIDE }));
  const lit = fgModuleBundle(path.join(dir, "Lit.mod"), { all: true });
  const scenes = Object.fromEntries(JSON.parse(new TextDecoder().decode(unzipSync(lit.bytes)["bundle.json"])).adventureData.scenes.map((scene) => [scene.name, scene]));
  assert(scenes.L00010.darkness === 0 && !scenes.L00010.ambient, "lighting off: daylight");
  assert(scenes.L00011.darkness === 1 && !scenes.L00011.ambient, `lighting on, no ambient light: dark (${scenes.L00011.darkness})`);
  const moon = scenes.L00012;
  assert(moon.darkness > 0.4 && moon.darkness < 0.6 && moon.ambient?.color === "#C9E7FF" && moon.ambient.areas.length === 0, `moonlight: half dark, tinted blue: ${JSON.stringify([moon.darkness, moon.ambient])}`);
  const masked = scenes.L00013;
  // FG's map switches and layers' own lighting.
  {
    const db2 = `<root><image><id-00020><name type="string">Inn</name><image type="image"><grid>on</grid><tokenlock>on</tokenlock><allowplayerdrawing>off</allowplayerdrawing><previewvision>on</previewvision><layers>
      <layer><id>0</id><type>image</type><bitmap>l.png</bitmap></layer>
      <layer><id>1</id><name>Roof</name><type>image</type><bitmap>roof.png</bitmap><uselights>false</uselights></layer>
      <layer><id>2</id><name>Sign</name><type>text</type><displayText>The Golden Grain</displayText><uselighting type="number">1</uselighting></layer>
      <layer><id>3</id><name>Note</name><type>text</type><displayText>Read me</displayText></layer>
    </layers></image></id-00020></image></root>`.replace('<uselighting type="number">1</uselighting>', "<uselighting>true</uselighting>");
    fs.writeFileSync(path.join(dir, "Inn.mod"), zipSync({ "definition.xml": strToU8("<root><name>Inn</name></root>"), "db.xml": strToU8(db2), "l.png": WIDE, "roof.png": WIDE }));
    const inn = fgModuleBundle(path.join(dir, "Inn.mod"), { all: true });
    const scene = JSON.parse(new TextDecoder().decode(unzipSync(inn.bytes)["bundle.json"])).adventureData.scenes[0];
    const extra = Object.values(inn.extras)[0];
    assert(scene.tokenLock === true && scene.playerDrawing === false && scene.previewVision === true, `the map's switches: ${JSON.stringify([scene.tokenLock, scene.playerDrawing, scene.previewVision])}`);
    assert(extra.tiles.find((tile) => tile.name === "Roof")?.unlit === true, "a layer that ignores lights is unlit");
    const texts = extra.pins.filter((pin) => !pin.link);
    assert(texts.find((text) => text.text === "The Golden Grain")?.lit === true && !texts.find((text) => text.text === "Read me")?.lit, `text with lighting on is lit, the rest not: ${JSON.stringify(texts.map((text) => [text.text, text.lit]))}`);
  }
  assert(masked.darkness === 1 && masked.ambient?.darkness < 0.1 && JSON.stringify(masked.ambient.areas) === JSON.stringify([[50, 50, 150, 50, 150, 150, 50, 150]]), `sunlight inside its mask, dark outside: ${JSON.stringify([masked.darkness, masked.ambient])}`);
}
fs.rmSync(dir, { recursive: true, force: true });
console.log("ok fg classic maps: an older module's pins all come through, placed and named, a weather layer keeps every mask shape, a newer map's pins are named and linked, terrain is limited");
