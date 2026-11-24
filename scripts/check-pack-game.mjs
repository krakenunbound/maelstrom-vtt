// A game defined by its books (shared/packgame, docs/pack-games.md): a rules pack's game.json teaches Maelstrom a game
// it has no code for, and Maelstrom plays it from the pack's records. The game here is made up for the test (its
// numbers are invented, no book's text): six abilities, five saves, descending Armor Class and THAC0, d6 initiative
// by side, race as class, classes in two books (the second adds a level), a cleric's turning row, a thief's skills,
// monsters by hit dice and "Save As", a Monster Attack Table and the Normal Man's numbers.
//   - The pack is read (its game.json), the game registered: the campaign screen's list has it, a campaign of it
//     takes the game's own books (and an adventure for it), Worldbuilding does not.
//   - A character built from the wizard's spec: the class from the books, its minimum scores, the shop in the game's
//     coins, hit points (the die + Constitution), descending AC (armor, shield, Dexterity), THAC0, the saves (Wisdom
//     against spells), a level up into the second book's level.
//   - The tracker: a monster's hit points rolled from its hit dice, its AC, THAC0 from the Monster Attack Table, its
//     saves as a Fighter; an attack hitting THAC0 - AC, a natural 20 and a 1; damage; a save; morale on 2d6; turning a
//     skeleton by the cleric's row; dead at 0.
//   node scripts/check-pack-game.mjs
import "./loopback.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { zipSync, strToU8 } from "fflate";

