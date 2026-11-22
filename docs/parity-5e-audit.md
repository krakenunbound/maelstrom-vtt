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
| Health bar colors (BARC) | | Health colour from green to red on the tracker and tokens | Check live (FG offers colour schemes) |
| Turn: Skip dead non-ally (CTSD) | off | `skipDead` table option (enemies, all, off) | Same |
| Turn: Skip hidden actor (CTSH) | off | Not found | Missing |
| Combat (Player): Show turn order (CTSI) | on | Players see the tracker | Check live (FG can hide the order) |
| Combat: Auto NPC initiative (INIT) | group | `initGroup` (each, kind, sides) | Same |
| Combat: NPC numbering (NNPC) | append | `npcNumbering` (append, random, off) | Same |
| Turn (Player): Notification sound (RING) | off | Turn chimes (Sound) | Same |
| Turn: Stop at round start (RNDS) | off | `roundStop` | Same |
| Turn: Show effects on notice (RSHE) | conditions | Turn card | Check live |
| Combat (Player): Enemy health display (SHNPC) | status | `healthNpc` on tokens | Partly (tracker side to check) |
| Combat (Player): Ally health display (SHPC) | detailed | `healthPc` on tokens | Partly (tracker side to check) |
| Combat: Wound categories (WNDC) | off | Health status words | Check live |

### Game

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Desktop: Show PCs (CLSH) | all | Portrait bar | Check live (FG: all, owned, off) |
| Chat: Set GM voice to active CT (CTAV) | off | GM's speaking-as picker | Missing (follow the active creature) |
| Desktop: Background decal position (DECALPOS) | center | Decal always centred | Missing |
| Dice: Limit rolls to chat window (DRMO) | off | Dice roll on the table | Missing |
| Game: Rules Version (GAVE) | 2024 | House rule: exhaustion and a long rest's hit dice follow it (the tracker mixed 2024 exhaustion with 2014 rests before) | Done |
| Party Sheet (Player): Show inventory details (PSIN) | off | Party sheet | Check live |
| Party Sheet (Player): Show character details (PSMN) | off | Party sheet | Check live |
| Chat: Show GM rolls (REVL) | on | Roll mode (public, GM, tower) | Check live |
| Chat: Show all whispers to GM (SHPW) | off | Not found | Missing |
| Chat: Show results to players (SHRR) | on | Results shown | Check live (hiding them) |
| Sound: Enable (SOUND) | on | Sound volume and mute | Same |
| Desktop: Show dice tower (TBOX) | off | Dice tower, GM-only by default, options | Same |

### House rules

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| PC: Currency weight (CURR) | on | Bookkeeping: coin weight in encumbrance | Same |
| PC: Attunement slots (HRAS) | 3 | Not found | Missing |
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
| PC: Inspiration slots (HRIS) | | One Inspiration box | Check live |
| Combat: Massive system shock (HRMD) | off | House rule: DC 15 Constitution, the d10 system shock table | Done |
| Combat: NPC hit points (HRNH) | off | `npcHp` | Same |
| Exhaustion: Apply mod to spell DC (HRSE) | off | House rule: the caster's spell save DC | Done |
| Combat: Auto death rolls (HRST) | on | House rule: the death save rolls itself as a dying character's turn starts | Done |
| Combat: NPC damage rolls (NPCD) | off | House rule: fixed, FG's average per die; a critical's extra dice rolled | Done |

### Per user: notifications

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Speech: Display location (CHATMAP) | image | Speech bubbles on the map | Check live |
| Speech: Play sound on whisper (CWHR) | on | Not found | Missing |
| Desktop: Combat actions (TOAST_COMBAT) | off | Table toasts | Check live |
| Desktop: Interface actions (TOAST_INTERFACE) | off | Table toasts | Check live |
| Desktop: Display location (TOAST_LOCATION) | | Not found | Missing |
| Desktop: Turn change (TOAST_TURN) | off | Turn card | Same |
| Token: Combat actions (TOKEN_COMBAT) | off | Token floats (damage, healing) | Check live (switch) |
| Speech: Map display duration (TOKEN_SPEECH) | off | Speech bubbles | Check live (duration) |

### Per user: settings

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Turn: Token center and/or select (CMAT) | on | Not found | Missing |
| Color: Active character (COLOR) | | Player colour | Same |
| Desktop: Combat list size (DESKTOPCTSIZE) | 6 | Not found | Check live |
| Effect: Short summary display (EFFSHORT) | on | Effects on the tracker | Check live |
| Input: Use Alt key for game actions (KALT) | on | Not found | Check live |
| Dice: Manual entry (MANUALROLL) | off | Not found | Missing (type your physical dice) |
| Combat: Remove on miss (RMMT) | multi | `clearTargets` (never, action, turn) | Partly (on a miss) |
| Desktop: Restore windows on start (WSAV) | on | Windows remembered | Check live |

### Token

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Token: Initiative indicator (INITIND) | off | Not found | Missing |
| Token: Auto-scale to grid (TASG) | 80 | Token size by squares | Check live (the 80%) |
| Token: Facing indicator (TFAC) | off | Facing on tokens | Check live (indicator switch) |
| Token: Fog of war (TFOW) | pc | Line of sight per scene | Check live |
| Token (GM): Show effects (TGME) | on | Effects on tokens | Check live (switch) |
| Token (GM): Show health (TGMH) | dot | Health on tokens | Check live (GM choice) |
| Token: Name display (TNAM) | tooltip | `names` (off, hover, always) | Same |
| Token (Player): Show enemy effects (TNPCE) | on | Effects on tokens | Check live |
| Token (Player): Show enemy health (TNPCH) | dot | `healthNpc` | Same |
| Token (Player): Show ally effects (TPCE) | on | Effects on tokens | Check live |
| Token (Player): Show ally health (TPCH) | dot | `healthPc` | Same |
| Token: Party vision and movement (TPTY) | off | Not found | Missing (shared party vision) |

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
