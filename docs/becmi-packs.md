# D&D BECMI packs: converting the boxed sets and their adventures

This page is for anyone (most often an AI agent) turning the old Dungeons &
Dragons boxed sets into Maelstrom packs: Set 1 Basic, Set 2 Expert, Set 3
Companion, Set 4 Master, Set 5 Immortals, and the adventures and gazetteers
written for them (Goblin's Lair, Wrath of the Immortals, Champions of
Mystara...). Read [kpack-format.md](kpack-format.md) first: it says what a
pack is, how pages, story entries, maps and tables are written, and how to
make and check a pack. This page adds only what is BECMI's own.

> **Status (2026-11-23):** the D&D BECMI game is being built. Packs made to
> this page now are read by it as it lands; until then a `D&D BECMI` pack shows
> in Worldbuilding campaigns, enough to read and proof its pages.

BECMI is its own game in Maelstrom, **D&D BECMI**, played the old way:
descending Armor Class, attack rolls against a to-hit number, race as class,
the five saving throws, group initiative on a d6, coins for encumbrance,
levels to 36 and the Immortals beyond. It is not AD&D and not Basic Fantasy:
never file these books under either.

Maelstrom ships none of these books. Convert only books the GM owns, for the
GM's own games; the packs live in `Documents/Kraken VTT/Packs/D&D BECMI/` and
are never committed or shared.

## 1. The manifest

| Field | Value |
|---|---|
| `ruleset` | `D&D BECMI` (exactly; every book of the line, rules and adventures alike) |
| `kind` | `rules` for the five sets and the Rules Cyclopedia; `adventure` for modules; `setting` for gazetteers and Mystara books; `monsters` for creature books |
| `group` | `Boxed Sets` for the five sets; the series for modules (`B series`, `X series`, `CM series`, `M series`, `IM series`); `Gazetteers`; `Mystara` |
| `order` | The TSR code: `1011B`, `1012B`, `1013`, `1021`, `1017`; a module's code (`B1`, `X1`) |
| `name` | The book's title as printed (`Set 1: Basic Rules`). Never change it once other packs link to it. |

A boxed set's books (Players Manual, Dungeon Masters Rulebook) go in one pack
for the set, a chapter per book. An adventure inside a set (Set 1's solo
adventure and "Castle Mistamere"-style starters) is part of that set's pack.

## 2. What the game reads from the packs

The rules engine knows how BECMI plays (how an attack, a save, initiative and
morale are rolled). **The numbers come from the books**: each class's
experience, hit dice, saves, to-hit and spells by level, each monster's line,
each spell and each item. So the Basic set alone plays levels 1 to 3, the
Expert set adds 4 to 14, the Companion 15 to 25 and so on: whatever packs the
GM has made active.

Write these records (section 4 of kpack-format.md names the sidebar lists):

### Classes (`type: "class"`, `visibility: "all"`)

One per class: Cleric, Fighter, Magic-User, Thief, Dwarf, Elf, Halfling
(Set 1), later the Mystic and the Druid where a set gives them. Dwarf, Elf and
Halfling are classes (race as class). A later set that carries a class higher
writes the same class again with only its new levels; the levels are merged
by level number across the active packs.

```json
{
  "id": "set-1-basic-rules:class.fighter",
  "type": "class",
  "name": "Fighter",
  "visibility": "all",
  "source": "Set 1: Basic Rules",
  "data": {
    "name": "Fighter",
    "race": "Human",
    "primerequisite": "Strength",
    "requirements": {},
    "xpbonus": { "13": 5, "16": 10 },
    "hitdie": "d8",
    "armor": "Any armor; shields allowed",
    "weapons": "Any weapon",
    "maxlevel": 36,
    "levels": {
      "1": { "xp": 0, "title": "Veteran", "hitdice": "1d8", "thac0": 19, "saves": { "death": 12, "wands": 13, "paralysis": 14, "breath": 15, "spells": 16 } },
      "2": { "xp": 2000, "title": "Warrior", "hitdice": "2d8", "thac0": 19, "saves": { "death": 12, "wands": 13, "paralysis": 14, "breath": 15, "spells": 16 } }
    },
    "abilities": {
      "id-00001": { "name": "Lance attack", "level": 9, "text": "<p>...</p>" }
    },
    "text": "<p>The class as the book describes it.</p>"
  }
}
```