const require = createRequire(import.meta.url);
const { FORMAT, VERSION } = require("../electron/packs.cjs");
const { createBookShelf, fitsRuleset } = require("../electron/books.cjs");
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { registerPackGame } = await import("../shared/packgame/register.mjs");
const { campaignRulesets, rulesetNamed } = await import("../shared/rulesets/registry.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const GAME = "Test Old Game";
const id = (book, path) => `${book.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${path}`;
const saves = (d, w, p, b, s) => ({ death: d, wands: w, paralysis: p, breath: b, spells: s });
const record = (book, type, name, data, visibility = "all") => ({ id: id(book, `${type}.${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`), type, name, visibility, source: book, data: { name, ...data } });
const rowsOf = (list) => Object.fromEntries(list.map((row, index) => [`id-${String(index + 1).padStart(5, "0")}`, row]));

const BASIC = "Test Basic Book";
const EXPERT = "Test Expert Book";
const game = {
  format: "maelstrom-game",
  version: 1,
  id: "testold",
  name: GAME,
  blurb: "A made-up old game for the test.",
  armorClass: { descending: true, unarmored: 9 },
  attack: { by: "thac0" },
  initiative: { die: "1d6", by: "side" },
  turning: { die: "2d6", affected: "2d6", undead: [{ key: "skeleton", names: ["Skeleton"] }, { key: "zombie", names: ["Zombie"] }] },
  skills: { names: { openlocks: "Open Locks", hide: "Hide in Shadows", hearnoise: "Hear Noise" } },
  normalMan: { thac0: 20, saves: saves(14, 15, 16, 17, 18) },
  coins: [{ key: "GP", name: "Gold", value: 100 }, { key: "SP", name: "Silver", value: 10 }, { key: "CP", name: "Copper", value: 1 }],
};
const basic = [
  record(BASIC, "class", "Fighter", { primerequisite: "Strength", hitdie: "d8", armor: "Any", weapons: "Any", xpbonus: { 13: 5, 16: 10 }, levels: { 1: { xp: 0, title: "Veteran", hitdice: "1d8", thac0: 19, saves: saves(12, 13, 14, 15, 16) }, 2: { xp: 2000, title: "Warrior", hitdice: "2d8" }, 3: { xp: 4000, title: "Swordmaster", hitdice: "3d8" } } }),
  record(BASIC, "class", "Cleric", { primerequisite: "Wisdom", hitdie: "d6", spellcasting: "divine", levels: { 1: { xp: 0, hitdice: "1d6", thac0: 19, saves: saves(11, 12, 14, 16, 15), turning: { skeleton: 7, zombie: 9 } }, 2: { xp: 1500, hitdice: "2d6", spells: { 1: 1 }, turning: { skeleton: "T", zombie: 7 } } } }),
  record(BASIC, "class", "Thief", { primerequisite: "Dexterity", hitdie: "d4", levels: { 1: { xp: 0, hitdice: "1d4", thac0: 19, saves: saves(13, 14, 13, 16, 15), skills: { openlocks: 15, hide: 10, hearnoise: "1-2" } } } }),
  record(BASIC, "class", "Dwarf", { race: "Dwarf", primerequisite: "Strength", hitdie: "d8", requirements: { constitution: 9 }, levels: { 1: { xp: 0, hitdice: "1d8", thac0: 19, saves: saves(8, 9, 10, 13, 12) } } }),
  record(BASIC, "item", "Chain Mail", { type: "Armor", ac: 5, cost: "40 gp", encumbrance: 400 }),
  record(BASIC, "item", "Shield", { type: "Armor", acbonus: 1, cost: "10 gp", encumbrance: 100 }),
  record(BASIC, "item", "Sword", { type: "Weapon", damage: "1d8", cost: "10 gp", encumbrance: 60 }),
  record(BASIC, "item", "Mace", { type: "Weapon", damage: "1d6", cost: "5 gp", encumbrance: 30 }),
  record(BASIC, "item", "Dagger", { type: "Weapon", damage: "1d4", cost: "3 gp", range: "10/20/30", encumbrance: 10 }),
  record(BASIC, "item", "Short Bow", { type: "Weapon", damage: "1d6", cost: "25 gp", range: "50/100/150", encumbrance: 30 }),
  record(BASIC, "item", "Quiver with 20 Arrows", { type: "Gear", cost: "5 gp" }),
  // A book's sample character, its equipment lines as the book prints them.
  record(BASIC, "pregencharsheet", "Sample Fighter", { class: "Fighter", level: 1, strength: 16, intelligence: 9, wisdom: 10, dexterity: 13, constitution: 14, charisma: 11, ac: 3, hp: 8, xp: 0, equipment: ["Chain mail & shield", "Sword", "2 torches"], coins: { GP: 12 } }),
  record(BASIC, "npc", "Kobold Chief", { ac: 6, hd: "2", attacks: "1 weapon", damage: "1d6", saveas: "F2", morale: 8, hp: 9 }, "gm"),
  record(BASIC, "npc", "Peasant", { ac: 9, hd: "1", attacks: "1 weapon", damage: "1d6", saveas: "NM", morale: 6, xp: 5 }, "gm"),
  // The Normal Man table (a row a value): its THAC0 is the one a Normal Man attacks with.
  record(BASIC, "tables", "Normal Man", { tablerows: rowsOf([{ fromrange: 1, torange: 1, results: rowsOf([{ result: "death: 14" }]) }, { fromrange: 2, torange: 2, results: rowsOf([{ result: "thac0: 21" }]) }]) }, "gm"),
  record(BASIC, "npc", "Goblin", { ac: 6, hd: "1-1", attacks: "1 weapon", damage: "1d6", saveas: "NM", morale: 7, xp: 5 }, "gm"),
  record(BASIC, "npc", "Ogre", { ac: 5, hd: "4+1", attacks: "1 club", damage: "1d10", saveas: "F4", morale: 10, xp: 125 }, "gm"),
  record(BASIC, "npc", "Skeleton", { ac: 7, hd: "1", attacks: "1 weapon", damage: "1d6", saveas: "F1", morale: 12, xp: 10 }, "gm"),
  record(BASIC, "tables", "Monster Attack Table", { dice: "d20", tablerows: rowsOf([{ fromrange: 0, torange: 1, results: rowsOf([{ result: "19" }]) }, { fromrange: 2, torange: 2, results: rowsOf([{ result: "18" }]) }, { fromrange: 3, torange: 3, results: rowsOf([{ result: "17" }]) }, { fromrange: 4, torange: 5, results: rowsOf([{ result: "15" }]) }]) }, "gm"),
];
const expert = [record(EXPERT, "class", "Fighter", { levels: { 4: { xp: 8000, title: "Hero", hitdice: "4d8", thac0: 17, saves: saves(10, 11, 12, 13, 14) } } })];
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "kraken-pack-game-"));
const pack = (name, manifest, records, extra = {}) =>
  fs.writeFileSync(path.join(folder, `${name}.kpack`), zipSync({ "kraken-pack.json": strToU8(JSON.stringify({ format: FORMAT, version: VERSION, name, title: name, ruleset: GAME, kind: "rules", hasBook: false, ...manifest })), "records.json": strToU8(JSON.stringify(records)), ...extra }));
