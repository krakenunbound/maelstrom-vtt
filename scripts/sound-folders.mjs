// Writes docs/sound-folders.md: every folder Maelstrom listens for (electron/soundCatalog.cjs soundFolders), for
// whoever makes a sound pack. --check: fail if the file is out of date (check-sound runs it).
//   node scripts/sound-folders.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { soundFolders, TRIGGERS_VERSION } = require("../electron/soundCatalog.cjs");
const FILE = "docs/sound-folders.md";
const folders = soundFolders();
const cell = (text) => String(text ?? "").replace(/\|/g, "\\|");
const section = (title, rows) => [`## ${title}`, "", "| Folder | What goes in it | What plays it | Make |", "|---|---|---|---|", ...rows.map((row) => `| \`${row.folder}\` | ${cell(row.what)} | ${cell(row.plays)} | ${row.wanted} |`), ""];
const by = (test) => folders.filter((row) => !row.core && test(row.folder));
const text = [
  "<!-- Made by scripts/sound-folders.mjs from electron/soundCatalog.cjs: edit those, then run it. -->",
  "# Sound folders",
  "",
  "The folders Maelstrom listens for. A sound pack (`Documents/Kraken VTT/Sound Packs`, see its README) holds",
  "some of them; each folder plays one of its sounds at random, so five files in a folder are five variations.",
  "**Make** is how many to aim for. A folder with nothing in it is silent and the next rule that fits plays",
  "instead (an axe with no `Hit` sounds falls back to any melee hit). Make a pack with",
  "`node scripts/build-sound-packs.mjs <folder> <out> --name \"<Name>\"`; ask the app what is still empty with",
  "`kraken_sound` action `folders`.",
  "",
  `${folders.length} folders (sound triggers version ${TRIGGERS_VERSION}). Sounds: .mp3, .ogg, .wav, .m4a, .webm, .flac or .opus.`,
  "Weapon and impact sounds: 1 to 3 seconds, no voices. Loops (ambience): 20 seconds or more, seamless.",
  "",
  ...section("Shipped with the app (the table's own)", folders.filter((row) => row.core)),
  ...section("Weapons", by((folder) => folder.startsWith("sfx/Weapons/"))),
  ...section("Armour and hide: where a blow lands", by((folder) => folder.startsWith("sfx/Impacts/"))),
  ...section("Spells", by((folder) => folder.startsWith("sfx/Spells/"))),
  ...section("Creatures", by((folder) => /^sfx\/(Monsters|Animals)\//.test(folder))),
  ...section("Bodies: wounds, death, healing", by((folder) => folder.startsWith("sfx/Body/"))),
  ...section("Traps, doors, treasure and other effects", by((folder) => folder.startsWith("sfx/Effects/"))),
  ...section("Ambience (loops)", by((folder) => folder.startsWith("ambience/"))),
  ...section("Music", by((folder) => folder.startsWith("music/"))),
  ...section("Voices", by((folder) => folder.startsWith("oneshots/"))),
].join("\n");
if (process.argv.includes("--check")) {
  let old = "";
  try {
    old = readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
  } catch {
    /* missing */
  }
  if (old !== text) {
    console.error(`${FILE} is out of date: run node scripts/sound-folders.mjs`);
    process.exit(1);
  }
  console.log(`ok ${FILE}: ${folders.length} folders`);
} else {
  writeFileSync(FILE, text);
  console.log(`wrote ${FILE}: ${folders.length} folders`);
}
