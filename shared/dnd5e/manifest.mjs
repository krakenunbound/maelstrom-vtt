// @ts-check
// D&D 5E and, as its variant, Descending Darkness (one sheet, as FG plays
// Descending Darkness on the 5E ruleset). Its sheet is the core's parts
// (docs/core-ui-design.md, migration step 6): the manifest lists its tabs
// (Main, Skills, Combat, Spells, Inventory, Notes) and arranges the core's
// strip, stat block, derived boxes, skills, lists, coins and notes on them;
// its own parts are the Spells page, Dread, bleeding out and death saves
// (src/rulesets/dnd5e.tsx). The variant changes the words ({@species}: Kin,
// {@ac}: Defense, {@hp}: Health), its features and its maximum level. The
// host's edit whitelist (electron/dnd5e.cjs) is built from `edit` below.
import { SKILLS, STATS } from "./rules.mjs";
import { SKILLS as PARTY_SKILLS, STATS as PARTY_STATS } from "./rules.mjs";
// The party sheet's group rolls: what the game checks, saves and its skills (D6).
const titleOf = (/** @type {string} */ word) => word[0].toUpperCase() + word.slice(1);
/** @type {{ stats: string[]; rolls: { kind: "check" | "save" | "skill"; label: string; options: { value: string; label: string }[] }[] }} */
const PARTY_GROUP = { stats: [], rolls: [{ kind: "check", label: "Check", options: PARTY_STATS.map((value) => ({ value, label: titleOf(value) })) }, { kind: "save", label: "Save", options: PARTY_STATS.map((value) => ({ value, label: titleOf(value) })) }, { kind: "skill", label: "Skill", options: Object.entries(PARTY_SKILLS).map(([value, row]) => ({ value, label: String(row[0]) })) }] };

const SIX = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const titled = (/** @type {string} */ word) => word[0].toUpperCase() + word.slice(1);
// A roll with the strip's DC (advantage is the chat bar's ADV and DIS keys, the modifier stack).
/** @param {"save" | "check" | "skill" | "init"} roll @param {Record<string, unknown>} [more] */
const roll = (roll, more = {}) => ({ roll, dc: "dc", ...more });
/** @type {Record<string, string[]>} */
const SKILL_LIST = SKILLS;