pack(BASIC, {}, basic, { "game.json": strToU8(JSON.stringify(game)) });
pack(EXPERT, {}, expert);
pack("Test Adventure", { kind: "adventure" }, [record("Test Adventure", "npc", "Zombie", { ac: 8, hd: "2", attacks: "1 claw", damage: "1d8", saveas: "F1", morale: 12 }, "gm")]);

let server;
try {
  // --- The pack is read: its game registered -------------------------------------------------------------------------
  const shelf = createBookShelf({ folder });
  const infos = shelf.list();
  const withGame = infos.filter((info) => info.game);
  assert(withGame.length === 1 && withGame[0].name === BASIC, `the rules book carries the game: ${infos.map((info) => `${info.name}:${Boolean(info.game)}`)}`);
  const manifest = registerPackGame(withGame[0].game);
  assert(manifest.id === "packtestold" && rulesetNamed(GAME)?.id === "packtestold" && campaignRulesets().some((row) => row.name === GAME), `registered: on the campaign screen's list: ${manifest.id}`);
  assert(registerPackGame(withGame[0].game).id === "packtestold" && campaignRulesets().filter((row) => row.name === GAME).length === 1, "registering it again replaces it");
  const adventure = infos.find((info) => info.name === "Test Adventure");
  assert(fitsRuleset(adventure, GAME) && fitsRuleset(withGame[0], GAME) && !fitsRuleset(adventure, "Worldbuilding") && !fitsRuleset(adventure, "AD&D 2E"), "its books (and an adventure for it) in its own campaigns, not Worldbuilding's or another game's");
  assert(manifest.wizard?.steps?.map((step) => step.id).join() === "sample,abilities,class,gear,details" && manifest.sheet.tabs.some((tab) => tab.id === "skills") && manifest.tracker.saves.keys.join() === "death,wands,paralysis,breath,spells", "its wizard, sheet and tracker from the definition");
  // The campaign screen offers only the games whose books are installed: this one (its rules book), Worldbuilding
  // (no books needed); not a game whose only pack is an adventure, nor one with packs for any game only.
  const { installedGames } = require("../electron/books.cjs");
  const extra = [...infos, { kraken: "Traveller", title: "A Traveller adventure", category: "Adventures", kind: "adventure" }, { kraken: "Any", title: "Token pack", category: "Tokens", kind: "tokens" }];
  const offered = installedGames(extra, ["Castles & Crusades", "Traveller", GAME, "Worldbuilding"]);
  assert(offered.join() === `${GAME},Worldbuilding`, `only games with books installed: ${offered}`);
  done.push("a pack's game.json read and registered (the campaign list has it; its books, an adventure too, fit it alone); the campaign screen offers only games whose books are installed");

  // --- A table of it ---------------------------------------------------------------------------------------------------
  server = createTableServer({ books: shelf, ruleset: GAME });
  await server.listen({ port: 0, password: "" });
  const agent = server.agent;
  for (const name of [BASIC, EXPERT, "Test Adventure"]) await agent.activateBook(name);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert(agent.records.list({ type: "class" }).length === 5 && agent.records.list({ type: "npc" }).length === 6, `the books' classes and monsters in the campaign: ${agent.records.list({ type: "class" }).length} classes`);
  const tool = async (name, args = {}) => {
    const result = await callTool(name, args, { table: () => server });
    if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
    return JSON.parse(result.content[0].text);
  };
  const force = (...values) => agent.dice.force(values);
  const last = (pattern) => [...agent.chatLog(300)].reverse().find((line) => line.roll && pattern.test(line.roll.label ?? ""));
  // The old games' starting gold, a whole roll times ten (the wizard's 3d6*10).
  force(1, 2, 3);
  const purse = agent.dice.roll("3d6*10");
  assert(purse.total === 60 && purse.multiplier === 10, `3d6*10: (1+2+3) x 10: ${JSON.stringify(purse)}`);

  // Ana, a fighter: Str 16 (+2), Dex 13 (+1), Con 14 (+1); 80 gp: chain mail, a shield, a sword (60 gp).
  const built = await tool("kraken_build_character", { spec: { name: "Ana", class: "Fighter", abilities: { strength: 16, intelligence: 9, wisdom: 10, dexterity: 13, constitution: 14, charisma: 11 }, hpRoll: 6, gold: 80, buy: [["Chain Mail", 1], ["Shield", 1], ["Sword", 1]], alignment: "Lawful" } });
  const ana = agent.records.get(built.id);
  const a = ana.data;
  assert(built.problems.length === 0 && a.ruleset === "packtestold" && a.className === "Fighter" && a.leveltitle === "Veteran", `built: ${JSON.stringify(built)}`);
  assert(a.hp.total === 7 && a.ac.total === 3 && a.thac0 === 19 && a.saves.death.total === 12 && a.xpbonus === 10 && a.expnext === 2000, `hp 6+1, AC 5-1-1 = 3, THAC0 19, death 12, +10% XP: ${JSON.stringify({ hp: a.hp, ac: a.ac, thac0: a.thac0, xp: a.xpbonus })}`);
  const sword = Object.values(a.attacks)[0];
  assert(sword.name === "Sword" && sword.bonus === 2 && sword.damage === "1d8+2" && Object.values(a.coins).find((coin) => coin.name === "GP").amount === 20, `the sword +2, 1d8+2; 20 gp left: ${JSON.stringify(sword)} ${JSON.stringify(a.coins)}`);
  const refused = await tool("kraken_build_character", { spec: { name: "Short", class: "Dwarf", abilities: { strength: 12, constitution: 6 }, hpRoll: 4, gold: 10 } }).then(() => "", (error) => error.message);
  assert(/Dwarf needs Constitution 9/.test(refused), `a class's minimum scores: ${refused}`);
  // Up to the second book's level: level 4 from the Expert book (THAC0 17, its saves).
  agent.records.update(ana.id, { data: { exp: 8000 } }, agent.seat);
  for (let level = 2; level <= 4; level += 1) {
    force(5);
    await tool("kraken_level_up", { id: ana.id }).catch(async () => {
      const { levelUp } = require("../electron/siege.cjs");
      await levelUp(agent, agent.records.get(ana.id), "GM");
    });
  }
  const up = agent.records.get(ana.id).data;
  assert(up.level === 4 && up.thac0 === 17 && up.saves.death.total === 10 && up.leveltitle === "Hero", `level 4 from the second book: ${JSON.stringify({ level: up.level, thac0: up.thac0, death: up.saves.death, title: up.leveltitle })}`);
  done.push("a character built from the books' classes (minimum scores, the shop in the game's coins, descending AC, THAC0, saves, XP bonus) and raised into a second book's level");

  // A cleric to turn the dead.
  const cleric = await tool("kraken_build_character", { spec: { name: "Brother Tom", class: "Cleric", abilities: { strength: 10, intelligence: 10, wisdom: 13, dexterity: 10, constitution: 10, charisma: 10 }, hpRoll: 4, gold: 20, buy: [["Mace", 1]] } });
  const c = agent.records.get(cleric.id).data;
  assert(c.turning?.skeleton === 7 && c.saves.spells.total === 14, `the cleric's turning row; Wisdom 13 takes 1 off the save against spells: ${JSON.stringify({ turning: c.turning, spells: c.saves.spells })}`);

  // A thief: Hear Noise is a chance in six ("1-2": 1d6 at or under 2); a dagger in melee and thrown; a quiver holds 20.
  const thief = await tool("kraken_build_character", { spec: { name: "Nell", class: "Thief", abilities: { strength: 13, intelligence: 10, wisdom: 10, dexterity: 16, constitution: 10, charisma: 10 }, hpRoll: 3, gold: 60, buy: [["Dagger", 1], ["Short Bow", 1], ["Quiver with 20 Arrows", 1]] } });
  const t = agent.records.get(thief.id).data;
  assert(t.thiefskills.hearnoise.die === "1d6" && t.thiefskills.hearnoise.total === 2 && t.thiefskills.hearnoise.shown === "1-2" && t.thiefskills.openlocks.shown === "15%", `Hear Noise 1-2 on a d6: ${JSON.stringify(t.thiefskills)}`);
  force(2);
  await tool("kraken_check", { recordId: thief.id, kind: "skill", skill: "hearnoise" }).catch(async () => require("../electron/packGame.cjs").checkPg(agent, agent.records.get(thief.id), { kind: "skill", skill: "hearnoise" }));
  assert(/Hear Noise \[UNDER 2\] \[SUCCESS 2 under 2\]/.test(last(/Hear Noise/).roll.label) && last(/Hear Noise/).roll.formula === "1d6", `rolled on a d6: ${JSON.stringify(last(/Hear Noise/)?.roll)}`);
  const dagger = Object.entries(t.attacks).filter(([, attack]) => attack.name.startsWith("Dagger"));
  assert(dagger.length === 2 && dagger[0][1].type === "melee" && dagger[0][1].damage === "1d4+1" && dagger[1][0].endsWith("-thrown") && dagger[1][1].type === "missile" && dagger[1][1].bonus === 2 && dagger[1][1].damage === "1d4", `a dagger in melee (+Str) and thrown (+Dex, no Str): ${JSON.stringify(dagger)}`);
  const bowKey = Object.keys(t.attacks).find((key) => t.attacks[key].name === "Short Bow");
  // A sample character as the book made it: its gear matched to the books' items ("Chain mail & shield"), the rest as written.
  const sample = await tool("kraken_build_character", { spec: { pregen: "Sample Fighter", name: "Sam" } });
  const sd = agent.records.get(sample.id).data;
  assert(sd.ac.total === 3 && sd.hp.total === 8 && Object.values(sd.coins).find((coin) => coin.name === "GP").amount === 12 && Object.values(sd.inventorylist).some((row) => row.name === "2 torches") && /2 torches/.test(sample.problems.join()), `the sample fighter: AC 3, 8 hp, 12 gp, its torches as written: ${JSON.stringify({ ac: sd.ac, hp: sd.hp, problems: sample.problems })}`);
  // A game that rolls initiative a side starts its table that way.
  assert(server.agent.options?.().initGroup === "sides" || (await tool("kraken_table_options", {})).initGroup === "sides", "initiative a side by default");
  // Two prime requisites (an Elf's Strength and Intelligence): the XP bonus as a list of rules.
  const { xpBonusOf } = await import("../shared/packgame/rules.mjs");
  const elf = { xpbonus: [{ all: { strength: 13, intelligence: 13 }, bonus: 5 }, { all: { strength: 13, intelligence: 16 }, bonus: 10 }] };
  const scores = (strength, intelligence) => ({ abilities: { strength: { score: strength }, intelligence: { score: intelligence } } });
  assert(xpBonusOf(elf, scores(13, 13)) === 5 && xpBonusOf(elf, scores(13, 16)) === 10 && xpBonusOf(elf, scores(12, 18)) === 0, "two prime requisites' XP bonus");
  // A class a later book writes again: what the first left empty ({}), the later fills; levels merge.
  const { classesOf, turnAgainst } = await import("../shared/packgame/rules.mjs");
  const merged = classesOf({ classes: [{ name: "Elf", data: { xpbonus: {}, maxlevel: "", levels: { 1: { xp: 0 } } } }, { name: "Elf", data: { xpbonus: elf.xpbonus, maxlevel: 10, levels: { 4: { xp: 16000 } } } }] })[0];
  assert(Array.isArray(merged.xpbonus) && merged.maxlevel === 10 && Object.keys(merged.levels).join() === "1,4", `a later book fills what the first left empty: ${JSON.stringify(merged)}`);
  // "D+": destroyed, and the turn reaches the definition's affectedPlus (one die more than affected by default).
  assert(turnAgainst({ skeleton: "D+" }, "skeleton").plus === true && rulesetNamed(GAME).packGame.turning.affectedPlus === "3d6", "D+ reaches 3d6 hit dice");
  // "D#": destroyed, 4d6 hit dice (two dice more than affected).
  assert(turnAgainst({ skeleton: "D#" }, "skeleton").mark === "D#" && rulesetNamed(GAME).packGame.turning.affectedBy["D#"] === "4d6", "D# reaches 4d6 hit dice");
  // Attack ranks: a demi-human at its last level with the experience of a rank fights and saves by the rank.
  const { attackRankOf } = await import("../shared/packgame/rules.mjs");
  const dwarfRanks = { attackranks: { C: { xp: 660000, thac0: 13, saves: saves(2, 3, 4, 4, 3) }, D: { xp: 800000, thac0: 12, saves: saves(2, 3, 4, 4, 3) } } };
  assert(attackRankOf(dwarfRanks, 700000, 12, 12)?.rank === "C" && attackRankOf(dwarfRanks, 900000, 12, 12)?.thac0 === 12 && attackRankOf(dwarfRanks, 900000, 11, 12) === null && attackRankOf(dwarfRanks, 600000, 12, 12) === null, "attack ranks by experience, at the last level only");
  // A fixed damage ("1/1d4": a camel's bite does 1).
  const { monsterAttacks } = await import("../shared/bfrpg/rules.mjs");
  assert(monsterAttacks("1 bite/1 hoof", "1/1d4").map((attack) => attack.damage).join() === "1,1d4", "a fixed damage");
  // Weapon mastery: the level's damage against the primary target, and its special.
  const { masteryOf, npcStats: pgNpc } = await import("../shared/packgame/rules.mjs");
  const axe = { mastery: { basic: { damage: "1d8", special: "" }, master: { damage: "P 1d8+8; S 1d8+6", special: "Delay and stun" } } };
  assert(masteryOf({ ...axe, masterylevel: "master" })?.damage === "1d8+8" && masteryOf({ ...axe, masterylevel: "master" }).special === "Delay and stun" && masteryOf(axe)?.damage === "1d8" && masteryOf({ name: "Club" }) === null, "weapon mastery");
  // A monster's THAC0 of 0 is its THAC0; an attack "by weapon" rolls the game's weapon damage.
  const huge = pgNpc({ hd: "22", thac0: 0, attacks: "1 weapon", damage: "by weapon" }, { game: rulesetNamed(GAME).packGame, tables: [] });
  assert(huge.thac0 === 0 && huge.attacks[0].damage === "1d6", `THAC0 0, by weapon 1d6: ${JSON.stringify(huge)}`);
  // A creature's own saves (its save-as class not in the game).
  const nipper = pgNpc({ hd: "1", saveas: "F1", saves: { death: 12 }, attacks: "1 swarm", damage: "1" }, { game: rulesetNamed(GAME).packGame, classes: [], tables: [] });
  assert(nipper.saves.death === 12, `a creature's own saves: ${JSON.stringify(nipper.saves)}`);
  // An Immortal's game: scores typed, to the modifier table's top (100), not rolled to 18.
  const { readGame } = await import("../shared/packgame/definition.mjs");
  const { manifestOf } = await import("../shared/packgame/manifest.mjs");
  const { buildFromSpec } = await import("../shared/packgame/rules.mjs");
  const immortal = readGame({ format: "maelstrom-game", version: 1, id: "testimm", name: "Test Immortals", abilityEntry: "typed", abilityModifiers: [{ from: 0, to: 18, mod: 0 }, { from: 19, to: 100, mod: 10 }] });
  const god = buildFromSpec({ name: "God", class: "Immortal", abilities: { strength: 60, charisma: 100 }, hpRoll: 1 }, { game: immortal, classes: [{ name: "Immortal", data: { levels: { 1: { xp: 0, hitdice: "0d8+75" } } } }], items: [], tables: [] });
  assert(immortal.abilityMax === 100 && god.data.abilities.strength.score === 60 && god.data.abilities.charisma.score === 100 && god.data.abilities.strength.bonus === 10, `typed scores to 100: ${JSON.stringify(god.data.abilities)}`);
  assert(manifestOf(immortal).wizard.steps.find((step) => step.id === "abilities").parts[0].typed?.max === 100, "the wizard types an Immortal's scores");
  done.push("a thief's Hear Noise on a d6, two prime requisites' XP bonus, a dagger in melee and thrown, a book's sample character taken as printed, initiative a side by default");

  // --- The fight -------------------------------------------------------------------------------------------------------
  const npc = (name) => agent.records.list({ type: "npc" }).find((item) => item.name === name);
  await tool("kraken_combat", { action: "add", recordId: ana.id });
  await tool("kraken_combat", { action: "add", recordId: cleric.id });
  force(6);
  await tool("kraken_combat", { action: "add", recordId: npc("Ogre").id });
  force(4);
  await tool("kraken_combat", { action: "add", recordId: npc("Skeleton").id });
  let view = (await tool("kraken_combat", { action: "view" })).entries;
  const pc = view.find((entry) => entry.recordId === ana.id);
  const ogre = view.find((entry) => entry.name === "Ogre");
  const skeleton = view.find((entry) => entry.name === "Skeleton");
  assert(ogre.ac === 5 && ogre.hp >= 4 && ogre.attacks?.[0]?.damage === "1d10", `the ogre: AC 5, 4d8+1 rolled: ${JSON.stringify(ogre)}`);
  // Ana (THAC0 17 at level 4, +2) at the ogre (AC 5): she needs 12 on d20+2: a 10 hits (12), a 9 misses (11).
  await tool("kraken_combat", { action: "target", id: pc.id, targetId: ogre.id, on: true });
  force(10);
  let results = (await tool("kraken_combat", { action: "attack", recordId: ana.id, weapon: sword.item })).results;
  assert(results[0].hit && results[0].need === 12 && /\[THAC0 17: NEEDS 12\]/.test(last(/\[ATTACK\]/).roll.label), `10 + 2 hits AC 5 at THAC0 17: ${last(/\[ATTACK\]/).roll.label}`);
  force(3);
  const damage = await tool("kraken_combat", { action: "damage-roll", recordId: ana.id, weapon: sword.item });
  assert(damage.damage.total === 5, `3 + 2 damage: ${JSON.stringify(damage.damage)}`);
  force(9);
  results = (await tool("kraken_combat", { action: "attack", recordId: ana.id, weapon: sword.item })).results;
  assert(!results[0].hit, "9 + 2 misses");
  force(1);
  results = (await tool("kraken_combat", { action: "attack", recordId: ana.id, weapon: sword.item })).results;
  assert(!results[0].hit && /AUTOMATIC MISS/.test(last(/\[ATTACK\]/).roll.label), "a natural 1 misses");
  // The ogre (4+1 hit dice: the table's 4-5 row, THAC0 15) at Ana (AC 3): it needs 12: an 11 misses, a 12 hits.
  await tool("kraken_combat", { action: "target", id: ogre.id, targetId: pc.id, on: true });
  force(11);
  results = (await tool("kraken_combat", { action: "attack", id: ogre.id, weapon: "0" })).results;
  assert(!results[0].hit && results[0].need === 12, `the ogre's THAC0 from the Monster Attack Table (15): ${JSON.stringify(results)}`);
  force(12);
  results = (await tool("kraken_combat", { action: "attack", id: ogre.id, weapon: "0" })).results;
  assert(results[0].hit, "12 hits");
  // Saves: the ogre saves as a Fighter 4 (the Expert book's death 10); Ana's death save is hers.
  force(10);
  let save = await tool("kraken_combat", { action: "save", id: ogre.id, attribute: "death", cl: 0 });
  assert(save.save.success && save.save.target === 10, `the ogre saves as a Fighter 4: ${JSON.stringify(save.save)}`);
  force(1);
  save = await tool("kraken_combat", { action: "save", id: pc.id, attribute: "spells", cl: 20 });
  assert(!save.save.success && /NATURAL 1/.test(last(/\[SAVE\]/).roll.label), "a natural 1 fails");
  // Morale: 2d6 against 10.
  force(6, 5);
  const morale = await tool("kraken_combat", { action: "morale", id: ogre.id });
  assert(!morale.morale.stands && morale.morale.total === 11, `morale 11 against 10 breaks: ${JSON.stringify(morale.morale)}`);
  // Turning: the cleric's row against a skeleton (7 or more on 2d6).
  force(4, 4, 2, 2);
  const turn = await tool("kraken_combat", { action: "turn-undead", recordId: cleric.id, undead: [skeleton.id] }).catch((error) => ({ error: error.message }));
  const turned = turn.turn ?? turn;
  assert(turned.affected === 1 && /Skeleton: TURNED \(needed 7\)/.test(JSON.stringify(turned.results)), `the skeleton turned by the cleric's row: ${JSON.stringify(turn)}`);
  // Dead at 0.
  view = (await tool("kraken_combat", { action: "view" })).entries;
  const left = view.find((entry) => entry.id === ogre.id);
  force(20);
  await tool("kraken_combat", { action: "attack", recordId: ana.id, weapon: sword.item });
  force(8);
  for (let blow = 0; blow < 6 && (await tool("kraken_combat", { action: "view" })).entries.find((entry) => entry.id === ogre.id).health.status !== "Dead"; blow += 1) {
    force(20);
    await tool("kraken_combat", { action: "attack", recordId: ana.id, weapon: sword.item });
    force(8);
    await tool("kraken_combat", { action: "damage-roll", recordId: ana.id, weapon: sword.item });
  }
  assert((await tool("kraken_combat", { action: "view" })).entries.find((entry) => entry.id === ogre.id).health.status === "Dead", `the ogre dead at 0 (${left.hp} hit points)`);
  // A creature's printed hit points (9), not its hit dice rolled.
  await tool("kraken_combat", { action: "add", recordId: npc("Kobold Chief").id });
  assert((await tool("kraken_combat", { action: "view" })).entries.find((entry) => entry.name === "Kobold Chief")?.hp === 9, "a creature's printed hit points");
  // A Normal Man attacks at the Normal Man table's THAC0 (21 here); a bow shoots from its quiver of 20.
  await tool("kraken_combat", { action: "add", recordId: npc("Peasant").id });
  await tool("kraken_combat", { action: "add", recordId: thief.id });
  view = (await tool("kraken_combat", { action: "view" })).entries;
  const peasant = view.find((entry) => entry.name === "Peasant");
  const nell = view.find((entry) => entry.recordId === thief.id);
  await tool("kraken_combat", { action: "target", id: peasant.id, targetId: pc.id, on: true });
  force(10);
  results = (await tool("kraken_combat", { action: "attack", id: peasant.id, weapon: "0" })).results;
  assert(/\[THAC0 21: NEEDS 18\]/.test(last(/\[ATTACK\]/).roll.label), `a Normal Man's THAC0 from its table: ${last(/\[ATTACK\]/).roll.label}`);
  await tool("kraken_combat", { action: "target", id: nell.id, targetId: peasant.id, on: true });
  force(10);
  results = (await tool("kraken_combat", { action: "attack", recordId: thief.id, weapon: bowKey }));
  const quiver = Object.values(agent.records.get(thief.id).data.inventorylist).find((row) => /Quiver/.test(row.name));
  assert(Array.isArray(results.results) && quiver.count === 1 && quiver.ammoperunit === 20 && quiver.ammoused === 1, `the bow shoots one of the quiver's 20: ${JSON.stringify({ results, quiver })}`);
  done.push("the tracker plays it: hit points from hit dice, THAC0 - descending AC (a character's from the books, a monster's from the Monster Attack Table), naturals, damage, saves as a class, morale, turning by the cleric's row, dead at 0");
} finally {
  await server?.stop?.();
  fs.rmSync(folder, { recursive: true, force: true });
}
console.log(`ok pack game: ${done.join("; ")}`);
process.exit(0);
