const path = require("path");
const { pathToFileURL } = require("url");

// Host side of the games defined by their books (shared/packgame, docs/pack-games.md): characters built by the
// wizard, checks and saves rolled in front of the table, level ups and the sheet's edits, for any such game. The game
// is the registered manifest's definition; its numbers are the campaign's records (classes, items) and the active
// books' tables. A character of one has data.ruleset = the game's id ("packbecmi").

let loaded = null;
const rulesPg = () => (loaded ??= import(pathToFileURL(path.join(__dirname, "..", "shared", "packgame", "rules.mjs")).href));
const registry = () => require("../shared/rulesets/registry.mjs");

// The game of a campaign (by its name) or of a record (by its data.ruleset), when it is a pack's.
const gameNamed = (name) => registry().rulesetNamed(String(name ?? ""))?.packGame ?? null;
const gameOf = (record) => {
  const id = String(record?.data?.ruleset ?? "");
  return id.startsWith("pack") ? (registry().packGames().find((game) => game.id === id) ?? null) : null;
};
const isPgRuleset = (name) => Boolean(gameNamed(name));
const isPg = (record) => Boolean(gameOf(record));

// What the rules read: the game, its classes and items (the campaign's records from the active books), the books' tables.
function libOf(table, game) {
  return {
    game,
    classes: table.records.list({ type: game.classType }),
    items: table.records.list({ type: "item" }),
    tables: (() => {
      try {
        return table.bookTables?.() ?? [];
      } catch {
        return [];
      }
    })(),
  };
}

async function buildPg(table, game, spec, owner, seat) {
  const rules = await rulesPg();
  const lib = libOf(table, game);
  if (!lib.classes.length) throw new Error(`No classes in this campaign: make the ${game.name} rules book active (Modules).`);
  // The first hit die, rolled by the host when the wizard did not.
  // A book's sample character, as the book made it (the wizard's first step, kraken_build_character { pregen }).
  if (spec?.pregen) {
    const wanted = String(spec.pregen).toLowerCase();
    const pregen = table.records.list({ type: "pregencharsheet" }).find((item) => item.id.toLowerCase() === wanted || String(item.name).toLowerCase() === wanted);
    if (!pregen) throw new Error(`No sample character ${spec.pregen} in the active books.`);
    const taken = rules.fromPregen({ ...pregen, data: { ...pregen.data, name: String(spec.name ?? "").trim() || pregen.name } }, lib);
    const data = require("./characterArt.cjs").withArt(taken.data, { ...spec, race: taken.data.race, class: taken.data.className }, table.art);
    const record = table.records.create({ type: "character", name: taken.name, owner: owner ?? "", visibility: owner ? "owner" : "gm", data }, seat ?? table.seat);
    return { record, problems: taken.problems };
  }
  const cls = rules.classOf(lib, spec?.class);
  const hpRoll = Number.isFinite(Number(spec?.hpRoll)) ? Number(spec.hpRoll) : table.roll(`1d${rules.hitDie(cls)}`, `${spec?.name || "New character"}: hit points (${cls?.name ?? "class"})`, owner || "GM")?.total;
  const built = rules.buildFromSpec({ ...(spec ?? {}), hpRoll }, lib);
  // The books' rules hold (a class's minimum scores, the money): the GM may force it.
  if (built.problems.length && !spec?.force) throw new Error(built.problems.join(" "));
  const data = require("./characterArt.cjs").withArt(built.data, { ...spec, race: built.data.race, class: built.data.className }, table.art);
  const record = table.records.create({ type: "character", name: built.name, owner: owner ?? "", visibility: owner ? "owner" : "gm", data }, seat ?? table.seat);
  return { record, problems: built.problems };
}

