const path = require("path");
const { pathToFileURL } = require("url");

// Host side of the AD&D 2E ruleset (shared/adnd2e/rules.mjs): characters
// built by the wizard (or taken from a book's pregens), checks, saves and
// thief skills rolled in front of the table, level ups, and the sheet's
// edits. A 2E character's record data has ruleset "adnd2e"; the SIEGE paths
// hand those here.

let loaded = null;
const rules2e = () => (loaded ??= import(pathToFileURL(path.join(__dirname, "..", "shared", "adnd2e", "rules.mjs")).href));
const RULESET_NAME = "AD&D 2E";
const is2eRuleset = (name) => String(name ?? "") === RULESET_NAME;
const is2e = (thing) => thing?.data?.ruleset === "adnd2e";

// The wizard's spec, or a pregen: spec.pregen is a book's FG 2E character
// sheet record (type pregencharsheet) in the campaign.
async function build2e(table, spec, owner, seat) {
  const rules = await rules2e();
  let built;
  if (spec?.pregen) {
    const sheet = table.records.get(String(spec.pregen));
    if (!sheet || sheet.type !== "pregencharsheet") throw new Error("No such pregenerated character: make its book active (Modules).");
    built = { name: String(spec.name ?? "").trim() || sheet.name, data: rules.fromFG(sheet.data), problems: [] };
    // (Its FG portrait path is the book's, not Kraken's art: the GM's art by race and class instead.)
  } else built = rules.buildFromSpec(spec ?? {}, { items: table.records.list({ type: "item" }) });
  const data = withProficiencies(rules, table, require("./characterArt.cjs").withArt(built.data, spec, table.art));
  const record = table.records.create({ type: "character", name: built.name, owner: owner ?? "", visibility: owner ? "owner" : "gm", data }, seat ?? table.seat);
  return { record, problems: built.problems };
}

// A test: kind save (its name: paralyzation, rod, petrification, breath,
// spell), check (an ability: d20 at or under the score), skill (a thief
// skill: d100 at or under) or proficiency (a nonweapon proficiency, skill: its
// name or its place on the sheet's list: an ability check with the
// proficiency's modifier, both from its record in the active books). bonus: a
// modifier (a save's +2 from magic adds to the roll; a check's or skill's comes off it).
async function check2e(table, record, { kind = "check", attribute, skill, bonus = 0, label } = {}, from) {
  const rules = await rules2e();
  const data = rules.derive(record.data);
  const test = kind === "proficiency" ? proficiencyTest(rules, table, data, skill) : rules.testOf(data, kind, kind === "skill" || kind === "table" ? skill : kind === "save" ? attribute : String(attribute ?? "").toLowerCase());
  // A die the test adds to itself (surprise: the Dexterity reaction adjustment) goes with the sheet's modifier.
  const mod = Math.round(Number(bonus) || 0) + Math.round(Number(test.add) || 0);
  // A save adds its modifier; a roll-under check takes a bonus off the die.
  const formula = `${test.die}${mod ? `${test.high ? (mod > 0 ? "+" : "") + mod : (mod > 0 ? "-" : "+") + Math.abs(mod)}` : ""}`;
  // The modifier stack too: added to a save, taken off a roll-under die.
  // A sheet made before its proficiencies showed their targets: kept with them now.
  if (kind === "proficiency") {
    const filled = withProficiencies(rules, table, structuredClone(data));
    if (filled !== data && JSON.stringify(filled.profs) !== JSON.stringify(data.profs)) table.records.update(record.id, { data: filled }, table.seat, { replace: true });
  }
  const rolled = table.act(formula, kind === "save" ? "save" : "check", "", { under: !test.high });
  const success = test.high ? rolled.total >= test.target : rolled.total <= test.target;
  const [yes, no] = test.words ?? ["SUCCESS", "FAILURE"];
  const words = `${label ? `${label} ` : ""}${test.label} [${test.high ? "NEEDS" : "UNDER"} ${test.target}] [${success ? yes : no} ${rolled.total} ${test.high ? "vs" : "under"} ${test.target}]`;
  table.postRoll(rolled, words, from || record.name, false, { by: record.name, result: success ? yes : no, against: test.target });
  // Open Doors: a locked, barred or magically held door its own roll (the bracketed number).
  if (test.then) {
    const again = table.act(`${test.die}${mod ? `${mod > 0 ? "-" : "+"}${Math.abs(mod)}` : ""}`, "check", "", { under: true });
    const opened = again.total <= test.then.target;
    table.postRoll(again, `${test.then.label} [UNDER ${test.then.target}] [${opened ? "SUCCESS" : "FAILURE"} ${again.total} under ${test.then.target}]`, from || record.name, false, { by: record.name, result: opened ? "SUCCESS" : "FAILURE", against: test.then.target });
  }
  return { total: rolled.total, target: test.target, success };
}

