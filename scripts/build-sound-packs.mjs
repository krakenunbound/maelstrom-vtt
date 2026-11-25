// Builds a Maelstrom sound pack (electron/sounds.cjs reads it in place from Documents/Kraken VTT/Sound Packs) from a
// folder laid out as the app listens for: <kind>/<group>/<file>, kinds sfx, ambience, music, oneshots
// (sfx/Weapons/Sword/Hit/swing-1.mp3, ambience/Cave/drip.ogg). docs/sound-folders.md lists the folders.
//   node scripts/build-sound-packs.mjs <source folder> <out folder> [--name "My Weapons"] [--id my-weapons] [--blurb "..."]
// The pack is <out>/Maelstrom-Sounds-<Name>.kpack: a stored zip with kraken-pack.json { kind: "sound-pack", ... }.
// Anything not a sound under one of the four kinds is left out (and listed).
import { mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { zipWriter } from "./lib/zipWriter.mjs";

const KINDS = ["sfx", "ambience", "music", "oneshots"];
const AUDIO = /\.(mp3|ogg|oga|wav|m4a|webm|flac|opus)$/i;
const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const [source, out] = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!source || !out) {
  console.error('node scripts/build-sound-packs.mjs <source folder> <out folder> [--name "My Weapons"] [--id my-weapons] [--blurb "..."]');
  process.exit(2);
}
const name = flag("name") ?? path.basename(path.resolve(source));
const id = flag("id") ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const file = path.join(out, `Maelstrom-Sounds-${name.replace(/[^\w&' -]+/g, "").trim().replace(/\s+/g, "-")}.kpack`);

const found = [];
const skipped = [];
const walk = (dir, rel) => {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    const id = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(full, id);
    else if (AUDIO.test(entry.name) && KINDS.includes(id.split("/")[0]) && id.split("/").length >= 2) found.push([id, full]);
    else skipped.push(id);
  }
};
walk(path.resolve(source), "");
if (!found.length) {
  console.error(`No sounds under ${source}: put them in sfx/, ambience/, music/ or oneshots/ folders.`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const groups = new Map();
for (const [entry] of found) groups.set(entry.split("/").slice(0, -1).join("/"), (groups.get(entry.split("/").slice(0, -1).join("/")) ?? 0) + 1);
const zip = zipWriter(file);
const manifest = { format: "kraken-pack", kind: "sound-pack", id, name, title: name, blurb: flag("blurb") ?? "", made: new Date().toISOString(), sounds: found.length, groups: Object.fromEntries(groups) };
zip.add("kraken-pack.json", Buffer.from(JSON.stringify(manifest, null, 2)));
let bytes = 0;
for (const [entry, full] of found) {
  zip.add(entry, full);
  bytes += statSync(full).size;
}
const done = zip.end();
console.log(JSON.stringify({ pack: file, sounds: found.length, folders: groups.size, mb: Math.round((done.bytes / 1048576) * 10) / 10, skipped: skipped.slice(0, 20), skippedCount: skipped.length }));
