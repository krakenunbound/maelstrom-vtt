// Battle maps from Universal VTT files (.dd2vtt from Dungeondraft) into a book's pack, beside the book's own maps:
// each map's picture made a WebP at the pack's size (70 pixels a square by default), its walls, doors and lights, and,
// when it is the same place as one of the book's maps, that map's pins (its keyed areas and encounters) moved across.
// The two maps are lined up by their walls: the shift that lays most of the book map's walls on the new map's.
//
//   node scripts/pack-maps.mjs <plan.json> [--dry] [--only <name>] [--preview <folder>]
//
// plan.json (kept with the GM's purchased maps, never in the repository):
//   { "pack": "<the book's .kpack>", "category": "Maps - <book>", "suffix": " (Map Adventurer)", "square": 70, "quality": 80,
//     "maps": [ { "name": "Haunted House - Ground Floor", "uvtt": "<file.dd2vtt>" or "<file.zip>::<entry>", "align": "<the book's map>" } ] }
//
// --dry works out every map (pictures, walls, the line-up) and writes nothing to the pack; --preview draws each new map
// small with its walls (red), doors (green) and pins (yellow) to check by eye. The pack is backed up once, beside it in
// .map-backup, before it is first written. A map already added (same name) is replaced, so a plan can be run again.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { zipWriter } from "./lib/zipWriter.mjs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { readEntries, contentsOf } = require("../electron/packs.cjs");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const planFile = args.find((arg, index) => !arg.startsWith("--") && !(index > 0 && ["--only", "--preview"].includes(args[index - 1])));
if (!planFile) throw new Error("Usage: node scripts/pack-maps.mjs <plan.json> [--dry] [--only <name>] [--preview <folder>]");
const plan = JSON.parse(readFileSync(planFile, "utf8"));
const SQUARE = Number(plan.square) || 70;
const QUALITY = Number(plan.quality) || 80;
const suffix = plan.suffix ?? "";
const only = option("--only");
const previewDir = option("--preview");

const list = (value) => (Array.isArray(value) ? value : value && typeof value === "object" ? [value] : []);
const nums = (text) => String(text ?? "").split(",").filter((part) => part.trim() !== "").map(Number);
const round = (value) => Math.round(value * 10) / 10;
const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The pack: its description, records and every entry's name.
const PACK = plan.pack;
const names = [];
readEntries(PACK, (name) => (names.push(name), false));
const head = readEntries(PACK, ["kraken-pack.json", "records.json"]);
const manifest = JSON.parse(Buffer.from(head["kraken-pack.json"]).toString("utf8"));
const records = JSON.parse(Buffer.from(head["records.json"]).toString("utf8"));
const packKey = String(records.find((record) => record.type === "image")?.id ?? "pack:").split(":")[0];

// A Universal VTT file: a file, or an entry inside a zip ("<zip>::<entry>").
function readUvtt(source) {
  const [zip, entry] = String(source).split("::");
  const bytes = entry ? execFileSync("unzip", ["-p", zip, entry], { maxBuffer: 2 ** 31 }) : readFileSync(zip);
  return JSON.parse(bytes.toString("utf8"));
}

// A book map's walls and pins in its own squares (FG keeps them from the base layer's place, y up).
function bookMap(record, pictures) {
  const image = record.data.image;
  const layers = list(image.layers?.layer);
  const base = layers[0];
  const meta = pictureSize(pictures[base.bitmap]);
  const grid = nums(image.gridsize)[0] || 50;
  const [bx = 0, by = 0] = nums(base.matrix).length === 16 ? nums(base.matrix).slice(12, 14) : [0, 0];
  const at = (x, y) => [(meta.width / 2 + x - bx) / grid, (meta.height / 2 - (y - by)) / grid];
  const walls = [];
  for (const layer of layers) for (const occluder of list(layer.occluders?.occluder)) {
    const p = nums(occluder.points);
    for (let i = 0; i + 3 < p.length; i += 2) walls.push([...at(p[i], p[i + 1]), ...at(p[i + 2], p[i + 3])]);
  }
  const pins = layers.filter((layer) => layer.type === "shortcut").map((layer) => {
    const [mx = 0, my = 0] = nums(layer.matrix).slice(12, 14);
    return { layer, at: [(meta.width / 2 + (mx - bx)) / grid, (meta.height / 2 - (my - by)) / grid] };
  });
  return { walls, pins, squares: [meta.width / grid, meta.height / grid] };
}

