// The 5E sheet beside FG's, played by the character's own player over the table's messages:
//  - AC and initiative adjustments (FG's Combat Details misc), the hit point maximum by hand
//  - Roll Initiative: a Dexterity check with the initiative; on the tracker it sets the character's place
//  - Inspiration as a count, held to the house rule HRIS (1 by default; 3 when chosen), a chat line on change
//  - death saves ticked by hand; a hit die rolled (spent) apart from a rest, healing
//  - attunement: the box on an item that requires it, the attuned count, class slots
//  - a wizard's slots by hand, prepared spells (known ones only), class resources given back by their rests
//  - skills' half proficiency and misc; feats, languages, proficiencies by hand; FG's weapon options (crit range, extra dice)
//  - multiclass: another class taken at level 1, a chosen class levelled, hit dice per class, the casters' slots together
//  - the character details FG keeps (deity, size, personality traits, ideals, bonds, flaws, appearance...)
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function connect(port, join) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const inbox = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      inbox.push(msg);
      if (msg.type === "ok") resolve({ ws, inbox, send: (body) => ws.send(JSON.stringify(body)) });
    });
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", ...join })));
  });
}
const settle = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const done = [];
const server = createTableServer({ ruleset: "D&D 5E" });
const { port, hostToken } = await server.listen({ port: 0, password: "" });
const ctx = { table: () => server };
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, ctx);
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "Descending Darkness Player's Handbook"));
const gm = await connect(port, { name: "GM", hostToken });
const ann = await connect(port, { name: "Ann" });
try {
  const built = await tool("kraken_build_character", { owner: "Ann", spec: { name: "Hero", species: "Human", class: "Fighter", level: 3, scores: { strength: 14, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 } } });
  const id = built.id;
  const data = () => agent.records.get(id).data;
  const edit = async (changes) => {
    ann.send({ type: "character-edit", id, changes });
    await settle();
  };
  const errors = () => ann.inbox.filter((msg) => msg.type === "error").map((msg) => msg.reason);

  // Adjustments: AC +1, initiative +5 (Alert), the maximum 40.
  const before = { ac: data().ac.total, init: data().initiative.total };
  await edit([{ path: "ac.misc", value: 1 }, { path: "initiative.misc", value: 5 }, { path: "hp.total", value: 40 }]);
  assert(data().ac.total === before.ac + 1 && data().initiative.total === before.init + 5 && data().hp.total === 40, `adjustments: ${JSON.stringify({ ac: data().ac, init: data().initiative, hp: data().hp, errors: errors() })}`);
  done.push("AC and initiative adjustments, the hit point maximum");

  // Roll Initiative: on the tracker, its place.
  await tool("kraken_combat", { action: "add", recordId: id });
  agent.dice.force([12]);
  ann.send({ type: "siege-check", id, kind: "init", label: "Initiative" });
  await settle(400);
  const entry = (await tool("kraken_combat", { action: "view" })).entries.find((item) => item.recordId === id);
  assert(entry?.initresult === 12 + data().initiative.total, `the tracker's initiative: ${JSON.stringify({ initresult: entry?.initresult, total: data().initiative.total, errors: errors() })}`);
  assert(agent.chatLog(10).some((line) => /\[INIT\]/.test(line.roll?.label ?? "")), "the roll in the chat");
  done.push("Roll Initiative sets the tracker's place");

  // Inspiration: one by default (5 asked, 1 kept); with HRIS 3, three; the chat says so.
  await edit([{ path: "inspiration", value: 5 }]);
  assert(data().inspiration === 1, `held to 1: ${data().inspiration}`);
  await tool("kraken_table_options", { rules: { HRIS: "3" } });
  await edit([{ path: "inspiration", value: 3 }]);
  assert(data().inspiration === 3, `three under HRIS 3: ${data().inspiration}`);
  assert(agent.chatLog(10).some((line) => /\[INSPIRATION\] Hero: gains Inspiration \(3 of 3\)/.test(line.text ?? "")), "the chat line");
  done.push("Inspiration held to the house rule, a chat line");

  // Death saves by hand; a hit die spent.
  await edit([{ path: "deathsaves.success", value: 2 }, { path: "deathsaves.failure", value: 1 }]);
  assert(data().deathsaves.success === 2 && data().deathsaves.failure === 1, `death saves: ${JSON.stringify(data().deathsaves)}`);
  await edit([{ path: "hp.wounds", value: 20 }]);
  const usedBefore = data().hitdice.used ?? 0;
  ann.send({ type: "bookkeeping", id, action: "hitdie", req: "hd" });
  await settle(400);
  const reply = ann.inbox.find((msg) => msg.type === "op-result" && msg.req === "hd");
  assert(data().hitdice.used === usedBefore + 1 && data().hp.wounds < 20, `a hit die: ${JSON.stringify({ hitdice: data().hitdice, wounds: data().hp.wounds, reply })}`);
  done.push("death saves by hand, a hit die rolled apart from a rest");

  // Attunement: a ring that requires it may be attuned; a rope may not. The count is the attuned.
  const record = agent.records.get(id);
  agent.records.update(id, { data: { ...record.data, inventorylist: { ...record.data.inventorylist, "id-90001": { name: "Ring of Protection", rarity: "Rare (requires attunement)", count: 1, carried: 2, weight: 0 }, "id-90002": { name: "Rope", count: 1, carried: 1, weight: 5 } } } }, agent.seat, { replace: true });
  await edit([{ path: "inventorylist.id-90001.attune", value: 1 }, { path: "inventorylist.id-90002.attune", value: 1 }]);
  const list = data().inventorylist;
  assert(list["id-90001"].attunable === 1 && list["id-90001"].attune === 1 && list["id-90002"].attune === 0 && data().attunement.used === 1, `attunement: ${JSON.stringify({ ring: list["id-90001"], rope: list["id-90002"], attunement: data().attunement, errors: errors() })}`);
  await edit([{ path: "attunement.class", value: 1 }]);
  assert(data().attunement.class === 1, "the class's slots");
  done.push("attunement: the box on items that require it, the count, class slots");

  // A wizard: slots by hand (an extra), prepared spells by name (only known ones), the class resources and rests.
  const mage = await tool("kraken_build_character", { owner: "Ann", spec: { name: "Mage", species: "Human", class: "Wizard", level: 3, scores: { strength: 8, dexterity: 14, constitution: 14, intelligence: 16, wisdom: 12, charisma: 10 } } });
  const mageData = () => agent.records.get(mage.id).data;
  const editMage = async (changes) => {
    ann.send({ type: "character-edit", id: mage.id, changes });
    await settle();
  };
  const l1 = mageData().slots.l1.max;
  await editMage([{ path: "slots.l1.extra", value: 1 }]);
  assert(mageData().slots.l1.max === l1 + 1, `a slot by hand: ${JSON.stringify(mageData().slots.l1)}`);
  agent.records.update(mage.id, { data: { ...mageData(), spells: ["Magic Missile", "Fire Bolt"] } }, agent.seat, { replace: true });
  const spellName = "Magic Missile";
  const slug = spellName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await editMage([{ path: `prepared.${slug}`, value: 1 }, { path: "prepared.wish", value: 1 }]);
  assert(mageData().prepared[slug] === 1 && !mageData().prepared.wish, `prepared: ${JSON.stringify({ spells: mageData().spells, prepared: mageData().prepared, errors: errors() })}`);
  // Resources: Arcane Recovery (long), a Ki-like one (short); both used; a short rest gives back the short one.
  await editMage([{ path: "resources.id-00001.name", value: "Arcane Recovery" }, { path: "resources.id-00001.max", value: 1 }, { path: "resources.id-00001.used", value: 1 }, { path: "resources.id-00002.name", value: "Focus" }, { path: "resources.id-00002.max", value: 3 }, { path: "resources.id-00002.used", value: 2 }, { path: "resources.id-00002.period", value: "short" }]);
  assert(mageData().resources["id-00002"].used === 2 && mageData().resources["id-00002"].period === "short" && mageData().resources["id-00001"].period === "long", `resources: ${JSON.stringify({ r: mageData().resources, errors: errors() })}`);
  ann.send({ type: "rest", id: mage.id, args: { kind: "short", hitDice: 0 }, req: "sr" });
  await settle(400);
  assert(mageData().resources["id-00002"].used === 0 && mageData().resources["id-00001"].used === 1, `a short rest: ${JSON.stringify(mageData().resources)}`);
  // A long rest is the GM's to call.
  gm.send({ type: "rest", id: mage.id, args: { kind: "long" }, req: "lr" });
  await settle(400);
  assert(mageData().resources["id-00001"].used === 0, `a long rest: ${JSON.stringify(mageData().resources)}`);
  await editMage([{ path: "resources.id-00002", value: null }]);
  assert(!mageData().resources["id-00002"], "a resource removed");
  done.push("spell slots by hand, prepared spells, class resources back on their rests");

  // Skills: half proficiency (Jack of All Trades, rounded down) and a misc bonus.
  const dexBonus = data().abilities.dexterity.bonus;
  await edit([{ path: "skills.stealth.prof", value: 3 }, { path: "skills.stealth.misc", value: 2 }]);
  assert(data().skills.stealth.total === dexBonus + Math.floor(data().prof / 2) + 2, `half and misc: ${JSON.stringify({ stealth: data().skills.stealth, prof: data().prof, dexBonus })}`);
  done.push("skills: half proficiency, misc");

  // The lists, one a line.
  await edit([{ path: "languages", value: ["Common", "Dwarvish", ""].join(String.fromCharCode(10)) }, { path: "proficiencylist.tools", value: "Smith's tools" }, { path: "feats", value: ["Alert", "Tough"] }]);
  assert(data().languages.join() === "Common,Dwarvish" && data().proficiencylist.tools.join() === "Smith's tools" && data().feats.join() === "Alert,Tough", `lists: ${JSON.stringify({ l: data().languages, t: data().proficiencylist.tools, f: data().feats, errors: errors() })}`);
  done.push("feats, languages and proficiencies by hand");

  // Weapon options: a melee critical on 19, one extra die.
  await edit([{ path: "weapon.critrange.melee", value: 19 }, { path: "weapon.critdicebonus.melee", value: 1 }]);
  const view = await tool("kraken_combat", { action: "view" });
  const me = view.entries.find((item) => item.recordId === id);
  await tool("kraken_combat", { action: "add", entry: { name: "Dummy", faction: "foe", hp: 200, ac: 30, init: 0 } });
  const dummy = (await tool("kraken_combat", { action: "view" })).entries.find((item) => item.name === "Dummy");
  await tool("kraken_combat", { action: "target", id: me.id, targetId: dummy.id, on: true });
  if (!Object.keys(data().attacks ?? {}).length) {
    const blade = agent.records.list({ type: "item" }).find((item) => /^(longsword|battleaxe|mace|shortsword)$/i.test(item.name));
    assert(blade, "a weapon in the book");
    await tool("kraken_character_drop", { id, record: blade.id, type: "item" });
    const row = Object.entries(data().inventorylist).find(([, item]) => item.name === blade.name)?.[0];
    await edit([{ path: `inventorylist.${row}.carried`, value: 2 }]);
  }
  const weaponKey = Object.keys(data().attacks ?? {}).find((key) => !/thrown/i.test(key) && !/unarmed/i.test(data().attacks[key].name ?? ""));
  const weapon = { key: weaponKey };
  assert(weaponKey, `a weapon to swing: ${JSON.stringify(data().attacks)}`);
  agent.dice.force([19]);
  await tool("kraken_combat", { action: "attack", recordId: id, weapon: weapon.key });
  const swing = agent.chatLog(6).find((line) => /\[ATTACK\]/.test(line.roll?.label ?? ""));
  assert(/CRITICAL/.test(`${swing?.roll?.label ?? ""} ${swing?.roll?.result ?? ""}`) || swing?.result === "CRITICAL", `a 19 against AC 30 is a critical: ${JSON.stringify(swing?.roll)}`);
  await tool("kraken_combat", { action: "damage-roll", recordId: id, weapon: weapon.key });
  const hurt = agent.chatLog(6).find((line) => /\[DAMAGE\].*\[CRITICAL\]/.test(line.roll?.label ?? ""));
  const dice = (hurt?.roll?.formula ?? "").match(/\d*d\d+/g) ?? [];
  assert(hurt && dice.length >= 2, `the critical's dice with one more: ${JSON.stringify(hurt?.roll?.formula)}`);
  done.push("weapon options: critical range, extra critical dice");

  // Multiclass (FG's Classes): the fighter 3 takes a level of Wizard, then another of Fighter; then a Cleric.
  const levelUp = async (choice) => {
    ann.send({ type: "level-up", id, package: choice });
    await settle(400);
  };
  const classOf = (name) => Object.values(data().packages).find((pkg) => pkg.packagetype === "Class" && pkg.name === name);
  await tool("kraken_record_update", { id, data: { exp: 900000 } });
  const hpBefore = data().hp.total;
  await levelUp("Wizard");
  assert(data().level === 4 && classOf("Fighter")?.level === 3 && classOf("Wizard")?.level === 1 && data().hp.total > hpBefore, `Fighter 3 / Wizard 1: ${JSON.stringify({ level: data().level, packages: data().packages, errors: errors() })}`);
  assert(data().spellcasting?.stat === "intelligence" && data().slots.l1?.max === 2 + (data().slots.l1?.extra ?? 0), `a 1st-level wizard's slots: ${JSON.stringify({ casting: data().spellcasting, slots: data().slots })}`);
  const fighterKey = Object.entries(data().packages).find(([, pkg]) => pkg.name === "Fighter")[0];
  await levelUp(fighterKey);
  assert(classOf("Fighter")?.level === 4 && classOf("Wizard")?.level === 1 && data().level === 5 && data().prof === 3, `Fighter 4 / Wizard 1: ${JSON.stringify({ level: data().level, prof: data().prof, packages: data().packages })}`);
  // Hit dice: 4 d10 and 1 d6; two spent go from the d10s first.
  await edit([{ path: "hitdice.used", value: 0 }]);
  await edit([{ path: "hitdice.used", value: 2 }]);
  const pools = data().hitdice.pools;
  assert(data().hitdice.total === 5 && pools.find((pool) => pool.name === "Fighter").left === 2 && pools.find((pool) => pool.name === "Wizard").left === 1, `hit dice per class: ${JSON.stringify(data().hitdice)}`);
  // A third caster level: Wizard 1 + Cleric 1 is a 2nd-level caster's slots (3 first-level), and two DCs.
  await levelUp("Cleric");
  assert(data().slots.l1?.max - (data().slots.l1?.extra ?? 0) === 3 && data().spellcasting.classes?.length === 2, `Wizard 1 + Cleric 1: ${JSON.stringify({ slots: data().slots, casting: data().spellcasting })}`);
  assert(agent.chatLog(10).some((line) => /\[LEVEL UP\] Hero is now Fighter 4 \/ Wizard 1 \/ Cleric 1/.test(line.text ?? "")), "the chat names every class");
  done.push("multiclass: a class taken, a class levelled, hit dice per class, the casters' slots together, each class's DC");

  // Pact Magic beside spellcasting: a Wizard 3 / Warlock 2 has a wizard's slots and the warlock's two pact slots apart.
  const rules = await import("../shared/dnd5e/rules.mjs");
  const both = rules.derive({ ...data(), packages: { "id-00001": { name: "Wizard", packagetype: "Class", level: 3, hitdie: 6 }, "id-00002": { name: "Warlock", packagetype: "Class", level: 2, hitdie: 8 } }, slots: {}, pactslots: {} });
  assert(both.level === 5 && both.slots.l1?.max === 4 && both.slots.l2?.max === 2 && both.pactslots?.l1?.max === 2, `wizard and warlock: ${JSON.stringify({ level: both.level, slots: both.slots, pact: both.pactslots })}`);
  const alone = rules.derive({ ...data(), packages: { "id-00001": { name: "Warlock", packagetype: "Class", level: 2, hitdie: 8 } }, level: 2, slots: {}, pactslots: { l1: { max: 2, used: 1 } } });
  assert(alone.slots.l1?.max === 2 && !alone.pactslots, `a warlock alone keeps its slots as they were: ${JSON.stringify({ slots: alone.slots, pact: alone.pactslots })}`);
  done.push("Pact Magic apart from a multiclass caster's slots");

  // The character details.
  await edit([{ path: "deity", value: "Tempus" }, { path: "size", value: "Medium" }, { path: "ideals", value: "Glory" }, { path: "bonds", value: "My shield-brothers" }, { path: "flaws", value: "Proud" }, { path: "personalitytraits", value: "Loud" }, { path: "specialdefenses", value: "Resist fire" }]);
  assert(data().deity === "Tempus" && data().size === "Medium" && data().ideals === "Glory" && data().flaws === "Proud" && data().specialdefenses === "Resist fire", `details: ${JSON.stringify({ deity: data().deity, errors: errors() })}`);
  done.push("deity, size, personality, ideals, bonds, flaws, special defenses");
} finally {
  gm.ws.close();
  ann.ws.close();
  await server.stop?.();
}
console.log(`ok 5e sheet: ${done.join("; ")}`);
process.exit(0);
