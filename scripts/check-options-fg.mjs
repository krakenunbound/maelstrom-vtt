// FG's options the audit settled side by side (CoreRPG's own code read for each):
//  - each person's own: Use Alt key (KALT), Short effect summary (EFFSHORT), Restore windows (WSAV), toast seconds
//    (TOAST_COMBAT 5, TOAST_INTERFACE 3), Combat list size (DESKTOPCTSIZE 6): kept, nonsense dropped
//  - the table's Token: Fog of war (TFOW): "pc", what a player's tokens have seen stays (their explored areas sent);
//    "off", only what they see now (nothing remembered, nothing sent)
import "./loopback.mjs";
import { createRequire } from "node:module";
import { WebSocket } from "ws";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { cleanPrefs } = require("../electron/prefs.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];

// 1. Each person's own.
const kept = cleanPrefs({ useAlt: false, effectsShort: false, reopenWindows: false, toastCombat: 10, toastInterface: 0, combatList: 12 }, {});
assert(kept.useAlt === false && kept.effectsShort === false && kept.reopenWindows === false && kept.toastCombat === 10 && kept.toastInterface === 0 && kept.combatList === 12, `kept: ${JSON.stringify(kept)}`);
const dropped = cleanPrefs({ useAlt: "no", toastCombat: 7, combatList: 9 }, {});
assert(!("useAlt" in dropped) && !("toastCombat" in dropped) && !("combatList" in dropped), `nonsense dropped: ${JSON.stringify(dropped)}`);
done.push("each person's KALT, EFFSHORT, WSAV, toasts and combat list size");

// 2. Fog of war.
const scene = { id: "room", name: "Room", width: 600, height: 300, padding: 0, backgroundColor: "#000", grid: { size: 50, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, lights: [], tokens: [], walls: [] };
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
const settle = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));
const server = createTableServer();
const info = await server.listen({ port: 0, password: "" });
const tool = async (name, args = {}) => {
  const result = await callTool(name, args, { table: () => server });
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return JSON.parse(result.content[0].text);
};
const dm = await connect(info.port, { name: "DM", hostToken: info.hostToken });
const player = await connect(info.port, { name: "Tester" });
try {
  dm.send({ type: "scene", scene });
  await settle();
  const map = server.agent.map;
  const hero = map.place({ name: "Hero", x: 75, y: 125 }, server.agent.seat);
  map.update(hero.id, { owner: "Tester" }, server.agent.seat);
  dm.send({ type: "sight", on: true });
  await settle();
  const explored = () => [...player.inbox].reverse().find((msg) => msg.type === "explored");
  assert((await tool("kraken_table_options", {})).tokenFog === "pc", "FG's default: pc");
  map.move(hero.id, { x: 125, y: 125 }, server.agent.seat);
  await settle();
  assert(explored()?.polygons?.length > 0, `pc: what the hero saw is kept and sent: ${JSON.stringify(explored())?.slice(0, 120)}`);
  await tool("kraken_table_options", { tokenFog: "off" });
  map.move(hero.id, { x: 175, y: 125 }, server.agent.seat);
  await settle();
  assert(explored()?.polygons?.length === 0, `off: nothing remembered: ${JSON.stringify(explored())?.slice(0, 120)}`);
  done.push("fog of war: pc keeps what was seen, off only what is in sight");
} finally {
  dm.ws.close();
  player.ws.close();
  await server.stop?.();
}
console.log(`ok options fg: ${done.join("; ")}`);
process.exit(0);
