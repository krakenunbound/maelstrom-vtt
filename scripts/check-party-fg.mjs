// The party sheet beside FG's 5E party sheet:
//  - Loot: Sell (unassigned items at 50% of their cost, into the parcel's coins; no price, kept), Identified per item
//    and Identify All (players see an unidentified item by its unidentified name until then)
//  - Party Attack: d20 + bonus at each member's AC; XP to one member; a member's special defenses
//  - PSMN / PSIN: players see names and portraits only, or no one's carried things, when the GM says so
//  - the friends placed on a map by the party's formation
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { importModule } = require("../electron/importers/fgModule.cjs");
const party = require("../electron/party.cjs");
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
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "Descending Darkness Player's Handbook"));
const ann = { role: "player", name: "Ann" };
try {
  const build = (owner, name, cls) => tool("kraken_build_character", { owner, spec: { name, species: "Human", class: cls, level: 2, scores: { strength: 14, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 } } });
  const hero = await build("Ann", "Hero", "Fighter");
  const sage = await build("Bob", "Sage", "Wizard");
  // No one on the party sheet yet: Add party says so, adds nothing.
  const empty = await tool("kraken_combat", { action: "add-party" }).then(() => "", (error) => error.message);
  assert(/party sheet is empty/.test(empty) && !agent.combat.entries().length, `Add party with nobody on the sheet: ${empty || "nothing said"}`);
  await tool("kraken_party_edit", { members: [hero.id, sage.id] });
  await tool("kraken_record_update", { id: hero.id, data: { specialdefenses: "Resist fire" } });

  // Loot: a priced sword, a priceless curio, a hidden ring.
  party.addToParcel(agent, { coins: { GP: 10 }, items: [{ name: "Longsword", count: 2, item: { cost: "15 gp" } }, { name: "Odd curio", count: 1, item: {} }, { name: "Ring of Warmth", count: 1, item: { isidentified: 0, nonid_name: "Plain ring", cost: "1000 gp" } }] });
  const items = () => agent.records.get("party").data.parcel.items;
  const ringId = Object.entries(items()).find(([, item]) => item.name === "Ring of Warmth")[0];
  // The ring assigned to the hero, so it is not sold.
  agent.records.update("party", { data: { parcel: { items: { [ringId]: { assign: "Hero" } } } } }, agent.seat);
  let annView = await party.partyView(agent, ann);
  assert(Object.values(annView.parcel.items).some((item) => item.name === "Plain ring") && !Object.values(annView.parcel.items).some((item) => item.name === "Ring of Warmth"), `players see the plain ring: ${JSON.stringify(annView.parcel.items)}`);
  await tool("kraken_party_distribute", { sell: true });
  const parcel = agent.records.get("party").data.parcel;
  assert(parcel.coins.GP === 10 + 15 && !Object.values(parcel.items).some((item) => item?.name === "Longsword") && Object.values(parcel.items).some((item) => item?.name === "Odd curio") && Object.values(parcel.items).some((item) => item?.name === "Ring of Warmth"), `sold the swords for 15 gp, kept the curio and the assigned ring: ${JSON.stringify(parcel)}`);
  await tool("kraken_party_distribute", { identify: true });
  annView = await party.partyView(agent, ann);
  assert(Object.values(annView.parcel.items).some((item) => item.name === "Ring of Warmth"), `identified: its real name: ${JSON.stringify({ seen: annView.parcel.items, stored: agent.records.get("party").data.parcel.items })}`);
  done.push("Sell at 50%, Identified and Identify All");

  // Party attack: a 2 misses everyone, a 20 hits.
  agent.dice.force([2, 20]);
  const attack = (await tool("kraken_party_group_check", { kind: "attack", bonus: 3 })).attack;
  assert(attack.length === 2 && !attack[0].hit && attack[1].hit, `a 2 misses, a 20 hits: ${JSON.stringify(attack)}`);
  // XP to one member.
  const before = { hero: agent.records.get(hero.id).data.exp ?? 0, sage: agent.records.get(sage.id).data.exp ?? 0 };
  await tool("kraken_party_award", { xp: 100, member: sage.id });
  assert(agent.records.get(sage.id).data.exp === before.sage + 100 && (agent.records.get(hero.id).data.exp ?? 0) === before.hero, "the Sage alone gets the 100");
  const gmView = await party.partyView(agent, { role: "dm", name: "GM" });
  assert(gmView.members.find((member) => member.name === "Hero").defenses === "Resist fire", "the hero's special defenses");
  done.push("Party Attack, XP to one member, special defenses");

  // PSMN and PSIN off.
  await tool("kraken_table_options", { partyDetails: false, partyCarried: false });
  annView = await party.partyView(agent, ann);
  const member = annView.members.find((item) => item.name === "Hero");
  assert(annView.details === false && member && member.hp === undefined && member.ac === undefined && annView.inventory.length === 0 && annView.carried === false, `players: names only, nothing carried: ${JSON.stringify(member)}`);
  assert((await party.partyView(agent, { role: "dm", name: "GM" })).members.find((item) => item.name === "Hero").ac !== undefined, "the GM keeps everything");
  await tool("kraken_table_options", { partyDetails: true, partyCarried: true });
  done.push("what players see (PSMN, PSIN)");

  // The friends by the formation: the Sage one square ahead of the Hero.
  agent.map.setScene({ id: "road", name: "Road", width: 1000, height: 1000, padding: 0, backgroundColor: "#000", grid: { size: 100, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, walls: [], lights: [], tokens: [] });
  agent.records.update("party", { data: { order: { formation: { facing: 0, slots: [{ x: 0, y: 0, id: hero.id }, { x: 0, y: -1, id: sage.id }] } } } }, agent.seat);
  await tool("kraken_combat", { action: "add-party" });
  await tool("kraken_combat", { action: "place-faction", faction: "friend", x: 450, y: 450 });
  const at = (name) => agent.map.tokens().find((token) => token.name === name);
  assert(at("Hero") && at("Sage") && at("Sage").x === at("Hero").x && at("Sage").y === at("Hero").y - 100, `by the formation: ${JSON.stringify([at("Hero"), at("Sage")].map((token) => token && [token.x, token.y]))}`);
  done.push("the friends placed by the party's formation");
} finally {
  await server.stop?.();
}
console.log(`ok party fg: ${done.join("; ")}`);
process.exit(0);
