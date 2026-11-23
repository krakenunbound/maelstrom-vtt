# Games defined by their books (game.json)

Maelstrom plays a game it has no code for when the game's rules book teaches
it, the way Fantasy Grounds' CoreRPG takes a ruleset. A rules pack carries a
`game.json` beside its `records.json`: it says how the game plays. Maelstrom
reads it when it reads the packs, offers the game on the campaign screen, and
a campaign of it sets itself up from it: the character sheet, the character
wizard, the combat tracker, the party sheet's rolls, the coins. **The numbers
come from the books' records**: each class's levels, each monster's line,
each spell and item. Nothing in Maelstrom's code is that game's.

The first game made this way is D&D BECMI: see [becmi-packs.md](becmi-packs.md)
for its records, and [games/becmi.game.json](games/becmi.game.json) for its
definition.

## 1. Where it goes

- In the zip of the game's core rules pack (its first book: BECMI's Set 1),
  at the top, named `game.json`. One pack per game carries it.
- Every pack of the game (the rules books and its adventures) has
  `"ruleset": "<the game's name>"` in its `kraken-pack.json`, the same name as
  `game.json`'s `name`. Those packs show in campaigns of that game only.
- **Folders > Refresh** (or a restart) reads a new or changed `game.json`.
  A campaign already of the game reads the changed definition when it opens.

## 2. game.json

Everything but `name` has a default (the old-school one: the six abilities,
the five saves, descending AC, THAC0, d6 initiative by side).

```json
{
  "format": "maelstrom-game",
  "version": 1,
  "id": "becmi",
  "name": "D&D BECMI",
  "blurb": "What the campaign screen says about it.",
  "abilities": [{ "key": "strength", "label": "Strength", "short": "STR" }],
  "abilityDice": "3d6",
  "abilitySwap": false,
  "abilityModifiers": [{ "from": 3, "to": 3, "mod": -3 }, { "from": 4, "to": 5, "mod": -2 }],
  "abilityCheck": { "die": "1d20", "atMost": true },
  "saves": [{ "key": "death", "label": "Death Ray or Poison" }, { "key": "spells", "label": "Rods, Staves or Spells", "ability": "wisdom" }],
  "saveDie": "1d20",
  "saveNaturalFail": 1,
  "saveNaturalPass": 20,
  "armorClass": { "descending": true, "unarmored": 9, "ability": "dexterity" },
  "attack": { "by": "thac0", "melee": "strength", "missile": "dexterity", "damage": "strength", "naturalHit": 20, "naturalMiss": 1, "minimumDamage": 1 },
  "initiative": { "die": "1d6", "by": "side", "order": "high", "ability": "" },
  "morale": { "die": "2d6", "atMost": true },
  "hitPoints": { "ability": "constitution", "abilityTo": 9, "deadAt": 0, "minimumPerDie": 1 },
  "skills": { "die": "1d100", "atMost": true, "names": { "openlocks": "Open Locks" } },
  "turning": { "die": "2d6", "affected": "2d6", "duration": "", "undead": [{ "key": "skeleton", "names": ["Skeleton"] }] },
  "coins": [{ "key": "GP", "name": "Gold", "value": 100 }],
  "startingGold": "3d6*10",
  "encumbrance": { "unit": "cn", "coinsPer": 1 },
  "alignments": ["Lawful", "Neutral", "Chaotic"],
  "maxLevel": 36,
  "classType": "class",
  "saveAs": { "F": "Fighter", "NM": "Normal Man" },
  "tables": { "monsterAttack": "Monster Attack Table", "normalMan": "Normal Man" },
  "normalMan": { "thac0": 20, "saves": { "death": 14 } },
  "monsterThac0": [{ "upTo": 1, "thac0": 19 }],
  "calendar": "gregorian"
}
```

