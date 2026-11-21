# Bringing a game and its content to Maelstrom VTT (an agent's guide)

This page is written for AI coding agents (and the people who direct them). It
says, for every kind of thing a GM might bring to Maelstrom, what Maelstrom
reads, where it goes, how to make or convert it, and how to prove it works. It
points to the detailed format documents rather than repeating them; read the
one named in each section before you start.

Maelstrom reads both Fantasy Grounds and Foundry VTT content. Its own formats
are the **pack** (`.kpack`, a book in one file) and the folders in
`Documents/Kraken VTT`. The app was called Kraken VTT until alpha.92, so files,
folders, tools and environment variables still say "Kraken".

**Ground rules for any conversion**

- Never put a GM's purchased or licensed content in the public repository
  (packs, art, sounds, maps). It lives in the GM's own folders on their computer.
- The core interface draws what a ruleset declares; it is never written for one
  game. A game's rules go in its ruleset files (below), never in shared code.
- Prove each conversion in the running app: open it, play it, look at it
  (screenshots), and run the checks named here. A conversion is not done until
  it has been played.

## Where everything lives

| What | Where | Read by |
|---|---|---|
| Books and packs (`.kpack`) | `Documents/Kraken VTT/Packs/<game>/` | Modules and Books windows |
| FG modules (`.mod`) | FG's own `modules` folder (read in place) | Modules, Make pack |
| Dice packs | `Documents/Kraken VTT/Dice/` | Settings > Dice, every seat |
| Dice tower pictures | `Documents/Kraken VTT/Dice Towers/` | Settings > Dice Tower |
| GM icons | `Documents/Kraken VTT/GM Icons/` | Settings > GM Icon |
| Background decals | `Documents/Kraken VTT/Background Decals/` | Settings > Background Decal |
| Desktop wallpapers | `Documents/Kraken VTT/Wallpapers/` | Settings > Desktop Wallpaper |
| Sounds and music | `%APPDATA%/kraken-vtt/assets/sounds/<music, ambience, sfx, oneshots>/<folder>/` (Linux: `~/.config/kraken-vtt/...`) | the Sound window |
| Map bundles, pictures, Universal VTT maps | opened with **Open map** (kept with the campaign) | the map window |
| A game's rules (a ruleset) | the repository: `shared/<id>/`, `electron/<id>.cjs`, `src/rulesets/<id>.tsx` | the whole app |

Each folder in `Documents/Kraken VTT` has a `README.md` with its exact format
and an agent's checklist (written by Maelstrom from
`skills/kraken-content/folders/`). The `kraken-content` skill
(`skills/kraken-content/SKILL.md`) is the short version of this table.

## 1. Dice, dice towers, GM icons, decals and wallpapers

Read `skills/kraken-content/folders/<Folder>/README.md` first. In short:

- **Dice packs** (`Dice/`): a folder or `.zip` with `dice.json`
  (`"kraken": "dice-pack"`, `"version": 1`, `name`, `sets`) and any face
  pictures. Each set is a look: `theme` or `texture` (with an optional `glow`
  picture), `body`, `ink`, `accent`, `material`, `font`, `pips`, and `effect`,
  the particles that follow the dice as they roll (`sparkles`, `fire`, `frost`,
  `arcane`, `shadow`, `glow`, `aura`, `spark`, `embers`, `wisp`, `holy`,
  `charge`, `notes`, `ion`, or `none`). Check with `kraken_dice_packs`
  `action: "check"`, show with `kraken_dice_settings`, throw with `kraken_roll`.
- **Dice towers** (`Dice Towers/`): a transparent PNG of a tower standing at the
  bottom middle (512 to 1024 px), optionally `<Name> lit.png`, the same tower
  lit. `kraken_tower` `action: "import"` copies one in and puts it up.
- **GM icons** (`GM Icons/`): a square transparent PNG, 256 to 512 px, bold at
  36 px. `kraken_decal` `kind: "gmicon"`.
- **Background decals** (`Background Decals/`): a transparent PNG or WebP about
  1024 px, one centred emblem; a subfolder named for a game groups it with that
  game. `kraken_decal` `kind: "decal"`.
- **Wallpapers** (`Wallpapers/`): game-table art (a hex grid, a battle mat, a
  map, a star chart), seamless, dark and quiet, about 2048 px.
  `kraken_decal` `kind: "wallpaper"`.

