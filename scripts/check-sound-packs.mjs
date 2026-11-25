// Sound packs (Documents/Kraken VTT/Sound Packs): scripts/build-sound-packs.mjs makes one from a folder; the sound
// library reads it in place with the ids loose files would have (the GM's own win over a pack's, a pack's over the
// app's); the table serves a pack's sound whole and by range; a weapon's blow that lands carries the impact of the
// target's armour (plate, chain, leather, cloth, a creature's hide), a spell's does not; a sprung trap is heard by
// every seat; kraken_sound packs and folders list them, and docs/sound-folders.md is up to date.
import "./loopback.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

const require = createRequire(import.meta.url);
const { createSoundLibrary } = require("../electron/sounds.cjs");
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");
const { armourOf } = require("../electron/soundTriggers.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const done = [];
const put = (root, id, text) => {
  mkdirSync(path.dirname(path.join(root, id)), { recursive: true });
  writeFileSync(path.join(root, id), text);
};

// A pack made from a folder: sounds in, a stray file left out, the manifest says what it is.
const source = mkdtempSync(path.join(tmpdir(), "mvtt-sp-src-"));
const packs = mkdtempSync(path.join(tmpdir(), "mvtt-sp-packs-"));
const SOUNDS = {
  "sfx/Weapons/Axe/Hit/axe-1.mp3": "pack axe 1",
  "sfx/Weapons/Axe/Hit/axe-2.mp3": "pack axe 2",
  "sfx/Impacts/Plate/plate-1.mp3": "pack plate",
  "sfx/Impacts/Chain/chain-1.mp3": "pack chain",
  "sfx/Impacts/Leather/leather-1.mp3": "pack leather",
  "sfx/Impacts/Cloth/cloth-1.mp3": "pack cloth",
  "sfx/Impacts/Flesh/flesh-1.mp3": "pack flesh",
  "sfx/Effects/Traps/Spikes/spikes-1.mp3": "pack spikes",
  "sfx/Effects/Traps/Sprung/sprung-1.mp3": "pack sprung",
  "sfx/Effects/Critical Hit/pack-crit.mp3": "pack crit",
  "ambience/Cave/drip.ogg": "x".repeat(5000),
};
for (const [id, text] of Object.entries(SOUNDS)) put(source, id, text);
put(source, "notes.txt", "not a sound");
const built = JSON.parse(execFileSync(process.execPath, ["scripts/build-sound-packs.mjs", source, packs, "--name", "Test Steel", "--id", "test-steel"], { encoding: "utf8" }).trim().split("\n").pop());
assert(built.sounds === Object.keys(SOUNDS).length && built.skippedCount === 1 && readdirSync(packs).includes("Maelstrom-Sounds-Test-Steel.kpack"), `the pack is built: ${JSON.stringify(built)}`);
done.push("a pack built from a folder");

// Read in place, the same ids; the GM's own sound wins over the pack's, the pack's over the app's.
const core = mkdtempSync(path.join(tmpdir(), "mvtt-sp-core-"));
const gm = mkdtempSync(path.join(tmpdir(), "mvtt-sp-gm-"));
put(core, "sfx/Effects/Critical Hit/pack-crit.mp3", "core crit");
put(core, "sfx/Effects/Critical Hit/core-only.mp3", "core only");
put(gm, "sfx/Weapons/Axe/Hit/axe-2.mp3", "gm axe 2");
const library = createSoundLibrary({ folder: gm, builtin: core, packs });
const read = (id) => {
  const found = library.file(id);
  return found.pack ? require("../electron/artPacks.cjs").read(found.pack, found.entry).toString() : require("node:fs").readFileSync(found.path, "utf8");
};
assert(read("sfx/Weapons/Axe/Hit/axe-1.mp3") === "pack axe 1" && read("sfx/Weapons/Axe/Hit/axe-2.mp3") === "gm axe 2", "a pack's sound, and the GM's own over it");
assert(read("sfx/Effects/Critical Hit/pack-crit.mp3") === "pack crit" && read("sfx/Effects/Critical Hit/core-only.mp3") === "core only", "the pack's over the app's; the app's own still there");
assert(library.groups("sfx").some((group) => group.id === "sfx/Impacts/Plate" && group.count === 1) && library.pick("sfx/Weapons/Axe/Hit"), "its folders are groups, picked from at random");
const listed = library.packs();
assert(listed.length === 1 && listed[0].name === "Test Steel" && listed[0].kind === "sound-pack" && listed[0].sounds === Object.keys(SOUNDS).length, `the packs listed: ${JSON.stringify(listed)}`);
done.push("read in place, the GM's over the pack's over the app's");

// What a blow lands on.
const shape = (type, data) => armourOf({ type, data });
assert(shape("character", { inventorylist: { a: { name: "Plate", type: "Armor", carried: 2 }, b: { name: "Leather", type: "Armor", carried: 1 } } }) === "Plate", "worn plate, not the leather in the pack");
assert(shape("character", { inventorylist: { a: { name: "Chain Mail", carried: 1 }, b: { name: "Shield", type: "Armor", carried: 2 } } }) === "Chain", "chain mail (a shield is not armour)");
assert(shape("npc", { actext: "(studded leather, shield)" }) === "Leather" && shape("npc", {}) === "Flesh" && shape("character", {}) === "Cloth", "an NPC's armour words; hide for a creature, cloth for a character");
done.push("armour: plate, chain, leather, cloth, a creature's hide");

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
async function until(test, label) {
  const start = Date.now();
  while (Date.now() - start < 4000) {
    const found = test();
    if (found) return found;
    await wait(20);
  }
  throw new Error(`waiting for ${label}`);
}

const server = createTableServer({ sounds: library });
const sockets = [];
try {
  const { port, hostToken } = await server.listen({ port: 0, password: "" });
  const tool = async (name, args) => {
    const result = await callTool(name, args, { table: () => server });
    if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
    return JSON.parse(result.content[0].text);
  };
  const dm = await connect(port, { name: "GM", hostToken });
  const ann = await connect(port, { name: "Ann" });
  sockets.push(dm.ws, ann.ws);
  const assetToken = dm.inbox.find((msg) => msg.type === "ok")?.you?.assetToken;

  // Served from inside the pack: whole, and by range (a long loop seeks).
  const base = `http://127.0.0.1:${port}/sound/file?token=${assetToken}&id=`;
  const whole = await fetch(base + encodeURIComponent("sfx/Impacts/Plate/plate-1.mp3"));
  assert(whole.status === 200 && (await whole.text()) === "pack plate" && whole.headers.get("content-type") === "audio/mpeg", `a pack's sound served: ${whole.status}`);
  const part = await fetch(base + encodeURIComponent("ambience/Cave/drip.ogg"), { headers: { Range: "bytes=100-199" } });
  assert(part.status === 206 && (await part.text()).length === 100 && part.headers.get("content-range") === "bytes 100-199/5000", `by range: ${part.status} ${part.headers.get("content-range")}`);
  done.push("served from the pack, whole and by range");

  // A longsword lands on an orc in chain: the line carries the chain impact; a fire bolt's damage does not clang.
  const orc = server.agent.records.create({ type: "npc", name: "Orc", visibility: "gm", data: { hp: { total: 30, wounds: 0 }, ac: 16, actext: "(chain mail)" } }, server.agent.seat);
  const knight = server.agent.records.create({ type: "npc", name: "Knight", visibility: "gm", data: { hp: { total: 30, wounds: 0 }, inventorylist: { a: { name: "Plate", type: "Armor", carried: 2 } } } }, server.agent.seat);
  await tool("kraken_combat", { action: "add", recordId: orc.id });
  await tool("kraken_combat", { action: "add", recordId: knight.id });
  const lineOf = (pattern) => [...ann.inbox].reverse().find((msg) => msg.type === "chat" && pattern.test(String(msg.text ?? "")));
  server.agent.say("[DAMAGE] Longsword -> Orc: 8 (Wounded)", "Combat");
  const hit = await until(() => lineOf(/Longsword -> Orc/), "the longsword's line");
  assert(/^sfx\/Impacts\/Chain\//.test(hit.impact ?? ""), `the blow on chain mail: ${hit.impact}`);
  server.agent.say("[DAMAGE] Warhammer -> Knight: 5 (Wounded)", "Combat");
  assert(/^sfx\/Impacts\/Plate\//.test((await until(() => lineOf(/Warhammer -> Knight/), "the hammer's line")).impact ?? ""), "the blow on plate");
  server.agent.say("[DAMAGE] Fire Bolt -> Orc: 9 (Wounded)", "Combat");
  assert(!(await until(() => lineOf(/Fire Bolt -> Orc/), "the fire bolt's line")).impact, "a spell's damage: no clang");
  server.agent.say("[DAMAGE] Longsword -> Orc: 0", "Combat");
  assert(!(await until(() => lineOf(/Longsword -> Orc: 0/), "a blow that did nothing")).impact, "no damage, no impact");
  done.push("a weapon's blow carries its impact by armour; a spell's and a harmless one's do not");

  // A sprung trap: every seat hears it (its kind by its name: a pit of spikes).
  dm.send({ type: "scene", scene: { id: "hall", name: "Hall", width: 500, height: 300, padding: 0, backgroundColor: "#000", grid: { size: 50, type: 1, color: "#000", alpha: 0.2, distance: 5, units: "ft" }, lights: [], tokens: [], walls: [] } });
  await until(() => ann.inbox.some((msg) => msg.type === "map" && msg.sceneId === "hall"), "Ann's map");
  const hero = server.agent.records.create({ type: "character", name: "Ann's Hero", owner: "Ann", visibility: "owner", data: {} }, server.agent.seat);
  const placed = await tool("kraken_token_place", { recordId: hero.id, col: 0, row: 2 });
  await tool("kraken_region", { action: "add", kind: "trap", name: "Hall of spikes", rect: { col: 2, row: 2, cols: 1, rows: 1 } });
  ann.send({ type: "token-move", id: placed.id, x: 225, y: 125 });
  const heard = await until(() => ann.inbox.find((msg) => msg.type === "sound" && /^sfx\/Effects\/Traps\//.test(msg.id)), "the trap's sound at Ann's seat");
  assert(/^sfx\/Effects\/Traps\/Spikes\//.test(heard.id) && dm.inbox.some((msg) => msg.type === "sound" && msg.id === heard.id), `the spikes, heard by every seat: ${heard.id}`);
  done.push("a sprung trap heard by every seat");

  // The agent's view: the packs, and the folders with how many sounds each has.
  const listedByTool = await tool("kraken_sound", { action: "packs" });
  assert(listedByTool.packs[0]?.name === "Test Steel", "kraken_sound packs");
  const folders = await tool("kraken_sound", { action: "folders", search: "Impacts" });
  assert(folders.folders.length === 5 && folders.folders.every((item) => item.has === 1 && item.wanted === 5) && folders.empty === 0, `kraken_sound folders: ${JSON.stringify(folders).slice(0, 300)}`);
  done.push("kraken_sound packs and folders");
} finally {
  for (const ws of sockets) ws.close();
  await server.close?.();
}
execFileSync(process.execPath, ["scripts/sound-folders.mjs", "--check"], { stdio: "inherit" });
console.log(`ok sound packs: ${done.join("; ")}`);
process.exit(0);
