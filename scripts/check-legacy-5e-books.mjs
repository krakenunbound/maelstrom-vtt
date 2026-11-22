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
import { backgroundKit2014, legacyKit, legacyKitItems } from "../shared/dnd5e/kits2014.mjs";

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
      speed: { name: "Speed", text: "<p>Your base walking speed is 25 feet. Heavy armor does not slow you.</p>" },
      dark: { name: "Darkvision", text: "<p>You can see in dim light within 60 feet of you as if it were bright light.</p>" },
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
    data: { name: "Cleric", text: "<p>You start with the following equipment, in addition to the equipment granted by your background:</p><list><li>(a) a mace or (b) a warhammer (if proficient)</li><li>(a) scale mail, (b) leather armor, or (c) chain mail (if proficient)</li><li>(a) a light crossbow and 20 bolts or (b) any simple weapon</li><li>(a) a priest's pack or (b) an explorer's pack, shield and a holy symbol</li></list>", hp: { hitdice: { text: "1d8 per cleric level" } }, proficiencies: { armor: { text: "Light armor, medium armor, shields" }, weapons: { text: "All simple weapons" }, savingthrows: { text: "Wisdom, Charisma" }, skills: { text: "Choose two from History, Insight, Medicine, Persuasion, and Religion" } }, features: { a: { name: "Divine Domain", level: 1, specializationchoice: 1, text: "<p>Choose a domain.</p>" } } },
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
  { id: "test-legacy:reference.refmanualdata.intro", type: "refpage", name: "Introduction", visibility: "all", source: "Test Legacy", data: { name: "Introduction", text: "<p>A test book.</p>", fgPath: "reference.refmanualdata.intro@Test Legacy" } },
  { id: "test-legacy:reference.tables.tab_testideal", type: "table", name: "Test Acolyte Ideal", visibility: "all", source: "Test Legacy", data: { name: "Test Acolyte Ideal", dice: "d6", resultscols: 1, tablerows: { a: { fromrange: 1, torange: 6, results: { a: { result: "Faith in the old ways." } } } }, fgPath: "reference.tables.tab_testideal@Test Legacy" } },
  ...[
    ["Bless", "Cleric, Paladin"],
    ["Animal Friendship", "Bard, Cleric Nature Domain, Druid"],
    ["Healing Word", "Bard, Cleric, Druid"],
  ].map(([name, source], index) => ({ id: `test-legacy:reference.spelldata.s${index}`, type: "spell", name, visibility: "all", source: "Test Legacy", data: { name, level: 1, source } })),
];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-legacy-"));
const file = path.join(dir, "Test Legacy.kpack");
fs.writeFileSync(file, zipSync({ "kraken-pack.json": strToU8(JSON.stringify({ format: FORMAT, version: VERSION, name: "Test Legacy", ruleset: "D&D 5E", hasBook: true })), "records.json": strToU8(JSON.stringify(records)) }));
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
const elfRecord = () => of("race").find((record) => record.name === "Elf");
const elf = speciesInfo(elfRecord());
assert(elf.skills.base.includes("perception"), "Keen Senses: Perception");
const human = speciesInfo(of("race").find((record) => record.name === "Human"));
assert(Object.values(human.increases).every((n) => n === 1) && Object.keys(human.increases).length === 6, `Human: +1 to each: ${JSON.stringify(human.increases)}`);
assert(human.decisions.some((item) => item.type === "language"), "Human: one language of choice");
const halfElf = speciesInfo(of("race").find((record) => record.name === "Half-Elf"));
assert(halfElf.decisions.filter((item) => item.type === "asi").length === 2 && halfElf.decisions.filter((item) => item.type === "skill").length === 2, "Half-Elf: two +1s and two skills to choose");
// A subrace's own choices (a High Elf's): a cantrip from the wizard's list, one extra language.
const highElf = speciesInfo(elfRecord(), { name: "High Elf", data: { traits: [{ name: "Cantrip", text: "<p>You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.</p>" }, { name: "Extra Language", text: "<p>You can speak, read, and write one extra language of your choice.</p>" }] } });
assert(highElf.decisions.filter((item) => item.type === "cantrip" && item.list === "Wizard").length === 1, `High Elf: a wizard cantrip to choose: ${JSON.stringify(highElf.decisions)}`);
assert(highElf.decisions.filter((item) => item.type === "language").length === 1, "High Elf: one extra language to choose");
assert(human.decisions.filter((item) => item.type === "language").length === 1, "Human: still one language, not two");
const trained = speciesInfo({ name: "Elf", data: { traits: [{ name: "Elf Weapon Training", text: "<p>You have proficiency with the longsword, shortsword, shortbow, and longbow.</p>" }, { name: "Keen Senses", text: "<p>You have proficiency in the Perception skill.</p>" }] } });
assert(trained.weapons.join(",") === "longsword,shortsword,shortbow,longbow", `an Elf's Weapon Training: ${trained.weapons}`);
done.push("a 2014 race's languages, skills, ability increases and tool choice from its traits (a subrace's cantrip and extra language too)");

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
assert(hero.speed === "25 ft." && hero.senses === "Darkvision 60 ft", `a 2014 Dwarf's speed and darkvision from its traits: ${hero.speed}, ${hero.senses}`);
assert(/heavy armor/.test(hero.proficiencylist.armor), "heavy armor on the sheet");
done.push("a Hill Dwarf cleric built: its toughness, speed 25, darkvision 60, heavy armor and details");
// The builder holds a spec to the class's own skill list as the wizard reads it ("Choose four from Acrobatics, ..."):
// the first skill named counts, and so does a count in words.
{
  const rogue = { type: "class", name: "Rogue", data: { name: "Rogue", hp: { hitdice: { text: "1d8 per rogue level" } }, proficiencies: { skills: { text: "Choose four from Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand, and Stealth" } } } };
  const built = buildFromSpec({ name: "Quick", class: "Rogue", level: 1, scores: {}, skills: ["Acrobatics", "Perception", "Stealth", "Deception"] }, { ...lib, classes: [rogue] });
  const known = Object.entries(built.data.skills).filter(([, value]) => value.prof).map(([key]) => key).sort().join(",");
  assert(!built.problems.length && known === "acrobatics,deception,perception,stealth", `a 2014 Rogue's four skills, the first named too: ${known} ${built.problems}`);
  done.push("a 2014 class's skill choices held as the wizard reads them (four, the first named counts)");
}
// The 2014 starting kits, read from the book's words: the class's equipment list (each (a)/(b) line a choice; two packs
// with more after the last: the rest comes with either) and the background's equipment sentence.
const gear = [
  ["Mace", "Weapon", "Simple Melee Weapons"],
  ["Warhammer", "Weapon", "Martial Weapons"],
  ["Club", "Weapon", "Simple Melee Weapons"],
  ["Crossbow, Light", "Weapon", "Simple Ranged Weapons"],
  ["Crossbow Bolts (20)", "Adventuring Gear", "Ammunition"],
  ["Scale Mail", "Armor", "Medium Armor"],
  ["Leather", "Armor", "Light Armor"],
  ["Chain Mail", "Armor", "Heavy Armor"],
  ["Shield", "Armor", "Shield"],
  ["Priest's Pack", "Adventuring Gear", "Equipment Packs"],
  ["Explorer's Pack", "Adventuring Gear", "Equipment Packs"],
  ["Amulet", "Adventuring Gear", "Holy Symbol"],
  ["Emblem", "Adventuring Gear", "Holy Symbol"],
  ["Book", "Adventuring Gear", "Standard"],
  ["Incense (One Block)", "Adventuring Gear", "Standard"],
  ["Clothes, Vestments", "Adventuring Gear", "Standard"],
  ["Clothes, Common", "Adventuring Gear", "Standard"],
  ["Pouch", "Adventuring Gear", "Standard"],
  ["Rope, Silk (50 Feet)", "Adventuring Gear", "Standard"],
  ["Dagger", "Weapon", "Simple Melee Weapons"],
].map(([name, type, subtype]) => ({ type: "item", name, data: { name, type, subtype } }));
const kit = legacyKit(cleric, gear);
assert(kit.included.map((entry) => entry.name ?? entry.kind).join(",") === "Shield,holy symbol" && kit.choices.length === 4, "a 2014 Cleric's kit: a shield, a holy symbol, four choices");
const holy = kit.included[1];
assert(holy.options.join(",") === "Amulet,Emblem", `the holy symbols the books hold: ${holy.options}`);
const halfway = legacyKitItems(kit, { c0: "1", c1: "2" }, gear);
assert(halfway.open.length === 3, `still to choose: ${halfway.open}`);
const picks = { i1: "Emblem", c0: "1", c1: "2", c2: "1", "c2:0": "Club", c3: "0" };
const chosen = legacyKitItems(kit, picks, gear);
assert(chosen.open.length === 0 && chosen.items.map((entry) => entry.name).join(",") === "Shield,Emblem,Warhammer,Chain Mail,Club,Priest's Pack", `the Cleric's kit chosen: ${chosen.items.map((entry) => entry.name)}`);
const acolyte = "A holy symbol (a gift to you when you entered the priesthood), a prayer book or prayer wheel, 5 sticks of incense, vestments, a set of common clothes, and a belt pouch containing 15 gp";
const bgKit = backgroundKit2014(acolyte, gear);
assert(bgKit.included.map((entry) => (entry.kind ? entry.kind : `${entry.count} ${entry.name}`)).join(",") === "holy symbol,1 Book,5 Incense (One Block),1 Clothes, Vestments,1 Clothes, Common,1 Pouch", `the Acolyte's kit: ${JSON.stringify(bgKit.included.map((entry) => entry.name ?? entry.kind))}`);
assert(backgroundKit2014("A belaying pin (club), 50 feet of silk rope, a trophy (a dagger, broken blade, or banner)", gear).included.map((entry) => `${entry.count} ${entry.name}`).join(",") === "1 Club,1 Rope, Silk (50 Feet)", "a bracket naming the thing kept, a story's alternatives not; 50 feet of rope is one rope");
const kitted = buildFromSpec(
  { name: "Kit", species: "Dwarf", ancestry: "Hill Dwarf", class: "Cleric", background: "", level: 1, scores: { strength: 10, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 15, charisma: 10 }, kitPicks: { class: picks } },
  { ...lib, items: gear },
).data;
const carried = Object.values(kitted.inventorylist).map((entry) => entry.name);
assert(["Shield", "Emblem", "Warhammer", "Chain Mail", "Club"].every((name) => carried.includes(name)), `built with its kit: ${carried}`);
done.push("2014 starting kits read from the book: a class's equipment list (choices, a kind picked from the books' items) and a background's sentence, built onto the sheet");
// A campaign that made the book active under an older reader (no subrace records then) reads it again when it opens.
{
  const { createBookShelf } = require("../electron/books.cjs");
  const { createTableServer } = require("../electron/tableServer.cjs");
  const shelf = createBookShelf({ folder: dir });
  const table = createTableServer({ books: shelf, ruleset: "D&D 5E" });
  await table.agent.activateBook("Test Legacy");
  const subraces = (server) => server.agent.records.list({ type: "race_subrace" }).length;
  assert(subraces(table) === 2, `made active: its subraces: ${subraces(table)}`);
  const saved = JSON.parse(JSON.stringify(table.persisted()));
  const id = Object.keys(saved.books.readWith)[0];
  assert(id, "the reader each book was read with is kept with the campaign");
  saved.books.readWith[id] = "an older reader";
  const records = saved.records?.records ?? saved.records;
  if (Array.isArray(records)) saved.records.records ? (saved.records.records = records.filter((record) => record.type !== "race_subrace")) : (saved.records = records.filter((record) => record.type !== "race_subrace"));
  else for (const [key, record] of Object.entries(records)) if (record.type === "race_subrace") delete records[key];
  const before = createTableServer({ books: shelf, ruleset: "D&D 5E", saved });
  assert(subraces(before) === 0, "saved without them");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert(subraces(before) === 2, `reopened, read again by this reader: ${subraces(before)}`);
  assert(before.persisted().books.readWith[id] !== "an older reader", "and stamped with it");
  // A player rolls a table of a book shared with them by its name (the wizard's ideals), never of a book kept the GM's.
  const content = require("../electron/content.cjs");
  const player = { seat: { role: "player", name: "Tess" }, from: "Tess" };
  const roll = (ctx) => content.message(table.agent, { type: "table-roll", action: "roll", name: "Test Acolyte Ideal" }, ctx);
  await table.agent.shareBook("Test Legacy", false);
  assert(await roll(player).then(() => false, () => true), "a GM's book's table is not the player's to roll");
  assert((await roll({ seat: { role: "dm", name: "GM" }, from: "GM" })).result === "Faith in the old ways.", "the GM rolls it");
  await table.agent.shareBook("Test Legacy", true);
  assert((await roll(player)).result === "Faith in the old ways.", "shared, the player rolls it by name");
  // Not shared, but named by a background the player sees (the wizard's Roll beside a 2014 background's ideals): rolled.
  await table.agent.shareBook("Test Legacy", false);
  const named = table.agent.records.list().find((record) => record.type === "background" && String(record.data?.supportingtables ?? "").includes("Test Acolyte Ideal"));
  const background = named ?? table.agent.records.create({ type: "background", name: "Test Acolyte", visibility: "all", data: { supportingtables: "Test Acolyte Ideal" } }, table.agent.seat);
  assert(table.agent.records.list({ seat: player.seat }).some((record) => record.id === background.id), "the background is the player's to see");
  assert((await roll(player)).result === "Faith in the old ways.", "a table its background names: the player rolls it, the book not shared");
  done.push("a player rolls a table of a book shared with them by name (the wizard's ideals), not a GM's book's, unless a background they see names it");
  await table.stop?.();
  await before.stop?.();
  done.push("a campaign whose books an older reader read gets them read again when it opens");
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`ok legacy 5e books: ${done.join("; ")}`);
process.exit(0);
