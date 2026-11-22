// A 2014 5E book read as FG keeps it, and the character wizard's reading of it (the shapes of FG's 2014 PHB; the
// words here are our own, no book's):
//  - a race's subraces nested inside it (reference.racedata.dwarf.subraces.hilldwarf) become race_subrace records of
//    the book when it is read, so Hill Dwarf is chosen as a 2024 book's subrace is;
//  - the race's trait text: its languages, its skills, "each ability score increases by 1", "two other ability
//    scores of your choice", a tool of the player's choice, a subrace's hit point a level;
//  - a subclass index holding a 2014 and a 2024 version of one domain: a 2014 class offers its own edition, once;
//  - a spell's classes ("Bard, Cleric Nature Domain, Druid"): a domain's spell is not every Cleric's;
//  - a feature's armour proficiency ("you gain proficiency with heavy armor").
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { createRequire } from "node:module";
import { zipSync, strToU8 } from "fflate";
import { ancestriesOf, classInfo, classSpells, speciesInfo, subclassesOf } from "../shared/dnd5e/wizard.mjs";
import { buildFromSpec } from "../shared/dnd5e/rules.mjs";

const require = createRequire(import.meta.url);
const { readModule } = require("../electron/importers/fgModule.cjs");
const { FORMAT, VERSION } = require("../electron/packs.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];

const race = (name, traits, subraces) => ({ id: `test-legacy:reference.racedata.${name.toLowerCase()}`, type: "race", name, visibility: "all", source: "Test Legacy", data: { name, traits, ...(subraces ? { subraces } : {}), fgPath: `reference.racedata.${name.toLowerCase()}@Test Legacy` } });
const records = [
  race(
    "Dwarf",
    {
      asi: { name: "Ability Score Increase", text: "<p>Your Constitution score increases by 2.</p>" },
      lang: { name: "Languages", text: "<p>You speak Common and Dwarvish. More about the tongue follows.</p>" },
      tool: { name: "Tool Proficiency", text: "<p>You gain proficiency with the artisan's tools of your choice: smith's tools, brewer's supplies, or mason's tools.</p>" },
    },
    {
      hilldwarf: { name: "Hill Dwarf", text: "<p>Hardy folk.</p>", traits: { asi: { name: "Ability Score Increase", text: "<p>Your Wisdom score increases by 1.</p>" }, tough: { name: "Dwarven Toughness", text: "<p>Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.</p>" } } },
      mountaindwarf: { name: "Mountain Dwarf", text: "<p>Strong folk.</p>", traits: { asi: { name: "Ability Score Increase", text: "<p>Your Strength score increases by 2.</p>" } } },
    },
  ),
  race("Elf", { asi: { name: "Ability Score Increase", text: "<p>Your Dexterity score increases by 2.</p>" }, keen: { name: "Keen Senses", text: "<p>You have proficiency in the Perception skill.</p>" }, lang: { name: "Languages", text: "<p>You speak Common and Elvish.</p>" } }),
  race("Human", { asi: { name: "Ability Score Increase", text: "<p>Your ability scores each increase by 1.</p>" }, lang: { name: "Languages", text: "<p>You speak Common and one extra language of your choice.</p>" } }),
  race("Half-Elf", { asi: { name: "Ability Score Increase", text: "<p>Your Charisma score increases by 2, and two other ability scores of your choice increase by 1.</p>" }, skills: { name: "Skill Versatility", text: "<p>You gain proficiency in two skills of your choice.</p>" } }),
  {
    id: "test-legacy:reference.classdata.cleric",
    type: "class",
    name: "Cleric",
    visibility: "all",
    source: "Test Legacy",
    data: { name: "Cleric", hp: { hitdice: { text: "1d8 per cleric level" } }, proficiencies: { armor: { text: "Light armor, medium armor, shields" }, weapons: { text: "All simple weapons" }, savingthrows: { text: "Wisdom, Charisma" }, skills: { text: "Choose two from History, Insight, Medicine, Persuasion, and Religion" } }, features: { a: { name: "Divine Domain", level: 1, specializationchoice: 1, text: "<p>Choose a domain.</p>" } } },
  },
  {
    id: "test-legacy:reference.class_specializationdata@Test Legacy",
    type: "refindex",
    name: "Subclasses",
    visibility: "all",
    source: "Test Legacy",
    data: {
      fgPath: "reference.class_specializationdata@Test Legacy",
      a: { name: "Life Domain", class: "Cleric", version: "2024", features: { x: { name: "Disciple of Life", level: 3, text: "<p>Healing.</p>" } } },
      b: { name: "Life Domain", class: "Cleric", features: { x: { name: "Disciple of Life", level: 1, text: "<p>Healing.</p>" }, y: { name: "Bonus Proficiency", level: 1, text: "<p>You gain proficiency with heavy armor.</p>" } } },
    },
  },
  ...[
    ["Bless", "Cleric, Paladin"],
    ["Animal Friendship", "Bard, Cleric Nature Domain, Druid"],
    ["Healing Word", "Bard, Cleric, Druid"],
  ].map(([name, source], index) => ({ id: `test-legacy:reference.spelldata.s${index}`, type: "spell", name, visibility: "all", source: "Test Legacy", data: { name, level: 1, source } })),
];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-legacy-"));
const file = path.join(dir, "Test Legacy.kpack");
fs.writeFileSync(file, zipSync({ "kraken-pack.json": strToU8(JSON.stringify({ format: FORMAT, version: VERSION, name: "Test Legacy", ruleset: "D&D 5E" })), "records.json": strToU8(JSON.stringify(records)) }));
const read = readModule(file).records;
const of = (type) => read.filter((record) => record.type === type);

// The reader: nested subraces as the book's own records.
const dwarf = of("race").find((record) => record.name === "Dwarf");
const ancestries = ancestriesOf(dwarf, of("race_subrace"));
assert(ancestries.map((item) => item.name).join(",") === "Hill Dwarf,Mountain Dwarf", `Dwarf's subraces read from the book: ${ancestries.map((item) => item.name)}`);
assert(ancestries.every((item) => item.source === "Test Legacy" && item.data.race === "Dwarf"), "each the book's, naming its race");
assert(readModule(file).records.filter((record) => record.type === "race_subrace").length === 2, "read again: still two");
done.push("a race's nested subraces read as the book's subrace records");

// The race's trait text.
const hill = ancestries[0];
const kin = speciesInfo(dwarf, hill);
assert(kin.increases.constitution === 2 && kin.increases.wisdom === 1, `Hill Dwarf: Con +2, Wis +1: ${JSON.stringify(kin.increases)}`);
assert(kin.languages.base.join(",") === "Common,Dwarvish", `Dwarf's languages: ${kin.languages.base}`);
const tool = kin.decisions.find((item) => item.type === "toolprof");
assert(tool?.options.join("|") === "Smith's Tools|Brewer's Supplies|Mason's Tools", `the tool choice: ${tool?.options}`);
const elf = speciesInfo(of("race").find((record) => record.name === "Elf"));
assert(elf.skills.base.includes("perception"), "Keen Senses: Perception");
const human = speciesInfo(of("race").find((record) => record.name === "Human"));
assert(Object.values(human.increases).every((n) => n === 1) && Object.keys(human.increases).length === 6, `Human: +1 to each: ${JSON.stringify(human.increases)}`);
assert(human.decisions.some((item) => item.type === "language"), "Human: one language of choice");
const halfElf = speciesInfo(of("race").find((record) => record.name === "Half-Elf"));
assert(halfElf.decisions.filter((item) => item.type === "asi").length === 2 && halfElf.decisions.filter((item) => item.type === "skill").length === 2, "Half-Elf: two +1s and two skills to choose");
done.push("a 2014 race's languages, skills, ability increases and tool choice from its traits");

// Subclasses of the class's edition; a domain's spells; a feature's armour.
const cleric = of("class")[0];
const domains = subclassesOf(cleric, of("class_specialization"));
assert(domains.length === 1 && domains[0].data.version !== "2024", `a 2014 Cleric's Life Domain, once: ${domains.length}`);
const info = classInfo(cleric, 1, domains[0]);
assert(info.features.some((feature) => feature.name === "Disciple of Life"), "Disciple of Life at level 1");
assert(/heavy armor/.test(info.armor), `Bonus Proficiency: heavy armor: ${info.armor}`);
const spells = classSpells(of("spell"), "Cleric", 1).map((spell) => spell.name);
assert(spells.includes("Bless") && spells.includes("Healing Word") && !spells.includes("Animal Friendship"), `the Cleric's list: ${spells}`);
assert(classSpells(of("spell"), "Cleric", 1, "Nature Domain").some((spell) => spell.name === "Animal Friendship"), "a Nature Domain cleric's own spell");
done.push("subclasses of the class's edition, once; a domain's spells only for it; a feature's heavy armor");

// Built: the Hill Dwarf's hit point.
const lib = { classes: of("class"), species: of("race"), ancestries: of("race_subrace"), backgrounds: [], subclasses: of("class_specialization"), feats: [], items: [], spells: of("spell") };
const hero = buildFromSpec({ name: "Test", species: "Dwarf", ancestry: "Hill Dwarf", class: "Cleric", subclass: "Life Domain", level: 1, scores: { strength: 10, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 15, charisma: 10 }, details: { deity: "A god of the forge", ideals: "Tradition." } }, lib).data;
assert(hero.hp.total === 8 + 3 + 1, `Hill Dwarf cleric's hit points (8 + Con 3 + 1): ${hero.hp.total}`);
assert(hero.hpperlevel === 1 && hero.deity === "A god of the forge" && hero.ideals === "Tradition.", "a hit point a level kept; the wizard's details on the sheet");
assert(/heavy armor/.test(hero.proficiencylist.armor), "heavy armor on the sheet");
done.push("a Hill Dwarf cleric built: its toughness, heavy armor and details");
fs.rmSync(dir, { recursive: true, force: true });
console.log(`ok legacy 5e books: ${done.join("; ")}`);