| Field | Meaning |
|---|---|
| `id` | Letters and digits; a character of the game keeps `pack<id>` as its game. Never change it once characters exist. |
| `name` | The game's name: the campaign screen's, and every one of its packs' `ruleset`. |
| `abilities` | The scores, in the sheet's order. |
| `abilityDice`, `abilitySwap` | How the wizard rolls them (in order), and whether two may be swapped. |
| `abilityModifiers` | The modifier for each range of score. |
| `abilityCheck` | An ability check: the die, at or under the score (`atMost`) or at or above. |
| `saves` | The saving throws, in order; `ability`: an ability whose modifier helps that save (Wisdom against spells). |
| `armorClass` | `descending` (lower is better, armor sets it, a shield and Dexterity lower it) or ascending; unarmored AC. |
| `attack` | `by`: `thac0` (d20 + bonuses at or above THAC0 minus the target's AC) or `bonus` (d20 + attack bonus at or above the AC); the abilities for melee, missiles and damage; the naturals. |
| `initiative` | The die; `by`: `side` (one roll a side) or `creature`; `order`: `high` or `low` first. |
| `morale` | A monster's morale and a retainer's loyalty: the die, at or under. |
| `hitPoints` | The ability added to each hit die, up to which level; after it, the class's fixed gain (its levels' `hitdice`, `"9d8+2"`); dead at `deadAt`. |
| `skills` | A class's percentage skills (a Thief's): the die and the names of the keys its levels give. |
| `turning` | Turning the undead: the die, the hit dice affected, how long the turned flee (dice of rounds; empty: the GM ends it), and the undead kinds (each the words in a monster's name that make it that kind). A cleric's levels give the row (`turning`). |
| `coins` | The coins, each its worth in the smallest. |
| `startingGold` | The wizard's money roll, in gold. |
| `encumbrance` | The unit things weigh in (the books' `encumbrance` on items) and how many coins make one. |
| `classType` | The record type of the classes (`class`). |
| `saveAs` | The codes a monster's "Save As" uses, each the class it names (`F2`: Fighter 2). |
| `tables` | The two tables the rules read by name from the books (section 3). |
| `normalMan`, `monsterThac0` | The numbers when the books have no such tables. |

## 3. What the rules read from the books

- **Classes** (`class` records): `primerequisite`, `requirements`,
  `xpbonus`, `hitdie`, `race` (race as class), `maxlevel`, `spellcasting`
  (`arcane` or `divine`), and `levels`, keyed by level, each with `xp`,
  `title`, `hitdice`, `thac0` (or `attackbonus`), `saves`, `spells` (a day by
  spell level), `turning`, `skills`. A level that does not give a value uses
  the nearest level below that does; a later book adds levels to a class by
  writing the class again with only its new levels.
- **Monsters** (`npc`): `ac`, `hd` (as printed: `"3*"`, `"4+1"`, `"1-1"`,
  `"1/2"`), `thac0` (else the Monster Attack Table by hit dice), `attacks` and
  `damage` (`"2 claws/1 bite"`, `"1d4/1d4/1d8"`), `saveas`, `morale`, `xp`,
  `hp` (fixed, else rolled from the hit dice), `undead` (its turning kind,
  when its name does not say).
- **Items** (`item`): `type` (`Weapon`, `Armor`, `Gear`...), `cost` (`"10
  gp"` in the game's coins), `encumbrance`, `damage`, `range` (missile), `ac`
  (armor), `acbonus` (a shield), `bonus` (magic).
- **Tables** (`tables`): the **Monster Attack Table** (rows by hit dice,
  `fromrange`/`torange`, the result the THAC0) and the **Normal Man** (a row a
  value: `death: 14`, `thac0: 20`).

## 4. What it gives

- **Campaign screen:** the game, its blurb.
- **Character wizard:** the abilities rolled, a class from the books, money
  and the shop, name and alignment. The host rolls the first hit die and holds
  the books' rules (a class's minimum scores, the money).
- **Sheet:**
  - main: the abilities and their checks, Armor Class, hit points, initiative, load and the saves;
  - combat: the ready weapons, each to hit and its damage;
  - skills, spells (spells a day, the spellbook), the inventory and coins, and notes;
  - the strip: level, experience (the prime requisite's bonus), THAC0, and a modifier box.
- **Tracker:**
  - a monster's hit points from its hit dice, its AC and attacks;
  - attacks by THAC0 against descending AC (or by bonus), damage, saves (a monster as its "Save As" class and level);
  - morale, turning by the cleric's row, dead at 0;
  - initiative by side.
- **Party:** its coins, group saves and checks.

What the definition and the records do not cover (a spell's effect, a special
attack, weapon mastery's specials) is the books' text, for the GM to rule, as
in CoreRPG.

Checked by `node scripts/check-pack-game.mjs` (a made-up game, defined only
by a pack).