// A nonweapon proficiency as the active books have it ("Blind-Fighting [2]" is
// Blind-fighting): { found, stat, mod } (stat "" when its book gives it no ability), or null.
function proficiencyOf(rules, table, name) {
  const plain = (text) => String(text ?? "").replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/[^a-z]/gi, "").toLowerCase();
  const found = table.records.list({ type: "skill" }).find((item) => plain(item.name) === plain(name));
  if (!found) return null;
  const stat = String(found.data?.stat ?? "").toLowerCase();
  return { found, stat: rules.STATS.includes(stat) ? stat : "", mod: Math.round(Number(found.data?.adj_mod) || 0) };
}
// The sheet's proficiency rows with their ability and modifier from the books (the engine's, as FG's
// sheet shows each skill's target), worked out again: a character's data, ready to keep.
function withProficiencies(rules, table, data) {
  let changed = false;
  for (const row of Object.values(data.profs?.checks ?? {})) {
    if (!row || row.stat) continue;
    const known = proficiencyOf(rules, table, row.name);
    if (!known?.stat) continue;
    row.stat = known.stat;
    row.mod = known.mod;
    changed = true;
  }
  return changed ? rules.derive(data) : data;
}
// A nonweapon proficiency's check: its ability (d20 at or under the score) and modifier.
function proficiencyTest(rules, table, data, skill) {
  const list = data.profs?.nonweapon ?? [];
  const name = /^\d+$/.test(String(skill ?? "")) ? list[Number(skill)] : String(skill ?? "").trim();
  if (!name) throw new Error("No such proficiency on the sheet.");
  // The sheet's row (its ability and modifiers, the player's choice kept), else the book's record.
  const row = Object.values(data.profs?.checks ?? {}).find((item) => item?.name === name);
  if (row?.stat) {
    const test = rules.testOf(data, "check", row.stat);
    const adjust = Math.round(Number(row.mod) || 0) + Math.round(Number(row.misc) || 0);
    return { ...test, target: test.target + adjust, label: `[PROFICIENCY] ${name} (${rules.titled(row.stat)}${adjust ? ` ${rules.signed(adjust)}` : ""})` };
  }
  const known = proficiencyOf(rules, table, name);
  if (!known) throw new Error(`No ${name} in the active books: make the book that has it active (Modules), or pick its ability on the sheet.`);
  if (!known.stat) throw new Error(`${known.found.name} has no check (its book gives it no ability): pick one on the sheet.`);
  const test = rules.testOf(data, "check", known.stat);
  return { ...test, target: test.target + known.mod, label: `[PROFICIENCY] ${known.found.name} (${rules.titled(known.stat)}${known.mod ? ` ${rules.signed(known.mod)}` : ""})` };
}

