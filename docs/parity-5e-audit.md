# D&D 5E side by side: Fantasy Grounds and Maelstrom

The method (the GM's, 2026-11-21): load the same ruleset in both, do the same
thing in each, setting by setting and control by control. Where they differ,
ask why, and whether Maelstrom is missing it or can do it better. Anything
missing is built to at least FG's behaviour, with the aim of doing better, on
modern technology. Nothing is left out because "the engine can't".

Areas, in order: **1 Options** (below), 2 character sheet, 3 combat tracker,
4 maps and tokens, 5 library and books, 6 chat and dice, 7 party sheet,
8 GM tools.

Verdicts: **Same** (works as FG), **Better** (Maelstrom does more), **Partly**
(some of it), **Missing** (to build), **Check live** (settle side by side with
FG open), **n/a** (FG's own concern, no Maelstrom equivalent needed, with why).

## 1. Options

FG's 5E ruleset (5E on CoreRPG) registers 71 options (`scripts/data_options_5E.lua`,
`data_options_core.lua` and others), listed by script from the ruleset files.

### Combat

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Health bar colors (BARC) | standard | `healthColors`: gradient or tiered (FG's tier colours) | Done |
| Turn: Skip dead non-ally (CTSD) | off | `skipDead` table option (enemies, all, off) | Same |
| Turn: Skip hidden actor (CTSH) | off | `skipHidden`, every game | Done |
| Combat (Player): Show turn order (CTSI) | on | `turnOrder`: everyone, allies only, none (allies first by name) | Done |
| Combat: Auto NPC initiative (INIT) | group | `initGroup` (each, kind, sides) | Same |
| Combat: NPC numbering (NNPC) | append | `npcNumbering` (append, random, off) | Same |
| Turn (Player): Notification sound (RING) | off | Turn chimes (Sound) | Same |
| Turn: Stop at round start (RNDS) | off | `roundStop` | Same |
| Turn: Show effects on notice (RSHE) | conditions | `turnEffects`: the GM's line with every effect, the players' line (an ally's) without the GM's own (a new players-only chat line) | Done |
| Combat (Player): Enemy health display (SHNPC) | status | `ctHealthNpc`: hit points, status, nothing (tokens keep their own option) | Done |
| Combat (Player): Ally health display (SHPC) | detailed | `ctHealthPc`: hit points, status, nothing | Done |
| Combat: Wound categories (WNDC) | off | `woundCategories`: simple (Wounded, Heavy) or detailed (Light, Moderate, Heavy, Critical) | Done |

### Game

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Desktop: Show PCs (CLSH) | all | `partyShown`: all, or players at the table | Done |
| Chat: Set GM voice to active CT (CTAV) | off | `gmVoiceActive`: the GM speaks as the creature whose turn it is (not a character), then back | Done |
| Desktop: Background decal position (DECALPOS) | center | `decalFit`: in the middle, covering the table, as large as fits | Done |
| Dice: Limit rolls to chat window (DRMO) | off | `diceInChat`: no 3D dice, rolls straight to chat | Done |
| Game: Rules Version (GAVE) | 2024 | House rule: exhaustion and a long rest's hit dice follow it (the tracker mixed 2024 exhaustion with 2014 rests before) | Done |
| Party Sheet (Player): Show inventory details (PSIN) | off | Party sheet | Check live |
| Party Sheet (Player): Show character details (PSMN) | off | Party sheet | Check live |
| Chat: Show GM rolls (REVL) | on | `revealGmRolls`: off, the GM's own rolls go to the GM alone (the roll mode and tower stay as they were) | Done |
| Chat: Show all whispers to GM (SHPW) | off | `gmSeesWhispers`; before, the GM always saw every whisper | Done |
| Chat: Show results to players (SHRR) | on | `resultsToPlayers`: on, with an ally, between allies, off. Hidden, the GM gets the full line and players the roll without HIT/MISS; a hidden creature's results never shown | Done |
| Sound: Enable (SOUND) | on | Sound volume and mute | Same |
| Desktop: Show dice tower (TBOX) | off | Dice tower, GM-only by default, options | Same |

### House rules

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| PC: Currency weight (CURR) | on | Bookkeeping: coin weight in encumbrance | Same |
| PC: Attunement slots (HRAS) | 3 | House rule: 3, 4, 5, 2 or the proficiency bonus | Done |
| Game: Bastion support (HRBASTION) | off | Not found | Missing (2024 Bastions) |
| Map: Diagonal distance (HRDD) | | `diagonal` (1, 1.5, raw) | Same |
| PC: Encumbrance (HREN) | standard | Bookkeeping: encumbrance on or off, the variant | Same |
| Exhaustion: Roll modifier per level (HREX) | | House rule: -1, -2, -3 a level on every d20 test | Done |
| Combat: Attack fumble/crit tables (HRFC) | | Krits for C&C and 2E | Missing for 5E |
| Combat: Ranged attack DIS in melee (HRFFM) | on | House rule, with FG's feat exceptions; part of a new attack resolver (ADVATK, DISATK, GRANTADVATK, GRANTDISATK, the 5E conditions, Prone by range), which 5E attacks lacked | Done |
| Game: Skill auto-reliable rolls (HRFL) | | House rule: Insight, Investigation, Perception, or all skills | Done |
| Exhaustion: Apply when heal from dying (HRHE) | off | House rule: 1 to 5 levels | Done |
| PC: Healing variants (HRHV) | | House rule: fast and slow rests | Done |
| Combat: Roll initiative each round (HRIR) | off | `initEachRound` | Same |
| PC: Inspiration slots (HRIS) | | House rule: standard (1), 2, 3, 5 | Done |
| Combat: Massive system shock (HRMD) | off | House rule: DC 15 Constitution, the d10 system shock table | Done |
| Combat: NPC hit points (HRNH) | off | `npcHp` | Same |
| Exhaustion: Apply mod to spell DC (HRSE) | off | House rule: the caster's spell save DC | Done |
| Combat: Auto death rolls (HRST) | on | House rule: the death save rolls itself as a dying character's turn starts | Done |
| Combat: NPC damage rolls (NPCD) | off | House rule: fixed, FG's average per die; a critical's extra dice rolled | Done |

### Per user: notifications

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Speech: Display location (CHATMAP) | image | `speechBubbles`, each person's own: bubbles over the token, or the chat only | Done |
| Speech: Play sound on whisper (CWHR) | on | `whisperSound`, each person's own | Done |
| Desktop: Combat actions (TOAST_COMBAT) | off | Table toasts | Check live |
| Desktop: Interface actions (TOAST_INTERFACE) | off | Table toasts | Check live |
| Desktop: Display location (TOAST_LOCATION) | | Not found | Missing |
| Desktop: Turn change (TOAST_TURN) | off | Turn card | Same |
| Token: Combat actions (TOKEN_COMBAT) | off | `tokenFloats`, each person's own (on by default) | Done |
| Speech: Map display duration (TOKEN_SPEECH) | off | Bubbles last by the length of what is said; on or off with `speechBubbles` | Partly (no set duration) |

### Per user: settings

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Turn: Token center and/or select (CMAT) | on | `turnFocus`, each person's own: centre, centre and select, nothing | Done |
| Color: Active character (COLOR) | | Player colour | Same |
| Desktop: Combat list size (DESKTOPCTSIZE) | 6 | Not found | Check live |
| Effect: Short summary display (EFFSHORT) | on | Effects on the tracker | Check live |
| Input: Use Alt key for game actions (KALT) | on | Not found | Check live |
| Dice: Manual entry (MANUALROLL) | off | `manualDice`, each person's own: a dialog for the faces, the host rolls with them, [MANUAL] in chat | Partly (tray and chat rolls; sheet and tracker rolls to follow) |
| Combat: Remove on miss (RMMT) | multi | `clearTargets` (never, action, turn) | Partly (on a miss) |
| Desktop: Restore windows on start (WSAV) | on | Windows remembered | Check live |

### Token

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Token: Initiative indicator (INITIND) | off | `initIndicator`: a glow (default), a turning ring, nothing | Done |
| Token: Auto-scale to grid (TASG) | 80 | `tokenFill`: 80% (default) or whole squares | Done |
| Token: Facing indicator (TFAC) | off | `facingIndicator` (on by default: Maelstrom's tokens face a way) | Done |
| Token: Fog of war (TFOW) | pc | Line of sight per scene | Check live |
| Token (GM): Show effects (TGME) | on | `effectsGm`: icons, on hover, one mark, a mark on hover, off | Done |
| Token (GM): Show health (TGMH) | dot | `healthGm`; before, the GM saw the players' choice | Done |
| Token: Name display (TNAM) | tooltip | `names` (off, hover, always) | Same |
| Token (Player): Show enemy effects (TNPCE) | on | `effectsNpc`: as TGME; off sends players no signs | Done |
| Token (Player): Show enemy health (TNPCH) | dot | `healthNpc` | Same |
| Token (Player): Show ally effects (TPCE) | on | `effectsPc` | Done |
| Token (Player): Show ally health (TPCH) | dot | `healthPc` | Same |
| Token: Party vision and movement (TPTY) | off | `partyVision`: players see through every player's token and may move them; the GM's creatures stay the GM's | Done |

## 2. Character sheet

FG's 5E sheet (`campaign/record_char*.xml`, read from the ruleset files) against Maelstrom's
(`shared/dnd5e/manifest.mjs` sheet, `src/rulesets/dnd5e.tsx`). FG's tabs: Main, Skills,
Abilities, Inventory, Notes, Actions; Maelstrom's: Main, Skills, Combat, Spells, Inventory, Notes.

### Main and header

| FG control | Maelstrom | Verdict |
|---|---|---|
| Portrait, name | Portrait (picker, drag as a link), token picture, name | Better |
| Inspiration counter, maximum by HRIS (1 to 5), a chat line on change | A count held to the house rule HRIS (standard 1, 2, 3, 5), a chat line | Done |
| Class & level summary; Classes window (each class: level, caster multiplier, pact magic, hit die, used) | "Fighter 4 / Wizard 1"; Classes on the Main tab: each class's level, hit die and dice left, a level more in it, another class taken | Done (caster share by the SRD's rule, not by hand) |
| Level up opens the wizard | Level up (+): rolls the hit die, posts it | Partly (no choices on level up) |
| XP, next level | Experience / next | Same |
| PROF | Prof | Same |
| Background, species links and text | Read-only text | Partly (no links) |
| Abilities: score, modifier, check, save, save proficiency | The same, a DC box for every roll | Better |
| Senses (text) | Senses on the Notes tab, the line under the boxes | Done |
| Passive Perception | Passive Perception | Same |
| AC with Combat Details (armor, shield, DEX cap, 2nd ability, misc, proficient, stealth disadvantage) | AC from armor and shield, a Misc box | Partly (no DEX cap or 2nd ability by hand) |
| Initiative: misc, proficiency, roll button | Misc box; Roll, which on the tracker sets the character's place | Done (no proficiency toggle) |
| Speed: base, armor, misc, special move | Speed typed in the box | Partly (one text) |
| Special defenses (text) | Special defenses on the Notes tab | Done |
| HP: wounds, max, temp; numbers dropped on them | Current / max with a bar, Damage and Heal, wounds, temp and max boxes | Better (Damage and Heal) |
| Hit dice per class: die, dice left, roll (spend) one; Hit Dice details (stat, 2nd stat, misc) | Hit dice box, Roll one; each class's dice left (the largest die spent first) | Partly (no stat choice; a short rest rolls the largest die) |
| Death saves: roll button, 3 success and 3 failure boxes | Three boxes each, ticked by hand; Roll in a fight (and HRST rolls it itself) | Done |

### Skills

| FG control | Maelstrom | Verdict |
|---|---|---|
| Proficiency: none, proficient, double, half | None, proficient, expertise, half (rounded down) | Done |
| Ability per skill (changeable), misc, total, roll | Misc box, total, roll | Partly (the ability stays the skill's own) |
| Add or delete skills (custom skills) | The 18 | Missing |

### Abilities (Maelstrom: Notes)

| FG control | Maelstrom | Verdict |
|---|---|---|
| Feats, features, traits, proficiencies, languages: add, delete, open | Each a box, one a line (the wizard fills them); a feat or spell dropped on the sheet | Partly (no link to open each) |

### Inventory

| FG control | Maelstrom | Verdict |
|---|---|---|
| Items: count, name, unidentified name, location (container), carried, link | Count, carried, containers (drag, Put in), thumbnails, party stash | Better (containers, stash) |
| Weight per item | An item's weight beside its type, the load meter | Done |
| Attuned per item, attunement count (HRAS base, class, misc), red over the limit | The Attuned box on items that require attunement; Attuned used / allowed (HRAS, class, misc), red over | Done |
| Treasure: coins, add your own currency rows | The game's coins | Partly (no custom rows) |
| Encumbrance: load, encumbered, heavy, maximum, lift/push/drag | Load meter, the variant | Partly (no lift/push/drag figure) |

### Notes

| FG control | Maelstrom | Verdict |
|---|---|---|
| Gender, age, height, weight, size, alignment, deity | All of them on the Notes tab | Done |
| Personality traits, ideals, bonds, flaws, appearance, notes | All of them | Done |
| Logs: faction, DCI, adventures list | Not found | Missing |
| Bastion (HRBASTION) | Not found | Missing |

### Actions (Maelstrom: Combat and Spells)

| FG control | Maelstrom | Verdict |
|---|---|---|
| Weapons from the inventory, attack and damage rolls, drag to roll | Attack and damage rolls at targets, drag onto a creature, versatile hands | Better (targets) |
| Weapon options: crit range, extra crit dice, two-weapon fighting | Melee and ranged critical range, extra critical dice (Combat tab) | Partly (no two-weapon fighting) |
| Weapon editor: attack ability, bonus, proficiency; damage rows | Not found | Missing |
| Ammunition counter per weapon | Spent from the inventory | Better (real ammunition) |
| Weapon mastery | Not found | Missing (2024) |
| Spell slots: maximums by hand, used boxes; Pact Magic apart | Used boxes, the maximum by hand (kept beyond the class's), Pact Magic named | Done |
| Powers by group and level, Preparation mode, prepared ticks and count | Spells by level (cantrips first), a prepared box each, the prepared count, Cast | Done (no separate mode: always shown) |
| Class resources: uses and period (daily, encounter, once) | Class resources: name, uses ticked off, most, back on a short or a long rest (rests give them back) | Done (short or long; no once) |
| A power's cast, attack, save, damage, heal and effect rows, upcast | Cast at targets (templates, saves, damage) | Partly (no rows to see, no upcast choice) |

## How house rules work in Maelstrom

A game declares its house rules in its manifest (`settings` with a `key`: a switch
or a choice, its default; `shared/dnd5e/manifest.mjs` has 5E's ten, FG's keys and
defaults). The GM sees them in Settings > House rules, the agent sets them with
`kraken_table_options rules`, and the game's rules read them with `houseRule(key)`.
Any game can add its own the same way; nothing in the core names a game.
`scripts/check-5e-house-rules.mjs` plays each one.

## Status

Options: listed from FG's ruleset files; Maelstrom's side from its table options,
Settings and code. The **Check live** rows and every area after Options need FG
open on the 5E campaign through the bridge, side by side with Maelstrom.
