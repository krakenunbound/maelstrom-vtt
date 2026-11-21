// An FG map's repeated parts all come through: an older module's pins (image > shortcuts > shortcut, at picture
// pixels from the top left), each named by the entry it opens; and a weather layer's every mask shape (one <points>
// a shape). Before, the importer kept only the last of each.
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
    <id-00002><name type="string">Moor</name><image type="image"><grid>on</grid><layers><layer><name>moor.png</name><id>0</id><type>image</type><bitmap>moor.png</bitmap></layer><layer><name>Rain</name><id>1</id><type>fx</type><fx><type>rain</type><usemask>true</usemask><mask><points>0,0,10,0,10,10</points><points>20,20,30,20,30,30</points></mask></fx></layer></layers></image></id-00002>
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
fs.rmSync(dir, { recursive: true, force: true });
console.log("ok fg classic maps: an older module's pins all come through, placed and named, a weather layer keeps every mask shape, a newer map's pins are named and linked, terrain is limited");
