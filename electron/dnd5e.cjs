const path = require("path");
const { pathToFileURL } = require("url");

// Host side of the D&D 5E ruleset (shared/dnd5e/rules.mjs; the GM's 5E books):
// characters built from the campaign's active books, checks, saves and skills
// rolled in front of the table, level ups, and the sheet's edits. A 5E
// character's record data has ruleset "dnd5e"; the SIEGE paths hand those here.

let loaded = null;
const rules5e = () => (loaded ??= import(pathToFileURL(path.join(__dirname, "..", "shared", "dnd5e", "rules.mjs")).href));
let levelUpLoaded = null;
const levelUpRules = () => (levelUpLoaded ??= import(pathToFileURL(path.join(__dirname, "..", "shared", "dnd5e", "levelup.mjs")).href));
const RULESET_NAME = "D&D 5E";
// The d20 family's games (shared/dnd5e/rules.mjs PROFILES): their campaign names and record ids.
const D20 = { "D&D 5E": "dnd5e", "Descending Darkness": "descending" };
const isD20Ruleset = (name) => Object.prototype.hasOwnProperty.call(D20, String(name ?? ""));
const is5e = (thing) => Object.values(D20).includes(thing?.data?.ruleset);
// The record types a 5E book's activation copies in (beside items, NPCs and spells).
const TYPES_5E = ["class", "race", "race_subrace", "background", "feat", "skill", "class_specialization"];

function library5e(records) {
  const list = (type) => records.list({ type });
  // (spells: a level up's new ones, shared/dnd5e/levelup.mjs)
  return { classes: list("class"), species: list("race"), ancestries: list("race_subrace"), backgrounds: list("background"), subclasses: list("class_specialization"), feats: list("feat"), items: list("item"), spells: list("spell") };
}

async function build5e(table, spec, owner, seat) {
  const rules = await rules5e();
  // A book's pregenerated character (type pregencharsheet: an FG 5E character sheet), taken whole as an import is.
  if (spec?.pregen) {
    const wanted = String(spec.pregen).toLowerCase();
    const sheet = table.records.get(String(spec.pregen)) ?? table.records.list({ type: "pregencharsheet" }).find((item) => String(item.name).toLowerCase() === wanted);
    if (!sheet || sheet.type !== "pregencharsheet") throw new Error("No such pregenerated character: make its book active (Modules).");
    const { fromFg5eCharacter } = await import(require("url").pathToFileURL(require("path").join(__dirname, "..", "shared", "dnd5e", "fgcharacter.mjs")).href);
    const name = String(spec.name ?? "").trim() || sheet.name;
    // Made by Maelstrom (a pack's own 5E sheet, data.ruleset set) as it is; else an FG 5E sheet, read as an import is.
    const data = sheet.data?.ruleset && sheet.data?.species !== undefined ? rules.derive({ ...structuredClone(sheet.data), name }) : rules.derive(fromFg5eCharacter({ ...sheet.data, name }, { skillKey: rules.skillKey, spellSlug: rules.spellSlug, rulesetId: D20[table.ruleset?.()] ?? "dnd5e" }));
    const withArt = require("./characterArt.cjs").withArt(data, spec, table.art);
    const record = table.records.create({ type: "character", name: withArt.name || sheet.name, owner: owner ?? "", visibility: owner ? "owner" : "gm", data: withArt }, seat ?? table.seat);
    return { record, problems: [] };
  }
  const lib = library5e(table.records);
  if (lib.classes.length === 0) throw new Error(table.ruleset?.() === "Descending Darkness" ? "No classes in this campaign: make the Descending Darkness Player's Handbook active (Modules)." : "No 5E classes in this campaign: make a 5E Player's Handbook active (Modules).");
  const built = rules.buildFromSpec(spec ?? {}, lib, D20[table.ruleset?.()] ?? "dnd5e");
  const data = require("./characterArt.cjs").withArt(built.data, spec, table.art);
  const record = table.records.create({ type: "character", name: built.name, owner: owner ?? "", visibility: owner ? "owner" : "gm", data }, seat ?? table.seat);
  return { record, problems: built.problems };
}

