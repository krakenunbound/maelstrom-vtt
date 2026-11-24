// The ready check (chat's /readycheck or /rc, the party sheet's Ready check, kraken_ready_check): after a break the GM
// asks who is back. Every player at the table then is waiting; each answers I'm back; everyone sees who is back and who
// is not; it ends by itself when all are back, or when the GM ends it (chat says who is not back). Only the GM starts
// or ends one; a player answers only for themself; a new check ends the last; it is kept with the chat.
import "./loopback.mjs";
import { WebSocket } from "ws";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function connect(port, join) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const lines = [];
    const events = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "chat") lines.push(msg);
      events.push(msg);
      if (msg.type === "no") reject(new Error(`join refused: ${msg.reason}`));
      if (msg.type === "ok") resolve({ ws, lines, events, send: (body) => ws.send(JSON.stringify(body)) });
    });
    ws.on("error", reject);
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", ...join })));
  });
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
const readyLine = (seat) => seat.lines.filter((line) => line.ready).at(-1);
// The check as a seat sees it now: its chat line, updated by "ready" messages.
const seen = (seat) => {
  const line = readyLine(seat);
  if (!line) return null;
  const update = seat.events.filter((event) => event.type === "ready" && event.ready.id === line.ready.id).at(-1);
  return update ? update.ready : line.ready;
};
const done = [];

const server = createTableServer({ ruleset: "Worldbuilding" });
try {
  const { port, hostToken } = await server.listen({ port: 0, password: "" });
  const gm = await connect(port, { name: "GM", hostToken });
  const ann = await connect(port, { name: "Ann" });
  const bob = await connect(port, { name: "Bob" });
  await settle();

  // A player cannot call one.
  ann.send({ type: "ready-check" });
  await settle();
  assert(!readyLine(gm), "a player cannot start a ready check");
  done.push("only the GM starts one");

  // The GM calls it: Ann and Bob wait (not the GM).
  gm.send({ type: "ready-check" });
  await settle();
  let check = seen(ann);
  assert(check && check.open && check.waiting.join() === "Ann,Bob" && check.back.length === 0, `everyone at the table waits: ${JSON.stringify(check)}`);
  assert(seen(bob)?.id === check.id && seen(gm)?.id === check.id, "every seat sees it");
  done.push("every player at the table waits, the GM not");

  // Ann is back; Bob may not answer for her, nor end it.
  ann.send({ type: "ready-back", id: check.id });
  bob.send({ type: "ready-end" });
  await settle();
  check = seen(gm);
  assert(check.open && check.back.join() === "Ann" && check.waiting.join() === "Bob", `Ann back, Bob waiting: ${JSON.stringify(check)}`);
  assert(seen(bob).back.join() === "Ann", "everyone sees who is back");
  ann.send({ type: "ready-back", id: check.id });
  await settle();
  assert(seen(gm).back.join() === "Ann", "answering twice counts once");
  done.push("I'm back moves a player from waiting to back, for all to see; a player cannot end it");

  // Bob is back: it ends by itself, and chat says so.
  bob.send({ type: "ready-back", id: check.id });
  await settle();
  check = seen(gm);
  assert(!check.open && check.waiting.length === 0 && check.back.join() === "Ann,Bob", `all back, closed: ${JSON.stringify(check)}`);
  assert(gm.lines.at(-1).text === "Ready check: everyone is back.", `chat says everyone is back: ${gm.lines.at(-1).text}`);
  done.push("it ends by itself when everyone is back");

  // The GM ends one with Bob still away: chat names him; a late I'm back changes nothing.
  gm.send({ type: "ready-check" });
  await settle();
  const second = seen(gm);
  ann.send({ type: "ready-back", id: second.id });
  await settle();
  gm.send({ type: "ready-end" });
  await settle();
  assert(!seen(gm).open && seen(gm).waiting.join() === "Bob", "ended with Bob not back");
  assert(gm.lines.at(-1).text === "Ready check ended. Not back: Bob.", `chat names who is not back: ${gm.lines.at(-1).text}`);
  bob.send({ type: "ready-back", id: second.id });
  await settle();
  assert(seen(gm).waiting.join() === "Bob", "an ended check takes no answers");
  done.push("the GM ends it; chat names who is not back");

  // A new check ends the open one.
  gm.send({ type: "ready-check" });
  await settle();
  const third = seen(gm);
  gm.send({ type: "ready-check" });
  await settle();
  assert(seen(gm).id !== third.id && server.agent.readyCheck().id === seen(gm).id, "one check at a time");
  const old = gm.events.filter((event) => event.type === "ready" && event.ready.id === third.id).at(-1);
  assert(old && !old.ready.open, "the last one is closed");
  done.push("a new check ends the last");

  // The agent: start, answer for a player, read, end.
  const tool = async (args) => {
    try {
      const result = await callTool("kraken_ready_check", args, { table: () => server });
      return { error: result.isError ? result.content[0].text : null, ...(result.isError ? {} : JSON.parse(result.content[0].text)) };
    } catch (error) {
      return { error: error.message };
    }
  };
  const started = (await tool({ action: "start" })).readyCheck;
  assert(started.open && started.waiting.join() === "Ann,Bob", `the agent starts one: ${JSON.stringify(started)}`);
  assert((await tool({ action: "back", player: "ann" })).readyCheck.back.join() === "Ann", "the agent answers for Ann (any case)");
  assert(/not waiting/.test((await tool({ action: "back", player: "Ann" })).error ?? ""), "Ann is not waiting any more");
  assert((await tool({})).readyCheck.waiting.join() === "Bob", "status reads it");
  assert((await tool({ action: "end" })).readyCheck.open === false, "the agent ends it");
  assert(/no ready check/.test((await tool({ action: "back", player: "Bob" })).error ?? ""), "none open");
  done.push("kraken_ready_check starts, answers, reads and ends it");

  // No players at the table: said, nothing to wait for.
  ann.ws.close();
  bob.ws.close();
  await new Promise((resolve) => setTimeout(resolve, 400));
  const empty = (await tool({ action: "start" })).readyCheck;
  assert(!empty.open && empty.waiting.length === 0, `no players: ${JSON.stringify(empty)}`);
  done.push("with no players it says so and stays closed");

  // Kept with the chat: the campaign reopened has the line.
  const reopened = createTableServer({ ruleset: "Worldbuilding", saved: server.persisted() });
  assert(reopened.agent.readyCheck()?.id === empty.id, "kept with the chat");
  done.push("kept with the chat");

  gm.ws.close();
} finally {
  await server.stop();
}
console.log(`ok ready check: ${done.join("; ")}`);
process.exit(0);