// A test in front of the table: a save (at or above, the game's naturals), an ability check, a skill, loyalty.
async function checkPg(table, record, { kind = "check", attribute, skill, bonus = 0, label } = {}, from) {
  const game = gameOf(record);
  if (!game) throw new Error("Not a game defined by its books.");
  const rules = await rulesPg();
  const data = rules.derive(record.data, libOf(table, game));
  const which = kind === "skill" ? skill : String(attribute ?? "").toLowerCase();
  const test = rules.testOf(data, kind, which, game);
  const mod = Math.round(Number(bonus) || 0);
  const formula = `${test.die}${mod ? (test.high ? rules.signed(mod) : mod > 0 ? `-${mod}` : `+${-mod}`) : ""}`;
  const rolled = table.act(formula, kind === "save" ? "save" : "check", "", { under: !test.high });
  const die = rolled.terms?.[0]?.rolls?.[0];
  let success = test.high ? rolled.total >= test.target : rolled.total <= test.target;
  const natural = kind === "save" && (die === game.save.naturalFail || die === game.save.naturalPass);
  if (kind === "save" && die === game.save.naturalFail) success = false;
  if (kind === "save" && die === game.save.naturalPass) success = true;
  const words = `${label ? `${label} ` : ""}${test.label} [${test.high ? "NEEDS" : "UNDER"} ${test.target}] [${success ? "SUCCESS" : "FAILURE"} ${rolled.total} ${test.high ? "vs" : "under"} ${test.target}]${natural ? ` [NATURAL ${die}]` : ""}`;
  table.postRoll(rolled, words, from || record.name, false, { by: record.name, result: success ? "SUCCESS" : "FAILURE", against: test.target });
  return { total: rolled.total, target: test.target, success };
}

async function levelUpPg(table, record, from) {
  const game = gameOf(record);
  const rules = await rulesPg();
  const lib = libOf(table, game);
  const data = rules.derive(record.data, lib);
  const die = rules.levelUpDie(data, lib);
  const roll = die ? table.roll(`1d${die}`, `${record.name}: ${data.className} ${data.level + 1} hit points`, from || record.name) : null;
  const { data: next, gain } = rules.levelUp(data, roll?.total, lib);
  const updated = table.records.update(record.id, { data: next }, table.seat, { replace: true });
  table.say(`[LEVEL UP] ${record.name} is now a level ${next.level} ${next.className}${next.leveltitle ? ` (${next.leveltitle})` : ""}: +${gain} hit points (${next.hp.total})${game.attack.by === "thac0" ? `, THAC0 ${next.thac0}` : ""}.${next.spellcasting ? ` Spells a day: ${next.spellcasting.perday.filter(Boolean).join("/")}.` : ""}`, from || record.name);
  return { record: updated, gain, level: next.level };
}

// What the sheet may change (the game's manifest's edit globs), then every number worked out again.
const { editPaths } = require("../shared/rulesets/edit.mjs");
function setPath(data, key, value) {
  const keys = key.split(".");
  let node = data;
  for (const part of keys.slice(0, -1)) {
    if (Array.isArray(node[part])) node = node[part];
    else node = node[part] = node[part] && typeof node[part] === "object" ? node[part] : {};
  }
  node[keys.at(-1)] = value;
}
const listOf = (value) => (Array.isArray(value) ? value : String(value ?? "").split(/\n|,/)).map((item) => String(item).trim()).filter(Boolean).slice(0, 200);
async function editPg(table, record, changes, seat) {
  if (seat.role !== "dm" && record.owner !== seat.name) throw new Error("You can only change your own character.");
  if (!Array.isArray(changes) || changes.length === 0) throw new Error("What changes?");
  const game = gameOf(record);
  const manifest = registry().rulesetOfRecord(record.data.ruleset);
  const paths = editPaths(manifest.edit);
  const rules = await rulesPg();
  const data = structuredClone(record.data);
  let name = record.name;
  for (const change of changes.slice(0, 50)) {
    const key = String(change?.path ?? "");
    const value = change?.value;
    if (key === "name") name = String(value ?? "").trim().slice(0, 120) || record.name;
    else if (paths.text.some((pattern) => pattern.test(key))) data[key] = String(value ?? "").slice(0, 8000);
    else if (paths.string.some((pattern) => pattern.test(key))) setPath(data, key, String(value ?? "").slice(0, 120));
    else if (paths.list.some((pattern) => pattern.test(key))) data[key] = listOf(value);
    else if (paths.number.some((pattern) => pattern.test(key))) {
      const n = Number(value);
      if (!Number.isFinite(n) || Math.abs(n) > 1e7) throw new Error(`${key} needs a number.`);
      setPath(data, key, /(^spellcasting|^hp\.wounds|amount$|count$)/.test(key) ? Math.max(0, Math.round(n)) : Math.round(n));
    } else if (paths.remove.some((pattern) => pattern.test(key)) && value === null) delete data[key.split(".")[0]]?.[key.split(".")[1]];
    else throw new Error(`The sheet cannot change ${key}.`);
  }
  return table.records.update(record.id, { name, data: rules.derive(data, libOf(table, game)) }, table.seat, { replace: true });
}

module.exports = { rulesPg, libOf, gameNamed, gameOf, isPg, isPgRuleset, buildPg, checkPg, levelUpPg, editPg };
