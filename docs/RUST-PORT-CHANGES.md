# What to port to Maelstrom VTT Rust: the web app's changes since the port began

The Rust port (`F:\Maelstrom VTT Rust`, first commit `e73d19e`,
2026-11-23 10:38) began from the web app as it stood on 2026-11-23 morning.
The web app's last commit before then is `bf24b5b6` (2026-11-22 13:25). Every
change after it is listed below, in order, with where its full description
is. As of this list, none of part A is in the Rust port: it has no lobby, no
`game.json` games, no BECMI, no character or creature art library, no animated
tokens and no book links.

This list ends at web app commit `9e234745` (2026-11-24 10:15). To see later
work: `git log --oneline 9e234745..HEAD` in `F:\Kraken VTT Web`.

The full descriptions (files, functions, checks):

- [changes-2026-11-23.md](changes-2026-11-23.md): 2026-11-22 afternoon and
  2026-11-23, sections 1 to 24 (§ below).
- [changes-2026-11-24.md](changes-2026-11-24.md): 2026-11-23 evening and
  2026-11-24, sections 1 to 3 (24§ below).

Each commit shows its whole change: `git show <commit>`. Each check named is a
script in `scripts/` whose cases say what the behaviour must be; port them as
the Rust tests.

## A. To port (after the port began)

### Games defined by their books, and D&D BECMI

| Commit | Change | Detail |
|---|---|---|
| 76b28118 | A rules pack's `game.json` teaches Maelstrom a game: sheet, wizard, tracker and party from the definition, numbers from the books' records. No game code: the core reads it. D&D BECMI is the first. | §1, [pack-games.md](pack-games.md), [games/becmi.game.json](games/becmi.game.json) |
| a7491916 | Dice: a whole roll times a number (`3d6*10`), for starting gold. | §2 |
| 85b9faed | The campaign screen offers only the games whose books are installed. | §3 |
| 0aefe06c | BECMI Set 1: book sample characters in the wizard, Hear Noise on a d6, thrown weapons, Normal Man THAC0, side initiative, two-prime XP bonus. | §15 |
| ed63f6a0 | BECMI Expert: D+ turning to 3d6 hit dice, a later book fills a class's empty fields, empty wizard steps left out. | §17 |
| 224732b1 | BECMI Companion: attack ranks for demi-humans, D# turning with 4d6, a monster's fixed damage, each set's art. | §18 |
| 27e15a2f | BECMI Master: weapon mastery from the sheet, a monster's THAC0 of 0, weapon damage dice. | §19 |
| 46669e59 | BECMI Immortals: scores to 100 typed in the wizard, no empty shop step, printed hit points. | §20 |
| 25c05e56, 952e61a1 | Docs: converting the BECMI sets into packs; The Goblin's Lair review. | [becmi-packs.md](becmi-packs.md) |

### Tokens, maps and books

| Commit | Change | Detail |
|---|---|---|
| 936fe139 | Animated tokens: a `.webm` token plays everywhere (served by byte range); a token's art scale draws a top-down figure over its ring. | §3b |
| e1e20a86 | A PDF adventure's battles put each creature on the nearest free floor square of its room, read from the map picture. | §22 |
| a7a121e6 | Story window links open (map, battle, treasure, pages); a book's treasure parcel shows its items and coins and goes to the party. | §21 |
| d75bb5c0 | A book's record follows its links (a vehicle's deck maps, its printed page), from the book or the campaign's copy. | §23 |

### Character and creature art

| Commit | Change | Detail |
|---|---|---|
| 202ce028, 2c8ff916, 3c9e5b62 | Character art library: 7,267 portrait and token pairs by race, class and gender (`games/characters`, `manifest.json`, `review.json`); a campaign offers the pairs for its game; a new character gets a matching pair. | §16, [character-art.md](character-art.md) |
| c91e02f4, f18a3751, 80bc18ca, 7a2b2dd9 | Creatures get faces: an NPC with no picture takes one of its kind, from its whole record (kind, class, gender); named by class or title alone, a human of that kind. | §21, [character-art.md](character-art.md) §3b |
| 235d0342, 1d9193b6 | The GM's 3.5e Monster Manual art (595 creatures, `games/creatures`) serves every game, found by the name's words. | §24 |
| 4bcf8bfe, adb31732, 584443a0 | Art by the whole name: the GM's own art beats shipped art; brackets choose; a book's kind before its comma; short names; never a template or another kind's sample; a class in the name chooses the face's class. | 24§3 |

### Find a game

| Commit | Change | Detail |
|---|---|---|
| 1e154965, 39142661 | List this game: a hosted internet table checks in to maelstromvtt.com every 3 minutes and comes off when hosting stops; the invite card shows the listing's state; `kraken_host listed`; `maelstrom://join` links fill Join a Game. | 24§1, [find-a-game.md](find-a-game.md) |
| ee017a3e | Join a Game in the app: the player's past games (each on or off, LAN ones asked of the table) and the games hosted now, beside Take your seat. | 24§2 |

The website side (the Worker, its database, the Find a game page) is already
live and needs no port. The Rust app only has to speak the same API, in
[find-a-game.md](find-a-game.md) §2: check in by `POST /api/lobby/checkin`
over IPv4, close by `POST /api/lobby/close`, and read `GET /api/lobby/games`,
`/status` and `/join`. It also has to keep one key per computer and one id
per campaign, so a campaign stays the same game in players' histories.

### The table

| Commit | Change | Detail |
|---|---|---|
| fbdd00ad | Ready check after a break: /readycheck, /rc, the party sheet's button, the player's I'm back banner, `kraken_ready_check`. | 24§2b |

### Docs only (nothing to port)

`53924f1b`, `7d92b3b1`, `9e234745`, and the docs parts of the commits above.

## B. Check whether the port has these (2026-11-22, 12:02 to 13:25)

These were made a few hours before the port began, so the port probably read
them, but check each one. They are written up in
[changes-2026-11-23.md](changes-2026-11-23.md) §5 to §14.

| Commit | Change | Detail |
|---|---|---|
| 7461a6c4 | The map opens in a window beside the tracker and chat, moved by its title bar; read-aloud buttons reach boxed text that loads late. | §5 |
| 2dc19de6 | A token shown or hidden on the map is on the tracker too; art-library pictures show on the tracker. | §6 |
| 3ebd6b54 | A token's transparent art sits on the map with no dark disc. | §7 |
| 579f9252 | 2014 races' cantrip, extra language and weapon training; a player rolls a background's trait tables. | §8 |
| 85c8a280 | A turn's path shows only during the fight. | §9 |
| 5020e301 | Windows keep their place across an app window resize. | §10 |
| 6ae3d1a0 | A new character opens in its own sheet window. | §11 |
| c7fe754f | A pack changed on disk is read again. | §12 |
| 553a9b2b | A new caster's chosen spells start prepared. | §13 |
| bf24b5b6 | Art pickers read folders five deep. | §14 |

## C. Data and art (copy, do not port)

- `games/characters/` (7,267 pairs, `manifest.json`, `review.json`) and
  `games/creatures/` (595 pairs). Both ship beside the app, not inside it.
- [games/becmi.game.json](games/becmi.game.json): BECMI's definition, also
  inside its rules packs.
- The GM's own data, already on this computer, read the same way by both
  apps:
  - `%APPDATA%\kraken-vtt\assets\portraits|tokens\Creatures` holds the
    painted creature art, by name;
  - the 78 packs in `Documents\Kraken VTT\Packs` now hold every creature's
    picture and token.

  Whichever app reads them needs the art pick order of 24§3 and
  [character-art.md](character-art.md) §3b.