function pictureSize(bytes) {
  const b = Buffer.from(bytes);
  if (b.toString("ascii", 1, 4) === "PNG") return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") { const v = b.readUInt32LE(21); return { width: 1 + (v & 0x3fff), height: 1 + ((v >> 14) & 0x3fff) }; }
  throw new Error("Unknown picture format.");
}

// The shift (in squares) that lays the book map's walls on the new map's: the new map's walls drawn on a quarter-square
// grid (with a cell either side), then every quarter-square shift scored by how many of the book walls' points land on
// one. The book map may show more than the new one (a ship's every deck against one deck): a shift may leave part of it
// off the new map, and the shift with the most points on a wall wins. score: the share of the points on the new map
// that land on a wall; cover: the share of the book map's points on the new map.
function lineUp(bookWalls, newWalls, newSquares) {
  const step = 0.25;
  const cols = Math.ceil(newSquares[0] / step) + 1;
  const rows = Math.ceil(newSquares[1] / step) + 1;
  const near = new Uint8Array(cols * rows);
  for (const [x1, y1, x2, y2] of newWalls) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    for (let t = 0; t <= length; t += 0.1) {
      const cx = Math.round((x1 + ((x2 - x1) * t) / (length || 1)) / step);
      const cy = Math.round((y1 + ((y2 - y1) * t) / (length || 1)) / step);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const x = cx + ox, y = cy + oy;
        if (x >= 0 && y >= 0 && x < cols && y < rows) near[y * cols + x] = 1;
      }
    }
  }
  const points = [];
  for (const [x1, y1, x2, y2] of bookWalls) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    for (let t = 0; t <= length; t += 0.5) points.push([x1 + ((x2 - x1) * t) / (length || 1), y1 + ((y2 - y1) * t) / (length || 1)]);
  }
  if (points.length < 10) return null;
  const minX = Math.min(...points.map((p) => p[0])), maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])), maxY = Math.max(...points.map((p) => p[1]));
  const score = (dx, dy, sample) => {
    let hits = 0, inside = 0;
    for (const [x, y] of sample) {
      const cx = Math.round((x + dx) / step), cy = Math.round((y + dy) / step);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      inside++;
      if (near[cy * cols + cx]) hits++;
    }
    return { dx, dy, hits, inside };
  };
  // A whole-square search on a few hundred of the points, then the best few refined by quarter squares on all of them.
  const few = points.filter((_, index) => index % Math.ceil(points.length / 400) === 0);
  const coarse = [];
  for (let dx = Math.floor(-maxX); dx <= newSquares[0] - minX; dx += 1) for (let dy = Math.floor(-maxY); dy <= newSquares[1] - minY; dy += 1) coarse.push(score(dx, dy, few));
  coarse.sort((a, b) => b.hits - a.hits);
  let best = { dx: 0, dy: 0, hits: -1, inside: 1 };
  for (const start of coarse.slice(0, 6)) {
    for (let dx = start.dx - 1; dx <= start.dx + 1; dx += step) for (let dy = start.dy - 1; dy <= start.dy + 1; dy += step) {
      const found = score(dx, dy, points);
      if (found.hits > best.hits) best = found;
    }
  }
  const r2 = (value) => Math.round(value * 100) / 100;
  return { dx: r2(best.dx), dy: r2(best.dy), score: r2(best.hits / Math.max(1, best.inside)), cover: r2(best.inside / points.length), hits: best.hits };
}