async function levelUp2e(table, record, from, className) {
  const rules = await rules2e();
  const data = rules.derive(record.data);
  const cls = data.classes.find((item) => item.name.toLowerCase() === String(className ?? "").toLowerCase()) ?? data.classes[0];
  if (!cls) throw new Error("This character has no class.");
  const die = rules.GROUPS[cls.group].die;
  const past = cls.level + 1 > rules.GROUPS[cls.group].top;
  const roll = past ? null : table.roll(`1d${die}`, `${record.name}: ${cls.name} ${cls.level + 1} hit points`, from || record.name);
  const { data: next, gain } = rules.levelUp(data, roll?.total, cls.name);
  const updated = table.records.update(record.id, { data: next }, table.seat, { replace: true });
  const now = next.classes.find((item) => item.name === cls.name);
  table.say(`[LEVEL UP] ${record.name} is now a level ${now.level} ${cls.name}: +${gain} hit points (${next.hp.total}), THAC0 ${next.thaco}.${next.thiefskills ? " Spend the new thief skill points on the sheet." : ""}`, from || record.name);
  return { record: updated, gain, level: now.level };
}

// What the 2E sheet may change (the manifest's edit globs: shared/rulesets/edit.mjs),
// then every number worked out again.
const { default: MANIFEST } = require("../shared/adnd2e/manifest.mjs");
const { editPaths } = require("../shared/rulesets/edit.mjs");
const EDIT_PATHS = editPaths(MANIFEST.edit);
const TEXT = EDIT_PATHS.text;
const NUMBERS = EDIT_PATHS.number;
const LISTS = EDIT_PATHS.list;
function setPath(data, key, value) {
  const keys = key.split(".");
  let node = data;
  for (const part of keys.slice(0, -1)) {
    if (Array.isArray(node[part])) node = node[part];
    else node = node[part] = node[part] && typeof node[part] === "object" ? node[part] : {};
  }
  node[keys.at(-1)] = value;
}
const listOf = (value) => (Array.isArray(value) ? value : String(value ?? "").split(/\n|,(?![^(]*\))/)).map((item) => String(item).trim()).filter(Boolean).slice(0, 200);
async function edit2e(table, record, changes, seat) {
  if (seat.role !== "dm" && record.owner !== seat.name) throw new Error("You can only change your own character.");
  if (!Array.isArray(changes) || changes.length === 0) throw new Error("What changes?");
  const rules = await rules2e();
  const data = structuredClone(record.data);
  let name = record.name;
  for (const change of changes.slice(0, 50)) {
    const key = String(change?.path ?? "");
    const value = change?.value;
    if (key === "name") name = String(value ?? "").trim().slice(0, 120) || record.name;
    else if (TEXT.some((pattern) => pattern.test(key))) data[key] = String(value ?? "").slice(0, 8000);
    // A row's words (an item's location: the container it is in), from the manifest's string list.
    else if (EDIT_PATHS.string.some((pattern) => pattern.test(key))) setPath(data, key, String(value ?? "").slice(0, 120));
    else if (LISTS.some((pattern) => pattern.test(key))) setPath(data, key, listOf(value));
    else if (NUMBERS.some((pattern) => pattern.test(key))) {
      const n = Number(value);
      if (!Number.isFinite(n) || Math.abs(n) > 1e7) throw new Error(`${key} needs a number.`);
      setPath(data, key, /(^spellcasting|\.points$|^hp\.(wounds|temp))/.test(key) ? Math.max(0, Math.round(n)) : Math.round(n));
    } else if (EDIT_PATHS.remove.some((pattern) => pattern.test(key)) && value === null) delete data[key.split(".")[0]]?.[key.split(".")[1]];
    else throw new Error(`The sheet cannot change ${key}.`);
  }
  return table.records.update(record.id, { name, data: withProficiencies(rules, table, rules.derive(data)) }, table.seat, { replace: true });
}

module.exports = { rules2e, build2e, check2e, levelUp2e, edit2e, is2e, is2eRuleset, RULESET_NAME, EDIT_PATHS };
