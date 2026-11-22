// The 5E sheet beside FG's, played by the character's own player over the table's messages:
//  - AC and initiative adjustments (FG's Combat Details misc), the hit point maximum by hand
//  - Roll Initiative: a Dexterity check with the initiative; on the tracker it sets the character's place
//  - Inspiration as a count, held to the house rule HRIS (1 by default; 3 when chosen), a chat line on change
//  - death saves ticked by hand; a hit die rolled (spent) apart from a rest, healing
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