// One new map: its picture, its record (FG's shape, the base layer's place at the picture's centre so points are
// picture pixels with y negated), and what was done.
async function makeMap(spec) {
  const uvtt = readUvtt(spec.uvtt);
  const origin = uvtt.resolution?.map_origin ?? { x: 0, y: 0 };
  const squares = [Number(uvtt.resolution?.map_size?.x), Number(uvtt.resolution?.map_size?.y)];
  const width = Math.round(squares[0] * SQUARE), height = Math.round(squares[1] * SQUARE);
  const sq = (point) => [Number(point.x) - origin.x, Number(point.y) - origin.y];
  const source = Buffer.from(String(uvtt.image).replace(/^data:[^,]*,/, ""), "base64");
  const picture = await sharp(source, { limitInputPixels: false }).resize(width, height, { kernel: "lanczos3" }).webp({ quality: QUALITY, effort: 5 }).toBuffer();
  const wallsSq = [];
  const occluder = [];
  // "walls": false leaves a map's walls out (a level whose file carries another level's walls) and with them its line-up.
  const keepWalls = spec.walls !== false;
  for (const line of keepWalls ? [...(uvtt.line_of_sight ?? []), ...(uvtt.objects_line_of_sight ?? [])] : []) {
    const pts = list(line).map(sq);
    if (pts.length < 2) continue;
    for (let i = 0; i + 1 < pts.length; i++) wallsSq.push([...pts[i], ...pts[i + 1]]);
    occluder.push({ id: String(occluder.length), points: pts.flatMap(([x, y]) => [round(x * SQUARE), round(-y * SQUARE)]).join(",") });
  }
  const doorsSq = [];
  for (const portal of keepWalls ? uvtt.portals ?? [] : []) {
    const [a, b] = portal.bounds ?? [];
    if (!a || !b) continue;
    const pa = sq(a), pb = sq(b);
    doorsSq.push([...pa, ...pb]);
    occluder.push({ id: String(occluder.length), points: [pa, pb].flatMap(([x, y]) => [round(x * SQUARE), round(-y * SQUARE)]).join(","), toggleable: true, ...(portal.closed === false ? { open: true } : {}) });
  }
  const light = (uvtt.lights ?? []).filter((item) => item.position).map((item, index) => {
    const [x, y] = sq(item.position);
    const range = Math.max(0, Number(item.range) || 0);
    const rgb = /^#?(?:[0-9a-f]{2})?([0-9a-f]{6})$/i.exec(String(item.color ?? ""))?.[1] ?? "FFB347";
    return { id: String(index), position: `${round(x * SQUARE)},${round(-y * SQUARE)}`, on: true, range: `${round(range / 2)},0.25,${round(range)},0.5`, color: `#FF${rgb.toUpperCase()}` };
  });
  // The book map's pins, moved across by the line-up.
  let aligned = null;
  const pinLayers = [];
  const dropped = [];
  if (spec.align && keepWalls) {
    // "auto": every gridded map of the book tried, the best line-up kept (none below minScore, 0.6). A name, or a list of
    // names (a new map that joins two of the book's: the lizardfolk lair's two halves), lines up each one named.
    const named = spec.align === "auto" ? null : [spec.align].flat();
    const candidates = named
      ? named.map((name) => records.find((record) => record.type === "image" && record.name === name) ?? (() => { throw new Error(`${spec.name}: the book has no map named "${name}".`); })())
      : records.filter((record) => record.type === "image" && record.data?.image?.grid === "on" && (!plan.category || record.data?.fgCategory === plan.category) && !record.data?.madeFrom);
    const found = [];
    for (const original of candidates) {
      const pictures = readEntries(PACK, [list(original.data.image.layers.layer)[0].bitmap]);
      const shape = bookMap(original, pictures);
      const result = spec.shift ? { dx: spec.shift[0], dy: spec.shift[1], score: 1, cover: 1, hits: 1 } : lineUp(shape.walls, [...wallsSq, ...doorsSq], squares);
      if (result) found.push({ ...result, with: original.name, shape });
    }
    found.sort((x, y) => y.hits * y.score - x.hits * x.score);
    const used = named ? found : found.slice(0, 1).filter((item) => item.score >= (spec.minScore ?? 0.6));
    aligned = named ? used.map(({ shape, ...rest }) => rest) : found[0] ? { ...(({ shape, ...rest }) => rest)(found[0]), ...(used.length ? {} : { rejected: true }) } : null;
    for (const item of used) for (const pin of item.shape.pins) {
      const x = pin.at[0] + item.dx, y = pin.at[1] + item.dy;
      if (x < 0 || y < 0 || x > squares[0] || y > squares[1]) { dropped.push(pin.layer.shortcut?.record); continue; }
      pinLayers.push({ ...pin.layer, id: String(pinLayers.length + 1), parentid: "-2", matrix: `1,0,0,0,0,1,0,0,0,0,1,0,${round(x * SQUARE)},${round(-y * SQUARE)},0,1` });
    }
  }
  const key = `ma-${slug(spec.name)}`;
  const bitmap = `images/maps/${key}.webp`;
  const name = `${spec.name}${suffix}`;
  const record = {
    id: `${packKey}:image.${key}`,
    type: "image",
    name,
    visibility: "gm",
    source: manifest.name,
    data: {
      image: {
        grid: "on",
        gridsize: `${SQUARE},${SQUARE}`,
        gridoffset: "0,0",
        layers: {
          layer: [
            { name, id: "0", parentid: "-1", type: "image", bitmap, matrix: `1,0,0,0,0,1,0,0,0,0,1,0,${width / 2},${-height / 2},0,1`, ...(occluder.length ? { occluders: { occluder } } : {}), ...(light.length ? { lights: { light } } : {}) },
            ...pinLayers,
          ],
        },
      },
      name,
      ...(plan.category ? { fgCategory: plan.category } : {}),
      madeFrom: path.basename(String(spec.uvtt).split("::").pop()),
    },
  };
  if (previewDir) await preview(picture, width, height, wallsSq, doorsSq, pinLayers, path.join(previewDir, `${key}.jpg`));
  return { record, bitmap, picture, report: { name, squares, pixels: `${width}x${height}`, mb: Math.round((picture.length / 1e6) * 100) / 100, walls: wallsSq.length, doors: doorsSq.length, lights: light.length, ...(aligned ? { lineUp: aligned, pins: pinLayers.length, pinsOffMap: dropped.length } : {}) } };
}

