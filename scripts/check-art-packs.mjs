// Maelstrom's art packs (electron/artPacks.cjs) read in place, with no art folders (an installed copy): the character
// art's pairs (ids as the folder gave them: characters/...), only a game's in its pickers, a picture's bytes, the review's
// list, the creature art (creatures/portraits|tokens/...) and a creature's face from it; a pack taken out takes its art.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";

const require = createRequire(import.meta.url);
const { createArtLibrary } = require("../electron/artLibrary.cjs");
const { packsIn } = require("../electron/artPacks.cjs");
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const folder = mkdtempSync(path.join(tmpdir(), "mvtt-art-packs-"));
// A WebP's first bytes, then its own name (so each picture can be told apart).
const webp = (name) => strToU8(`RIFF\0\0\0\0WEBPVP8 ${name}`);
const pack = (file, manifest, files) => writeFileSync(path.join(folder, file), zipSync({ "kraken-pack.json": strToU8(JSON.stringify({ format: "kraken-pack", kind: "art-pack", ...manifest })), ...files }, { level: 0 }));
const pair = (ruleset, race, cls, gender, name) => ({ ruleset, race, cls, gender, name, portrait: `${ruleset}/${race}/${cls}/${gender}/${name}_Portrait.webp`, token: `${ruleset}/${race}/${cls}/${gender}/${name}_Token.webp`, rulesets: [ruleset] });
const fantasy = [pair("D&D 5e (2024)", "Dwarf", "Fighter", "Male", "V1"), pair("in_common", "Goblin", "Rogue", "Male", "V1"), pair("in_common", "Human", "Fighter", "Female", "V1")];
const filesOf = (pairs) => Object.fromEntries(pairs.flatMap((p) => [[`characters/${p.portrait}`, webp(p.portrait)], [`characters/${p.token}`, webp(p.token)]]));
pack("Maelstrom-Art-Fantasy-Characters.kpack", { id: "fantasy", name: "Maelstrom Art: Fantasy Characters" }, {
  "characters/manifest.json": strToU8(JSON.stringify({ format: 1, pairs: fantasy })),
  "characters/review.json": strToU8(JSON.stringify({ notLikeRace: { [fantasy[2].portrait]: "looks elven" } })),
  ...filesOf(fantasy),
});
pack("Maelstrom-Art-Monsters.kpack", { id: "monsters", name: "Maelstrom Art: Monsters" }, {
  "creatures/portraits/Owlbear_Portrait.webp": webp("owlbear portrait"),
  "creatures/tokens/Owlbear_Token.webp": webp("owlbear token"),
});
// Not an art pack (a book): left out.
writeFileSync(path.join(folder, "Some Book.kpack"), zipSync({ "kraken-pack.json": strToU8(JSON.stringify({ format: "kraken-pack", name: "Some Book" })), "records.json": strToU8("[]") }));

try {
  assert(packsIn(folder).map((item) => item.manifest.id).sort().join() === "fantasy,monsters", `only art packs are read: ${packsIn(folder).map((item) => item.manifest.id)}`);
  done.push("only art packs");

  const art = (ruleset) => createArtLibrary({ base: tmpdir(), roots: [], characters: { dir: path.join(folder, "no-folder"), ruleset, packs: folder } });
  const five = art("D&D 5E");
  const portraits = five.list("portrait").map((item) => item.id);
  assert(portraits.includes(`characters/${fantasy[0].portrait}`) && portraits.includes("creatures/portraits/Owlbear_Portrait.webp"), `ids as the folders gave them: ${portraits}`);
  assert(!art("Traveller").list("portrait").some((item) => item.id === `characters/${fantasy[0].portrait}`), "a game's pickers list only its art");
  done.push("ids as before (characters/..., creatures/...), a game's own art in its pickers");

  const picture = five.file(`characters/${fantasy[0].portrait}`);
  assert(picture.read && new TextDecoder().decode(picture.read()).endsWith(fantasy[0].portrait) && picture.mime === "image/webp", "a picture's bytes, read from the pack");
  assert(art(undefined).list("portrait").find((item) => item.id === `characters/${fantasy[2].portrait}`)?.unlike === true, "the review's list travels with the pack");
  done.push("a picture's bytes from the pack; the review's list");

  const owlbear = five.creature("Owlbear", "a", "token");
  assert(owlbear === "creatures/tokens/Owlbear_Token.webp" && five.creature("Owlbear", "a", "portrait") === "creatures/portraits/Owlbear_Portrait.webp", `a creature's own art: ${owlbear}`);
  const goblin = five.creature("Goblin Sneak", "a", "portrait");
  assert(goblin === `characters/${fantasy[1].portrait}`, `a goblin's face from the character art: ${goblin}`);
  done.push("creatures' own art and faces of their kind");

  rmSync(path.join(folder, "Maelstrom-Art-Monsters.kpack"));
  assert(!art("D&D 5E").list("token").some((item) => item.id.startsWith("creatures/")), "a pack taken out takes its art");
  done.push("a pack taken out takes its art away");
} finally {
  rmSync(folder, { recursive: true, force: true });
}
console.log(`ok art packs: ${done.join("; ")}`);