// A d20 test: kind check (an ability), save, or skill; advantage or
// disadvantage (2d20, the higher or lower kept); dc to say success or failure.
async function check5e(table, record, { kind = "check", attribute, skill, dc, bonus = 0, advantage = "", label } = {}, from) {
  const rules = await rules5e();
  const key = kind === "skill" ? rules.skillKey(skill) : kind === "init" ? "dexterity" : String(attribute ?? "").toLowerCase();
  if (kind !== "skill" && !rules.STATS.includes(key)) throw new Error("Pick an ability.");
  const { modifier, label: tag } = rules.testModifier(record.data, kind, key);
  const total = modifier + (Number(bonus) || 0);
  const shaken = rules.dreadAdvantage(record.data, kind, key, advantage);
  advantage = shaken.advantage;
  const dice = advantage === "advantage" ? "2d20kh1" : advantage === "disadvantage" ? "2d20kl1" : "1d20";
  const formula = `${dice}${total ? rules.signed(total) : ""}`;
  const against = Number(dc) > 0 ? Math.round(Number(dc)) : null;
  // The result goes with the roll card (FG's [SUCCESS] / [FAILURE] after the roll).
  const rolled = table.act(formula, kind === "save" ? "save" : "check");
  // FG 5E's reliable skill rolls (HRFL: Insight, Investigation and Perception, or every skill): a d20 under 10 counts as 10.
  const reliableRule = kind === "skill" ? table.houseRule?.("HRFL") : "";
  const reliable = reliableRule === "all" || (reliableRule === "passive" && ["insight", "investigation", "perception"].includes(key));
  const kept = (rolled.terms?.[0]?.rolls ?? []).filter((_die, index) => rolled.terms[0].kept?.[index] !== false);
  const natural = kept.length ? Math.max(...kept) : null;
  if (reliable && natural !== null && natural < 10) rolled.total += 10 - natural;
  const success = against === null ? null : rolled.total >= against;
  const words = `${label ? `${label} ` : ""}${tag}${reliable ? " [RELIABLE]" : ""}${shaken.dread ? " [DREAD]" : ""}${advantage ? ` [${advantage.toUpperCase()}]` : ""}${against !== null ? ` [DC ${against}] [${success ? "SUCCESS" : "FAILURE"} ${rolled.total} vs ${against}]` : ""}`;
  table.postRoll(rolled, words, from || record.name, false, { by: record.name, ...(against !== null ? { result: success ? "SUCCESS" : "FAILURE", against } : {}) });
  // Initiative rolled from the sheet sets the character's place on the tracker (FG's).
  if (kind === "init") {
    const entry = table.combat?.viewFor?.({ role: "dm", name: "GM" })?.entries?.find((item) => item.recordId === record.id);
    if (entry) await table.combat.update(entry.id, { initresult: rolled.total }, table.seat);
  }
  return { total: rolled.total, d20: rolled.terms[0].rolls, modifier: total, dc: against, success };
}

// One level more, in the class chosen (packageKey: a class package's key or a class's name; a class the character
// has not yet taken joins at level 1, its hit die from the campaign's class record: FG's multiclass).
// choices (FG's level up through the wizard): hp "average" (the die's fixed value, else rolled), subclass, asi
// {stat: n}, feat; the level's features are added either way (shared/dnd5e/levelup.mjs).
async function levelUp5e(table, record, from, packageKey, choices = {}) {
  const rules = await rules5e();
  const { levelUpPlan, applyLevelUp } = await levelUpRules();
  const plan = levelUpPlan(record.data, library5e(table.records), packageKey);
  const classes = Object.entries(record.data.packages ?? {}).filter(([, item]) => String(item.packagetype).toLowerCase() === "class");
  const wanted = String(packageKey ?? "").trim();
  const owned = classes.find(([key, item]) => key === wanted || String(item.name).toLowerCase() === wanted.toLowerCase());
  let choice = owned ? { key: owned[0] } : {};
  if (wanted && !owned) {
    const lib = library5e(table.records);
    const cls = lib.classes.find((item) => item.name.toLowerCase() === wanted.toLowerCase());
    if (!cls) throw new Error(`No class "${wanted}" in this campaign's books.`);
    choice = { className: cls.name, hitdie: rules.hitDie(cls) };
  }
  const pkg = owned?.[1] ?? (choice.className ? { name: choice.className, hitdie: choice.hitdie, level: 0 } : classes[0]?.[1]);
  const die = Number(pkg?.hitdie) || Number(record.data.hitdice?.die) || 8;
  const classLevel = (classes.length > 1 || choice.className ? Number(pkg?.level) || 0 : Number(record.data.level) || 1) + 1;
  // The hit die rolled in front of the table, or its fixed value (half the die + 1).
  const average = choices?.hp === "average";
  const rolled = average ? Math.floor(die / 2) + 1 : table.roll(`1d${die}`, `${record.name}: ${pkg?.name ?? "Class"} ${classLevel} hit points`, from || record.name).total;
  const raised = rules.levelUp(record.data, rolled, choice);
  const { gain, className } = raised;
  const data = plan ? rules.derive(applyLevelUp(raised.data, plan, choices ?? {}, library5e(table.records))) : raised.data;
  const updated = table.records.update(record.id, { data }, table.seat, { replace: true });
  const line = rules.classLine ? rules.classLine(data) : className;
  const gained = [
    ...(plan?.features ?? []).map((feature) => feature.name),
    ...(choices?.subclass ? [choices.subclass] : []),
    ...Object.entries(choices?.asi ?? {}).filter(([, n]) => Number(n) > 0).map(([stat, n]) => `${stat[0].toUpperCase()}${stat.slice(1, 3)} +${n}`),
    ...(choices?.feat ? [choices.feat] : []),
    ...((choices?.expertise ?? []).length ? [`Expertise: ${choices.expertise.join(", ")}`] : []),
    ...((choices?.spells ?? []).length ? [`Spells: ${choices.spells.join(", ")}`] : []),
  ];
  table.say(`[LEVEL UP] ${record.name} is now ${line || className} (level ${data.level}): +${gain} hit points${average ? " (fixed)" : ""} (${data.hp.total}), proficiency ${rules.signed(data.prof)}.${gained.length ? ` ${gained.join(", ")}.` : ""}`, from || record.name);
  return { record: updated, gain, level: data.level, note: "" };
}