Pictures: no text in them unless asked, real transparency (an alpha channel),
named as they should be listed. Look at the result on the table with
`kraken_ui_screenshot`.

## 2. Sounds and music

Any `.mp3`, `.ogg`, `.wav`, `.m4a`, `.flac` or `.webm` sound. Put it in the
library with the Sound window's **Add sounds** (or `window.kraken.addSound`),
or let a module bring it:

- **A book or pack made active** (an FG module, a Maelstrom pack) puts its
  sounds in the library for good: music (a file in a `music` folder, or the
  book's own Music kind) in **Music**, a loop (its name says loop, ambient,
  atmosphere or background) in **Ambience**, the rest in **Effects**, each in a
  folder named for the book. Books active when a campaign opens are read the
  same way. They stay when the book is put away; the same file (its name and
  size) is never added twice (`sounds.keep`, `electron/sounds.cjs`).
- **A Foundry map bundle** puts its playlists' tracks in Music (a folder per
  playlist), its scenes' ambient sounds in Ambience and any other sound in
  Effects.

A book's own sound links ("Sound: Caverns (mood)") play the library's sound of
that kind and name, or the one the GM drops on the link.

## 3. Books: a rulebook, a bestiary, an adventure (packs)

Read **[kpack-format.md](kpack-format.md)** (format 3: the contract) and, for
Fantasy Grounds modules and their history, [kraken-pack-format.md](kraken-pack-format.md).

- **From a Fantasy Grounds module (`.mod`)**: Maelstrom reads it directly
  (Modules) and makes a pack from it (**Modules > Packs > Make pack**). Its
  records, pages, pictures, maps with walls and lights, tokens, sounds and
  tables come along. A store book FG keeps encrypted is read through FG itself:
  `scripts/fg-bridge-export/export_book.py` with the book loaded in a running FG
  campaign and the Kraken Agent Bridge on.
- **From a PDF or your own notes**: `npm run kpack:make` builds a pack from a
  folder of records and pictures; follow "Converting a PDF: an agent's
  checklist" in kpack-format.md. Every page becomes a book page; creatures,
  items, spells and tables become records the game's ruleset reads.
- **Check it**: `npm run kpack:check <pack>` (the format), then make it active
  in a campaign of its game and open it in Books: every chapter reads, every
  link opens, every map opens on its room (a page's map link opens the map at
  that room's pin or encounter), every encounter places its creatures.

A pack's `kind` (`rules`, `adventure`, `setting`, `maps`, `art`, `tools`,
`other`) files it in Modules; a rules book with story entries is still a rules
book.

## 4. Maps: Foundry, Universal VTT, pictures

The GM's **Open map** (or `kraken_open_adventure` with a path) takes:

- **Foundry adventure bundles**: a `.zip` holding `bundle.json` and its assets
  (made by Foundry's Adventure Bundler module, the usual "Prepared Foundry" or
  "Foundry module" download of a map set). Every scene comes in with its picture
  (or video), grid (size, type, offset, padding), walls with Foundry's senses
  (sight, light, sound, move, direction) and doors (open, closed, locked,
  secret), lights (radius, colour, animation, darkness), tokens with their
  pictures, tiles (overhead ones above the tokens), notes and drawings as map
  pins. Its playlists' music goes into the sound library (section 2).
  **Several at once**: choose several bundles in Open map, drop them together,
  or give `kraken_open_adventure` a folder: one adventure of them all (a set's
  floors), each scene a click away, kept with the campaign. A zip of bundles
  works the same way. A wall Foundry keeps with no length is left out.
- **Universal VTT maps** (`.dd2vtt` from Dungeondraft, `.df2vtt`, `.uvtt`): the
  picture with its grid, walls, doors and lights.
- **A bare picture** (`.png`, `.jpg`, `.webp`, `.gif`): one scene, its grid,
  walls and lights then set in the map editor or Map Studio.

