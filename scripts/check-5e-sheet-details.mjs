// The 5E sheet's details beside FG's, each through the player's own edits (the host's whitelist):
//  - AC: the Dex cap by hand (none, max 2) and a second ability (Wisdom)
//  - speed: the base, heavy armor's -10 with Strength under its requirement, misc, special movement
//  - a skill's ability changed (Athletics on Dexterity)
//  - two-weapon fighting: the off hand's damage without the ability modifier, with it under the style
//  - hit dice: the ability added changed, misc; a multiclass character rolls the class's die chosen
//  - push, drag or lift: Strength x 30 lb. beside the load
//  - coins of one's own: added, named, counted, taken out
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import { encumbranceOf } from "../shared/bookkeeping/bookkeeping.mjs";
import books5e from "../shared/dnd5e/bookkeeping.mjs";

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
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
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
const { port } = await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const agent = server.agent;
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "SRD 5.2.1 Player's Rules"));
const ann = await connect(port, { name: "Ann" });
try {
  const built = await tool("kraken_build_character", { owner: "Ann", spec: { name: "Wren", species: "Human", class: "Fighter", level: 3, scores: { strength: 10, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 16, charisma: 10 } } });
  const id = built.id;
  const data = () => agent.records.get(id).data;
  const edit = async (changes) => {
    ann.send({ type: "character-edit", id, changes });
    await settle();
  };
  const errors = () => ann.inbox.filter((msg) => msg.type === "error").map((msg) => msg.reason);
  const item = (name) => {
    const record = agent.records.list({ type: "item" }).find((row) => row.name === name);
    assert(record, `the book's ${name}`);
    return { ...record.data, name };
  };
  // Nothing worn: 10 + Dex 2.
  agent.records.update(id, { data: { inventorylist: null } }, agent.seat);
  agent.records.update(id, { data: { inventorylist: { "id-00090": { ...item("Shortsword"), carried: 2 } } } }, agent.seat);
  await edit([{ path: "ac.misc", value: 0 }]);
  const plain = data().ac.total;
  assert(plain === 12, `unarmored: ${JSON.stringify(data().ac)}`);

  // 1. AC details.
  await edit([{ path: "ac.dexcap", value: "none" }]);
  assert(data().ac.total === 10, `no Dex: ${JSON.stringify(data().ac)} ${errors()}`);
  await edit([{ path: "ac.dexcap", value: "" }, { path: "ac.stat2", value: "wisdom" }]);
  assert(data().ac.total === 15 && data().ac.stat2bonus === 3, `Wisdom added: ${JSON.stringify(data().ac)}`);
  await edit([{ path: "ac.stat2", value: "" }]);
  done.push("AC: Dex cap by hand, a second ability");

  // 2. Speed.
  agent.records.update(id, { data: { inventorylist: { "id-00091": { ...item("Plate Armor"), carried: 2 } } } }, agent.seat);
  await edit([{ path: "speed", value: "30 ft." }, { path: "speedmisc", value: 10 }, { path: "speedspecial", value: "climb 30 ft." }]);
  assert(data().speedtotal === 30 && data().speedarmor === -10 && data().speedspecial === "climb 30 ft.", `speed: ${JSON.stringify({ total: data().speedtotal, armor: data().speedarmor, special: data().speedspecial, errors: errors() })}`);
  await edit([{ path: "abilities.strength.score", value: 15 }]);
  assert(data().speedtotal === 40 && data().speedarmor === 0, `Strength enough: ${data().speedtotal}`);
  await edit([{ path: "abilities.strength.score", value: 16 }]);
  agent.records.update(id, { data: { inventorylist: { "id-00091": null } } }, agent.seat);
  done.push("speed: base, heavy armor, misc, special");

  // 3. A skill's ability.
  const athletics = data().skills.athletics;
  await edit([{ path: "skills.athletics.stat", value: "dexterity" }]);
  assert(data().skills.athletics.stat === "dexterity" && data().skills.athletics.total === athletics.total - 3 + 2 && data().skills.athletics.ownstat === "strength", `Athletics on Dex: ${JSON.stringify([athletics, data().skills.athletics])}`);
  done.push("a skill on another ability");

  // 4. Two-weapon fighting.
  const sword = () => data().attacks["id-00090"];
  assert(/\+3$/.test(sword().damage), `main hand: ${sword().damage}`);
  await edit([{ path: "attacks.id-00090.hands", value: 3 }]);
  assert(sword().damage === "1d6" && /off hand/.test(sword().name), `off hand: ${JSON.stringify(sword())}`);
  agent.records.update(id, { data: { features: [...(Array.isArray(data().features) ? data().features : []), "Fighting Style: Two-Weapon Fighting"] } }, agent.seat);
  await edit([{ path: "attacks.id-00090.hands", value: 3 }]);
  assert(sword().damage === "1d6+3", `with the style: ${sword().damage}`);
  done.push("two-weapon fighting");

  // 5. Hit dice.
  await edit([{ path: "hitdice.stat", value: "wisdom" }, { path: "hitdice.misc", value: 1 }]);
  assert(data().hitdice.mod === 4, `Wisdom +3 and misc 1: ${JSON.stringify(data().hitdice)}`);
  agent.records.update(id, { data: { hp: { wounds: 20 }, packages: { "id-00077": { name: "Wizard", packagetype: "Class", level: 1, hitdie: 6 } } } }, agent.seat);
  await edit([{ path: "hitdice.misc", value: 1 }]);
  agent.dice.force([4]);
  const spent = await tool("kraken_bookkeeping", { action: "hitdie", id, die: 6 }).catch((error) => ({ error: String(error) }));
  const wizard = data().packages["id-00077"];
  assert(!spent.error && wizard.hdused === 1 && agent.chatLog(3).some((line) => /\[HIT DIE\]/.test(line.roll?.label ?? "") && /1d6\+4/.test(line.roll?.formula ?? line.roll?.expr ?? JSON.stringify(line.roll))), `the wizard's d6, +4: ${JSON.stringify({ spent, wizard, log: agent.chatLog(3).map((line) => line.roll) })}`);
  done.push("hit dice: the ability, misc, a class's die chosen");

  // 6. Push, drag or lift.
  const load = encumbranceOf(books5e, data());
  assert(load.lift?.at === 480 && load.lift.label === "Push, drag or lift", `lift: ${JSON.stringify(load.lift)}`);
  done.push("push, drag or lift");

  // 7. Coins of one's own.
  await edit([{ path: "coins.id-00042.name", value: "Moonstones" }, { path: "coins.id-00042.custom", value: 1 }, { path: "coins.id-00042.amount", value: 3 }]);
  assert(data().coins["id-00042"]?.name === "Moonstones" && data().coins["id-00042"].amount === 3, `a coin of one's own: ${JSON.stringify(data().coins)} ${errors()}`);
  await edit([{ path: "coins.id-00042", value: null }]);
  assert(!data().coins["id-00042"], "taken out");
  done.push("coins of one's own");
} finally {
  ann.ws.close();
  await server.stop?.();
}
console.log(`ok 5e sheet details: ${done.join("; ")}`);
process.exit(0);