/** @type {import("../rulesets/types").RulesetManifest} */
export default {
  id: "dnd5e",
  // Where a character keeps its classes (FG's classes list), for the roster, Character Selection and spells.
  // FG's characters keep a classes list; Maelstrom's builder a class package.
  classes: [{ rows: "classes", name: "name", level: "level" }, { rows: "packages", where: { packagetype: "Class" }, name: "name", level: "level" }],
  // Spells list the classes that cast them in source ("Wizard, Sorcerer").
  spells: { casters: { field: "source" } },
  names: ["D&D 5E", "Descending Darkness"],
  blurb: "Played from your 5E books (the rulebooks you own, or the free SRD): 5E sheets and character building, d20 combat with criticals, saves, spells and death saves.",
  engine: "shared/dnd5e/rules.mjs",
  // The Item Forge's rules (base items and templates into new magic items): content.cjs's item-forge.
  forge: "shared/dnd5e/forge.mjs",
  // A race pasted as text into race records (its subraces too): content.cjs's race-import.
  raceImport: "shared/dnd5e/raceblock.mjs",
  host: { module: "electron/dnd5e.cjs" },
  // The modifier box's keys beside the chat (shared/rulesets/modifiers.mjs).
  dice: { modifiers: { presets: ["adv", "dis", "plus2", "minus2", "plus5", "minus5", "opp", "cover", "scover", "crit", "max", "half"] } },
  // The sheet's words ({@word}) and its highest level.
  labels: { species: "Race", speciesLower: "race", ac: "AC", acLong: "Armor Class", hp: "Hit Points", hpLower: "hit points", maxLevel: "20" },
  sheet: {
    level: "arrange",
    className: "sheet-5e",
    art: ["race", "species"],
    header: {
      identity: [
        { path: "species", label: "{@species}" },
        { path: "className", label: "Class", hook: "class", format: "dnd5e.className" },
        { path: "background", label: "Background" },
      ],
    },
    top: [
      {
        part: "strip",
        items: [
          { kind: "level", path: "level", exp: "exp", next: "expnext", max: "{@maxLevel}", title: "Level up: the host rolls the hit die" },
          { kind: "xp", path: "exp", next: "expnext", label: "Experience" },
          { kind: "value", label: "Prof", path: "prof", hook: "prof", title: "Proficiency bonus", format: "signed" },
          { kind: "modifier", key: "dc", label: "DC", aria: "Difficulty class", title: "The DC a check or save is rolled against (0: none)", min: 0, max: 40 },
        ],
      },
    ],
    tabs: [
      {
        id: "main",
        parts: [
          {
            part: "row",
            className: "cc-main-grid five-main d5e-main",
            parts: [
              {
                part: "statBlock",
                label: "Abilities",
                hook: "ability",
                plain: true,
                rows: STATS.map((key) => ({ key, label: titled(key) })),
                columns: [
                  { label: "Score", path: "abilities.{key}.score", field: { kind: "number", label: "{key} score" } },
                  { label: "Check", roll: { action: roll("check"), hook: "roll-check", label: "{abilities.{key}.bonus|signed}", title: "Roll a {key} check", aria: "{key} check" } },
                ],
              },
              // The six saves in a column beside the abilities: proficient or not, and the roll.
              {
                part: "statBlock",
                label: "Saving throws",
                hook: "save",
                base: "cc-panel d5e-saves",
                heading: { text: "Saving throws", hint: "prof · roll" },
                plain: true,
                rowClass: "five-ability d5e-save",
                rows: STATS.map((key) => ({ key, label: titled(key) })),
                columns: [
                  { label: "Prof", path: "abilities.{key}.saveprof", field: { kind: "check", label: "{key} save proficiency", title: "Proficient in this saving throw" } },
                  { label: "Save", roll: { action: roll("save", { fight: true }), hook: "roll-save", className: "cc-save", label: "{abilities.{key}.save|signed}", title: "Roll a {key} saving throw", aria: "{key} save" } },
                ],
              },
              {
                part: "derived",
                className: "d5e-combat",
                boxes: [
                  { label: "{@ac}", show: "shield", path: "ac.total", hook: "ac", title: "{@acLong}[: {ac.armor}][ and a shield{?ac.shield}]", lines: [{ items: [{ before: "Misc", field: { path: "ac.misc", kind: "number", label: "{@ac} adjustment", title: "Added to the {@acLong} (a ring, a spell, cover)" } }] }] },
                  {
                    label: "{@hp}",
                    show: "remaining",
                    path: "hp.total",
                    minus: "hp.wounds",
                    quick: true,
                    hook: "hp",
                    danger: true,
                    lines: [{ items: [{ before: "Wounds", field: { path: "hp.wounds", kind: "number", label: "Wounds" } }] }, { items: [{ before: "Temp", field: { path: "hp.temp", kind: "number", label: "Temporary {@hpLower}" } }] }, { items: [{ before: "Max", field: { path: "hp.total", kind: "number", label: "Maximum {@hpLower}", title: "The {@hpLower} maximum (a level up adds to it)" } }] }],
                  },
                  {
                    label: "Initiative",
                    show: "value",
                    path: "initiative.total",
                    hook: "init",
                    format: "signed",
                    lines: [{ items: [{ before: "Misc", field: { path: "initiative.misc", kind: "number", label: "Initiative adjustment", title: "Added to initiative (Alert, a magic item)" } }] }],
                    // FG's Roll Initiative: a Dexterity check with the initiative; on the tracker, its place.
                    actions: [{ hook: "roll-init", label: "Roll", title: "Roll initiative (on the combat tracker, it sets your place)", action: roll("init") }],
                  },
                  { label: "Speed", show: "field", path: "speed", field: { path: "speed", kind: "text", label: "Speed", title: "Speed (30 ft., fly 60 ft.)" } },
                  { label: "Passive Perception", show: "value", path: "passive", hook: "passive" },
                  // Inspiration (2014) or Heroic Inspiration (2024): the GM gives it, the player spends it for advantage.
                  // FG's Inspiration counter: as many as the house rule HRIS allows (1, 2, 3 or 5); a change goes to the chat.
                  { label: "Inspiration", show: "field", path: "inspiration", hook: "inspiration", title: "Inspiration: the GM gives it; spend it for advantage on a roll", field: { path: "inspiration", kind: "number", label: "Inspiration", title: "How many Inspiration (the GM's house rule sets the most)" } },
                  // Hit dice: the die, how many are left, and one rolled (spent) apart from a rest.
                  { custom: "dnd5e.hitDice", when: { feature: "deathSaves" } },
                  // FG's Classes window: each class, its level and hit die, a level more in it, another class.
                  { custom: "dnd5e.classes", when: { feature: "deathSaves" } },
                  // Descending Darkness's Dread, its bleeding out at 0 Health; 5E's death saves.
                  { custom: "dnd5e.dread", when: { feature: "dread" } },
                  { custom: "dnd5e.dying", when: { all: [{ feature: "dying.bleed" }, { zero: { path: "hp.total", minus: "hp.wounds" } }] } },
                  { custom: "dnd5e.deathSaves", when: { all: [{ feature: "deathSaves" }, { zero: { path: "hp.total", minus: "hp.wounds" } }] } },
                ],
                hint: "{senses}",
              },
            ],
          },
        ],
      },
      {
        id: "skills",
        page: "panel",
        pageClass: "cc-panel five-skills cc-page",
        parts: [
          {
            part: "skills",
            path: "skills",
            hook: "skill",
            rows: Object.entries(SKILL_LIST).map(([key, [label, stat]]) => ({ key, label, note: stat.slice(0, 3).toUpperCase() })),
            field: { path: "prof", kind: "select", number: true, label: "{label} proficiency", title: "Proficiency: none, proficient, expertise, half (Jack of All Trades)", options: [{ value: "0", label: "–" }, { value: "1", label: "●" }, { value: "2", label: "◆" }, { value: "3", label: "½" }] },
            after: [{ path: "misc", kind: "number", label: "{label} misc", title: "Added to {label} (an item, a feat)" }],
            roll: { action: roll("skill", { keyAs: "skill" }), hook: "roll-skill", label: "{total|signed}", aria: "Roll {label}", send: "{label}" },
          },
        ],
      },
      {
        id: "combat",
        page: "panel",
        parts: [
          { part: "heading", text: ["Attacks "], targets: true },
          {
            part: "list",
            path: "attacks",
            hook: "attack",
            className: "five-attacks",
            name: { path: "name", bold: true, flat: true },
            // FG's hands button: a versatile weapon in one hand or two (its larger die).
            fields: [{ path: "hands", kind: "select", number: true, label: "{name} hands", title: "One hand or two: two rolls the versatile die", options: [{ value: "1", label: "1 hand" }, { value: "2", label: "2 hands" }], when: { not: { isNull: "versatile" } } }],
            rowActions: [
              { hook: "attack", label: "{bonus|signed}", title: "Attack roll", action: { ct: "attack", key: "weapon" } },
              { hook: "damage", label: ["{damage}", " ", "{dmgtype}"], title: "Damage roll", action: { ct: "damage-roll", key: "weapon" } },
            ],
            empty: "No weapon in hand: equip one on the Inventory tab.",
          },
          // FG's Weapon Options: the critical range and extra critical dice, melee and ranged.
          {
            part: "notes",
            className: "d5e-weapon-options",
            fields: [
              { path: "weapon.critrange.melee", kind: "number", label: "Melee critical on", title: "A melee attack is a critical hit on this or higher (20; a Champion 19)" },
              { path: "weapon.critrange.ranged", kind: "number", label: "Ranged critical on", title: "A ranged attack is a critical hit on this or higher" },
              { path: "weapon.critdicebonus.melee", kind: "number", label: "Extra melee critical dice", title: "More of the weapon's die on a melee critical (Brutal Critical)" },
              { path: "weapon.critdicebonus.ranged", kind: "number", label: "Extra ranged critical dice", title: "More of the weapon's die on a ranged critical" },
            ],
          },
        ],
      },
      { id: "spells", page: "none", parts: [{ part: "custom", component: "dnd5e.spells" }] },
      {
        id: "inventory",
        page: "panel",
        parts: [
          {
            part: "list",
            path: "inventorylist",
            hook: "item",
            // A count or carried of 0 shows as 1, as the hand-made sheet did.
            select: { path: "carried", kind: "select", number: true, label: "{name} carried", title: "Equipped, carried or not carried", options: [{ value: "2", label: "Equipped" }, { value: "1", label: "Carried" }, { value: "0", label: "Not carried" }], default: 1 },
            fields: [
              { path: "count", kind: "number", label: "{name} count", default: 1, zeroIsEmpty: true },
              // FG's Attuned box, on an item that requires attunement.
              { path: "attune", kind: "check", label: "{name} attuned", title: "Attuned", when: { positive: "attunable" } },
            ],
            name: { path: "name" },
            head: { select: "Status", fields: ["#"], name: "Item" },
            details: [{ text: "{subtype}", when: { not: { isNull: "subtype" } } }, { text: "{type}", when: { isNull: "subtype" } }, { text: "{weight} lb.", when: { positive: "weight" } }],
            remove: { aria: "Drop {name}", title: "Drop it" },
          },
          // FG's attunement: the attuned items of how many slots (the house rule HRAS, the class's, misc).
          { part: "custom", component: "dnd5e.attunement" },
          { part: "coins", path: "coins", aria: "{name}", upper: true },
        ],
      },
      {
        id: "notes",
        page: "panel",
        parts: [
          {
            part: "notes",
            fields: [
              { path: "alignment", kind: "text", label: "Alignment" },
              { path: "deity", kind: "text", label: "Deity" },
              { path: "size", kind: "text", label: "Size" },
              { path: "gender", kind: "text", label: "Gender" },
              { path: "age", kind: "text", label: "Age" },
              { path: "height", kind: "text", label: "Height" },
              { path: "weight", kind: "text", label: "Weight" },
              { path: "senses", kind: "text", label: "Senses" },
              { path: "specialdefenses", kind: "text", label: "Special defenses", title: "Resistances, immunities and the like" },
              { path: "personalitytraits", kind: "textarea", label: "Personality traits" },
              { path: "ideals", kind: "textarea", label: "Ideals" },
              { path: "bonds", kind: "textarea", label: "Bonds" },
              { path: "flaws", kind: "textarea", label: "Flaws" },
              { path: "appearance", kind: "textarea", label: "Appearance" },
              { path: "notes", kind: "textarea", label: "Notes", fieldClass: "tall" },
            ],
          },
          // FG's Abilities tab: feats, languages, proficiencies, traits and features (the wizard's, then the owner's), one a line.
          {
            part: "notes",
            fields: [
              { path: "feats", kind: "textarea", lines: true, label: "Feats" },
              { path: "features", kind: "textarea", lines: true, label: "Features" },
              { path: "traits", kind: "textarea", lines: true, label: "{@species} traits" },
              { path: "languages", kind: "textarea", lines: true, label: "Languages" },
              { path: "proficiencylist.armor", kind: "textarea", lines: true, label: "Armor proficiencies" },
              { path: "proficiencylist.weapons", kind: "textarea", lines: true, label: "Weapon proficiencies" },
              { path: "proficiencylist.tools", kind: "textarea", lines: true, label: "Tool proficiencies" },
            ],
          },
        ],
      },
    ],
  },
  // What the sheet may change (the host's whitelist, electron/dnd5e.cjs): "*" one id-n key, "#" a digit, "%" a word,
  // "(a|b)" either; remove: the lists whose rows the sheet may drop. Death saves, hit dice and concentration are the agent's.
  edit: {
    text: ["playername", "alignment", "appearance", "notes", "senses", "speed", "background", "species", "gender", "age", "height", "weight", "concentration", "deity", "size", "specialdefenses", "personalitytraits", "ideals", "bonds", "flaws"],
    number: [
      "abilities.(strength|dexterity|constitution|intelligence|wisdom|charisma).(score|saveprof)",
      "skills.%.(prof|misc)",
      "hp.(wounds|temp|total)",
      "exp",
      "ac.misc",
      "initiative.misc",
      "slots.l#.(used|extra)",
      "pactslots.l#.(used|extra)",
      "prepared.&",
      "resources.*.(max|used)",
      "deathsaves.(success|failure)",
      "inspiration",
      "hitdice.used",
      "dread",
      "coins.*.amount",
      "inventorylist.*.(count|carried|attune)",
      "attunement.(class|misc)",
      "weapon.(critrange|critdicebonus).(melee|ranged)",
      "attacks.*.hands",
    ],
    // The container an item is in (FG's location), set by dragging it onto a backpack on the sheet.
    string: ["inventorylist.*.location", "resources.*.(name|period)"],
    // Lists of words, one a line (FG's Abilities tab lists): feats, features, traits, languages, proficiencies.
    list: ["feats", "features", "traits", "languages", "proficiencylist.(armor|weapons|tools)"],
    remove: ["inventorylist", "resources"],
  },
  wizard: "dnd5e.wizard",
  // Rolls the sheet may ask for beyond check, save and skill: initiative.
  rollKinds: ["init"],
  // House rules (the GM's Settings > House rules; FG 5E's options of the same keys, their choices and defaults).
  settings: [
    { key: "GAVE", group: "Game", label: "Rules version", kind: "select", default: "2024", options: [{ value: "2024", label: "2024" }, { value: "2014", label: "2014" }], hint: "Exhaustion and a long rest's hit dice follow this edition." },
    { key: "HRAS", group: "Character", label: "Attunement slots", kind: "select", default: "3", options: [{ value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5" }, { value: "prof", label: "Proficiency bonus" }, { value: "2", label: "2" }], hint: "How many magic items a character may be attuned to, before class and other slots." },
    { key: "HRIS", group: "Character", label: "Inspiration", kind: "select", default: "", options: [{ value: "", label: "Standard (1)" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "5", label: "5" }], hint: "How many Inspiration a character may hold." },
    { key: "HRST", group: "Combat", label: "Auto death saves", kind: "toggle", default: true, hint: "A dying character rolls its death saving throw at the start of its turn." },
    { key: "NPCD", group: "Combat", label: "NPC damage", kind: "select", default: "off", options: [{ value: "off", label: "Rolled" }, { value: "fixed", label: "Fixed (average)" }] },
    { key: "HRFFM", group: "Combat", label: "Ranged attack next to an enemy at disadvantage", kind: "toggle", default: true, hint: "Unless the attacker has Sharpshooter (2024), Spell Sniper (2024, spells) or Crossbow Expert (2014)." },
    { key: "HRMD", group: "Combat", label: "Massive damage (system shock)", kind: "toggle", default: false, hint: "Damage of half a creature's hit points or more, not dropping it to 0: a DC 15 Constitution save, else a d10 on the system shock table." },
    { key: "HREX", group: "Exhaustion", label: "Roll modifier per level", kind: "select", default: "", options: [{ value: "", label: "As the rules version" }, { value: "-1", label: "-1" }, { value: "-2", label: "-2" }, { value: "-3", label: "-3" }] },
    { key: "HRSE", group: "Exhaustion", label: "Applies to a caster's spell save DC", kind: "toggle", default: false },
    { key: "HRHE", group: "Exhaustion", label: "Levels gained when healed from dying", kind: "select", default: "off", options: [{ value: "off", label: "None" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5" }] },
    { key: "HRHV", group: "Character", label: "Healing", kind: "select", default: "", options: [{ value: "", label: "Standard" }, { value: "fast", label: "Epic heroism (fast)" }, { value: "slow", label: "Gritty realism (slow)" }], hint: "Fast: a long rest gives back every hit die, a short rest a quarter of them. Slow: a long rest heals no hit points and gives back half the hit dice." },
    { key: "HRFL", group: "Character", label: "Reliable skill rolls (no d20 below 10)", kind: "select", default: "", options: [{ value: "", label: "Standard" }, { value: "passive", label: "Insight, Investigation, Perception" }, { value: "all", label: "All skills" }] },
  ],
  blank: false,
  features: ["deathSaves", "spellbooks"],
  party: { currency: ["PP", "GP", "EP", "SP", "CP"], xp: "xp", groupCheck: PARTY_GROUP },
  tracker: {
    saves: { keys: SIX, modLabel: "DC", modAria: "Save DC", button: "Roll save" },
    // A player's own initiative is a d20 (Dexterity), the GM's button rolls everyone's.
    initiative: { rollAll: "Roll all", own: "d20", ownTitle: "Roll my initiative" },
    reaction: { label: "React", title: "Its reaction is spent this round (it comes back at the start of its turn)" },
    // A Dying character's death saving throw.
    rowActions: [
      { hook: "death-save", label: ["Death save ", { if: { defined: "deathsaves" }, then: "({deathsaves.success}✓ {deathsaves.failure}✗)", else: "" }], title: "Death saves: {deathsaves.success|0} successes, {deathsaves.failure|0} failures", when: { all: [{ status: "Dying" }, { gmOrMine: true }] }, call: { ct: "death-save" } },
    ],
  },
  calendar: "harptos",
  variants: {
    "Descending Darkness": {
      id: "descending",
      blurb: "Kraken's dark fantasy: d20, fragile heroes, light that runs out, dread that builds. Its books and a first adventure come with Kraken.",
      records: { race: { label: "Kin" } },
      labels: { species: "Kin", speciesLower: "kin", ac: "Defense", acLong: "Defense", hp: "Health", hpLower: "health", maxLevel: "10" },
      features: ["dread", "dying.bleed", "spellbooks"],
      party: { currency: ["GC"], xp: "xp", groupCheck: PARTY_GROUP },
      // Its save box says DC, as 5E's, but kept its old aria-label (the tracker's, before the manifest).
      tracker: {
        saves: { keys: SIX, modLabel: "DC", modAria: "Save CL", button: "Roll save" },
        initiative: { rollAll: "Roll all", own: "d20", ownTitle: "Roll my initiative" },
        reaction: { label: "React", title: "Its reaction is spent this round (it comes back at the start of its turn)" },
        // An ally steadies the dying (Wisdom 12); the GM's call without one.
        rowActions: [
          { hook: "stabilize", label: "Steady", title: "Steady them: an ally's Wisdom check against 12 stops the bleeding", when: { all: [{ status: "Dying" }, { any: [{ gm: true }, { viewerHasCharacter: true }] }] }, call: { ct: "stabilize", with: "viewer" } },
        ],
      },
      calendar: "waning",
    },
  },
};
