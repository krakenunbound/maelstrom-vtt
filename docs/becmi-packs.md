# D&D BECMI packs: converting the boxed sets and their adventures

This page is for anyone (most often an AI agent) turning the old Dungeons &
Dragons boxed sets into Maelstrom packs: Set 1 Basic, Set 2 Expert, Set 3
Companion, Set 4 Master, Set 5 Immortals, and the adventures and gazetteers
written for them (Goblin's Lair, Wrath of the Immortals, Champions of
Mystara...). Read [kpack-format.md](kpack-format.md) first: it says what a
pack is, how pages, story entries, maps and tables are written, and how to
make and check a pack. This page adds only what is BECMI's own.

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

### The game itself: game.json (Set 1 only)

Maelstrom has no BECMI code: the Set 1 pack teaches it the game, as a
Fantasy Grounds ruleset teaches CoreRPG ([pack-games.md](pack-games.md)).
Copy [games/becmi.game.json](games/becmi.game.json) into the Set 1 pack's
folder as `game.json`, next to `kraken-pack.json` and `records.json`;
`npm run kpack:make` puts it in the zip. Check its numbers against the book
(the ability modifiers, the five saves' names, the undead kinds of the
turning table, the coins) and correct the copy if the book says otherwise.
Only Set 1 carries it; the other sets and every adventure say
`"ruleset": "D&D BECMI"` and add their records.

Once Set 1 (with its game.json) is in `Documents/Kraken VTT/Packs/D&D BECMI/`,
**Folders > Refresh** (or a restart) and **D&D BECMI** is on the campaign
screen.

### One game, or one game per set

Two ways work; choose before converting, and keep to it for the whole line.

- **One game, `D&D BECMI` (as above).** Set 1 carries `game.json`; every
  later set says `"ruleset": "D&D BECMI"`, has no `game.json`, and adds what
  it brings: the class levels it prints (4 to 14 for Expert; it may repeat
  1 to 3), its spells, its items, its monsters. A campaign activates the sets
  it plays with; a character goes from 1st level in Basic to 14th in Expert
  without leaving the campaign, and Set 1's monsters and tables stay
  available. Tested 2026-11-23: Set 1 with a copy of Set 2 relabelled this
  way gives one campaign both books, 106 monsters and a Magic-User levelled
  from Basic into Expert.
- **One game per set (`D&D BECMI Expert`, id `becmiexpert`...).** Each set's
  pack is a whole game on its own: its own `game.json` (its own id, name and
  `maxLevel`), **every** class level from 1, and everything a table needs
  that the set does not print again: the `Monster Attack Table`, the
  `Normal Man` table, the monsters, the equipment. Its campaigns see only
  that set's books (an Expert campaign cannot open Set 1 or its monsters),
  and characters do not move between a Basic and an Expert campaign. Use
  this only when the GM wants each set played on its own.

**An adventure is never a game of its own**, in either way. It has no
`game.json`, its `kind` is `adventure`, and its `ruleset` is the game it is
played in: the set its levels belong to (`D&D BECMI` for a Basic adventure
such as B1 or The Goblin's Lair; `D&D BECMI Expert` for X1 when the sets are
separate games). Maelstrom offers a game on the campaign screen only when a
book of its rules, monsters or setting is installed, never for an adventure
alone, so an adventure made a game of its own cannot be played at all. It
carries only what it adds: its keyed areas, battles, treasure, maps, its own
creatures (named individuals with their printed hit points) and its own
tables. Never copies of the rules book's classes, equipment, spells or
standard monsters: in the game's campaigns those are already there, and a
copy lists every item twice in the shop.