- `levels` is keyed by level number. Each level gives:
  - `xp`: experience needed;
  - `title`: the level title the book gives;
  - `hitdice`: the total at that level (`"9d8"`, then `"9d8+2"` past
    ninth level, as the book writes it);
  - `thac0`: the roll needed to hit Armor Class 0, read off the book's attack
    table. Rules Cyclopedia prints it; the boxed sets print the attack table,
    so take the column for AC 0;
  - `saves`: the five saving throws: `death` (Death Ray or Poison), `wands`
    (Magic Wands), `paralysis` (Paralysis or Turn to Stone), `breath` (Dragon
    Breath), `spells` (Rods, Staves or Spells);
  - `spells` (spellcasters): spells per day by spell level, `{ "1": 2, "2": 1 }`;
  - `turning` (Clerics): the turn undead row, keyed by undead type, each `7`,
    `9`, `11` (roll needed on 2d6), `"T"` (turned), `"D"` (destroyed) or `"-"`.
    Keys: `skeleton`, `zombie`, `ghoul`, `wight`, `wraith`, `mummy`,
    `spectre`, `vampire`, `phantom`, `haunt`, `spirit`, `nightshade`, `lich`,
    `special`;
  - `skills` (Thieves): the percentages, keyed `openlocks`, `findtraps`,
    `removetraps`, `climb`, `movesilently`, `hide`, `pickpockets`, `hearnoise`
    (Hear Noise as the book writes it: `"1-2"` on a d6, or a percentage).
- `requirements`: minimum scores (`{ "constitution": 9 }` for a Dwarf).
- `xpbonus`: the prime requisite's experience adjustment, keyed by the lowest
  score that earns it, in percent (a penalty is negative).
- `attackranks` (Dwarf, Elf, Halfling past their top level, Companion set):
  `{ "A": { "xp": 660000, "thac0": 10, "saves": { ... } } }`.
- `abilities`: what the class gains and when (Lance attack, Smash, Parry,
  Multiple attacks; an Elf's detect secret doors; a Halfling's hiding), each
  with the level it comes at and its text.

### Monsters (`type: "npc"`, `visibility: "gm"`)

```json
{
  "id": "set-1-basic-rules:npc.goblin",
  "type": "npc",
  "name": "Goblin",
  "visibility": "gm",
  "source": "Set 1: Basic Rules",
  "data": {
    "name": "Goblin",
    "ac": 6,
    "hd": "1-1",
    "move": "90' (30')",
    "attacks": "1 weapon",
    "damage": "1d6 or by weapon",
    "noappearing": "2d4 (6d10)",
    "saveas": "NM",
    "morale": 7,
    "treasure": "(R) C",
    "intelligence": 9,
    "alignment": "Chaotic",
    "xp": 5,
    "text": "<p>The description as the book gives it.</p>",
    "token": "tokens/goblin.webp"
  }
}
```

- `ac`: a number, descending (lower is better; can go below 0).
- `hd`: as printed, asterisks kept (`"3*"`, `"5+1**"`, `"1/2"`, `"1-1"`);
  each asterisk is a special ability for experience.
- `saveas`: as printed: `F2`, `C5`, `MU3`, `T4`, `D1` (Dwarf), `E3` (Elf),
  `H2` (Halfling), `NM` (Normal Man).
- `thac0`: only when the book gives it; otherwise the game works it out from
  `hd` by the monster attack table.
- `hp`: only for a named creature with fixed hit points; otherwise the game
  rolls them from `hd` when the monster is added to a fight.
- Several attacks: `"attacks": "2 claws/1 bite"`, `"damage": "1d4/1d4/1d8"`,
  in the book's order.
- A monster in an adventure (the goblins of room 3) is its own `npc` record in
  that adventure's pack, with the numbers the adventure prints, linked from
  the room's story entry and its `battle`.