Not read from a Foundry bundle yet: its actors, items, journal entries, roll
tables, macros and cards (a map set's bundle usually has none); a Foundry
**module or world folder** (`module.json` with compendium packs) is not opened
directly. Bring its maps as bundles and its text as a pack (section 3).

**Prove a map set**: `npm run foundry-bundle-ui` (with `FOUNDRY_BUNDLES` naming
the folder of a set's zips) opens each bundle and the folder in the app and
compares every scene's walls, doors and lights with what Foundry keeps, checks
the music in the library, and shows a player's view. Then play it: share the
map, put a token in it, open a door, walk through, and look at the player's
view (lights, walls, fog).

## 5. A new game: a ruleset

A ruleset is code in the repository, built from parts the core draws. Read
[core-ui-design.md](core-ui-design.md) (how the core and the manifests fit),
`shared/rulesets/types.d.ts` (every manifest field, with comments) and an
existing ruleset of the same family (Cairn for a simple one, Basic Fantasy for a
d20 one, AD&D 2E for a full one).

A ruleset's files:

| File | What it holds |
|---|---|
| `shared/<id>/manifest.mjs` | The sheet (header, strip, tabs of parts: stat blocks, skills, lists, derived boxes, links, notes), the tracker (row and header buttons, `ownActions` for a player's own creature), the edit whitelist, features, `rollKinds` (its own kinds of sheet roll), `initiativeOrder` and `initiativeDie`, the party sheet, the wizard |
| `shared/<id>/rules.mjs` | `derive` (every number worked out from the scores, classes and gear), building a character from the wizard's spec, `testOf` (each roll's die and target), level up |
| `shared/<id>/actions.mjs` | Targeting, attacks, saves, damage types, effects, light sources |
| `shared/<id>/bookkeeping.mjs` | Rest, ammunition, rations, light, encumbrance |
| `electron/<id>.cjs` | The host: building a character, every roll (its kinds, from the manifest's `rollKinds`), sheet edits, level up |
| `src/rulesets/<id>.tsx` | Only what the core parts cannot show (registered in `src/rulesets/parts.tsx` as `<id>.<Name>`) |

Register it in `shared/rulesets/registry.mjs` (the manifest, its actions and
bookkeeping, and its name in `CAMPAIGN_RULESETS`). Its books are packs (section
3) with `"ruleset"` naming it.

What the core gives every game, declared in the manifest, never coded for one:
a die and a value for every roll (an ability check, a save, a skill, a
proficiency: a `roll` on its row, `actions` on a value box, a `roll` on a
detail box, an `action` on a strip value), record links (a `links` part), the
tracker's header buttons for the viewer's own creature (`tracker.ownActions`),
initiative order and die. Every sheet roll goes to the host as a kind the
manifest declares.

**Match the published game, control by control.** If the game has a Fantasy
Grounds ruleset, list every control on its sheet and combat tracker (each tab,
each clickable or computed value, from the ruleset's `.pak` and the running FG
through the bridge) and build each one (the layout may follow FG; icons and art
are Maelstrom's own). Keep the list in [feature-parity.md](feature-parity.md).

**Prove it**: `scripts/check-<id>.mjs` (the rules on the host: every roll,
derive, the edit whitelist), `scripts/verify-<id>-ui.mjs` (a player makes a
character with the wizard and plays: every roll from the sheet, initiative, an
attack, damage, a save, a spell), `npm run coverage` (every UI action has its
agent tool), and a play test with the game's real books
(`scripts/playtest-2e.mjs` is the model: a session in the app with a player in
Chrome, a screenshot of each step, every failed step listed).

## 6. Taking a core rulebook to Maelstrom

The whole road for a published game the GM owns:

1. **The rules** (section 5): a ruleset for the game, its sheet matching the
   rulebook's character sheet (every value, every roll), its tracker its
   initiative and combat, its wizard its character creation.
2. **The books** (section 3): the rulebook as a pack (`kind: "rules"`), its
   bestiary and supplements as packs, each in `Packs/<game>/`. Creatures,
   items, spells and tables become records the ruleset reads (the wizard reads
   races, classes, kits and spells from the active books; the host reads a
   proficiency's ability from its record).
3. **Its adventures** (sections 3 and 4): as packs, their maps with walls and
   lights, their encounters placed on them, their sounds in the library.
4. **Its look** (section 1): a decal, a wallpaper, dice and a tower for the
   game, if the GM wants them.
5. **Play it** (sections 4 and 5): a session with the real books, as GM and as
   a player, looking for what does not work.
