# Settings

Settings (the cog, or `/settings`) holds everyone's own preferences and the GM's table options. Players see only the parts that are theirs. This page goes through each part, and describes the `Documents/Kraken VTT` folder where everything you add to Maelstrom lives.

## For everyone

### Dice

Opens the **Dice** window: your dice sets, colours, design, material, lettering, effects, the crit flare, 3D and sound, and your NPC and damage dice. See [Dice and chat](dice-and-chat.md).

### You at the table

- **Your colour:** rings your tokens and colours your pings and drawings, so everyone knows who is who. **Auto** takes the table's colour for your name, or pick any colour.
- **Chime on your turn:** a soft chime when your turn comes round in combat.
- **Banner on your turn:** your name across the screen when it is your turn.
- **Chime on a whisper:** a soft chime when someone whispers to you.
- **Type in my own dice:** for real dice at the table. A roll from the tray or the chat asks for the faces your dice show, and the roll uses them; chat marks it **[MANUAL]**. Sheet and tracker rolls still roll themselves.

### Ability cards

- **Spells and weapons as cards:** a Cards button in the sidebar with your character's abilities as painted cards.
- **Card effects:** flips, foil and sparks.

## For the GM

### The buttons along the top

| Button | Opens |
|---|---|
| **Background Decal** | The emblem in the middle of the table. |
| **Desktop Wallpaper** | Seamless tiles behind the desktop. |
| **GM Icon** | Your picture beside what you say in chat. |
| **Critical Hits & Fumbles** | The critical hit and fumble tables' window. |
| **Death Markers** | The set each creature type leaves where it dies. |
| **Maelstrom VTT Folder** | Opens `Documents/Kraken VTT`. |
| **Open logs** | Maelstrom's logs, for a bug report. |

### Look, chat languages, currency and modifiers

- **Look**: the table's theme on every screen, changed at once: Maelstrom (brass), Abyss (sea), Ember, Arcane (violet), Iron (steel).
- **Chat languages**: your setting's own languages, beside the game's and those the characters know.
- **Currency**: your world's coins, most valuable first, for the party sheet and treasure parcels. Empty: the game's own.
- **Modifiers**: named numbers beside every player's modifier box, one a line (*Higher ground +1*).

Decals, wallpapers and GM icons each offer Maelstrom's own, a set for each game, **Browse…** to import a picture of your own, or none.

![The hex grid wallpaper, the Maelstrom decal and the dice tower](../screenshots/desktop-hex.jpg)

### Dice and the dice tower

- **Players see their own tower rolls:** off, only you see what goes into the dice tower, as in Fantasy Grounds.
- **Dice tower on the table:** the tower stands apart from the chat, for everyone; each person places it where they like. Off, it sits in the chat.
- **The tower's look:** six drawn looks, painted towers, or a picture of your own.
- **Dice stay on the table:** seconds the landed dice stay before they fade, for everyone.
- **Dice roll in the chat only:** no 3D dice on the table; every roll goes straight to the chat.
- **Players see your rolls:** off, the rolls you make yourself go to you alone.
- **Players see results:** whether players see if your creatures' attacks hit and what their saves were: always, when an ally is in it, only between allies, or never. Players still see the roll, without its result. A hidden creature's results are never shown.
- **See players' whispers to each other:** off by default; on, you see every whisper.
- **Speak as the creature whose turn it is:** in a fight, what you say in chat comes from the creature whose turn it is (not a player's character), and goes back to you after.

### Combat

Clear targets, Initiative, Creatures' hit points, Roll initiative every round, Stop at the start of each round, Skip turns, NPC numbering, Token effects and Apply damage. Each is explained in [Combat tracker](combat-tracker.md#the-trackers-options).


What players see in a fight: the turn order (everyone's initiative, the allies' alone, or none), the health of allies and of enemies on their tracker (hit points, status words, or nothing), and the effects with each turn in the chat (all, conditions, or none; never your own GM-only effects). Also: wound categories (simple, or detailed: Light, Moderate, Heavy, Critical), health colours (a gradient, or one colour a category), and whether hidden creatures get a turn.

### Bookkeeping

Ammunition, Consumables, Rations and water, Light from the pack, Encumbrance and bag space, and Variant encumbrance. See [Bookkeeping and rest](bookkeeping-and-rest.md).

### Tokens and measuring

- **Creatures' health** and **Characters' health:** what players see, as a bar, a dot, either on hover, or off.
- **Token names:** on hover, always, or off.
- **Health you see:** your own view of health on tokens (the tracker always shows you everything).
- **Creatures' effects**, **Characters' effects** and **Effects you see:** an icon for each effect, one mark with how many, either only on hover, or nothing. Off, players are not sent the signs at all; flames, frost and glows stay visible.
- **Token size:** a token's picture fills 80% of its squares, or all of them.
- **Whose turn it is, on the map:** the token whose turn it is wears a glow, a turning ring, or nothing.
- **Facing arrows:** the small arrow on a token that faces a way.
- **Diagonals:** every square counts one, 5-10-5, or a straight line.

What is off is never sent to a player's browser. See [Tokens, vision and lighting](tokens-vision-and-lighting.md).

### The game's own settings

Some games add their own rows here, shown only in that game.

### House rules

A game's optional rules, each a switch or a choice, kept with the campaign. D&D 5E has:

- **Rules version** (2024 or 2014): exhaustion and how many hit dice a long rest gives back follow it.
- **Auto death saves** (on): a dying character rolls its death save as its turn starts.
- **NPC damage**: rolled, or fixed at the average.
- **Ranged attack next to an enemy at disadvantage** (on), unless a feat lets the attacker ignore it.
- **Massive damage**: a blow of half a creature's hit points asks a DC 15 Constitution save; a failure rolls the system shock table.
- **Exhaustion**: its modifier per level, whether it lowers a caster's spell save DC, and levels gained when healed from dying.
- **Healing**: standard, fast or slow rests.
- **Reliable skill rolls**: a d20 under 10 counts as 10, for Insight, Investigation and Perception or every skill.

### Map Studio art

The folders of your Dungeondraft packs and your art packs (`.mod`). See [Map Studio](map-studio.md#the-art-it-uses).

## Your Maelstrom VTT folder

Everything you add to Maelstrom lives in `Documents/Kraken VTT` (Settings > **Your Maelstrom folder** opens it), one folder for each kind of thing. (Maelstrom VTT was called Kraken VTT while it was young; the folder keeps that name for now, so nothing of yours moves.)

| Folder | What goes in it |
|---|---|
| Packs | Your books (`.kpack`) |
| Dice | Dice packs: more dice sets for everyone |
| Dice Towers | Tower pictures (with a `lit` twin if you like) |
| GM Icons | Your picture beside what you say in chat |
| Background Decals | The emblem in the middle of the table; in a folder named for a game (`D&D 3.5e`), they show under its filter |
| Wallpapers | Seamless tiles behind the desktop |

Each folder's README says what goes in it and how to make one. `AGENTS.md` says the same for an AI agent, so you can ask one to make dice, towers or wallpapers for you. Pictures you add with **Browse…** are copied into the right folder. Back up the whole folder to keep what you made.

## Screen size

`/scaleui 125` makes everything on your screen bigger or smaller (50 to 200; 100 is normal). It is kept in that browser. `/scaledice` and `/scaleroll` size the tray's dice and the rolled dice.