### Spells (`type: "spell"`, `visibility: "all"`)

```json
{
  "id": "set-1-basic-rules:spell.sleep",
  "type": "spell",
  "name": "Sleep",
  "visibility": "all",
  "source": "Set 1: Basic Rules",
  "data": {
    "name": "Sleep",
    "class": "Magic-User",
    "level": 1,
    "reversible": false,
    "range": "240'",
    "duration": "4d4 turns",
    "effect": "2d8 Hit Dice of living creatures within a 40' square area",
    "text": "<p>...</p>"
  }
}
```

- `class`: `Cleric`, `Magic-User` (Elves cast these), `Druid`.
- A reversible spell names its reverse in `reverse` (`"Cause Light Wounds"`).

### Equipment (`type: "item"`, `visibility: "all"`)

```json
{ "name": "Sword", "type": "Weapon", "cost": "10 gp", "encumbrance": 60, "damage": "1d8", "hands": 1, "text": "<p>...</p>" }
{ "name": "Chain Mail", "type": "Armor", "cost": "40 gp", "encumbrance": 400, "ac": 5, "text": "<p>...</p>" }
{ "name": "Shield", "type": "Armor", "cost": "10 gp", "encumbrance": 100, "acbonus": 1, "text": "<p>...</p>" }
{ "name": "Rope, 50'", "type": "Gear", "cost": "1 gp", "encumbrance": 50 }
{ "name": "Sword +1", "type": "Magic Item", "subtype": "Weapon", "damage": "1d8", "bonus": 1, "text": "<p>...</p>" }
```

- `encumbrance` in coins (cn), as the books count it.
- Armor gives the Armor Class it makes (`ac`); a shield gives `acbonus` (it
  lowers AC by that much).
- Missile weapons give `range`: `"50/100/150"` (short, medium, long).
- Weapon mastery (Master set): `mastery`, keyed `basic`, `skilled`, `expert`,
  `master`, `grandmaster`, each `{ "damage": "...", "special": "..." }`.

### Tables (`type: "tables"`)

Every random table the books print, as kpack-format.md's `tables` records:
wandering monsters by dungeon level and terrain, treasure types (one table
per letter, or one table with a row per letter), reaction (2d6), random
monster encounters, magic item tables. Name each as the book does.

The game itself reads two tables by name, so make them exactly:

- **`Monster Attack Table`**: rows by hit dice (`fromrange`/`torange` over
  the book's columns: up to 1, 1+ to 2, 2+ to 3 and so on), one result each:
  the roll needed to hit AC 0 (the THAC0 the monster has at those hit dice).
- **`Normal Man`**: the saves and to-hit of a Normal Man, one row: results
  `death`, `wands`, `paralysis`, `breath`, `spells`, `thac0`.

### Characters (`type: "pregencharsheet"`)

The pregenerated characters some adventures give (the Set 1 solo adventure's
fighter): `name`, `class`, `level`, `alignment`, the six scores
(`strength`...`charisma`), `hp`, `ac`, `xp`, their equipment and spells.

## 3. Pages and story

As kpack-format.md says: one `refpage` per section, in reading order; boxed
read-aloud text in a `blue` frame; the book's tables inside the pages as
`<table>` and, when they are rolled on, also as `tables` records. An
adventure's keyed areas are `encounter` records, with a `battle` for each
fight and a `treasureparcels` for each hoard (coins: `PP`, `GP`, `EP`, `SP`,
`CP`). Maps are `image` records at full resolution with their grid.

The solo adventure in Set 1's Players Manual ("go to 12") is pages too: each
numbered paragraph its own `refpage`, its choices links to the next.

## 4. Checking a pack

`npm run kpack:check -- "path/to/Set 1 Basic Rules.kpack"`. Then, in
Maelstrom, a **D&D BECMI** campaign: Modules shows the pack; make it active;
Books reads its pages; the wizard offers its classes; its monsters fight on
the tracker with their Armor Class, to-hit and saves as the book prints them.
Compare every page with the PDF.