async function preview(picture, width, height, walls, doors, pins, file) {
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const line = ([x1, y1, x2, y2], color) => `<line x1="${x1 * SQUARE * scale}" y1="${y1 * SQUARE * scale}" x2="${x2 * SQUARE * scale}" y2="${y2 * SQUARE * scale}" stroke="${color}" stroke-width="2"/>`;
  const dots = pins.map((layer) => { const [x, y] = nums(layer.matrix).slice(12, 14); return `<circle cx="${x * scale}" cy="${-y * scale}" r="7" fill="yellow" stroke="black" stroke-width="2"/>`; });
  const w = Math.round(width * scale), h = Math.round(height * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${walls.map((wall) => line(wall, "red")).join("")}${doors.map((door) => line(door, "lime")).join("")}${dots.join("")}</svg>`;
  mkdirSync(path.dirname(file), { recursive: true });
  await sharp(picture).resize(w, h).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 80 }).toFile(file);
}

const reports = [];
const made = [];
for (const spec of plan.maps) {
  if (only && spec.name !== only) continue;
  try {
    const result = await makeMap(spec);
    made.push(result);
    reports.push(result.report);
  } catch (error) {
    reports.push({ name: spec.name, error: error.message });
  }
}

if (!flag("--dry") && made.length) {
  const backup = path.join(path.dirname(PACK), ".map-backup", path.basename(PACK));
  if (!existsSync(backup)) {
    mkdirSync(path.dirname(backup), { recursive: true });
    copyFileSync(PACK, backup);
  }
  const replaced = new Set(made.map((item) => item.record.name));
  const kept = records.filter((record) => !(record.type === "image" && replaced.has(record.name)));
  const allRecords = [...kept, ...made.map((item) => item.record)];
  const newPictures = new Set(made.map((item) => item.bitmap));
  const pictures = [...new Set([...(manifest.pictures ?? []).filter((name) => !newPictures.has(name)), ...newPictures])];
  const nextManifest = { ...manifest, records: allRecords.length, ...(manifest.contents ? { contents: contentsOf(allRecords) } : {}), pictures, mapsAdded: new Date().toISOString() };
  const out = zipWriter(PACK);
  out.add("kraken-pack.json", Buffer.from(JSON.stringify(nextManifest)));
  out.add("records.json", Buffer.from(JSON.stringify(allRecords)));
  // The pack's other entries, a few at a time (a pack is hundreds of megabytes).
  const rest = names.filter((name) => name !== "kraken-pack.json" && name !== "records.json" && !newPictures.has(name));
  for (let i = 0; i < rest.length; i += 50) {
    const batch = readEntries(PACK, rest.slice(i, i + 50));
    for (const name of rest.slice(i, i + 50)) if (batch[name]) out.add(name, Buffer.from(batch[name]));
  }
  for (const item of made) out.add(item.bitmap, item.picture);
  out.end();
  reports.push({ pack: PACK, mb: Math.round(statSync(PACK).size / 1e5) / 10, backup });
}
console.log(JSON.stringify(reports, null, 1));