// What the 5E sheet may change (the manifest's edit globs: shared/rulesets/edit.mjs),
// then every number worked out again.
const { default: MANIFEST } = require("../shared/dnd5e/manifest.mjs");
const { editPaths } = require("../shared/rulesets/edit.mjs");
const EDIT_PATHS = editPaths(MANIFEST.edit);
const TEXT = EDIT_PATHS.text;
const NUMBERS = EDIT_PATHS.number;
function setPath(data, key, value) {
  const keys = key.split(".");
  let node = data;
  for (const part of keys.slice(0, -1)) node = node[part] = node[part] && typeof node[part] === "object" ? node[part] : {};
  node[keys.at(-1)] = value;
}
async function edit5e(table, record, changes, seat) {
  if (seat.role !== "dm" && record.owner !== seat.name) throw new Error("You can only change your own character.");
  if (!Array.isArray(changes) || changes.length === 0) throw new Error("What changes?");
  const rules = await rules5e();
  const data = structuredClone(record.data);
  let name = record.name;
  for (const change of changes.slice(0, 50)) {
    const key = String(change?.path ?? "");
    const value = change?.value;
    if (key === "name") name = String(value ?? "").trim().slice(0, 120) || record.name;
    else if (TEXT.some((pattern) => pattern.test(key))) data[key] = String(value ?? "").slice(0, 8000);
    // A row's words (an item's location: the container it is in), from the manifest's string list.
    else if (EDIT_PATHS.string.some((pattern) => pattern.test(key))) setPath(data, key, String(value ?? "").slice(0, 120));
    // A list of words (feats, languages...): an array, or text one a line.
    else if (EDIT_PATHS.list.some((pattern) => pattern.test(key)))
      setPath(data, key, (Array.isArray(value) ? value : String(value ?? "").split(/\r?\n/)).map((item) => String(item).trim().slice(0, 200)).filter(Boolean).slice(0, 200));
    else if (NUMBERS.some((pattern) => pattern.test(key))) {
      const n = Math.round(Number(value));
      if (!Number.isFinite(n) || Math.abs(n) > 1e7) throw new Error(`${key} needs a number.`);
      // Counts of things used (slots, hit dice, death saves) never go below 0 (-5 used is not 5 extra casts).
      setPath(data, key, /(^slots\.l\d\.used|^hitdice\.used|^deathsaves\.)/.test(key) ? Math.max(0, n) : n);
    } else if (EDIT_PATHS.remove.some((pattern) => pattern.test(key)) && value === null) delete data[key.split(".")[0]]?.[key.split(".")[1]];
    else throw new Error(`The sheet cannot change ${key}.`);
  }
  // FG's Inspiration counter: 0 up to the house rule's most (HRIS: 1, 2, 3 or 5); a change is said in the chat.
  if (changes.some((change) => change?.path === "inspiration")) {
    const most = Number(table.houseRule?.("HRIS")) || 1;
    data.inspiration = Math.max(0, Math.min(most, Math.round(Number(data.inspiration) || 0)));
    const before = Math.round(Number(record.data.inspiration) || 0);
    if (data.inspiration !== before) table.say?.(`[INSPIRATION] ${name}: ${data.inspiration > before ? "gains" : "spends"} Inspiration (${data.inspiration} of ${most}).`, seat.role === "dm" ? "GM" : name);
  }
  return table.records.update(record.id, { name, data: rules.derive(data) }, table.seat, { replace: true });
}

module.exports = { rules5e, library5e, build5e, check5e, levelUp5e, edit5e, is5e, isD20Ruleset, D20, RULESET_NAME, TYPES_5E, EDIT_PATHS };
