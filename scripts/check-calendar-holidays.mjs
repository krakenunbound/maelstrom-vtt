// Holidays on calendar days (FG's period holidays: a name, a start day, a duration):
//  - a calendar's own (the Gregorian's Christmas Day) in today's words and said with the date
//  - the GM's own: added on a month's day, lasting days, shown on each of them and kept with the campaign, for that
//    calendar only; a day out of the month or a month out of the year refused; a calendar's own not taken out; the
//    players may not add them
//  - the agent's kraken_calendar holiday-add (months 1-based) and say
import "./loopback.mjs";
import { createRequire } from "node:module";
import { calendarOf, dayOfYear, holidaysOn } from "../shared/calendars.mjs";

const require = createRequire(import.meta.url);
const { createCalendar } = require("../electron/calendar.cjs");
const { createTableServer } = require("../electron/tableServer.cjs");
const { callTool } = require("../electron/agent/tools.cjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const done = [];
const GM = { role: "dm", name: "GM" };
const ann = { role: "player", name: "Ann" };
const refused = (fn) => {
  try {
    fn();
    return "";
  } catch (error) {
    return String(error);
  }
};

// 1. A calendar's own.
const gregorian = calendarOf("gregorian");
const cal = createCalendar({ saved: { id: "gregorian", year: 2026 } });
cal.set({ day: dayOfYear(gregorian, 2026, 11, 25) }, GM);
assert(/Christmas Day/.test(cal.view(GM).today) && cal.view(GM).holidays.some((item) => item.builtin && item.name === "Christmas Day"), `today's words: ${cal.view(GM).today}`);
cal.set({ day: dayOfYear(gregorian, 2026, 11, 26) }, GM);
assert(!/\(/.test(cal.view(GM).today.split(",").slice(0, 2).join(",")) && !/Christmas/.test(cal.view(GM).today), `the next day is not: ${cal.view(GM).today}`);
done.push("a calendar's own holiday in today's words");

// 2. The GM's own.
const fair = cal.addHoliday({ name: "Harvest Fair", month: 8, day: 20, days: 3 }, GM);
const on = (day) => holidaysOn(gregorian, 2026, dayOfYear(gregorian, 2026, 8, day), cal.view(GM).holidays);
assert(on(19).length === 0 && on(20).join() === "Harvest Fair" && on(22).join() === "Harvest Fair" && on(23).length === 0, "three days long");
cal.addHoliday({ name: "Market Day", month: 8, day: 21 }, GM);
cal.set({ day: dayOfYear(gregorian, 2026, 8, 21) }, GM);
assert(/\(Harvest Fair \/ Market Day\)/.test(cal.view(GM).today), `two on one day: ${cal.view(GM).today}`);
assert(/GM/.test(refused(() => cal.addHoliday({ name: "Ann's Day", month: 0, day: 1 }, ann))), "a player may not add one");
assert(/has 30 days/.test(refused(() => cal.addHoliday({ name: "Nope", month: 8, day: 31 }, GM))) && /12 months/.test(refused(() => cal.addHoliday({ name: "Nope", month: 12, day: 1 }, GM))), "out of the month or the year refused");
assert(/cannot be taken out/.test(refused(() => cal.removeHoliday("christmas", GM))), "a calendar's own stays");
const kept = createCalendar({ saved: cal.persisted() });
assert(kept.view(GM).holidays.filter((item) => !item.builtin).map((item) => item.name).join() === "Harvest Fair,Market Day", "kept with the campaign");
kept.set({ id: "greyhawk" }, GM);
assert(!kept.view(GM).holidays.some((item) => item.name === "Harvest Fair"), "another calendar's not shown");
kept.set({ id: "gregorian" }, GM);
kept.removeHoliday(fair.id, GM);
assert(kept.view(GM).holidays.filter((item) => !item.builtin).map((item) => item.name).join() === "Market Day", "taken out");
done.push("the GM's own: days long, two on a day, kept, for its calendar; checks");

// 3. The agent.
const server = createTableServer({ ruleset: "Castles & Crusades" });
await server.listen({ port: 0, password: "" });
try {
  const tool = async (args) => {
    const result = await callTool("kraken_calendar", args, { table: () => server });
    if (result.isError) throw new Error(result.content[0].text);
    return JSON.parse(result.content[0].text);
  };
  const greyhawk = calendarOf("greyhawk");
  await tool({ action: "set", calendar: "greyhawk", year: 576, month: 2, day: 14 });
  const made = await tool({ action: "holiday-add", name: "Feast of the Founding", month: 2, day: 14, days: 2 });
  assert(made.month === 1 && made.day === 14 && made.days === 2, `added: ${JSON.stringify(made)}`);
  const view = await tool({ action: "view" });
  assert(/Feast of the Founding/.test(view.today) && holidaysOn(greyhawk, 576, view.day + 1, view.holidays).join() === "Feast of the Founding", `on its days: ${view.today}`);
  await tool({ action: "say" });
  assert(server.agent.chatLog(3).some((line) => /\[DATE\].*Feast of the Founding/.test(line.text ?? "")), "said with the date");
  done.push("the agent adds one and says the date with it");
} finally {
  await server.stop?.();
}
console.log(`ok calendar holidays: ${done.join("; ")}`);
process.exit(0);
