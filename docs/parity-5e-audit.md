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
| Game: Bastion support (HRBASTION) | off | Settings > House rules: Bastions, off | Same |
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
| Speech: Map display duration (TOKEN_SPEECH) | off | Bubbles last by the length of what is said, or a set 3, 5, 10 or 20 seconds (`speechSeconds`, each person's); on or off with `speechBubbles` | Yes |

### Per user: settings

| FG option | FG default | Maelstrom | Verdict |
|---|---|---|---|
| Turn: Token center and/or select (CMAT) | on | `turnFocus`, each person's own: centre, centre and select, nothing | Done |
| Color: Active character (COLOR) | | Player colour | Same |
| Desktop: Combat list size (DESKTOPCTSIZE) | 6 | Not found | Check live |
| Effect: Short summary display (EFFSHORT) | on | Effects on the tracker | Check live |
| Input: Use Alt key for game actions (KALT) | on | Not found | Check live |
| Dice: Manual entry (MANUALROLL) | off | `manualDice`, each person's own: a dialog for the faces, the host rolls with them, [MANUAL] in chat; the tray's, chat's, sheet's (checks, saves, skills, initiative) and tracker's (attacks, saves, death saves) rolls, the ruleset's die (`manualDie`) | Yes |
| Combat: Remove on miss (RMMT) | multi | `clearTargets` (never, action, turn); Remove on miss: with several targets (FG's default), always, never | Same |
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
| Background, race links and text | Read-only text | Partly (no links) |
| Abilities: score, modifier, check, save, save proficiency | The same, a DC box for every roll | Better |
| Senses (text) | Senses on the Notes tab, the line under the boxes | Done |
| Passive Perception | Passive Perception | Same |
| AC with Combat Details (armor, shield, DEX cap, 2nd ability, misc, proficient, stealth disadvantage) | AC from armor and shield, a Misc box; Dex as the armor says, none, all, max 2 or 3, by hand; a second ability added | Same |
| Initiative: misc, proficiency, roll button | Misc box; Roll, which on the tracker sets the character's place | Done (no proficiency toggle) |
| Speed: base, armor, misc, special move | Base, heavy armor's -10 (Strength under its requirement), misc, special movement; the total | Same |
| Special defenses (text) | Special defenses on the Notes tab | Done |
| HP: wounds, max, temp; numbers dropped on them | Current / max with a bar, Damage and Heal, wounds, temp and max boxes | Better (Damage and Heal) |
| Hit dice per class: die, dice left, roll (spend) one; Hit Dice details (stat, 2nd stat, misc) | Hit dice box, Roll one; Details: the ability added, a second, misc; a multiclass character rolls the class's die chosen | Same |
| Death saves: roll button, 3 success and 3 failure boxes | Three boxes each, ticked by hand; Roll in a fight (and HRST rolls it itself) | Done |

### Skills

| FG control | Maelstrom | Verdict |
|---|---|---|
| Proficiency: none, proficient, double, half | None, proficient, expertise, half (rounded down) | Done |
| Ability per skill (changeable), misc, total, roll | The ability per skill (changeable), misc box, total, roll | Same |
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
| Treasure: coins, add your own currency rows | The game's coins, and rows of one's own (+ Coin: named, counted, taken out) | Same |
| Encumbrance: load, encumbered, heavy, maximum, lift/push/drag | Load meter, the variant, push, drag or lift (Strength x 30 lb., by size) | Same |

### Notes

| FG control | Maelstrom | Verdict |
|---|---|---|
| Gender, age, height, weight, size, alignment, deity | All of them on the Notes tab | Done |
| Personality traits, ideals, bonds, flaws, appearance, notes | All of them | Done |
| Logs: faction, DCI, adventures list | Not found | Missing |
| Bastion (HRBASTION) | The party sheet's Bastion tab: each character's bastion, named and kept by its player | Same (on the party sheet, not a button on the Notes tab) |

### Actions (Maelstrom: Combat and Spells)

| FG control | Maelstrom | Verdict |
|---|---|---|
| Weapons from the inventory, attack and damage rolls, drag to roll | Attack and damage rolls at targets, drag onto a creature, versatile hands | Better (targets) |
| Weapon options: crit range, extra crit dice, two-weapon fighting | Melee and ranged critical range, extra critical dice; a weapon in the off hand (two-weapon fighting: no ability modifier to its damage unless the style) | Same |
| Weapon editor: attack ability, bonus, proficiency; damage rows | Not found | Missing |
| Ammunition counter per weapon | Spent from the inventory | Better (real ammunition) |
| Weapon mastery | Not found | Missing (2024) |
| Spell slots: maximums by hand, used boxes; Pact Magic apart | Used boxes, the maximum by hand (kept beyond the class's), Pact Magic named | Done |
| Powers by group and level, Preparation mode, prepared ticks and count | Spells by level (cantrips first), a prepared box each, the prepared count, Cast | Done (no separate mode: always shown) |
| Class resources: uses and period (daily, encounter, once) | Class resources: name, uses ticked off, most, back on a short or a long rest (rests give them back) | Done (short or long; no once) |
| A power's cast, attack, save, damage, heal and effect rows, upcast | Cast at targets (templates, saves, damage) | Partly (no rows to see, no upcast choice) |

## 3. Combat tracker

FG's 5E tracker (CoreRPG's `ct/` with 5E's sections, read from the ruleset files) against
Maelstrom's (`src/combat/CombatTracker.tsx`, `electron/combat.cjs`).

| FG control | Maelstrom | Verdict |
|---|---|---|
| Next actor, next round, round counter (GM edits) | Next turn, next round, round box, Back and Round back (undo) | Better (undo) |
| Next round's menu: advance 5, 10, 15, 20 | Advance… 5, 10, 15 or 20 rounds (each a round as Next round has it) | Done |
| Menu: roll all / NPC / PC initiative, clear initiative | Buttons | Same |
| Menu: delete non-friendly, foes only; clear all effects | Buttons | Same |
| Menu: clear expiring effects | Clear timed effects (those with rounds left) | Done |
| Menu: short and long rest for everyone | Rest the party (round 0) | Same |
| Faction chips dragged onto a map: tokens in formation | Not found | Missing |
| Show or hide all NPCs (header) | Hide all creatures / Show all creatures (all but friends) | Done |
| Row: active marker, drag it to another row | Turn arrow, dragged | Same |
| Row: token (click outline, Ctrl+click target, drag to map) | Portrait (focus), Ctrl+click target, row dragged to the map | Same |
| Row: identified toggle, the players' name while unidentified | The token's unidentified name, on the players' tracker and their turn notice (it showed the real name before) | Done |
| Row: visibility eye (non-friends) | Eye | Same |
| Row: record link (PC sheet or NPC) | NPC Record; a character's Sheet | Done |
| Row: faction cycler | Faction button | Same |
| Row: HP, temp, wounds as numbers (dropped numbers apply) | Wounds and a character's temp typed, damage and heal, a chat roll dropped applies | Done |
| Row: initiative typed (re-sorts), dragged to swap | Initiative box; its ⇅ dragged onto another row swaps them | Done |
| Offense: "React?" box (reaction used) | React box on the row (the GM's and its owner's), back at the start of its turn | Done |
| Offense: init bonus (rolls), AC, DT, speed | The creature panel's Offense: initiative bonus, speed, senses, skills, CR; AC in Defense | Same |
| Offense: NPC actions, bonus actions, reactions, legendary, lair, innate spells, slots; a clause rolled by double-click, [USED], recharge | Attack and damage buttons, power buttons with uses, the stat block's lists; [USED] on a recharge or a day's-uses action, a recharge's d6 at its turn; clause rolls: an action's attack, damage, healing and save words clicked (an attack or damage through its tracker attack; a save asked of its targets at the DC) | Same |
| Defense: ability scores (check, Shift save), resistances, immunities, vulnerabilities, condition immunities typed | Read in the detail; a save picker with a DC; damage by type against them; a condition it is immune to left out of an effect ([IMMUNE]) | Same |
| Space and reach | The creature panel: space and reach set by the GM (the map's reach ring reads them) | Same |
| Effects: add, active / inactive / skip once, GM-only, apply (once a turn, a round, an action, a roll), uses, label, duration, initiative it ticks on, whose turn, expiry (turn start or end, short or long rest), its targets, applied by | Add: text, how long (rounds, minutes, hours, days), ends (rounds, when hurt, a short or long rest, a long rest), Apply (one roll, one action, a single use), GM only, on its targets; each effect active, inactive or skipped once; the buff bar (remove, rounds, put out) | Same |
| Targets: the target icons, add by drag, all allies / non-allies, clear | Target chips, the target button, Ctrl+click, faction and box targeting | Same |
| Death saves, concentration (no control in FG) | Death save button with the count; concentration checked on damage | Better |
| Delay turn (not in FG) | Delay and Act now | Better |
| Players: end turn, ctrl+click targeting, health by option, effects without the GM's | The same; their own initiative roll (d20) | Same |

## 4. Maps and tokens

FG's image window and tokens (CoreRPG; much of it inside the FGU engine) against Maelstrom's map
(`src/table/MapView.tsx`, `electron/mapState.cjs`). The map settings were compared before (FG's lighting,
token lock, drawing, preview: `check-fg-classic-maps`).

| FG control | Maelstrom | Verdict |
|---|---|---|
| Lock, Image Data panel (grid, layers, walls, lights) | Lock opens the map editor: walls, doors, lights, mask, grid, text, paint, FX, image layers | Better |
| Share: public, or with chosen players | Share with players, or with those ticked (the others are sent no map) | Done |
| Identified map name for players | Not found | Missing (small) |
| Navigation pad, zoom to fit | Navigation pad, Fit, zoom | Same |
| Player vision preview, token movement lock, approvals | The same | Same |
| Shortcut view (map pins), clear death markers | Pins, Clear death markers | Same |
| Target mode, target friends / enemies, clear targets, selection mode | The same, box targeting | Same |
| Drawing and eraser (players when unlocked) | Draw (shapes, colours), Erase, players' drawing switch | Better |
| Mask mode (fog painting) | Mask: rectangle, polygon, square, a freehand brush (its width set); reveal or hide | Yes |
| Ping | Ping, pull the players' view | Better |
| Token view (first person), 3D camera | Not found | n/a (FG's 3D engine) |
| Right-drag pointers: arrow, circle, square, cone, line, seen by all | Draw's pointer switch: an arrow, line, square, circle or cone everyone sees, gone after 6 s; right-drag stays the ruler | Done |
| Distance readout, diagonal rule | Ruler, per-scene rule, height, difficult terrain | Better |
| Drag a token, snap; waypoints while dragging | Drag, snap (Alt: no snap), walk / dash colouring, group moves, keys; Space while dragging drops a waypoint (Backspace takes it off), the token goes through each, each leg stopped by walls | Yes |
| Ctrl+click target, targeting arrows | The same, with range colouring | Better |
| Double-click a token: its sheet | A character's sheet (the GM's and its player's), an NPC's record (the GM's) | Done |
| Alt+wheel height, Ctrl+wheel scale, facing | The same; Shift+wheel facing | Same |
| Hover: name, health, effects, reach underlay | Name, health, effects by option; a reach ring (the GM's for every creature, players' for friends) | Done |
| Faction underlay, token colour, height label, facing, initiative indicator, auto-scale | The same (token display options) | Same |
| Death markers | The same, by creature type | Same |
| Tracker faction chip dropped on the map: the faction in formation | Friends, Neutral, Foes chips on the tracker: the side placed three across, each tied to its row | Done |
| Record or tracker token dropped on the map | Token tray, tracker rows, records | Same |
| Quick Map from an encounter | Map Studio's generator | Better |
| Token right-click (engine): delete, visibility, facing, lock, scale | Token menu: name, light, vision, players' name, senses, sight, undo, elevation, combat, target, effects, hide, size 1 to 4 or any (0.25 to 50 squares), faction, remove | Yes |
| Fog of war by PC tokens; party vision; vision and light from effects | Explored fog, party vision, senses and lights | Same |

## 5. Library and books

FG's Library, Modules window, record lists (`masterindex`), record windows and reference books (CoreRPG and
5E's `data_library_5E.lua`) against Maelstrom's Books window, sidebar lists, record windows and book window
(`src/books/`).

| FG control | Maelstrom | Verdict |
|---|---|---|
| Modules: load, unload, filters (name, author, loaded, shared, ruleset), paging | Activation: Active, Players, search, shelves by kind and series | Same |
| Module sets (save and load a set of modules) | Modules > Activation: Sets: what is active (and shared with the players) saved by name, kept with the GM for any campaign of the game; Apply makes the set active and the rest inactive, says a book not on this computer | Better (named sets in the window, not a file) |
| Module permissions: block, allow, autoload for players | Players box per book (shared or not) | Same (FG's autoload is a share) |
| Library Export: build a module from the campaign | Modules > Export: the campaign's own records (whole kinds ticked, or single records dropped) into a pack in the packs folder (name, title, category, author; this game or any; the players may read it or not); its story, encounters, parcels and tables kept as a book's, characters as pregenerated ones, links between them into the pack; another campaign makes it active; a converted book is never written over; the campaign's images and maps go in with their pictures (Map Studio's painted ones), walls, doors, lights and grid, and open in the other campaign as the same maps | Same (an NPC's or item's own picture still names the book or art it comes from) |
| Sidebar categories, folding, icon modes, drag a list link | The same | Same |
| List: name search, All / Shared, add, edit (delete), paging | Search, All / Shared, + New, right-click Duplicate / Delete with Undo, 400 rows then search | Better (undo) |
| List: groups (custom categories): create, rename, delete, drop a record in | Your groups: + Group, drop a record on a chip, click to show, × to remove; a Group filter and By group | Done (no rename) |
| List: drop a record link or file to copy or import | Copy to campaign; tables pasted | Partly |
| List: row share icon, module icon, revert, version column | Eye per row; book in the subtitle | Partly (no revert per row, no version) |
| 5E NPC filters: CR, type; views by letter, CR, type | CR, type and book filters | Same |
| 5E Item filters: type, rarity, attunement; Armor, Weapons, Gear tables | Type, rarity, attunement and book filters; book armor and weapon tables | Same |
| 5E Spell filters: level, school, source, ritual | Level, ritual, school, class, book | Same |
| Record: link drag, module icon, revert, duplicate, export, lock, share (public, a player by portrait drop), identified, unidentified name and notes | Anchor and name drag, lock, eye (everyone, chosen players, GM only), copy to campaign, duplicate, delete, identified (items), portrait drop for one player | Better (chosen players) |
| Record: Send to chat | A chat button on every record: its link, and (the GM's) its text as the players know it | Same |
| Record: Speak as (an NPC) | The GM's voice picker, the creature whose turn it is, Speak as on an NPC's record | Same |
| Story: simple and advanced pages, blocks, frames, image sizes, copy and paste a page | Block story pages, frames and colours, read-aloud | Same (no copy and paste of a page) |
| Story templates | Not found | Missing |
| Book: contents, search by name and keywords, add and arrange chapters, sections, pages, page lock | The same, page editor, sounds bound to links | Better (sounds) |
| Book: previous and next section, links across books | Back (to the page a link or jump left), previous and next page, links | Better |
| Library-wide or in-book full-text search | Search the text: every page of the book, the words around each find | Better (FG searches names and keywords) |
| Players: only shared records, unidentified names, no GM buttons | The same; spells by their class | Same |

## 6. Chat and dice

FG's chat window, slash commands, dice tray, modifier box, Modifiers window, dice tower and manual dice
(CoreRPG; 5E adds its keys) against Maelstrom's chat dock, `chatCommands.ts`, tray, modifier box and tower.

| FG control | Maelstrom | Verdict |
|---|---|---|
| Entry, Enter sends, Tab completes a name | Entry, Tab completes a command, command suggestions | Better |
| Up and Down recall sent lines | Up and Down: the last 50 lines this seat sent | Same |
| Ctrl+Enter story (GM) or action, Ctrl+Shift+Enter emote, Alt+Enter OOC, the mode icon | The same keys, and /story, /action, /emote, /ooc | Same (no mode icon) |
| Speaker list (GM voices), language list | Speak as, language, roll mode lists | Better (roll mode) |
| "GM is typing" for players | The GM is typing… under the players' chat (not for commands) | Same |
| Speech, emote, act, OOC, story, mood, whisper, languages (understood by) | The same, scripts with translations | Same |
| Rolls with tags, secret and tower rolls, results by option | Roll cards with dice, the same | Same |
| Drop an image, sound or dice skin on chat | Links attached; a picture link shows the picture in the line | Partly (sounds and dice skins by link) |
| Slash: /w, /r, /mod, /rollon, /option, /afk, /id, /gmid, /die, /roll, /emote, /ooc, /story, /mood, /vote, /reload, /save, /clear, /version, /help | All of them (/reply for /r) and more (/check, /save DC, /award, /pause, /kick, /volume...) | Better |
| /exportchar, /importchar, /exportnpc, /importnpc, /export, /flushdb, /console, /cq | Import and export in the windows; no FG queue or console | n/a (windows do it) |
| Tray dice, drag to gather, right-click roll N, custom d2, d3 | The same, custom d2, d3, d16, d30; pick up N | Same |
| Damage dice coloured by damage type; NPC dice by creature type | NPC and damage dice sets; Settings > Dice by type (`typedDice`, on): damage dice in their damage type's colours, a creature's in its creature type's | Yes |
| Dice window: skins, colours, sizes, per-die tray toggles | Sets, colours, sizes, your own design, character dice | Better |
| Modifier box: total, wheel, right-click clear, drag out, drop rolls, 6 slots | The same, quick values, named entries | Same |
| 5E keys: ADV, DIS, +2, -2, +5, -5 | All six; +5 and -5 stack with +2 and -2 | Same |
| Modifiers window: Opportunity, Cover, Sup. Cover, Critical, Max, Half; custom rows | Keys for each; the GM's preset buttons | Same |
| Dice tower: drop a roll; drop text to whisper the GM | Drop dice; external tower; a player's text dropped on the tower whispers the GM | Yes |
| Manual dice: a queue window, OK, Roll, Faux roll (GM), Cancel | A dialog per roll (tray, chat, sheet, tracker), Roll, Cancel | Partly (no queue or faux roll) |
| Portraits: whisper, ring the bell (GM), kick; drop a number or text on a portrait | Whisper, Ring bell, View as, Kick, Ban; a record dropped shares it, words or a number dropped are whispered to them | Better |

## 7. Party sheet

FG's 5E party sheet (`ps_*` in CoreRPG and 5E's `manager_ps2.lua`) against Maelstrom's
(`src/party/PartySheet.tsx`, `electron/party.cjs`).

| FG control | Maelstrom | Verdict |
|---|---|---|
| Members: drop a PC to add, delete; portrait opens the sheet | Drop, Add a character, Party from who's here, ×; drag a row onto the map | Better |
| Row: name, race, class and level, HP and HD bars, scores, modifiers, AC, passive Perception, defenses, senses | The same, special defenses under the senses | Same |
| Modifiers: the GM double-clicks a member's for a check (Shift: save) | Group roll for everyone; the GM double-clicks a member's ability for their check (Shift: save) | Yes |
| Group rolls: ability, save, skill with DCs; results per PC | One group roll (check, save, skill, a DC), a tally, or Ask the players (they roll on a chat card) | Better (tally, asking) |
| Party attack: d20 + bonus at each PC's AC | Attack the party: d20 + bonus at each member's AC, HIT or MISS | Same |
| Hide roll results (secret group rolls) | Not found | Missing |
| Loot: coins and items, drop a parcel or items, assignment, Distribute | The parcel: coins, items, Who gets, Distribute | Same |
| Loot: Identified per item, Identify All | Identified box per item, Identify all; players see the unidentified name until then, and the Loot (read only) | Same |
| Loot: Sell unassigned items at Sell % (50) | Sell at %: unassigned items at the percent of their cost into the parcel's coins; no price, kept and said | Same |
| Carried: everyone's coins and items, Rebuild | Party inventory and coins (always up to date) | Same |
| PSMN (players see Main), PSIN (players see Carried) | Players see the party's details / what the party carries (on by default; off, they are not sent it) | Same |
| Shared stash (not in FG) | Put and Take, by any member | Better |
| Order: watch order, formation 7x7, fill 1 to 3, rotate, clear | Watches 1 to 3, formation, fill, turn, clear | Same |
| Order: the friendly icon dragged onto a map places them in formation | The tracker's Friends chip: by the party's formation, the rest three across behind | Same |
| XP: party list, XP dropped on a PC | Award to the party; each member's XP and Give for them alone | Same |
| XP: encounters and quests with CR, XP, Aw? checkbox, Award, Award one | Encounters and quests, Award all, Award one, × | Same |
| Rests (not on FG's sheet) | Short and long rest for the party | Better |
| Bastion tab (HRBASTION): facilities, orders, turns, log | Bastion tab: each member's facilities (a location dropped in links it), the seven orders dragged onto a facility or chosen on it (the same again: a turn more), turns left; the GM's Next turn, Clear, Log with the turn count and Clear the log | Same |

## 8. GM tools

FG's calendar, random tables, encounters, effects window, sound sets, item forge and importers, Options
and utility windows, and player management against Maelstrom's.

| FG control | Maelstrom | Verdict |
|---|---|---|
| Calendar: modules' calendars, date, era, time by Ctrl+wheel, to chat, set today, journal per day (player and GM notes), all journals | Eight calendars, date and time, +1h / +8h, rests move it, say date, set today, notes per day (players' and GM's) | Better (time moves with rests) |
| Calendar: holidays by name on their days | Festival months, and holidays on days: the calendar's own (the Gregorian's), the GM's added on a day, a day or more long; marked on the calendar, named on the day's page, in today's words and said with the date | Same |
| Tables: add by size, import from text, columns, ranges, links, nested rolls, `[1d6]`, `[2x]`, hide results, /rollon | The same; import from pasted text | Same |
| Tables: output to chat, story, parcel or encounter | Output on the roll bar: chat, a new story, parcel or encounter (the NPCs it names, counted) | Same |
| Encounters: NPCs, counts, faction, ID name, tokens placed, CR, XP, add to tracker, Quick Map | NPCs, counts (dice), faction, players' name, placed spots, CR, XP, add to tracker, end | Same |
| Random encounters: dice counts, Generate a new encounter | Dice counts ($PC the party's size) rolled when added; Generate on any encounter and on a book's random encounters (listed with the encounters): a new encounter of the rolled counts, a 0 left out | Same |
| Effects window: lights, conditions, custom effects, click or drag to apply, GM-only, expiry, units, apply mode | Conditions, buffs, debuffs, lights, your own (with units and Apply); click or drag; who may add | Same |
| Sound sets: triggers by chat pattern, content sounds on a record, Syrinscape | Sound window: library, triggers on hidden rolls, scene sounds, map sounds, playlists, Syrinscape | Better |
| Item templates, Item Forge (base items and magic templates make new items) | Items and Item Templates lists: Item Forge (drop or pick base items and templates, items and spells as templates; the SRD's +1, +2, or +3 with a chosen bonus); the names, rarity, bonus, properties, damage, AC, cost and text combine, a spell makes a Spell Scroll of it, templates alone make a template; the forged item works on the sheet | Better (chosen bonus, costs kept, templates from any item) |
| NPC import from stat block text; race import from text | NPCs list: Import from a stat block (2014 and 2024 layouts; every SRD creature reads back the same); Races list: Import a race (2014 and 2024 layouts, its subraces as their own records, linked; Creature Type, Size, Speed and Ability Score Increase into the race's fields; every SRD race and subrace reads back the same) | Better (subraces of one word, options kept inside their trait, fields filled) |
| Item import from text (FG's Import Item) | Items list: Import items: a table (type, subtype, column names, rows; cells by `|` or tabs) with each item's description, or magic items as the books print them (name, type and rarity line, text), many at once; every SRD magic item, weapon and armor reads back the same | Better (magic items as printed, tabs, AC and Dex cap from the armor table, rarity kept) |
| Story templates: text with `[Table]` rolls generates a story | Story list: From a template: `[Table]`, `[Table\|column]`, `[1d6]`, `[2x]` rolled into a new story | Same |
| Options: groups, per user and GM, export and import a set | Settings: you, the table, combat, tokens, house rules; Export settings and Import settings | Same |
| Currencies (name, weight, value), languages, MOTD, Setup, Token Lights, decal | Currency names, languages, MOTD, lights in Effects, decal, wallpaper, GM icon, themes | Partly (no coin weight or value) |
| Player management: whisper, ring, kick, AFK, release, identities, module player load | The same, view as, ban, accounts, pause | Better |

## How house rules work in Maelstrom

A game declares its house rules in its manifest (`settings` with a `key`: a switch
or a choice, its default; `shared/dnd5e/manifest.mjs` has 5E's ten, FG's keys and
defaults). The GM sees them in Settings > House rules, the agent sets them with
`kraken_table_options rules`, and the game's rules read them with `houseRule(key)`.
Any game can add its own the same way; nothing in the core names a game.
`scripts/check-5e-house-rules.mjs` plays each one.

## Status

All eight areas are compared, read from FG's ruleset files (CoreRPG and 5E) and
Maelstrom's code, and what was missing is built (each area's commits name its
check script). Still missing: the rows marked Partly. The **Check live** rows want FG open on
the 5E campaign through the bridge, side by side with Maelstrom.
