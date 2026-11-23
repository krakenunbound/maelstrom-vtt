# Character portraits and tokens (games/characters)

Maelstrom ships a library of character portraits and tokens, made by the GM
(generated locally, owned by them), for every game it plays and for games it
may play later. Each picture is a pair: a square **portrait** (1024×1024) and
its **token** (512×512, a round frame, transparent outside it), the same face.

## 1. The folders

```text
games/characters/
├── manifest.json
├── in_common/<Race>/<Class or role>/<Gender>/<Name>_Portrait.webp, <Name>_Token.webp
└── <Ruleset>/<Race>/<Class or role>/<Gender>/...
```

- **`in_common`** holds a race and class that serve several systems (a Dwarf
  Fighter for 5E, 3.5E, C&C...): one copy, listed for each system that may
  use it. Nothing is stored twice.
- **A ruleset folder** (`D&D 5e (2024)`, `Blades in the Dark`, `Traveller 2e
  (2022)`...) holds what only that system has: its own races, classes,
  careers or playbooks, or its own look.
- **Gender** is `Female` or `Male`. Each race, class and gender has two or
  more faces.
- Folders exist for systems Maelstrom does not play yet (Pathfinder,
  Daggerheart, Shadowrun...): a game added later finds its art waiting.

`manifest.json` lists every pair:

```json
{ "format": "maelstrom-character-art", "version": 1, "pairs": [
  { "ruleset": "in_common", "race": "Dwarf", "cls": "Fighter", "gender": "Female", "name": "V1_BattleScarred",
    "portrait": "in_common/Dwarf/Fighter/Female/..._Portrait.webp", "token": "in_common/Dwarf/Fighter/Female/..._Token.webp",
    "rulesets": ["D&D 5e (2014)", "D&D 3.5e", "Castles & Crusades"] }
] }
```

`rulesets` are the systems the pair serves (a shared pair lists several).

## 2. Which art a campaign sees

`shared/characters/art.mjs` `ART_RULESETS` names, for each of Maelstrom's
games, the library's systems whose art fits it: D&D 5E takes `D&D 5e (2014)`
and `D&D 5e (2024)`; 3.5E takes 3.5e and 3.0e; AD&D 2E takes 2e and 1e;
Forged in the Dark takes Blades in the Dark; Basic Fantasy takes Old School
Essentials and B/X; D&D BECMI takes the BECMI sets and the Rules Cyclopedia.
A game with no entry (Worldbuilding, Fate, Ironsworn, Cairn) sees the shared
`in_common` art. A new game gets art by adding its line there.

The portrait and token pickers (the wizard, a sheet's picture, a token)
list these under **Characters · <Race>**, beside the GM's own folders and the
players' uploads. Anyone at the table may choose one at any time.

## 3. A new character's picture

When a character is made (any wizard, or `kraken_build_character`), it gets
a portrait **and its own token** from the library: its race, class and
gender; if there is none, the nearest (race and class, race and gender,
race); chosen at random among those that fit. In the wizards that show the
picture (5E, 3.5E, 2E, C&C), it is shown before the character is saved and
chosen again when the race, class or **gender** changes (a gender rolled
again shows another face), until the player picks one by hand. A portrait
picked by hand brings its own token. A character that already has pictures
keeps them. With no fitting pair, the older pictures (Maelstrom's own, the
GM's folders) are used as before.

## 4. Adding art

New pairs are made in a separate working folder with its own `manifest.csv`
(columns `Ruleset`, `Race or ancestry`, `Class or role`, `Gender`,
`Character`, `Portrait`, `Token`, `Applicable rulesets`; paths relative to
that folder, PNG). Bring them in:

```powershell
node scripts/import-character-art.mjs "<the working folder>"
node scripts/import-character-art.mjs --verify
npm run character-art
```

The import converts each listed pair to WebP (portrait quality 85, token
quality 85 with its transparency), keeps the folder tree, adds it to
`manifest.json`, and skips pairs already brought in, so it runs again for
each new batch. PNGs the CSV does not list are reported, not brought in.
`--verify` decodes every file: the portrait 1024, the token 512 and
transparent at its corner.

## 5. Shipping

The installer carries the library beside the app (`extraResources`:
`resources/characters`), not inside `app.asar`; the app reads it there, or
from `games/characters` when run from the repository.
