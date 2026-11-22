// FG's currency weight and value:
//  - kept with the table's options (each coin's weight and value; nonsense dropped)
//  - a coin's own weight counts toward the load in place of the game's coins to the pound
//  - the coins' worth in the first coin
import "./loopback.mjs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { coinWorth } from "../shared/party/worth.mjs";

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
importModule(agent.records, agent.seat, path.join(ROOT, "games", "modules", "Descending Darkness Player's Handbook"));
try {
  // 1. Kept, nonsense dropped.
  await tool("kraken_table_options", { currencyInfo: { GP: { weight: 0.1, value: 1 }, SP: { value: 0.1 }, CP: { weight: -3, value: "lots" } } });
  const info = agent.options().currencyInfo;
  assert(info.GP.weight === 0.1 && info.GP.value === 1 && info.SP.value === 0.1 && !info.CP, `kept and cleaned: ${JSON.stringify(info)}`);
  done.push("kept with the table's options");

  // 2. The load: 100 GP at 0.1 each is 10 lb (the game's own 50 to the pound would be 2).
  const hero = await tool("kraken_build_character", { owner: "Ann", spec: { name: "Hero", species: "Human", class: "Fighter", level: 1, scores: { strength: 14, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 } } });
  const record = agent.records.get(hero.id);
  agent.records.update(hero.id, { data: { ...record.data, coins: { "id-00001": { name: "GP", amount: 100 }, "id-00002": { name: "SP", amount: 50 } } } }, agent.seat);
  const load = (await tool("kraken_bookkeeping", { id: hero.id })).load;
  assert(Math.abs(load.coins - (10 + 50 / 50)) < 0.01, `GP by its own weight, SP by the game's: ${JSON.stringify(load)}`);
  await tool("kraken_table_options", { currencyInfo: {} });
  const plain = (await tool("kraken_bookkeeping", { id: hero.id })).load;
  assert(Math.abs(plain.coins - 3) < 0.01, `no weights: the game's 50 to the pound: ${JSON.stringify(plain)}`);
  done.push("a coin's own weight in the load");

  // 3. Worth.
  assert(coinWorth([{ name: "GP", amount: 100 }, { name: "SP", amount: 50 }], { GP: { value: 1 }, SP: { value: 0.1 } }) === 105, "100 GP and 50 SP: 105 GP");
  assert(coinWorth([{ name: "GP", amount: 3 }], {}) === null, "no values: no worth");
  done.push("the coins' worth");
} finally {
  await server.stop?.();
}
console.log(`ok currency fg: ${done.join("; ")}`);
process.exit(0);
