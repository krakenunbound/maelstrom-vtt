// The character art library (games/characters, docs/character-art.md): the art list offers the pairs that serve the
// campaign's game (in_common for a game with none of its own), each item knowing its race, class, gender and partner;
// a new character gets a portrait and its own token by race, class and gender (the nearest when there is no exact
// one), at random among those that fit; a gender rolled again picks another face; a portrait chosen by hand keeps its
// token. Then the shipped library: every file its manifest lists is there.
//   node scripts/check-character-art.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createArtLibrary } = require("../electron/artLibrary.cjs");
const { withArt } = require("../electron/characterArt.cjs");
const { genderOf, pickPair, servesGame, fitting } = await import("../shared/characters/art.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-character-art-"));
const pair = (ruleset, race, cls, gender, name, rulesets) => {
  const base = `${ruleset}/${race}/${cls}/${gender}/${race}_${cls}_${gender}_${name}`;
  for (const end of ["Portrait", "Token"]) {
    fs.mkdirSync(path.join(folder, path.dirname(base)), { recursive: true });
    fs.writeFileSync(path.join(folder, `${base}_${end}.webp`), "RIFF");
  }
  return { ruleset, race, cls, gender, name, portrait: `${base}_Portrait.webp`, token: `${base}_Token.webp`, rulesets };
};
const pairs = [
  pair("in_common", "Dwarf", "Fighter", "Female", "V1", ["D&D 5e (2014)", "D&D 3.5e", "D&D BECMI Basic"]),
  pair("in_common", "Dwarf", "Fighter", "Male", "V1", ["D&D 5e (2014)", "D&D 3.5e"]),
  pair("in_common", "Dwarf", "Fighter", "Male", "V2", ["D&D 5e (2014)", "D&D 3.5e"]),
  pair("in_common", "Human", "Thief", "Female", "V1", ["D&D BECMI Basic", "AD&D 2e"]),
  pair("D&D BECMI Basic", "Dwarf", "Dwarf", "Male", "V1", ["D&D BECMI Basic"]),
  pair("Blades in the Dark", "Iruvian", "Cutter", "Female", "V1", ["Blades in the Dark"]),
];
fs.writeFileSync(path.join(folder, "manifest.json"), JSON.stringify({ format: "maelstrom-character-art", version: 1, pairs }));
try {
  // --- The picker ------------------------------------------------------------------------------------------------------
  assert(genderOf("F") === "Female" && genderOf("woman") === "Female" && genderOf("Male") === "Male" && genderOf("he/him") === "Male" && genderOf("") === "" && genderOf("nonbinary") === "", "genders read");
  assert(servesGame(pairs[0], "D&D BECMI") && !servesGame(pairs[1], "D&D BECMI") && servesGame(pairs[4], "D&D BECMI") && !servesGame(pairs[5], "D&D 5E"), "a pair serves the games its systems map to");
  assert(servesGame(pairs[0], "Worldbuilding") && !servesGame(pairs[5], "Worldbuilding"), "a game with no art of its own: the shared art (in_common)");

  // --- The art list, by the campaign's game ----------------------------------------------------------------------------
  const library = (ruleset) => createArtLibrary({ base: folder, roots: [], characters: { dir: folder, ruleset } });
  const five = library("D&D 5E").list("portrait");
  assert(five.length === 3 && five.every((item) => item.pair && item.race === "Dwarf" && item.group === "Characters · Dwarf"), `5E's portraits: ${JSON.stringify(five)}`);
  const becmi = library("D&D BECMI");
  assert(becmi.list("portrait").length === 3 && becmi.list("token").length === 3, "BECMI's: the shared Dwarf and Thief, its own Dwarf class");
  const served = becmi.file(becmi.list("token")[0].id);
  assert(served?.mime === "image/webp" && fs.existsSync(served.path), "its files served");
  assert(library("Worldbuilding").list("portrait").length === 4, "Worldbuilding: the shared four");

  // --- A new character's pair ------------------------------------------------------------------------------------------
  const art = (kind) => library("D&D 5E").list(kind);
  const portraits = art("portrait");
  const female = withArt({ race: "Dwarf", gender: "Female" }, { class: "Fighter" }, art);
  assert(female.portrait.includes("Female") && female.token === portraits.find((item) => item.id === female.portrait).pair, `a female dwarf fighter, its own token: ${JSON.stringify(female)}`);
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) seen.add(withArt({ race: "Dwarf" }, { class: "Fighter", gender: "m" }, art).portrait);
  assert(seen.size === 2 && [...seen].every((id) => id.includes("Male")), `at random among the two male ones: ${[...seen]}`);
  // A gender rolled again: another face when there is one.
  const first = pickPair(portraits, { race: "Dwarf", cls: "Fighter", gender: "Male" }, { random: () => 0 });
  const again = pickPair(portraits, { race: "Dwarf", cls: "Fighter", gender: "Male" }, { random: () => 0, avoid: first.portrait });
  assert(first.portrait !== again.portrait, "rolled again: the other face");
  // The nearest: a dwarf cleric (no cleric) is a dwarf of that gender; an elf (none) gets the library's nothing.
  assert(fitting(portraits, { race: "Dwarf", cls: "Cleric", gender: "Female" }).length === 1, "the nearest: race and gender");
  assert(!pickPair(portraits, { race: "Elf", cls: "Wizard" }), "no elf: no pair (the older pictures are tried)");
  // A portrait chosen by hand keeps its own token.
  const chosen = withArt({ race: "Dwarf" }, { class: "Fighter", portrait: portraits[2].id }, art);
  assert(chosen.portrait === portraits[2].id && chosen.token === portraits[2].pair, "a portrait chosen: its token with it");
  // A character that has its pictures keeps them.
  const kept = withArt({ race: "Dwarf", portrait: "players/portraits/mine.png", token: "players/tokens/mine.png" }, { class: "Fighter" }, art);
  assert(kept.portrait === "players/portraits/mine.png" && kept.token === "players/tokens/mine.png", "its own pictures kept");
  done.push("the art list offers the pairs that serve the campaign's game (the shared ones for a game with none), each knowing its pair; a new character gets a portrait and its own token by race, class and gender, at random among those that fit, the nearest when none, another face when the gender is rolled again; one chosen by hand keeps its token");

  // --- The shipped library ---------------------------------------------------------------------------------------------
  const shipped = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "games", "characters", "manifest.json");
  if (fs.existsSync(shipped)) {
    const manifest = JSON.parse(fs.readFileSync(shipped, "utf8"));
    const dir = path.dirname(shipped);
    const lost = manifest.pairs.flatMap((item) => [item.portrait, item.token]).filter((rel) => !fs.existsSync(path.join(dir, rel)));
    assert(lost.length === 0, `every file the manifest lists: ${lost.slice(0, 5)}`);
    assert(manifest.pairs.every((item) => !/[A-Za-z]:[\\/]/.test(item.portrait) && !item.portrait.startsWith("/")), "relative paths only");
    done.push(`the shipped library: ${manifest.pairs.length} pairs, every file there`);
  }
} finally {
  fs.rmSync(folder, { recursive: true, force: true });
}
console.log(`ok character art: ${done.join("; ")}`);
