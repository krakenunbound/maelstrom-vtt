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
  assert(servesGame(pairs[4], "D&D BECMI Companion") && !servesGame(pairs[1], "D&D BECMI Expert"), "every BECMI set's game uses the line's art");
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

  // --- Creatures with no picture of their own ---------------------------------------------------------------------------
  const { creaturePair, creatureToken, creatureRace } = await import("../shared/characters/art.mjs");
  const all = createArtLibrary({ base: folder, roots: [], characters: { dir: folder, ruleset: "Forged in the Dark" } });
  assert(all.list("portrait").length === 1 && all.creature("Dwarf Fighter", "x") !== null, `the pickers list the game's art; a creature may take any system's: ${all.list("portrait").length} ${all.creature("Dwarf Fighter", "x")}`);
  assert(creatureRace(["Goblin", "Hobgoblin"], "Hobgoblin Captain")?.race === "Hobgoblin" && creatureRace(["Goblin"], "Goblin Sentry (Room 2, 1)")?.classes.includes("Fighter") && creatureRace(["Kholo"], "Gnoll")?.race === "Kholo" && creatureRace(["Human"], "Bandit")?.race === "Human" && creatureRace(["Human"], "Carrion Crawler") === null && creatureRace(["Giant"], "Giant Bat") === null && creatureRace(["Giant"], "Hill Giant")?.race === "Giant", "a creature's race and role from its name (a Giant Bat is no giant)");
  const dwarves = library("D&D 5E").list("portrait");
  const a = creaturePair(dwarves, "Dwarf Guard (Gate, 1)", "npc-1");
  assert(a && a.token === dwarves.find((item) => item.id === a.portrait).pair && JSON.stringify(creaturePair(dwarves, "Dwarf Guard (Gate, 1)", "npc-1")) === JSON.stringify(a), "a creature's pair, the same each time");
  const tokens = [{ id: "t/Dire_Wolf_A1_Large_Beast_01.webp", kind: "token", name: "Dire_Wolf_A1_Large_Beast_01" }, { id: "t/Giant_Fire_Beetle_A1_Small_Beast_01.webp", kind: "token", name: "Giant_Fire_Beetle_A1_Small_Beast_01" }, { id: "t/Owlbear_A1_Large_Scale130_Monstrosity_01.webp", kind: "token", name: "Owlbear_A1_Large_Scale130_Monstrosity_01" }, { id: "t/Bat_A1_Tiny_Beast_01.webp", kind: "token", name: "Bat_A1_Tiny_Beast_01" }];
  assert(creatureToken(tokens, "Dire Wolf (Room 13, 1)", "s") === tokens[0].id && creatureToken(tokens, "Fire Beetle", "s") === tokens[1].id && creatureToken(tokens, "Owl Bear", "s") === tokens[2].id && creatureToken(tokens, "Normal Bat", "s") === tokens[3].id && creatureToken(tokens, "Rock Python", "s") === null, "a beast's token by its name from a token folder");
  // A portrait that does not look like its race (review.json) is never picked by itself; the pickers still offer it.
  fs.writeFileSync(path.join(folder, "review.json"), JSON.stringify({ notLikeRace: { [pairs[1].portrait]: { why: "looks human" } } }));
  const reviewed = createArtLibrary({ base: folder, roots: [], characters: { dir: folder, ruleset: "D&D 5E" } });
  const flaggedId = `characters/${pairs[1].portrait}`;
  const picked = new Set(Array.from({ length: 40 }, (_, i) => reviewed.creature("Dwarf Fighter", `seed-${i}`, "portrait")));
  const viaWizard = new Set(Array.from({ length: 40 }, () => withArt({ race: "Dwarf", gender: "Male" }, { class: "Fighter" }, (kind) => reviewed.list(kind)).portrait));
  assert(!picked.has(flaggedId) && !viaWizard.has(flaggedId) && reviewed.list("portrait").some((item) => item.id === flaggedId && item.unlike), "a picture flagged in review.json is never picked, still offered");
  fs.rmSync(path.join(folder, "review.json"));
  // Never a placeholder card (FG's "placeholders/id-00373-Shrieker"); the app's own token folders before a campaign's.
  const mixed = [{ id: "campaigns/WoW/tokens/placeholders/id-00373-Shrieker.png", kind: "token", name: "id-00373-Shrieker" }, { id: "campaigns/WoW/tokens/Shrieker.png", kind: "token", name: "Shrieker" }, { id: "kraken/tokens/FA/Shrieker_A1_Medium_Plant_01.webp", kind: "token", name: "Shrieker_A1_Medium_Plant_01" }];
  assert(creatureToken(mixed, "Shrieker (Room 3, 1)", "s") === mixed[2].id && creatureToken(mixed.slice(0, 2), "Shrieker", "s") === mixed[1].id && creatureToken(mixed.slice(0, 1), "Shrieker", "s") === null, "no placeholder; the app's own tokens first");
  // What a creature's record says (its text, its save, a title): a nosferatu lady is a female vampire; a lord whom
  // Turn Undead holds is undead (a zombie's token), a man by his text's "he"; "Cleric 5" a human cleric.
  const { creatureProfile } = await import("../shared/characters/art.mjs");
  const lillith = creatureProfile({ name: "Lady Lillith (Lillian Corran)", data: { saveas: "C9", text: "<p>9-HD nosferatu and cleric 9. Immune to normal non-silver weapons.</p>" } });
  const kazakk = creatureProfile({ name: "Lord Kazakk", data: { saveas: "F4", text: "<p>A successful Turn Undead holds the creature at bay. He carries a normal sword +1.</p>" } });
  const cleric = creatureProfile({ name: "Cleric of Balthac", data: { saveas: "C5", text: "<p>Cleric 5. Cure light wounds, bless.</p>" } });
  assert(lillith.kind?.race === "Vampire" && lillith.gender === "Female" && lillith.classes.includes("Cleric"), `a nosferatu lady: ${JSON.stringify(lillith)}`);
  assert(kazakk.kind?.token === "Zombie" && kazakk.gender === "Male", `an undead lord: ${JSON.stringify(kazakk)}`);
  assert(cleric.person && cleric.classes.includes("Cleric") && !cleric.kind, `a cleric: ${JSON.stringify(cleric)}`);
  // Art made for a creature by its name (its own portrait and token in the art folders) comes first, parentheses too.
  const madeFor = [{ id: "kraken/tokens/Creatures/Sprackle (Lesser)_Token.webp", kind: "token", name: "Sprackle (Lesser)_Token" }, { id: "kraken/tokens/Creatures/Sprackle (Greater)_Token.webp", kind: "token", name: "Sprackle (Greater)_Token" }];
  assert(creatureToken(madeFor, "Sprackle (Greater)", "a") === madeFor[1].id && creatureToken(madeFor, "Sprackle (Lesser)", "a") === madeFor[0].id, "its own picture by its full name");
  const both = [{ id: "creatures/tokens/Hill Giant_Token.webp", kind: "token", name: "Hill Giant_Token" }, { id: "kraken/tokens/Creatures/Hill Giant_Token.webp", kind: "token", name: "Hill Giant_Token" }];
  assert(["a", "b", "c", "d"].every((seed) => creatureToken(both, "Hill Giant", seed) === both[1].id), "the GM's own picture of a name before a shipped one");
  // A book's names with commas (games/creatures: "Red Dragon, Adult") are found by their words, the plainest first.
  const book = ["Red Dragon, Adult", "Skeleton, Young Adult Red Dragon", "Red Dragon, Mature adult", "Ooze, Gelatinous Cube"].map((name) => ({ id: `creatures/tokens/${name}_Token.webp`, kind: "token", name: `${name}_Token` }));
  const kinds = ["Fire Elemental, Medium", "Earth Elemental, Greater", "Red Dragon, Young", "Red Dragon, Old", "Boar"].map((name) => ({ id: `creatures/tokens/${name}_Token.webp`, kind: "token", name: `${name}_Token` }));
  assert(["a", "b", "c"].every((seed) => creatureToken(kinds, "Elemental (Fire, 12 HD)", seed) === kinds[0].id && creatureToken(kinds, "Dragon, Red (10 HD, Young)", seed) === kinds[2].id) && creatureToken(kinds, "Boar, Wild", "a") === kinds[4].id, "its words in brackets choose (a fire elemental, a young dragon); a book's kind before its comma");
  assert(creatureToken(book, "Adult Red Dragon", "a") === book[0].id && creatureToken(book, "Gelatinous Cube", "a") === book[3].id, `a book's comma names: ${creatureToken(book, "Adult Red Dragon", "a")}`);
  // Its portrait comes with the token (the same name, _Portrait).
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-creatures-"));
    for (const sub of ["portraits", "tokens"]) fs.mkdirSync(path.join(dir, sub));
    for (const [sub, end] of [["portraits", "Portrait"], ["tokens", "Token"]]) for (const name of ["Ooze, Gelatinous Cube", "Skeleton, Young Adult Red Dragon"]) fs.writeFileSync(path.join(dir, sub, `${name}_${end}.webp`), "x");
    const lib = createArtLibrary({ base: dir, roots: [{ dir: path.join(dir, "portraits"), kind: "portrait", group: "Creatures", prefix: "creatures/portraits/" }, { dir: path.join(dir, "tokens"), kind: "token", group: "Creatures", prefix: "creatures/tokens/" }] });
    const portrait = lib.creature({ name: "Gelatinous Cube", data: {} }, "a", "portrait");
    assert(portrait === "creatures/portraits/Ooze, Gelatinous Cube_Portrait.webp", `the token's own portrait: ${portrait}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  done.push("a creature with no picture takes one of its kind: a portrait and its token from the character art by the race its name shows (any system's, the same each time), else a token of its name from the GM's token folders; never a picture flagged as not looking like its race");

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
