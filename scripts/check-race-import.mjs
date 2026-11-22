// FG's race import, for 5E: a race pasted as text becomes a race record (and its subraces), as the books keep them.
//  - a 2014-layout race (Ability Score Increase, Size and Speed traits, two subraces by "<Word> <Race>") and a
//    2024 one (Creature Type, Size and Speed lines, lineages by their "<Name> Traits" header, one of one word)
//  - every race of the SRD 5.2.1 Player's Rules written back out as text (its subraces after it) and read again:
//    the same type, size, speed, traits and subraces with their traits
//  - imported: the race's text links its subraces; the builder's ability adjustments read it; the GM alone
//    imports; a game without a race reader says so
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseRace, isTraitHeading } from "../shared/dnd5e/raceblock.mjs";
import { abilityAdjustments } from "../shared/dnd5e/rules.mjs";
import { plainOf } from "../shared/text/formatted.mjs";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const content = require("../electron/content.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
// Our own wording, in the two books' layouts.
const MARSHFOLK = `Marshfolk
Marshfolk live in the reed country, where the water is shallow and the mist is thick.
They are slow to trust strangers.
Marshfolk Traits
Your marshfolk character has these traits.
Ability Score Increase. Your Constitution score increases by 2.
Size. Marshfolk stand between 5 and 6 feet tall. Your size is Medium.
Speed. Your base walking speed is 25 feet.
Hold Breath. You can hold your breath for up to 15 minutes.
You have Advantage on checks to swim.
Reed Sight. You can see through mist as if it were clear air.
Fen Marshfolk
Fen marshfolk keep to the deep water.
Ability Score Increase. Your Wisdom score increases by 1.
Mud Step. Difficult terrain made of mud costs you no extra movement.
River Marshfolk
Ability Score Increase. Your Dexterity score increases by 1.
Quick Paddle. You have a Swim Speed equal to your Speed.`;
const STARBORN = `Starborn
The starborn fell from the night sky long ago and still hear its music.
Creature Type: Humanoid
Size: Medium (about 5-6 feet tall) or Small (about 3-4 feet tall), chosen when you select this race
Speed: 30 feet
As a Starborn, you have these special traits.
Starborn Traits
Darkvision. You have Darkvision with a range of 60 feet.
Starlit Lineage. Choose a lineage from those below.
You gain its level 1 benefit.
Comet Starborn Traits
Comet Lineage. Your Speed increases by 5 feet.
Nova Traits
Nova Lineage. You know the Light cantrip.`;

// 1. The samples.
const marsh = parseRace(MARSHFOLK);
const m = marsh.data;
assert(marsh.name === "Marshfolk" && !marsh.problems.length && m.version === "2014" && m.size === "Medium" && m.speed === "25 feet" && m.abilityadjust === "Con +2", `the 2014 race: ${JSON.stringify({ ...m, traits: undefined })}`);
assert(Object.values(m.traits).map((row) => row.name).join("|") === "Ability Score Increase|Size|Speed|Hold Breath|Reed Sight" && /Advantage on checks to swim/.test(m.traits["id-00004"].text) && /reed country/.test(m.text) && /these traits\./.test(m.text), `its traits: ${JSON.stringify(m.traits)}`);
assert(marsh.subraces.map((sub) => `${sub.name}:${sub.data.race}:${sub.data.abilityadjust}:${Object.values(sub.data.traits).map((row) => row.name).join("+")}`).join("|") === "Fen Marshfolk:Marshfolk:Wis +1:Ability Score Increase+Mud Step|River Marshfolk:Marshfolk:Dex +1:Ability Score Increase+Quick Paddle", `its subraces: ${JSON.stringify(marsh.subraces)}`);
const star = parseRace(STARBORN);
const s = star.data;
assert(s.version === "2024" && s.type === "Humanoid" && /^Medium \(about 5-6 feet tall\) or Small/.test(s.size) && s.speed === "30 feet" && /<b>Creature Type:<\/b> Humanoid/.test(s.text), `the 2024 race: ${JSON.stringify({ ...s, traits: undefined })}`);
assert(Object.values(s.traits).map((row) => row.name).join("|") === "Darkvision|Starlit Lineage" && /level 1 benefit/.test(s.traits["id-00002"].text) && star.subraces.map((sub) => sub.name).join() === "Comet Starborn,Nova", `its traits and lineages: ${JSON.stringify([s.traits, star.subraces.map((sub) => sub.name)])}`);
assert(!isTraitHeading("You have Darkvision.") && isTraitHeading("Gift of the Ancients.") && isTraitHeading("Darkvision."), "a sentence is not a heading");
done.push("a 2014 race and a 2024 one, with subraces");

// 2. The SRD's races written back out and read again.
const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const agent = server.agent;
try {
  importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Player's Rules"));
  const lines = (html) => String(html ?? "").split(/<\/p>|<br\s*\/?>/i).map((line) => plainOf(line).replace(/\s+/g, " ").trim()).filter(Boolean);
  const traitLines = (traits) => Object.values(traits ?? {}).flatMap((row) => { const [first = "", ...rest] = lines(row.text); return [`${row.name}. ${first}`, ...rest]; });
  const races = agent.records.list({ type: "race" });
  const subs = agent.records.list({ type: "race_subrace" });
  const misses = [];
  for (const race of races) {
    const x = race.data;
    const mine = subs.filter((sub) => sub.data.race === race.name);
    const text = [
      race.name,
      "A people of the world.",
      `Creature Type: ${x.type}`,
      `Size: ${x.size}`,
      `Speed: ${x.speed}`,
      `${race.name} Traits`,
      ...traitLines(x.traits),
      ...mine.flatMap((sub) => [`${sub.name} Traits`, ...traitLines(sub.data.traits)]),
    ].join("\n");
    const back = parseRace(text);
    const names = (traits) => Object.values(traits ?? {}).map((row) => row.name).join("|");
    const wrong = [];
    if (back.data.type !== x.type || back.data.size !== x.size || back.data.speed !== x.speed) wrong.push("fields");
    if (names(back.data.traits) !== names(x.traits)) wrong.push(`traits ${names(back.data.traits)} vs ${names(x.traits)}`);
    if (back.subraces.map((sub) => sub.name).join() !== mine.map((sub) => sub.name).join()) wrong.push(`subraces ${back.subraces.map((sub) => sub.name)} vs ${mine.map((sub) => sub.name)}`);
    back.subraces.forEach((sub, i) => mine[i] && names(sub.data.traits) !== names(mine[i].data.traits) && wrong.push(`${sub.name}'s traits`));
    if (back.problems.length) wrong.push(back.problems.join(" "));
    if (wrong.length) misses.push(`${race.name}: ${wrong.join("; ")}`);
  }
  assert(races.length === 9 && subs.length === 16, `the book's races: ${races.length}, ${subs.length}`);
  assert(!misses.length, `${misses.length} read back differently:\n${misses.join("\n")}`);
  done.push(`all ${races.length} SRD races and ${subs.length} subraces read back`);

  // 3. Imported.
  const made = JSON.parse((await callTool("kraken_race_import", { text: MARSHFOLK }, { table: () => server })).content[0].text);
  const record = agent.records.get(made.id);
  assert(record.type === "race" && record.visibility === "gm" && made.subraces.length === 2 && made.subraces.every((sub) => agent.records.get(sub.id)?.type === "race_subrace"), `a race and its subraces: ${JSON.stringify(made).slice(0, 300)}`);
  assert(made.subraces.every((sub) => record.data.text.includes(encodeURIComponent(JSON.stringify({ kind: "record", record: sub.id, label: sub.name })))), `its text links its subraces: ${record.data.text}`);
  assert(abilityAdjustments(record).constitution === 2 && abilityAdjustments(agent.records.get(made.subraces[0].id)).wisdom === 1, "the builder reads its ability increases");
  let refused = "";
  try {
    await content.message(agent, { type: "race-import", text: MARSHFOLK }, { seat: { role: "player", name: "Ann" } });
  } catch (error) {
    refused = String(error);
  }
  assert(/GM's/.test(refused), "a player may not import");
  let none = "";
  try {
    await content.raceImport({ ...agent, ruleset: () => "Castles & Crusades" }, { text: MARSHFOLK });
  } catch (error) {
    none = String(error);
  }
  assert(/no race import/.test(none), `C&C has none: ${none}`);
  done.push("imported with its subraces linked, read by the builder; the GM's alone, only where the game reads races");
} finally {
  await server.stop?.();
}
console.log(`ok race import: ${done.join("; ")}`);
process.exit(0);
