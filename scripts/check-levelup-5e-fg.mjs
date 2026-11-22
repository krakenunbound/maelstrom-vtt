// FG's 5E level up through the wizard:
//  - the plan: the level's features, a subclass to choose (3rd), an Ability Score Improvement or a feat (4th)
//  - the level's features added; hit points fixed (half the die + 1) or rolled
//  - a subclass chosen: on the class, its features to this level; +2/+1+1 to scores (20 at most); a feat
//  - wrong choices refused (a subclass of another class, +3, a feat where none is given)
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { levelUpPlan } from "../shared/dnd5e/levelup.mjs";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const server = createTableServer({ ruleset: "D&D 5E" });
await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Player's Rules"));
const lib = { classes: agent.records.list({ type: "class" }), subclasses: agent.records.list({ type: "class_specialization" }), feats: agent.records.list({ type: "feat" }) };
const fails = (promise) => promise.then(() => "", (error) => error.message);
try {
  const built = await tool("kraken_build_character", { spec: { name: "Brand", species: "Human", class: "Fighter", level: 2, scores: { strength: 15, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 } } });
  const data = () => agent.records.get(built.id).data;

  // 1. Level 3: Fighter Subclass.
  const plan3 = levelUpPlan(data(), lib);
  assert(plan3.classLevel === 3 && plan3.features.some((feature) => feature.name === "Fighter Subclass") && plan3.subclasses?.includes("Champion") && !plan3.asi, `the 3rd level's plan: ${JSON.stringify(plan3)}`);
  assert(/not a Fighter subclass/.test(await fails(tool("kraken_level_up", { id: built.id, subclass: "Path of the Berserker" }))), "another class's subclass refused");
  const hp2 = data().hp.total;
  await tool("kraken_level_up", { id: built.id, hp: "average", subclass: "Champion" });
  const at3 = data();
  assert(at3.level === 3 && at3.hp.total === hp2 + 6 + 2, `fixed hit points (d10: 6, CON +2): ${hp2} -> ${at3.hp.total}`);
  assert(at3.packages["id-00001"].subclass === "Champion" && at3.subclass === "Champion", `the subclass on the class: ${JSON.stringify(at3.packages)}`);
  assert(at3.features.includes("Fighter Subclass (Fighter 3)") && at3.features.some((line) => /\(Champion 3\)/.test(line)), `the features: ${JSON.stringify(at3.features)}`);
  done.push("level 3: the subclass chosen, its features, fixed hit points");

  // 2. Level 4: Ability Score Improvement.
  const plan4 = levelUpPlan(at3, lib);
  assert(plan4.asi && !plan4.subclasses, `the 4th level's plan: ${JSON.stringify(plan4)}`);
  assert(/\+2 to one score or \+1 to two/.test(await fails(tool("kraken_level_up", { id: built.id, asi: { strength: 3 } }))), "+3 refused");
  const str = at3.abilities.strength.score;
  await tool("kraken_level_up", { id: built.id, asi: { strength: 1, constitution: 1 } });
  const at4 = data();
  assert(at4.level === 4 && at4.abilities.strength.score === str + 1 && at4.abilities.constitution.score === at3.abilities.constitution.score + 1, "+1 Strength, +1 Constitution");
  assert(at4.features.includes("Ability Score Improvement (Fighter 4)"), "its feature");
  done.push("level 4: an Ability Score Improvement");

  // 3. Level 5: no feat to take; Extra Attack added.
  assert(/gives no feat/.test(await fails(tool("kraken_level_up", { id: built.id, feat: "Alert" }))), "a feat where none is given refused");
  await tool("kraken_level_up", { id: built.id });
  assert(data().level === 5 && data().features.includes("Extra Attack (Fighter 5)"), `level 5's features: ${JSON.stringify(data().features)}`);
  const line = agent.chatLog(5).map((entry) => entry.text ?? "").find((text) => /\[LEVEL UP\] Brand .*level 5/.test(text));
  assert(line && /Extra Attack/.test(line), `said: ${line}`);
  done.push("level 5: its features, said in chat");

  // 4. Level 6: a feat in place of the improvement.
  assert(/not a feat to take/.test(await fails(tool("kraken_level_up", { id: built.id, feat: "Alert" }))), "an Origin feat refused at an improvement");
  await tool("kraken_level_up", { id: built.id, feat: "Grappler" });
  assert(data().feats.includes("Grappler"), `the feat: ${JSON.stringify(data().feats)}`);
  done.push("level 6: a General feat (an Origin one refused)");

  // 5. A Wizard's first Fighter level: the Fighter's d10.
  const sage = await tool("kraken_build_character", { spec: { name: "Sage", species: "Human", class: "Wizard", level: 3, scores: { strength: 13, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 10, charisma: 8 } } });
  const multi = levelUpPlan(agent.records.get(sage.id).data, lib, "Fighter");
  assert(multi.die === 10 && multi.classLevel === 1, `a new class's own die: ${JSON.stringify({ die: multi.die, level: multi.classLevel })}`);
  done.push("a new class: its own hit die");

  // 6. A Rogue's 6th level: Expertise in two skills it is proficient in.
  const rogue = await tool("kraken_build_character", { spec: { name: "Wren", species: "Human", class: "Rogue", level: 5, scores: { strength: 8, dexterity: 16, constitution: 12, intelligence: 14, wisdom: 12, charisma: 10 } } });
  const rogueData = () => agent.records.get(rogue.id).data;
  const plan6 = levelUpPlan(rogueData(), lib);
  const proficient = plan6.skills.map((skill) => skill.key);
  assert(plan6.expertise === 2 && proficient.length >= 2, `Expertise at Rogue 6: ${JSON.stringify({ expertise: plan6.expertise, skills: plan6.skills })}`);
  assert(/proficient in/.test(await fails(tool("kraken_level_up", { id: rogue.id, expertise: ["religion"].filter((key) => !proficient.includes(key)) }))), "a skill not proficient in refused");
  await tool("kraken_level_up", { id: rogue.id, expertise: proficient.slice(0, 2) });
  assert(proficient.slice(0, 2).every((key) => rogueData().skills[key].prof === 2), `doubled: ${JSON.stringify(rogueData().skills)}`);
  done.push("Expertise");
} finally {
  await server.stop?.();
}
// 7. Descending Darkness (the same rules, its own books): a level up with its choices.
const dark = createTableServer({ ruleset: "Descending Darkness" });
await dark.listen({ port: 0, password: "" });
try {
  importModule(dark.agent.records, dark.agent.seat, path.join(ROOT, "games", "modules", "Descending Darkness Player's Handbook"));
  const darkTool = async (name, args = {}) => {
    const result = await callTool(name, args, { table: () => dark });
    if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
    return JSON.parse(result.content[0].text);
  };
  const className = dark.agent.records.list({ type: "class" })[0]?.name;
  const hero = await darkTool("kraken_build_character", { spec: { name: "Vess", class: className, level: 1, scores: { strength: 14, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 } } });
  const before = dark.agent.records.get(hero.id).data;
  await darkTool("kraken_level_up", { id: hero.id, hp: "average" });
  const after = dark.agent.records.get(hero.id).data;
  assert(after.level === 2 && after.hp.total > before.hp.total, `Descending Darkness levelled: ${before.level} -> ${after.level}`);
  done.push(`Descending Darkness (${className} 2)`);
} finally {
  await dark.stop?.();
}
console.log(`ok levelup 5e fg: ${done.join("; ")}`);
process.exit(0);
