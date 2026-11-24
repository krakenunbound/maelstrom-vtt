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

## 3b. Creatures

A creature (an NPC, a monster of a book or adventure) with no picture of its
own, nor one from its book, gets one of its kind, on the map, the tracker and
its window:

- **A face from the character art**, by the race its name shows ("Goblin
  Sentry": a goblin; "Hobgoblin" before "Goblin"; a Gnoll is a Kholo, a
  Bandit a human thief), the class its role suggests (a chief or sentry a
  fighter, a shaman a cleric), from any system's art (a goblin looks like a
  goblin in any game). Each creature keeps the same face (chosen by its
  record), and a room of goblins gets different ones.
- **The shipped creature art next**, for a creature with no art of its own
  (art made for it by its name, in the GM's art folders, always comes first)
  (`games/creatures`: a portrait and its
  token for each of the 595 creatures of the GM's 3.5e Monster Manual, the
  GM's own AI-made art, free to use in every game). Found by its name's
  words, a book's commas too ("Adult Red Dragon" is "Red Dragon, Adult"; a
  Giant Bat is a Bat, "giant" before another word being only its size), the
  plainest name first, its portrait with its token; words in brackets choose
  among them ("Elemental (Fire, 12 HD)" a fire one, a hatchling a wyrmling).
  Never another creature that only carries the name's words: a book's sample
  with class levels must be of the name's kind ("Celestial Charger, 7th-Level
  Cleric" is no "Cleric 5"), and a template ("Zombie, Human Commoner",
  "Half-Black Dragon ... Human Fighter") never stands for a plain one. A
  class in the name ("Human Fighter", "Gnoll Ranger") chooses the face's
  class. A short name ("Ox") finds only art named for it. It comes before a face
  its record's words suggest (a Giant Bat whose text speaks of vampire bats
  is still a bat). `scripts/import-creature-art.mjs <module.mod>` brings in
  another book's (an FG module whose creatures each have a picture and a
  token), named after each record.
- **Else a token of its name from the token folders** (Forgotten Adventures'
  Dire Wolf, Owlbear, Giant Fire Beetle), the app's own folders before a
  campaign's, never a placeholder card.

The book's own picture always wins; the GM can still give any creature
another.

### What a creature's record tells

The name is only the start. The picker reads the creature's whole record:

- **Its kind**, from its name, else from its description: "nosferatu" or
  "vampire" is a Vampire; "zombie", "skeleton", "ghoul", "wight", "mummy",
  "demon", "devil", or being held by Turn Undead, takes that kind's token.
  A class or title in the name ("Lord", "Cleric") never beats what the
  record says (Lord Kazakk, whom Turn Undead holds, is undead).
- **Its class**, from its Save As code (`C5` cleric, `MU5` magic-user, `T`
  thief, `F` fighter) or "Cleric 5" in its text; a caster's save or a class
  in its text makes it a person, a human unless something says otherwise.
- **Its gender**, from a title (Lady, Queen, Lord, King) or its text's
  pronouns ("He carries a sword").

### Art made for one creature

A creature the libraries have nothing for (a book's own monster, a named
villain) can have its own portrait and token: put them in the art folders
named after it, `%APPDATA%\kraken-vtt\assets\portraits\Creatures\<Name>_Portrait.webp`
and `tokens\Creatures\<Name>_Token.webp` (the full name, parentheses too:
`Sprackle (Lesser)`). Maelstrom uses them before anything else.
`games/tools/creature_art.mjs <list.json>` makes them with the local ComfyUI
(a portrait, then a round token with a ring). They stay on this computer:
a book's creatures are its publisher's.

Each prompt is a plain description of how the creature looks ("a gorgon, a
great bull covered in iron scales, breathing green gas"), never its record's
text: rules words (saves, damage, page numbers) come out painted into the
picture as words, and a bare name the model does not know comes out as the
wrong thing (giants as boulders, a harpy as an eagle). Look over a contact
sheet of everything made and paint the bad ones again.

## 3c. Pictures that do not fit

`review.json` lists portraits that do not look like their race (a goblin
drawn as a human with pointed ears), checked on contact sheets of every
portrait of a race. Automatic picks (new characters, creatures) never use
them; the pickers still offer them. To take pictures out for good, delete
both files of the pair (`_Portrait.webp` and `_Token.webp`), then:

```powershell
node scripts/import-character-art.mjs --prune
```

The pairs leave `manifest.json` and `review.json` and are remembered
(`removed`), so a later import does not bring them back. Maelstrom also skips
a pair whose files are gone, and every seat's map gets its tokens again when
the pictures change.

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
from `games/characters` when run from the repository. The creature art the
same way (`resources/creatures`, else `games/creatures`).
