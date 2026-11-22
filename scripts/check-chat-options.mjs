// FG's chat options on the host, with a GM and a player connected:
//  - Show GM rolls (REVL) off: the GM's tray roll and the GM's creatures' attacks reach the GM alone
//  - Show results to players (SHRR): off, the GM gets the attack's full line, the player the roll without its result;
//    pc, a result with an ally in it is everyone's; a hidden target's never
//  - Dice: manual entry (MANUALROLL): the faces a person typed are the roll's, marked [MANUAL]; extra faces never
//    reach the next roll
// (Show all whispers to GM is in check-chat.)
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
    const lines = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "chat") lines.push(msg);
      if (msg.type === "no") reject(new Error(`join refused: ${msg.reason}`));
      if (msg.type === "ok") resolve({ ws, lines, send: (body) => ws.send(JSON.stringify(body)) });
    });
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", ...join })));
  });
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 200));
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
for (const name of ["Descending Darkness Player's Handbook", "Descending Darkness Bestiary"]) importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", name));
const gm = await connect(port, { name: "GM", hostToken });
const ann = await connect(port, { name: "Ann" });
const newLines = (seat, from) => seat.lines.slice(from);
try {
  // REVL off: the GM's tray roll is the GM's alone.
  await tool("kraken_table_options", { revealGmRolls: false });
  let mark = { gm: gm.lines.length, ann: ann.lines.length };
  gm.send({ type: "roll", formula: "1d20", label: "Secret check" });
  await settle();
  assert(newLines(gm, mark.gm).some((line) => line.roll?.label === "Secret check" && line.secret) && !newLines(ann, mark.ann).some((line) => line.roll?.label === "Secret check"), "the GM's roll is the GM's alone");
  await tool("kraken_table_options", { revealGmRolls: true });
  mark = { gm: gm.lines.length, ann: ann.lines.length };
  gm.send({ type: "roll", formula: "1d20", label: "Open check" });
  await settle();
  assert(newLines(ann, mark.ann).some((line) => line.roll?.label === "Open check"), "shown again, the player sees it");
  done.push("Show GM rolls");

  // SHRR off: the sentinel attacks Ann's character; the GM sees HIT/MISS, Ann the roll alone.
  const hero = await tool("kraken_build_character", { owner: "Ann", spec: { name: "Hero", species: "Human", class: "Fighter", level: 2, scores: { strength: 14, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 } } });
  const sentinel = agent.records.list({ type: "npc" }).find((record) => record.name === "Bone Sentinel");
  await tool("kraken_combat", { action: "add", recordId: hero.id });
  await tool("kraken_combat", { action: "add", recordId: sentinel.id });
  const entries = (await tool("kraken_combat", { action: "view" })).entries;
  const H = entries.find((item) => item.name === "Hero").id;
  const S = entries.find((item) => item.name === "Bone Sentinel");
  await tool("kraken_combat", { action: "target", id: S.id, targetId: H, on: true });
  await tool("kraken_table_options", { resultsToPlayers: "off" });
  mark = { gm: gm.lines.length, ann: ann.lines.length };
  await tool("kraken_combat", { action: "attack", id: S.id, weapon: S.attacks[0].key });
  await settle();
  const gmSaw = newLines(gm, mark.gm).filter((line) => /\[ATTACK\]/.test(line.roll?.label ?? ""));
  const annSaw = newLines(ann, mark.ann).filter((line) => /\[ATTACK\]/.test(line.roll?.label ?? ""));
  assert(gmSaw.length === 1 && /HIT|MISS/.test(gmSaw[0].roll.label) && gmSaw[0].secret, `the GM's full line: ${JSON.stringify(gmSaw.map((line) => line.roll.label))}`);
  assert(annSaw.length === 1 && !/HIT|MISS|AC \d/.test(annSaw[0].roll.label) && !annSaw[0].roll.result, `the player's line without the result: ${JSON.stringify(annSaw.map((line) => line.roll))}`);
  await tool("kraken_table_options", { resultsToPlayers: "pc" });
  mark = { gm: gm.lines.length, ann: ann.lines.length };
  await tool("kraken_combat", { action: "attack", id: S.id, weapon: S.attacks[0].key });
  await settle();
  assert(newLines(ann, mark.ann).some((line) => /HIT|MISS/.test(line.roll?.label ?? "")), "pc: an attack on an ally shows its result");
  await tool("kraken_table_options", { resultsToPlayers: "on" });
  done.push("Show results to players");

  // MANUALROLL: Ann typed 3 and 4 on her 2d6.
  mark = { ann: ann.lines.length };
  ann.send({ type: "roll", formula: "2d6+1", label: "My dice", manual: [3, 4, 6] });
  await settle();
  const manual = newLines(ann, mark.ann).find((line) => /My dice/.test(line.roll?.label ?? ""));
  assert(manual && manual.roll.total === 8 && /\[MANUAL\]/.test(manual.roll.label), `manual faces: ${JSON.stringify(manual?.roll)}`);
  agent.dice.force?.([]);
  mark = { ann: ann.lines.length };
  ann.send({ type: "roll", formula: "1d20", label: "Next roll" });
  await settle();
  const next = newLines(ann, mark.ann).find((line) => /Next roll/.test(line.roll?.label ?? ""));
  assert(next && !/MANUAL/.test(next.roll.label), "the next roll is the dice's own");
  done.push("manual dice entry");
} finally {
  gm.ws.close();
  ann.ws.close();
  await server.stop?.();
}
console.log(`ok chat options: ${done.join("; ")}`);
process.exit(0);
