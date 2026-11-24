// @ts-check
// A game defined by its books (definition.mjs) made a manifest like any other game's (shared/rulesets/types.d.ts):
// its sheet, wizard, tracker and party rolls are the core's parts, arranged from the definition (its abilities, its
// saving throws, how its Armor Class runs). Nothing in it is one game's.
import bfrpgActions from "../bfrpg/actions.mjs";
import bfrpgBooks from "../bfrpg/bookkeeping.mjs";

/** @typedef {import("./definition.mjs").PackGame} PackGame */
/** @typedef {import("../rulesets/types").RulesetManifest} RulesetManifest */

const titled = (/** @type {string} */ word) => (word ? word[0].toUpperCase() + word.slice(1) : word);
/** @param {"save" | "check" | "skill" | "morale"} roll @param {Record<string, unknown>} [more] */
const roll = (roll, more = {}) => ({ roll, bonus: "mod", ...more });
const DETAILS = ["playername", "deity", "languages", "gender", "age", "height", "weight"].map((key) => ({ path: key, kind: /** @type {const} */ ("text"), label: key === "playername" ? "Player" : titled(key) }));

/** @param {PackGame} game @returns {RulesetManifest} */
export function manifestOf(game) {
  const down = game.armorClass.descending;
  const thac0 = game.attack.by === "thac0";
  const gold = game.coins.find((coin) => coin.key === "GP") ?? game.coins[0];
  const abilityRows = game.abilities.map((row) => ({ key: row.key, label: row.label }));
  const saveRows = game.saves.map((row) => ({ key: row.key, label: row.label }));
  /** @type {any} */
  const manifest = {
    id: game.id,
    names: [game.name],
    blurb: game.blurb,
    // The core's own rules for games defined by their books (shared/packgame/rules.mjs); the host plays them
    // (electron/packGame.cjs), keyed by this id.
    engine: "shared/packgame/rules.mjs",
    host: { module: null },
    packGame: game,
    manualDie: "1d20",
    manualKinds: ["check", "save", "attack"],
    classes: { field: "className", level: "level" },
    dice: { modifiers: { presets: ["plus2", "minus2", "max", "half"] } },
    records: { class: { label: "Classes" }, npc: { label: "Monsters" } },
    initiativeDie: Number(/d(\d+)/i.exec(game.initiative.die)?.[1] ?? 6),
    initiativeOrder: game.initiative.high ? "high" : "low",
    blank: false,
    features: ["morale", "multiAttack", "spellbooks", "encumbrance", ...(game.turning ? ["turnUndead"] : []), ...(game.skills ? ["thiefSkills"] : [])],
    party: {
      currency: game.coins.map((coin) => coin.key),
      xp: "xp",
      groupCheck: {
        stats: [],
        rolls: [
          { kind: "save", label: "Save", options: saveRows.map((row) => ({ value: row.key, label: row.label })) },
          { kind: "check", label: "Check", options: abilityRows.map((row) => ({ value: row.key, label: row.label })) },
        ],
      },
    },
    tracker: {
      saves: { keys: game.saves.map((row) => row.key), modLabel: "Mod", modAria: "Save modifier", button: "Roll save" },
      rowActions: [
        ...(game.turning ? [{ hook: "turn-undead", label: "Turn undead", title: "Turn undead as a level {turns} {className}: target the undead first, or every undead foe is tried", when: { all: [{ has: "turns" }, { gmOrMine: true }, { activeTurn: true }] }, call: { ct: "turn-undead", with: "record" } }] : []),
        { hook: "morale", label: ["Morale ", "{morale}"], title: { if: { atLeast: { path: "morale", value: 12 } }, then: "Morale {morale}: 2d6 at or under it stands (12: never fails)", else: "Morale {morale}: {die} at or under it stands" }, when: { all: [{ gm: true }, { has: "morale" }] }, call: { ct: "morale" } },
      ],
    },
    calendar: game.calendar,
    sheet: {
      level: "arrange",
      className: "sheet-5e sheet-35 sheet-2e sheet-bf",
      art: "class",
      header: {
        identity: [
          { path: "className", label: "Class and level", hook: "class", show: "{className} {level|1}" },
          { path: "leveltitle", label: "Title", hook: "title" },
          { path: "alignment", label: "Alignment", kind: "text" },
        ],
      },
      top: [
        {
          part: "strip",
          items: [
            { kind: "level", path: "level", exp: "exp", next: "expnext", max: game.maxLevel, atLeast: 1, hint: "{exp|0} of {expnext|nz:—} experience points for the next level", title: "Level up: the host rolls the hit die, or adds the class's fixed hit points" },
            { kind: "xp", path: "exp", next: "expnext", label: "Experience", shown: { hook: "exp" }, note: { when: { positive: "xpbonus" }, text: ["+", "{xpbonus|0}", "% XP"] } },
            thac0 ? { kind: "value", label: "THAC0", path: "thac0", hook: "thac0", title: "To hit Armor Class 0; d20 + bonuses at or above THAC0 minus the target's AC" } : { kind: "value", label: "AB", path: "ab", hook: "ab", format: "signed", title: "Attack bonus" },
            { kind: "modifier", key: "mod", label: "Mod", aria: "Roll modifier", title: "A modifier for the next roll", min: -20, max: 20 },
          ],
        },
      ],
      tabs: [
        {
          id: "main",
          parts: [
            {
              part: "row",
              className: "cc-main-grid five-main",
              parts: [
                {
                  part: "statBlock",
                  label: "Abilities",
                  hook: "ability",
                  head: false,
                  plain: true,
                  rows: abilityRows,
                  columns: [{ label: "Score", path: "abilities.{key}.score", field: { kind: "number", label: "{key} score" } }],
                  roll: { action: roll("check"), hook: "roll-check", label: "{abilities.{key}.bonus|signed}", title: game.abilityCheck.atMost ? "Ability check: d20 at or under {abilities.{key}.score|0}" : "Ability check: d20 at or above {abilities.{key}.score|0}", aria: "{key} check" },
                },
                {
                  part: "derived",
                  boxes: [
                    { label: "Armor Class", show: "shield", path: "ac.total", hook: "ac", title: `Armor {ac.armor|0}[ ({ac.worn})], shield ${down ? "-" : "+"}{ac.shield|0}, Dexterity {ac.dex|signed}, misc {ac.misc|signed}${down ? " (lower is better)" : ""}`, fields: [{ before: "Misc", path: "ac.misc", kind: "number", label: "AC misc" }] },
                    { label: "Hit Points", show: "remaining", path: "hp.total", minus: "hp.wounds", quick: true, hook: "hp", danger: true, fields: [{ before: "Damage", path: "hp.wounds", kind: "number", label: "Damage taken" }], warn: { atZero: true, attr: { name: "status", value: "Dead" }, text: "At 0 hit points a character is dead." } },
                    { label: "Initiative", show: "value", path: "initiative.total", hook: "init", format: "signed", title: `${game.initiative.die} ${game.initiative.bySide ? "for each side" : "each"}, the ${game.initiative.high ? "highest" : "lowest"} acts first` },
                    { label: "Load", show: "value", path: "load", hook: "load", suffix: ` ${game.encumbrance.unit}`, title: `What is carried, in ${game.encumbrance.unit}` },
                  ],
                },
              ],
            },
            {
              part: "statBlock",
              label: "Saving throws",
              hook: "save",
              base: "cc-panel d2e-saves",
              heading: { text: "Saving throws", hint: `${game.save.die} at or above the number` },
              rowClass: "five-ability d35-save",
              rowTitle: "Class {saves.{key}.base|0}[, ability -{saves.{key}.ability}][, misc -{saves.{key}.misc}]",
              plain: true,
              rows: saveRows,
              columns: [{ label: "Misc", path: "saves.{key}.misc", field: { kind: "number", label: "{key} misc" } }],
              roll: { action: roll("save", { fight: true }), hook: "roll-save", className: "cc-save", label: "{saves.{key}.total|0}", title: "Roll a save: d20 at or above {saves.{key}.total|0}", aria: "{key} save" },
            },
          ],
        },
        {
          id: "combat",
          page: "panel",
          parts: [
            { part: "heading", text: "Attacks", targets: true },
            { part: "hint", text: thac0 ? `d20 + bonuses at or above THAC0 {thac0|0} minus the target's Armor Class. A natural ${game.attack.naturalHit} hits, a ${game.attack.naturalMiss} misses.` : `d20 + attack bonus at or above the target's Armor Class. A natural ${game.attack.naturalHit} hits, a ${game.attack.naturalMiss} misses.` },
            {
              part: "list",
              path: "attacks",
              hook: "attack",
              className: "five-attacks",
              name: { path: "name", bold: true, flat: true },
              details: [{ text: "{range}", when: { has: "range" } }, { text: "{mastery}: {special}", when: { has: "special" } }],
              hideEmpty: true,
              rowActions: [
                { hook: "attack", label: "{bonus|signed}", title: "One attack roll at each target", action: { ct: "attack", key: "weapon" } },
                { hook: "damage", label: "{damage}", title: "Damage roll (at least 1)", action: { ct: "damage-roll", key: "weapon" } },
              ],
              empty: "No weapon ready: ready one on the Inventory tab.",
            },
            { part: "hint", text: "Class abilities: {classabilities|join:, }", when: { has: "classabilities" } },
          ],
        },
        ...(game.skills
          ? [
              {
                id: "skills",
                page: "panel",
                parts: [
                  { part: "heading", text: "Skills", hint: `${game.skills.die} ${game.skills.atMost ? "at or under" : "at or above"}`, when: { rows: "thiefskills" } },
                  {
                    part: "skills",
                    path: "thiefskills",
                    hook: "skill",
                    className: "five-skills d2e-skills",
                    rowTitle: "{name}: {shown} (misc {misc|signed})",
                    field: { path: "misc", kind: "number", label: "{name} misc" },
                    name: "name",
                    roll: { action: roll("skill", { keyAs: "skill" }), hook: "roll-skill", label: "{shown}", aria: "Roll {name}" },
                    when: { rows: "thiefskills" },
                  },
                  { part: "hint", text: "This class has no skills of its own.", when: { not: { rows: "thiefskills" } } },
                ],
              },
            ]
          : []),
        {
          id: "spells",
          page: "panel",
          parts: [
            {
              part: "track",
              style: "boxes",
              className: "d35-perday",
              attr: { name: "perday", value: "{spellcasting.kind}" },
              intro: "Spells a day. Click a box to use a spell of that level, again to get it back.",
              max: "spellcasting.perday",
              used: "spellcasting.used",
              rowClass: "d35-slots",
              rowHook: "spell-level",
              labels: ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"],
              aria: "{label} level spell {n}",
              empty: "No spells a day at this level.",
              when: { has: "spellcasting" },
            },
            { part: "heading", text: "Spellbook", when: { is: { path: "spellcasting.kind", values: ["arcane"] } } },
            { part: "notes", fields: [{ path: "spellbook", label: "Spellbook", kind: "textarea", lines: true, bare: true }], when: { is: { path: "spellcasting.kind", values: ["arcane"] } } },
            { part: "heading", text: "Prepared today", when: { has: "spellcasting" } },
            { part: "notes", fields: [{ path: "prepared", label: "Prepared spells", kind: "textarea", lines: true, bare: true }], when: { has: "spellcasting" } },
            { part: "hint", text: "One spell a line, or drop a spell on the sheet.", when: { has: "spellcasting" } },
            { part: "hint", text: "This character casts no spells.", when: { not: { has: "spellcasting" } } },
          ],
        },
        {
          id: "inventory",
          page: "panel",
          parts: [
            {
              part: "list",
              path: "inventorylist",
              hook: "item",
              select: { path: "carried", kind: "select", number: true, label: "{name} carried", title: "Ready (worn or in hand), carried or left behind", options: [{ value: "2", label: "Ready" }, { value: "1", label: "Carried" }, { value: "0", label: "Left behind" }] },
              fields: [
                { path: "count", kind: "number", label: "{name} count", default: 1, zeroIsEmpty: true },
                // Weapon mastery (a weapon whose record has a mastery table): the character's level with it.
                { path: "masterylevel", kind: "select", label: "{name} mastery", title: "Weapon mastery: the damage and special at this level", when: { has: "mastery" }, default: "basic", options: ["basic", "skilled", "expert", "master", "grandmaster"].map((value) => ({ value, label: titled(value) })) },
              ],
              name: { path: "name" },
              head: { select: "Status", fields: ["#"], name: "Item" },
              details: [{ text: "{type}" }, { text: "{damage}" }, { text: "AC {ac}", when: { has: "ac" } }, { text: `AC ${down ? "-" : "+"}{acbonus}`, when: { has: "acbonus" } }, { text: `{encumbrance} ${game.encumbrance.unit}`, when: { has: "encumbrance" } }],
              remove: { aria: "Drop {name}", title: "Drop it" },
            },
            { part: "coins", path: "coins", aria: "{name}", upper: true },
            { part: "hint", text: `Load {load|0} ${game.encumbrance.unit}.` },
          ],
        },
        {
          id: "notes",
          page: "panel",
          parts: [
            { part: "notes", fields: DETAILS },
            { part: "notes", fields: [{ path: "loyalty", label: "Loyalty", kind: "number", edit: "gm", note: "A retainer's loyalty" }] },
            { part: "button", hook: "loyalty-roll", label: "Roll loyalty", title: `Loyalty check: ${game.morale.die} ${game.morale.atMost ? "at or under" : "at or above"}`, action: roll("morale"), disabled: { not: { editable: true } } },
            { part: "notes", fields: ["appearance", "background", "notes"].map((key) => ({ path: key, label: titled(key), kind: "textarea", bare: true })) },
          ],
        },
      ],
    },
    // The wizard: the scores rolled in order, a class from the books, money and the shop, then who they are.
    wizard: {
      hook: game.id,
      title: `New ${game.name} character`,
      aria: `${game.name} character wizard`,
      chat: "[CHARGEN] ",
      empty: { type: game.classType, text: `No classes yet: the GM makes the ${game.name} rules book active (Modules).` },
      finish: { title: "Every step done first", build: "packgame.build" },
      steps: [
        // A book's sample character, taken as the book made it (the steps below are then its own); none: make one.
        {
          id: "sample",
          title: "Sample character (or make your own)",
          parts: [
            { kind: "choose-record", fromType: "pregencharsheet", into: "pregen", aria: "Sample character", placeholder: "None: make my own", optional: true },
            { kind: "hint", text: "Its class, scores, hit points, gear and money as the book gives them. Name it below.", when: { has: "pregen" } },
          ],
        },
        {
          id: "abilities",
          title: "Abilities",
          parts: [
            {
              when: { not: { has: "pregen" } },
              kind: "roll-stats",
              ...(game.abilityEntry === "typed" ? { typed: { min: 0, max: game.abilityMax } } : {}),
              into: "abilities",
              hook: `${game.id}-roll-abilities`,
              formula: game.abilityDice,
              label: `{label} (${game.abilityDice})`,
              button: `Roll ${game.abilityDice} in order`,
              stats: game.abilities.map((row) => ({ key: row.key, label: row.label, short: row.short })),
              ...(game.abilitySwap ? { swap: { hook: `${game.id}-swap`, title: "You may swap two of the results", aria: ["Swap", "With"], start: [game.abilities[0].key, game.abilities[1]?.key ?? game.abilities[0].key], button: "Swap" } } : {}),
            },
          ],
        },
        {
          id: "class",
          title: "Class",
          parts: [
            { kind: "choose-record", fromType: game.classType, into: "class", aria: "Class", placeholder: "Choose a class…", when: { not: { has: "pregen" } } },
            { kind: "hint", when: { not: { has: "pregen" } }, record: "class", text: "Prime requisite: {primerequisite}. Hit die: {hitdie}. Armor: {armor}. Weapons: {weapons}." },
          ],
        },
        {
          id: "gear",
          title: "Money and Equipment",
          parts: [{ when: { not: { has: "pregen" } }, kind: "shop", into: "buy", fromType: "item", exclude: { path: "type", values: ["Treasure", "Magic Item", "Service"] }, price: { path: "cost", per: gold.value, unit: gold.key.toLowerCase() }, type: "type", gold: { into: "gold", hook: `${game.id}-roll-gold`, formula: game.startingGold, label: `${gold.name} pieces (${game.startingGold})`, button: `Roll ${game.startingGold} ${gold.key.toLowerCase()}`, done: `{value} ${gold.key.toLowerCase()} rolled` }, search: { aria: "Shop search", placeholder: "Search the equipment" }, limit: 120 }],
        },
        {
          id: "details",
          title: "Name and Alignment",
          parts: [
            { kind: "text", into: "name", label: "Name", aria: "Character name", placeholder: "", free: { aria: "Character name", placeholder: "Name" } },
            { when: { not: { has: "pregen" } }, kind: "text", into: "alignment", label: "Alignment", aria: "Alignment", placeholder: "Choose an alignment…", options: { values: game.alignments } },
          ],
        },
      ],
    },
    // What the sheet may change (the host's whitelist, electron/packGame.cjs).
    edit: {
      text: ["playername", "alignment", "deity", "appearance", "notes", "background", "gender", "age", "height", "weight", "languages"],
      number: [`abilities.(${game.abilities.map((row) => row.key).join("|")}).score`, `saves.(${game.saves.map((row) => row.key).join("|")}).misc`, "thiefskills.%.misc", "hp.(wounds|misc)", "exp", "ac.misc", "initiative.misc", "loyalty", "spellcasting.used.#", "coins.*.amount", "inventorylist.*.(count|carried)"],
      string: ["inventorylist.*.location", "inventorylist.*.masterylevel"],
      list: ["spellbook", "prepared"],
      remove: ["inventorylist"],
    },
    actions: bfrpgActions,
    bookkeeping: bfrpgBooks,
  };
  return manifest;
}