In either way, a later book that writes a class again may leave fields out
or empty; Maelstrom fills an empty field (`{}`, `[]`, `""`) from the other
book. It keeps the first book's value when both give one, so fix a wrong
value in the book that has it.

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
    `9`, `11` (roll needed on 2d6), `"T"` (turned), `"D"` (destroyed, 2d6 hit
    dice), `"D+"` (destroyed, 3d6), `"D#"` (destroyed, 4d6) or `"-"`. Write the
    marks exactly as printed; Maelstrom rolls the hit dice each one reaches.
    Keys: `skeleton`, `zombie`, `ghoul`, `wight`, `wraith`, `mummy`,
    `spectre`, `vampire`, `phantom`, `haunt`, `spirit`, `nightshade`, `lich`,
    `special`;
  - `skills` (Thieves): the percentages, keyed `openlocks`, `findtraps`,
    `removetraps`, `climb`, `movesilently`, `hide`, `pickpockets`, `hearnoise`
    (Hear Noise as the book writes it: `"1-2"` on a d6, or a percentage).
- `requirements`: minimum scores (`{ "constitution": 9 }` for a Dwarf).
- `xpbonus`: the prime requisite's experience adjustment, keyed by the lowest
  score that earns it, in percent (a penalty is negative). A class with two
  prime requisites (Elf, Halfling) gives a list of rules instead, each the
  minimum scores (`all` of them, or `any` one) and its bonus; the best one
  that holds counts:

  ```json
  "xpbonus": [
    { "all": { "strength": 13, "intelligence": 13 }, "bonus": 5 },
    { "all": { "strength": 13, "intelligence": 16 }, "bonus": 10 }
  ]
  ```

  The Halfling: `{ "any": { "strength": 13, "dexterity": 13 }, "bonus": 5 }`
  and `{ "all": { "strength": 13, "dexterity": 13 }, "bonus": 10 }`. Never
  leave it empty (`{}`): that is no bonus at all.
- `maxlevel`: the highest level the class reaches in the whole game (Dwarf
  12, Elf 10, Halfling 8, the human classes 36), even when this set prints
  only the first levels. Without it a class stops at the last level any
  active book gives.
- `attackranks` (Dwarf, Elf, Halfling past their top level, Companion set):
  `{ "C": { "xp": 660000, "thac0": 13, "saves": { ... } } }`, each rank the
  experience it starts at, its THAC0 and its five saves. A character at the
  class's last level with that much experience fights and saves by its
  highest rank; the sheet's title says it ("Dwarven Lord, attack rank E").
  A rank's other gains (smash, extra attacks, damage reduction) are its text
  in the class's `abilities`, for the GM.
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

- `encumbrance` in coins (cn), as the books count it, on every item the book
  weighs (a set that gives no weights, as Set 1, leaves it out: the load then
  counts coins only).
- Ammunition sold in a container keeps its count in its name: `Quiver with 20
  Arrows`, `Case with 30 Quarrels`, `Arrows (20)`; Maelstrom spends one a
  shot from it. A weapon sold with its shot (`Sling with 30 Sling Stones`)
  is the weapon only: give the shot as its own item too (`Sling Stones
  (30)`) when the book sells it apart, or the stones are not counted.
- A weapon with a `range` that is not a bow, crossbow or sling (dagger, hand
  axe, spear) is used both in melee and thrown: the sheet gives it both.
- Armor gives the Armor Class it makes (`ac`); a shield gives `acbonus` (it
  lowers AC by that much).
- Missile weapons give `range`: `"50/100/150"` (short, medium, long).
- Weapon mastery (Master set): `mastery`, keyed `basic`, `skilled`, `expert`,
  `master`, `grandmaster`, each `{ "damage": "...", "special": "..." }`. The
  damage as printed: one (`"1d8+4"`), or the primary and secondary targets'
  (`"P 1d8+8; S 1d8+6"`). The Inventory tab gives such a weapon a mastery
  select; its attack uses that level's damage (the primary target's) and
  shows its special. Give every weapon the book's table covers its
  `mastery`; a weapon without it attacks with its plain `damage`.

### Tables (`type: "tables"`)

Every random table the books print, as kpack-format.md's `tables` records:
wandering monsters by dungeon level and terrain, treasure types (one table
per letter, or one table with a row per letter), reaction (2d6), random
monster encounters, magic item tables. Name each as the book does.

The game itself reads two tables by name, so make them exactly:

- **`Monster Attack Table`**: rows by hit dice (`fromrange`/`torange` over
  the book's columns: up to 1, 1+ to 2, 2+ to 3 and so on), one result each:
  the roll needed to hit AC 0 (the THAC0 the monster has at those hit dice).
- **`Normal Man`**: the saves and to-hit of a Normal Man, a row a value,
  each row's result `key: number`: `death: 14`, `wands: 15`, `paralysis: 16`,
  `breath: 17`, `spells: 18`, `thac0: 20` (the book's numbers).

### Characters (`type: "pregencharsheet"`)

The pregenerated characters some adventures give (the Set 1 solo adventure's
fighter, the sample characters): `name`, `class`, `level`, `alignment`, the
six scores (`strength`...`charisma`), `hp`, `ac`, `xp`, `equipment`, `spells`
and `coins` (`{ "GP": 10 }`). The wizard's first step offers them; taken,
the character is built from the class and the items, and must come out at the
book's `ac` and `hp`.

`equipment` is a list of lines, **each the exact name of an item record** of
the books, with a count in front when there is more than one; two items on
one line joined by `&`:

```json
"equipment": ["Chain Mail Armor & Shield", "Mace", "Holy Symbol", "Backpack", "Torches, 6", "2 Waterskin or Wineskin", "12 Iron Spikes and Small Hammer", "2 Large Sack", "Flask of Oil", "Iron Rations", "Rope, 50 Feet"]
```

A line that names no item (`"6 tinder box torches"`, `"Rope (50')"`) is
carried as written, with no price, weight or use, and the wizard says so.
Things the book gives that are not sold (a gem, a family heirloom) are fine
as written.

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

### What to look at besides the pages

- Build each class in the wizard and compare its sheet with the book: saves,
  THAC0, hit die, a Thief's skills (Hear Noise `1-2`), spells a day.
- Take every sample character: each must match the book's Armor Class, hit
  points and money, and carry no line "as written" that is an item the book
  sells.
- An Elf with Strength 13 and Intelligence 16 shows +10% XP; a Halfling with
  Strength 13 shows +5%.
- A monster that saves as `NM` attacks at the Normal Man table's THAC0 (20)
  unless its own record gives `thac0`.

## 5. Set 1: Basic Rules, as made on 2026-11-23

Tested in Maelstrom: the classes, saves, THAC0, the Monster Attack Table,
the Normal Man table, turning, the Thief's skills, morale and the equipment
play as the book prints them. To fix in the pack:

1. **Elf and Halfling `xpbonus` is `{}`.** Give the two-prime-requisite
   rules above (section 2, Classes).
2. **Dwarf, Elf and Halfling have no `maxlevel`.** Give 12, 10 and 8.
3. **The sample characters' equipment lines name no item** in many places,
   so those things are carried as plain words:
   - Sample Cleric: `6 tinder box torches`, `2 waterskins (full)`, `1 flask oil`, `Rope (50′)`.
   - Sample Magic-User: `1 waterskin (full)`, `1 Holy water`, `4 flasks oil`, `Small metal mirror`, `1 wineskin (full)`.
   - Sample Thief: `Wolfsbane`, `3 flasks oil`.
   - Sample Dwarf: `Small hammer`, `Rope (50′)`, `1 full wineskin`, `12 iron spikes`, `Wolfsbane`.
   - Sample Elf: `Wolfsbane`, `20 arrows`, `Rope (50′)`.
   - Sample Halfling: `1 wineskin (full)`, `20 normal arrows`, `4 silver arrows`, `6 torches`, `1 waterskin (full)`.
   - Solo Adventure Fighter: `2 flasks of oil`, `Tinderbox`, `Rope, 50′`, `Leather backpack`, `Waterskin`, `2 torches` (and `Gem (100 gp)`, fine as written).

   Write them with the item names (`Torches, 6`, `Waterskin or Wineskin`,
   `Flask of Oil`, `Rope, 50 Feet`, `Wolfsbane, 1 Bunch`, `Holy Water, 1
   Vial`, `Steel Mirror`, `Tinder Box`, `Quiver with 20 Arrows`,
   `Silver-Tipped Arrow`, `12 Iron Spikes and Small Hammer`), each with its
   count. Their Armor Class, hit points and coins are already right.
4. **`Sling with 30 Sling Stones`** is one weapon item; the stones are not
   counted as shot. Leave it if the book sells them only together.
5. **No item has `encumbrance`.** Set 1 gives no weights, so this is right
   for it; the Expert set's equipment list does, so give them there.

## 6. Set 2: Expert Rules, as made on 2026-11-23

Made as its own game, `D&D BECMI Expert`. Tested in Maelstrom: the campaign
screen offers it; the wizard builds all seven classes; every class levels to
its top (humans 14, Dwarf 12, Elf 10, Halfling 8) with the book's titles,
hit dice, saves and spells a day; the two-score XP bonus works; cleric
turning works, `D+` included; all 106 pages open. To fix in the pack:

1. **Magic-User THAC0 is one row off.** The book's Character Hit Rolls
   table (its own Combat page) gives Magic-Users 19 at levels 1 to 5, 17 at
   6 to 10 and 15 at 11 to 15; the pack gives 17, 15 and 13. A 1st level
   Magic-User hits as a 6th. Read each class's THAC0 from the AC 0 column of
   its own row.
2. **Javelin has no `damage` or `range`; Staff has no `damage`.** Give them
   as the weapons table prints them. Without `damage` a weapon is not an
   attack on the sheet.
3. **Barding is `"type": "Armor"` with `ac`.** A character who buys it wears
   it (AC 5). Make it `"type": "Gear"` with its Armor Class in its text, as
   it is a horse's.
4. **Light Catapult is a `Weapon` with no damage.** Give its damage, or
   type it `Gear` (a siege engine, not a character's weapon).
5. **No monsters.** The Expert rules' monster chapter and The Isle of Dread
   have many; the pack has no `npc` records, so an Expert campaign has
   nothing to fight. Add each as section 2's Monsters says.
6. **The Isle of Dread has no story records.** Its keyed areas need
   `encounter` records, a `battle` for each fight, its creatures, and a
   `treasureparcels` for each hoard (section 3). It is TSR's module X1:
   better as its own pack (`kind: "adventure"`, `group: "X series"`,
   `order: "X1"`) with the same `ruleset`.
7. **Every map has `"grid": "off"`.** The temple levels, the pirate lair and
   the cave lairs are battle maps: give them `"grid": "on"`, their
   `gridsize` and `gridoffset`. Region and continent maps may stay off.
8. **87 of the 106 pages are a scan only** (not 74). Their text, tables and
   monsters cannot be searched, linked or rolled until transcribed.
9. Ammunition items (`Quiver with 20 Arrows`, `Case with 30 Quarrels`,
   `Silver-tipped Arrow`) have no `encumbrance`; the book's equipment table
   gives them.

Checked and right: the Monster Attack Table and the Normal Man table (spell
save 17, as this book prints it); hit dice past 9th level (`9d8+10`);
cleric turning rows to 14th level; the Thief's skills (Pick Pockets 125% at
14th: the sheet shows at most 99%, the GM rules above it).

## 7. Set 3: Companion Rules, review build of 2026-11-23

Made as its own game, `D&D BECMI Companion` (levels to 25). Tested in
Maelstrom with only this pack: every class builds and levels to its cap
(humans 25, Dwarf 12, Elf 10, Halfling 8); attack ranks play (a 12th level
Dwarf with 1,500,000 XP fights and saves at rank G, THAC0 9); a 25th level
cleric's `D#` destroys with 4d6 hit dice; the monsters fight, save and check
morale; all 104 pages open. To fix in the pack:

1. **Scale Mail and Banded Mail have no `cost`**: the shop cannot sell them
   and a character cannot start in them. Give their prices.
2. **The Cleric page carries a note for the app** ("Resolve this result
   manually in the current tracker"). Book text is the book's words only;
   Maelstrom now plays `D#`, so take the note out.
3. **One damage for two attacks**: the Basilisk's `attacks` "1 bite/1 gaze"
   with `damage` "1d10" gives the gaze 1d10 too. Write a damage for each
   attack in order, a word for one with no dice: `"1d10/petrification"`.
4. **19 of the Companion's own monsters** are records; the rest of its
   monster chapter is still page scans. The pack repeats Set 1's 97
   monsters ("Basic bestiary (inherited)") but none of Expert's (as a game
   of its own it needs every monster a Companion campaign meets: Expert's
   dragons, giants and the rest too).
5. **Green Slime, Sprite and Yellow Mold have no `ac`**: they come onto the
   tracker at AC 9. Give the book's (Green Slime: "can always be hit", write
   `9` and say so in its text).
6. **The three adventures' encounters link nothing**: The Golden Dagger,
   The Arena of Garald the Blue and The Fall of the Black Eagle have no links
   to their creatures, battles, treasure or maps. Only the arena's escape
   guards are a battle.
7. **94 of the 104 pages are scans only.**
8. Check against the book: Halfling attack rank A starts at 120,000 XP, the
   same as 8th level, so a Halfling is never 8th level without a rank.

Checked and right: THAC0 and saves by level to 25 (the rows at 28, 29, 31,
33 and 34 give the saves past 25 for when Master set levels come), the
Normal Man and Monster Attack tables, the Dwarf, Elf and Halfling rank
tables as printed in the pack.

## 8. Set 4: Master Rules, review build of 2026-11-23

Made as its own game, `D&D BECMI Master` (levels to 36). It carries the
fixes asked for in section 7 (armor prices, a damage for each attack, the
Halfling's 128,000 XP, the inherited Expert monsters). Tested in Maelstrom
with only this pack: every class builds and levels to its cap (humans 36);
Suit Armor makes a Fighter AC -1; attack ranks play; a 36th level cleric's
`D#` destroys with 4d6 hit dice; weapon mastery plays from the sheet (a
master's Battle Axe: 1d8+8 and Strength, "Delay and stun"); a Huge Gold
Dragon, a Bone Golem and a Centaur fight; all 104 pages open. Maelstrom now
reads a THAC0 of 0 (and below), rolls an attack "by weapon" with the game's
weapon damage (`attack.weaponDamage`, 1d6), and plays weapon mastery. To fix
in the pack:

1. **The Huge Gold Dragon's text has a note for the app** ("The current
   tracker treats a literal THAC0 of zero as unset") and its `thac0` was
   left out. Maelstrom now takes 0: give `"thac0": 0` and take the note out.
2. **12 of the 25 weapons have `mastery`.** Crossbow, Long Bow, Short Bow,
   Silver Dagger, Mace, Club, Pole Arm, Sling, War Hammer, Bastard Sword,
   Bola, Heavy Crossbow and Whip have none, so they cannot be mastered.
3. **97 of the 104 pages are scans only.**
4. Check against the book: the Elf's spells a day at 10th level are
   5/4/3/2/1 here and 3/3/3/3/2 in Set 2. One of the two is misread.
5. The monsters are 193: Set 1's 97, Expert's 60, the Companion's 23 and 13
   of the Master set's own; the rest of its bestiary is still page scans.

## 9. Set 5: Immortals Rules, review build of 2026-11-23

Made as its own game, `D&D BECMI Immortals`, with one class, `Immortal`,
whose 31 levels are the ranks (Initiate to Full Hierarch 5th level). Tested
in Maelstrom: the Immortal builds and climbs all 31 rows (hit points from
the table, 75 to 1,000; THAC0 8 to -2; the four Immortal saves); Orcus,
the demons, the tonals and the rest fight and save as their `I` ranks; all
100 pages open. Maelstrom now: takes ability scores up to the game's
modifier table (100); lets the wizard **type** the scores instead of rolling
them (`"abilityEntry": "typed"` in game.json); leaves out the money and shop
step when the books sell nothing; rolls no hit die when hit points are the
class's table from 1st level; reads a creature's own `saves`; and uses a
creature's printed `hp` on the tracker (it rolled the hit dice before, in
every set). To fix in the pack:

1. **Add `"abilityEntry": "typed"` to game.json.** Without it the wizard
   rolls 3d6 for an Immortal; with it the player types each score (0 to
   100), as the mortal's scores carried over and raised.
2. **The Croaking Demon's bite is `4-18`**, a range, not dice. Write the
   dice that give it (`2d8+2`).
3. **The Nipper saves as `F1`**, but this game has no Fighter, so it saves
   at 20. Give it its own `saves` (`{ "physical": 12, ... }`, the book's
   numbers), which Maelstrom now reads.
4. **Attacks with no dice** (Baak's power, Orcus's tail, Demogorgon's tail
   and tentacles, the Elemaster's fists): fine where the book gives an
   effect only; write the dice where it gives them.
5. **The class row's own numbers** (`immortalHitDice`, `antiMagic`) are
   kept but not shown or used; the sheet does not show Anti-Magic yet.
6. **91 of the 100 pages are scans only**; 19 creatures are records, the
   rest of the bestiary is still scans.
7. game.json still carries the mortal defaults it does not use (coins and
   `3d6*10` starting gold); harmless, as the books sell nothing.

The character art library's Immortals pairs (race `Immortal`, the five
Spheres as classes) go to an Immortal at random by gender; the wizard has no
Sphere choice yet.

## 10. The Goblin's Lair (TSR 1076), review build of 2026-11-23

Made as its own game, `D&D BECMI Goblin's Lair`, with a `game.json` and
copies of Set 1's 7 classes, 102 items, 34 spells, its two rules tables and
13 of its monsters. **As made it cannot be played**: Maelstrom registers the
game but does not offer it on the campaign screen, since an adventure alone
is not the game's books (section 2, "One game, or one game per set").

Tested instead as it should be, on a copy with `"ruleset": "D&D BECMI"` and
no `game.json`, beside Set 1, in a D&D BECMI campaign: the adventure is in
Modules and its lists show 2 maps, 19 battles, 8 parcels, 31 story entries,
83 creatures and 4 tables; a story entry opens with its map, battle and
printed-key links; the Palace of Dread map goes on the table with its 5-foot
grid; the Guard Room battle brings its five sentries and their chief onto
the tracker at their printed hit points (7, 6, 6, 5, 3 and 12); a character
fights them, and their morale breaks as the rules say. To fix in the pack:

1. **Make it an adventure of `D&D BECMI`**: `"ruleset": "D&D BECMI"`, no
   `game.json`, and take out the copies of Set 1's classes, items, spells,
   the Monster Attack and Normal Man tables and the 13 standard monsters
   (Bugbear, Carrion Crawler, Dire Wolf, Fire Beetle, Giant Centipede, Giant
   Rat, Gnome, Goblin, Gray Ooze, Hobgoblin, Normal Bat, Normal Rat, Rock
   Python). Keep its own named creatures (the sentries, the chief, the King)
   and its two wandering monster tables. Link a standard monster to Set 1's
   record (`npc.goblin@Set 1: Basic Rules`).
2. **The battles place no tokens.** A battle's creatures go on the open map
   where its rows say (`maplink`: the map's `imageref` and the creature's
   `imagex`, `imagey` from the picture's centre, as Fantasy Grounds stores
   them); without them the GM drags each from the tracker. Give each
   creature its spot from the keyed map.
3. **The treasure parcels are linked from no story entry.** Link each from
   its room's encounter (`<link class="treasureparcels" recordname="...">`).
4. **The maps' grids are not square** (`gridsize` "62.08,63.04" and
   "60.10,60.79"); Maelstrom uses the first number, so the grid drifts about
   one square in sixty down the map. Scale the picture so its squares are
   square, then give one size.
5. **The maps have no walls or doors**, so the players' line of sight is not
   blocked. Fine for a first build (the GM adds them in Map Studio);
   better with the dungeon's walls and doors as `occluders`.
6. The Red Hand Trail booklet and the handouts are missing from the PDF
   (Codex's review notes); 67 of the 72 pages are still scans.

### The Goblin's Lair rebuilt (D&D BECMI adventure), 2026-11-23

Rebuilt as asked: `"ruleset": "D&D BECMI"`, no `game.json`, no copies of
Set 1, 18 links into Set 1, battles with map positions, square grids. With
Set 1 in a D&D BECMI campaign every battle puts its creatures on its map
(70 tokens, none off the picture), the Story window's links open (fixed in
Maelstrom: they were all shown as text) and a book's treasure parcel shows
its items and coins and goes to the party sheet (fixed in Maelstrom: the
window was empty). To fix in the pack:

1. **The tokens were not in their rooms** (laid out as a block around each
   key number, some on rock). Fixed in Maelstrom instead: a PDF's spots are
   only about where a room is, so Maelstrom now puts each creature on the
   nearest free floor square of that room, read from the map's picture. All
   70 now stand on floor. Nothing to change in the pack.
2. Walls and doors are still to come; 67 pages are still scans; the Red
   Hand Trail booklet and the handouts are not in the PDF.

## 11. Wrath of the Immortals: The Immortals' Fury (TSR 1082), review build of 2026-11-23

An adventure of `D&D BECMI Master` (no `game.json`), played beside the Set 4
Master pack in a D&D BECMI Master campaign. Tested: the Modules list shows
it with 3 maps, 4 battles, 2 parcels, 13 story entries and 9 creatures; all
13 story entries open with their 47 links (none dead); the four battles put
their 5 creatures in their rooms on the Temple of Balthac and the Corran Keep
cave (Lady Lillith's two battles are her two places, for the GM to pick one);
both parcels go to the party sheet (500 sp; 500 sp and 200 gp). Its named
humans now get faces (Maelstrom: a class or title alone, "Cleric of
Balthac", "Lady Lillith", "Lord Kazakk", is a human of that kind).

Still to do (Codex's review notes): Book I, Codex of the Immortals, is not in
the PDF; 105 of the 114 pages are scans; most keyed areas have no
encounters, battles or treasure yet; the poster panels are not assembled;
walls and doors are not traced. The lesser Sprackle's save `F1-1` is kept in
its text and played as `F1`.

## 12. Champions of Mystara (TSR 1094), review build of 2026-11-23

A setting supplement of `D&D BECMI Master` (kind `setting`, no `game.json`),
played beside the Set 4 Master pack in a D&D BECMI Master campaign. It holds
280 pages, 56 creatures and heroes, 15 spells, 15 items (the War Claw with its
mastery), 9 skyships as `vehicle` records, 2 tables and 7 pictures (5 gridded
decks: the Princess Ark's decks 5, 6 and 7, the Flying Barge, the Alphatian
Man-of-War). Tested:

- The creatures go to the tracker with their printed hit points, attacks and
  damage (the Night Dragon's claw/claw/bite, the Sky Wyrm's whirlwind, the
  Guardian Tree's branch/root/vine). Every save code it uses reads right
  against Set 4's tables, up to `F36`, `C31`, `MU30`; `D8` (the sky gnome)
  saves as a dwarf, `H2` as a halfling, `NM` from the Normal Man table, and a
  hero with his own `saves` (Xerdon's `E10+2` through his armband) keeps them.
- Both tables roll (Aerial Encounters, the Pouch of Winds).
- The skyships show in the GM's Vehicles list under "Champions of Mystara,
  Skyships", with tonnage, hull points, AC, lift, speeds and maneuvering
  factor. Their links now open: "Open Deck 5" opens the deck in the map
  window, on its grid, and "Open the printed source" opens the book's page.
  (Fixed in Maelstrom: a record's links were followed only in a book's own
  record window, and picture links not at all.)

To fix in the pack:

1. **Picture links use `class="image"`.** Write FG's `imagewindow`
   (kpack-format.md, "Picture links with a made-up class").
2. **A note for the app in a creature's text**: the Guardian Tree's "The
   tracker represents the 25-HD trunk." Say what the record stands for in the
   book's words, or put it in the hand-over report.
3. **Pictures and tokens**: 2 of the 71 creatures and items have them. Take
   them from the art staging folder (`.kpack-review/Art/index.json`, by record
   name) as kpack-format.md says.

Still to do (Codex's review notes): aerial combat (ship against ship, hull
points, maneuvering) is played by the GM from the book; the two ungridded
pictures are views, not battle maps.
