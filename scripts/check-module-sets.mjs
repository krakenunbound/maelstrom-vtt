// FG's module sets (its Modules window's export and import): the books active in a campaign (and shared with the
// players) saved by name with the GM, applied in any campaign of the game:
//  - saved; everything made inactive; applied: the set's books active again, the handbook shared, the adventure not
//  - another campaign of the game (the same GM) applies it; a campaign of another game does not see it
//  - a book of the set not on this computer is said; a set taken out; the GM's alone
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { WebSocket } from "ws";
import { makeBooks } from "./fake-books.mjs";

const require = createRequire(import.meta.url);
const { createTableServer, diceLook } = require("../electron/tableServer.cjs");
const { createBookShelf } = require("../electron/books.cjs");
const { createPrefsStore } = require("../electron/prefs.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const folder = makeBooks();
const books = createBookShelf({ folder, cache: path.join(folder, "cache.json") });
const prefs = createPrefsStore(null, diceLook);
const first = createTableServer({ books, prefs, ruleset: "D&D 5E" });
const opened = await first.listen({ port: 0, password: "" });
const tool = async (server, args) => {
  const result = await callTool("kraken_module_set", args, { table: () => server });
  if (result.isError) throw new Error(result.content[0].text);
  return JSON.parse(result.content[0].text);
};
const others = [];
try {
  const a = first.agent;
  // 1. Saved, cleared, applied.
  await a.activateBook("Test Handbook");
  await a.activateBook("Test Keep");
  const saved = await tool(first, { action: "save", name: "Keep night" });
  assert(saved.active === 2 && saved.sets.some((set) => set.name === "Keep night" && set.shared.join() === "Test Handbook"), `saved: ${JSON.stringify(saved)}`);
  await a.activateBook("Test Handbook", false);
  await a.activateBook("Test Keep", false);
  const applied = await tool(first, { action: "apply", name: "Keep night" });
  assert(applied.active.sort().join() === "Test Handbook,Test Keep" && applied.shared.join() === "Test Handbook" && applied.missing.length === 0, `applied: ${JSON.stringify(applied)}`);
  // A set with fewer books makes the rest inactive.
  await a.activateBook("Test Keep", false);
  await tool(first, { action: "save", name: "Rules only" });
  await a.activateBook("Test Keep");
  const fewer = await tool(first, { action: "apply", name: "Rules only" });
  assert(fewer.active.join() === "Test Handbook", `the rest made inactive: ${JSON.stringify(fewer)}`);
  done.push("saved, applied: the books active and shared again; a smaller set makes the rest inactive");

  // 2. Another campaign of the game; another game.
  const second = createTableServer({ books, prefs, ruleset: "D&D 5E" });
  others.push(second);
  const there = await tool(second, { action: "apply", name: "Keep night" });
  assert(there.active.sort().join() === "Test Handbook,Test Keep", `another campaign: ${JSON.stringify(there)}`);
  const fifth = createTableServer({ books, prefs, ruleset: "D&D 3.5E" });
  others.push(fifth);
  assert((await tool(fifth, { action: "list" })).sets.length === 0, "another game's campaign does not see it");
  done.push("another campaign of the game applies it; another game's does not see it");

  // 3. A missing book, a set taken out, the GM's alone.
  // A campaign that lists a book active whose file is gone: saved without it, and a set applied makes it inactive.
  await a.activateBook("Test Keep");
  const shelfState = first.persisted().books;
  const stale = createTableServer({ books, prefs, ruleset: "D&D 5E", saved: { books: { ...shelfState, active: [...shelfState.active, "Gone Module"] } } });
  others.push(stale);
  assert(stale.persisted().books.active.includes("Gone Module"), "the campaign lists the gone book active");
  const staleSave = await tool(stale, { action: "save", name: "Stale" });
  const staleSet = staleSave.sets.find((set) => set.name === "Stale");
  assert(!staleSet.active.includes("Gone Module"), `a gone book not saved: ${JSON.stringify(staleSet)}`);
  const staleApply = await tool(stale, { action: "apply", name: "Rules only" });
  assert(!staleApply.active.includes("Gone Module") && staleApply.active.join() === "Test Handbook", `a gone book made inactive: ${JSON.stringify(staleApply)}`);
  prefs.set("@gm", { moduleSets: { "Lost shelf": { ruleset: "D&D 5E", active: ["Test Handbook", "Gone Book"], shared: [] } } });
  const lost = await tool(first, { action: "apply", name: "Lost shelf" });
  assert(lost.missing.join() === "Gone Book" && lost.active.join() === "Test Handbook" && lost.shared.length === 0, `a missing book said: ${JSON.stringify(lost)}`);
  await tool(first, { action: "remove", name: "Lost shelf" });
  assert(!(await tool(first, { action: "list" })).sets.some((set) => set.name === "Lost shelf"), "taken out");
  const player = await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${opened.port}`);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "ok") ws.send(JSON.stringify({ type: "module-set", req: 9, action: "list" }));
      if (msg.type === "op-result" && msg.req === 9) resolve({ ws, msg });
    });
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", name: "Ann" })));
  });
  assert(!player.msg.ok && /GM's/.test(player.msg.error), `a player may not: ${JSON.stringify(player.msg)}`);
  player.ws.close();
  done.push("a missing book said, a set taken out, the GM's alone");
} finally {
  await first.stop?.();
  for (const server of others) await server.stop?.();
}
console.log(`ok module sets: ${done.join("; ")}`);
process.exit(0);
