// 5E 2024's bastions (FG's CharBastionManager and the party sheet's Bastion tab), for any game whose manifest
// declares them (bastion: { rule, orders }):
//  - a character's bastion (FG keeps it as a location under the character): its name and its facilities, each with
//    the order it is carrying out and the bastion turns left; a facility may link a record (a location, its map)
//  - an order given to a facility (FG's order dragged onto it): the same order again adds a turn
//  - the GM advances the bastion turn: the log gets the turn (each member's facilities, their orders and turns
//    left) and every order counts down, one at 0 cleared; the GM clears an order, the log, and sets the turn count
// A character's owner manages their own bastion; the GM any. Off unless the house rule (HRBASTION) is on.
const { PARTY_ID, partyRecord } = require("./party.cjs");

const text = (value, max = 120) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const escape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rows = (value) => Object.entries(value && typeof value === "object" ? value : {}).filter(([, row]) => row && typeof row === "object");

function declared(table) {
  const { rulesetFor } = require("../shared/rulesets/registry.mjs");
  const spec = rulesetFor(table.ruleset?.() ?? "").bastion;
  if (!spec) throw new Error("This game has no bastions.");
  if (spec.rule && !table.houseRule?.(spec.rule)) throw new Error("Bastions are off: turn them on in Settings > House rules.");
  return spec;
}

/** A character's bastion as kept: { name, facilities: { id: { name, order, duration, link? } } }. */
function bastionOf(record) {
  const kept = record?.data?.bastion && typeof record.data.bastion === "object" ? record.data.bastion : {};
  return { name: text(kept.name) || `${record?.name ?? "Character"} Bastion`, facilities: Object.fromEntries(rows(kept.facilities)) };
}

function characterFor(table, seat, id) {
  const record = table.records.get(String(id ?? ""));
  if (!record || record.type !== "character") throw new Error("No such character.");
  if (seat.role !== "dm" && String(record.owner ?? "").toLowerCase() !== String(seat.name ?? "").toLowerCase()) throw new Error("That is not your character.");
  return record;
}
const nextKey = (list) => {
  let n = Object.keys(list).length + 1;
  while (list[`id-${String(n).padStart(5, "0")}`]) n += 1;
  return `id-${String(n).padStart(5, "0")}`;
};
const GM_SEAT = { role: "dm", name: "GM" };
const save = (table, record, bastion) => table.records.update(record.id, { data: { bastion } }, GM_SEAT);

// The party's log: { turn, text } on the party record.
function logOf(table) {
  const log = partyRecord(table).data.bastionlog ?? {};
  return { turn: Math.max(0, Math.round(Number(log.turn) || 0)), text: String(log.text ?? "") };
}
const saveLog = (table, log) => table.records.update(PARTY_ID, { data: { bastionlog: log } }, GM_SEAT);

function members(table) {
  const ids = Array.isArray(partyRecord(table).data.members) ? partyRecord(table).data.members : [];
  return ids.map((id) => table.records.get(id)).filter((record) => record?.type === "character");
}

/**
 * @param {any} table the agent handle
 * @param {{ role: string; name: string }} seat
 * @param {Record<string, any>} msg { action, character, facility, name, order, link, turn }
 */
function bastionAction(table, seat, msg) {
  const spec = declared(table);
  const action = String(msg.action ?? "");
  const gmOnly = () => {
    if (seat.role !== "dm") throw new Error("That is the GM's.");
  };
  if (action === "advance") {
    gmOnly();
    const log = logOf(table);
    const parts = [`<h>BASTION TURN: ${log.turn}</h>`];
    for (const member of members(table)) {
      const bastion = bastionOf(member);
      const list = rows(bastion.facilities);
      if (!list.length) continue;
      parts.push(`<p><b>${escape(member.name)}</b></p><list>${list.map(([, row]) => `<li>${escape(row.name)} - ${row.order ? `${escape(row.order)} - ${Math.max(Number(row.duration) - 1, 0)} TURNS LEFT` : "No order"}</li>`).join("")}</list>`);
      // Every order counts down a turn; one that reaches 0 is done.
      const facilities = Object.fromEntries(list.map(([id, row]) => {
        const left = Math.max((Number(row.duration) || 0) - 1, 0);
        return [id, { ...row, order: left ? row.order : "", duration: left }];
      }));
      save(table, member, { ...bastion, facilities });
    }
    saveLog(table, { turn: log.turn + 1, text: `${log.text}${parts.join("")}` });
    table.say?.(`[BASTION] Turn ${log.turn} done; the orders count down.`, "GM", true);
    return { turn: log.turn + 1, log: logOf(table).text };
  }
  if (action === "log-clear") {
    gmOnly();
    saveLog(table, { ...logOf(table), text: "" });
    return logOf(table);
  }
  if (action === "turn") {
    gmOnly();
    saveLog(table, { ...logOf(table), turn: Math.max(0, Math.min(9999, Math.round(Number(msg.turn) || 0))) });
    return logOf(table);
  }
  if (action === "log") return logOf(table);

  const record = characterFor(table, seat, msg.character);
  const bastion = bastionOf(record);
  const facility = () => {
    const id = String(msg.facility ?? "");
    if (!bastion.facilities[id]) throw new Error("No such facility.");
    return id;
  };
  if (action === "name") {
    bastion.name = text(msg.name) || bastion.name;
  } else if (action === "add") {
    // A facility by name, or a record dropped (a location): its name and a link to it.
    const link = msg.link && typeof msg.link === "object" && msg.link.kind === "record" ? { kind: "record", record: text(msg.link.record, 200), label: text(msg.link.label) } : null;
    const name = text(msg.name) || link?.label || "";
    if (!name) throw new Error("Name the facility.");
    if (Object.keys(bastion.facilities).length >= 40) throw new Error("A bastion has room for 40 facilities.");
    bastion.facilities[nextKey(bastion.facilities)] = { name, order: "", duration: 0, ...(link ? { link } : {}) };
  } else if (action === "rename") {
    const id = facility();
    bastion.facilities[id] = { ...bastion.facilities[id], name: text(msg.name) || bastion.facilities[id].name };
  } else if (action === "remove") {
    const id = facility();
    // As kept: the whole bastion written again without it (a facility removed is gone, not merged back).
    table.records.update(record.id, { data: { bastion: { facilities: { [id]: null } } } }, GM_SEAT);
    delete bastion.facilities[id];
    return { character: record.id, bastion };
  } else if (action === "order") {
    const id = facility();
    const order = spec.orders.find((item) => item.toLowerCase() === String(msg.order ?? "").toLowerCase());
    if (!order) throw new Error(`An order is one of ${spec.orders.join(", ")}.`);
    const row = bastion.facilities[id];
    // FG's: the same order again is a turn more; another order starts over at one turn.
    bastion.facilities[id] = row.order === order ? { ...row, duration: Math.min(99, (Number(row.duration) || 0) + 1) } : { ...row, order, duration: 1 };
  } else if (action === "clear") {
    gmOnly();
    const id = facility();
    bastion.facilities[id] = { ...bastion.facilities[id], order: "", duration: 0 };
  } else throw new Error("A bastion action: name, add, rename, remove, order, clear, advance, log, log-clear or turn.");
  save(table, record, bastion);
  return { character: record.id, bastion };
}

module.exports = { bastionAction, bastionOf };
