---
name: pdf-to-kpack
description: Convert a tabletop RPG PDF (rulebook, adventure, setting, supplement) into a Maelstrom VTT .kpack, page by page, until the conversion gate prints DONE. Also use it to check a .kpack someone else made from a PDF. The complete, only procedure for PDF to .kpack in Maelstrom.
---

# PDF to .kpack: the conversion skill

This file is the whole procedure for turning a PDF book into a Maelstrom pack
(`.kpack`). It is the only one: if any other note, skill or document says
something different about converting a PDF, this file wins.

Everything here is relative to the Maelstrom repository root, the folder two
levels above this file (`skills/pdf-to-kpack/SKILL.md`). Run every command from
the repository root. The skill's tools are in `skills/pdf-to-kpack/scripts/`.

Contents: 1 The one rule · 2 Stop and ask · 3 Set up the tools · 4 The work
folder and its files · 5 The pack's files · 6 Phase A, set up the book ·
7 Phase B, the page loop · 8 Phase C, build · 9 Phase D, play it · 10 Phase E,
the gate and the hand-over · 11 Mistakes conversions have made · 12 The tools ·
13 Problems and what works · 14 Licensing

## 1. The one rule

**You are done when the gate prints `DONE`, and not before:**

```bash
npm run kpack:verify -- "<pack>.kpack" --pdf "<book>.pdf" --work "<work folder>"
```

Its report is the hand-over: paste it as it printed. A pack that opens in
Maelstrom, or that passes `npm run kpack:check`, is not done; those check the
format, not the book.

A real conversion takes hours: every page read against its picture, every
creature, item, spell, table and map made into a record. A 300-page book
finished in minutes has skipped the work. Do not decide the job is "too big"
and make something smaller (page pictures, a text dump, a "reference" pack):
do it page by page, across as many sessions as it takes. The work folder's
files carry the state from one session to the next.

The gate catches shortcuts, not lies. It trusts that a ledger row marked
`checked` was compared with its page, and that `playtest.md` says what really
happened. The user spot-checks both.

## 2. Stop and ask the user (never decide these yourself)

Stop, say what you found, and wait for the answer when:

1. **The book's game is not one Maelstrom plays.** List the games with
   `npm run kpack:verify -- --games`. Do not file the book under `Any`, as
   "reference", or for Worldbuilding campaigns; do not invent a ruleset name;
   do not give the pack a `game.json` of your own. Ask the user whether to
   (a) add the game to Maelstrom first (its rules, sheet and wizard), or (b)
   file the book under a game they name. Adding a game is not part of this
   skill: it is development work in the repository, planned with the user
   (a game taught by its rules book's `game.json` is described in
   `docs/pack-games.md`). Convert the book after the game exists; then its
   packs and code give you the record shapes. When the user says `Any`, or to add the game,
   record it in `inventory.json`: `"approvedByUser": { "ruleset": "Any" }` or
   `"approvedByUser": { "gameJson": "<game>" }`. The gate fails without it.
2. **Pages are missing or unreadable** (blank in two renderers, cut off, an
   insert or map the book lists that the PDF lacks), after trying the repairs
   in section 13. Say which pages, and what is lost.
3. **The book is not the user's to convert.** A PDF the user gave you and asked
   you to convert is theirs; ask only when something says otherwise.

Everything else you decide yourself, and keep going: do not stop to report
progress, and do not ask "shall I continue?".

## 3. Set up the tools

- Node (the repository's `npm install` done), Python 3 with PyMuPDF and Pillow
  (`pip install pymupdf pillow`), and optionally Tesseract for
  `compare_region_ocr.py`.
- Maelstrom's packs folder is `Documents/Kraken VTT/Packs/<game>/`
  (`KRAKEN_PACKS` moves it). Installed packs of the book's game are where you
  copy record shapes from (`sample_record.mjs`, section 12).

## 4. The work folder and its files

One folder per book, **outside the repository** (books are licensed; never
commit them or anything made from them). Unless the user names a place, make
them beside the PDF: `<book> work` and `<book> proofing` in the PDF's own
folder. The pack is built from the work folder, so keep proofing material out
of it:

```text
<book> work/
  ledger.csv          one row per PDF page: the state of the page loop
  inventory.json      every thing in the book that becomes a record, by name
  kraken-pack.json    the manifest (section 5.1)
  book-index.json     chapters > sections > pages, for build_book_records.py
  pages/*.html        the book's text, rebuilt (section 5.4)
  tables/*.json       rollable tables, checked against pages/ (section 5.5)
  extra-records.json  the game records: npc, item, spell, tables, image... (section 5.3)
  images/             cover, art crops, maps, as WebP
  playtest.md         what phase D tried in Maelstrom and what it showed
  notes.md            this book's own findings (scan repairs, printed errors, choices made)
<book> proofing/      page renders, OCR drafts, repaired scans: never inside the work folder
```

`kpack:make` packs every picture it finds anywhere in the work folder, which is
why proofing renders live beside it, not in it.

### 4.1 ledger.csv

A header row, then one row for every PDF page, in order:

```csv
pdf_page,printed_folio,section,pack_record,content,checked,notes
1,,Cover,reference.refmanualdata.cover,facsimile:cover,yes,
2,1,Introduction,reference.refmanualdata.introduction,reflowed,yes,
3,2,Introduction,reference.refmanualdata.introduction,reflowed,,
```

| column | what goes in it |
|---|---|
| `pdf_page` | 1, 2, 3... every PDF page exactly once, in order (the page's position in the PDF, not its printed number) |
| `printed_folio` | the number printed on the page, if any |
| `section` | the book section it belongs to |
| `pack_record` | the record path(s) holding it: `reference.refmanualdata.<key>`, where `<key>` is the page's `key` in `book-index.json`. Several joined with `;`. A record may stand for at most 6 PDF pages: a longer section is split at its sub-headings into several book pages |
| `content` | `reflowed` (its text rebuilt), `blank`, or `facsimile:<reason>` (kept as a picture), reason one of `cover`, `art`, `map`, `form`, `handout`, `advertisement`, `credits`, `index` |
| `checked` | `yes` only after you compared the built page with the PDF page (phase B step 5); empty until then |
| `notes` | printed errors kept, repairs made, anything unresolved |

A page of rules or story text is never a facsimile. A page that is mostly a
picture (a map, the character sheet, a handout) is, and the text on it that
matters in play is transcribed where it is used (a handout's words in its
encounter, a sheet's fields in the wizard notes).

### 4.2 inventory.json

Written in phase A, **before any record is made**, from reading the whole book:

```json
{
  "things": [
    { "type": "npc", "name": "Goblin", "page": 31 },
    { "type": "item", "name": "Revolver, .38", "page": 251 },
    { "type": "spell", "name": "Magic Missile", "page": 40 },
    { "type": "tables", "name": "Wandering Monsters, Level 1", "page": 9 },
    { "type": "image", "name": "Caves of Chaos", "page": 2 },
    { "type": "encounter", "name": "1. Main Gate", "page": 12 },
    { "type": "battle", "name": "Main Gate Guards", "page": 12 },
    { "type": "treasureparcels", "name": "Guard Room Coins", "page": 12 }
  ]
}
```

`type` is the record type it becomes (section 5.2), `name` the record's exact
name, `page` its PDF page. The gate checks each is in the pack, and that every
`npc`, `item` and `spell` carries its game data, not only a name. List all of
them: a rules book's every monster, weapon, armour, piece of gear with a price,
spell, class, race, skill and other character option, every random table and
map; an adventure's every keyed area, fight, hoard, creature variant, map and
handout.

### 4.3 playtest.md and notes.md

`playtest.md`: one line per thing tried in phase D and what it showed. The gate
needs at least ten lines that are not empty. `notes.md`: free notes for whoever works
on the book next.

## 5. The pack's files

### 5.1 kraken-pack.json

```json
{
  "format": "kraken-pack",
  "version": 3,
  "name": "B2 The Keep on the Borderlands",
  "title": "B2 The Keep on the Borderlands",
  "ruleset": "D&D BECMI",
  "kind": "adventure",
  "group": "B series",
  "order": "B002",
  "cover": "images/cover.webp",
  "author": "Gary Gygax",
  "from": { "kind": "pdf", "name": "B2 The Keep on the Borderlands.pdf" }
}
```

| field | meaning |
|---|---|
| `format`, `version` | always `"kraken-pack"` and `3` |
| `name` | the book's name. Other packs link to its records by it (`npc.goblin@<name>`): never change it once made |
| `title` | what the lists show |
| `ruleset` | the game, exactly as `npm run kpack:verify -- --games` prints it (section 2 if it is not there) |
| `kind` | `rules` (core rules, supplements, handbooks, monster and spell books), `adventure`, `setting`, `maps`, `art`, `tools` (tables, calendars, pregens), `other` |
| `group` | the line or series: `Core Rules`, `Handbooks`, `B series` |
| `order` | sorting inside the group (`B2` before `B10`) |
| `parent` | the `name` of the pack this is a part of, if any |
| `cover` | the front cover picture in the zip |
| `calendar` | the world's calendar, if it brings one: `gregorian`, `greyhawk`, `harptos`, `mystara`, `golarion`, `imperial`, `waning`, `astra` |
| `from` | `{ "kind": "pdf", "name": "<the PDF's file name>" }` |

`kpack:make` fills in the rest (`records`, `contents`, `hasBook`, `hasStory`,
`pictures`, `thumbnail`, `made`).

### 5.2 Records

`records.json` is an array of records (`build_book_records.py` writes it from
`book-index.json`, `pages/` and `extra-records.json`):

```json
{
  "id": "b2-the-keep-on-the-borderlands:npc.goblin",
  "type": "npc",
  "name": "Goblin",
  "visibility": "gm",
  "source": "B2 The Keep on the Borderlands",
  "data": { "name": "Goblin", "fgPath": "npc.goblin@B2 The Keep on the Borderlands", "...": "the game's fields" }
}
```

- `id`: `<slug of the pack's name>:<path>`; the slug is lower-case letters,
  digits and hyphens. The path is the record's own (`npc.goblin`,
  `reference.refmanualdata.introduction`), unique in the pack.
- `type`: one of the types below.
- `visibility`: `gm` (default; an adventure's records always), `all` (players
  may see it: a rules book's player chapters, a handout), `owner`.
- `source`: the pack's `name`.
- `data`: the record's fields, always with `name` and
  `fgPath` (`<path>@<pack name>`). Lists inside `data` are objects keyed
  `id-00001`, `id-00002`...; a link is
  `{ "class": "<class>", "recordname": "<path>@<pack name>" }`.

| what | `type` | shown in |
|---|---|---|
| book pages and their contents | `refpage`, one `refindex` | Books |
| creature or NPC | `npc` | NPCs |
| weapon, armour, gear, magic item | `item` | Items |
| spell | `spell` | Spells |
| class, race, skill, feat, other option | `class`, `race`, `skill`, `feat`, `specialability` | character options |
| random table | `tables` | Tables |
| picture or map | `image` | Images |
| adventure keyed area or scene | `encounter` | Story |
| prepared fight | `battle` | Encounters |
| treasure | `treasureparcels` | Parcels |
| pregenerated character | `pregencharsheet` | Characters |
| ship, wagon, airship | `vehicle` | Vehicles |
| quest, location | `quest`, `location` | Quests, Locations |

**The game's own fields** (an npc's AC, hit dice, attacks and saves; an item's
cost, damage and weight; a spell's level, range and duration) follow that
game's existing packs exactly, because Maelstrom's sheets, shop, tracker and
dice read them. Print real ones and copy their shape:

```bash
node skills/pdf-to-kpack/scripts/sample_record.mjs "<game>"            # which types its packs hold
node skills/pdf-to-kpack/scripts/sample_record.mjs "<game>" npc 3      # three real npc records
```

Never guess a field name. If the game's packs have no record of the type you
need, read the game's code (`shared/<game>/`) or its `game.json` for the
fields it reads, and say in the hand-over what you based the shape on.

Shapes every game shares:

- **refpage** (a book page): `{ "name": "...", "blocks": { "id-00001": { "blocktype": "singletext", "order": 1, "text": "<p>...</p>", "frame": "blue" }, "id-00002": { "blocktype": "image", "order": 2, "align": "center", "scale": 100, "image": { "layers": { "layer": { "bitmap": "images/x.webp" } } } } } }`. `build_book_records.py` makes these from `pages/*.html`.
- **refindex** (the contents, one per pack): chapters > subchapters > refpages, each entry with `name`, `order` and `listlink` `{ "class": "reference_manualtextwide", "recordname": "reference.refmanualdata.<key>@<pack name>" }`. `build_book_records.py` makes it from `book-index.json`.
- **tables**: `{ "name": "...", "dice": "d20", "resultscols": 1, "labelcol1": "...", "tablerows": { "id-00001": { "fromrange": 1, "torange": 1, "results": { "id-00001": { "result": "..." } } } } }`. A result linking a record uses `resultlink` `{ "class", "recordname" }`.
- **image** (a picture or a map): `{ "image": { "grid": "on", "gridsize": "70,70", "gridoffset": "0,0", "layers": { "layer": [ { "name": "...", "type": "image", "bitmap": "images/maps/keep.webp" } ] } } }`. Battle and building maps have their grid (`gridsize` the square's size in pixels, both numbers equal; `gridoffset` from the picture's top left); region maps may have `"grid": "off"`. Keyed maps `visibility: "gm"`, player maps `all`.
- **encounter** (an adventure's keyed area): `{ "name": "12. Guard Room", "text": "<p>...</p>" }`, its text linking the area's creatures, battle, treasure and map in a `<linklist>`.
- **battle**: `{ "name": "...", "npclist": { "id-00001": { "count": 4, "name": "Goblin", "faction": "foe", "link": { "class": "npc", "recordname": "npc.goblin@<pack>" }, "maplink": { "id-00001": { "imageref": { "class": "imagewindow", "recordname": "image.caves@<pack>" }, "imagex": -120, "imagey": 85 } } } } }` (one `maplink` entry per creature placed). Factions `friend`, `neutral`, `foe`; at most 20 in one row; `imagex`/`imagey` in pixels from the map picture's centre, y down.
- **treasureparcels**: `{ "name": "...", "coinlist": { "id-00001": { "amount": 32, "description": "SP" } }, "itemlist": { "id-00001": { "name": "Silver chain and five gems", "count": 1, "cost": "400 gp" } } }`; copy a real one with `sample_record.mjs` for items that link an `item` record.
- **npc** and **item** also carry `"picture": "images/portraits/goblin.webp"` (square, 1024) and, for a living creature, `"token": "tokens/goblin.webp"` (round, 512, transparent outside the ring), files in the zip. Many records may share one file.

An adventure links the rules book's standard records (`npc.goblin@Set 1: Basic Rules`)
instead of copying them, and carries only what it adds.

### 5.3 extra-records.json

An array of every record that is not a book page (npc, item, spell, tables,
image, encounter, battle, treasureparcels...), in the shape above.
`build_book_records.py` adds them to the pages in `records.json`.
`build_monster_records.py` can make npc records and the Book's stat tables
from the same checked cells (section 12).

### 5.4 book-index.json and pages/*.html

```json
{"chapters":[{"name":"Part One: The Keep","sections":[{"name":"Areas of the Keep","pages":[
  {"key":"keep-gate","file":"pages/keep-gate.html","name":"1. Main Gate","visibility":"gm"}
]}]}]}
```

Each page's `key` becomes its record path `reference.refmanualdata.<key>` (the
`pack_record` in the ledger). One page per section of the book, in reading
order; a section longer than 6 PDF pages becomes several pages, split at its
sub-headings.

A page file is the book's text in Maelstrom's markup:

- `<p>` paragraphs: the book's paragraphs, never the PDF's line breaks;
- `<h>` headings (not `<h2>`, which is dropped);
- `<b>`, `<i>`, `<u>`, `<sup>`, `<sub>`; `<br/>` only for a printed line break
  (always closed: `<br/>`);
- `<list><li>...</li></list>` (bullets; `<ol>` is dropped, so keep printed
  numbers in the text);
- `<table><tr><th>...</th></tr><tr><td colspan="2">...</td></tr></table>` for
  every printed table;
- links: `<link class="<class>" recordname="<path>@<pack name>">...</link>`;
  a picture or map link uses class `imagewindow` with its `image.` record;
- art, on its own line where it sits in the reading flow:
  `<!-- image: images/<file>.webp -->` (an inline `<img>` disappears);
- boxed text (read-aloud, sidebars), each marker on its own line:
  `<!-- frame: blue -->` ... `<!-- end frame -->`. Frames: `blue`, `green`,
  `brown`, `grey`, `pink`, `yellow`, `sidebar`, `book`, `page`, `picture`,
  `noframe`, `text1`-`text5`. Read-aloud text goes in `blue` (or `grey`).

Book text is the book's words. Notes about the conversion or what the app
cannot do go in `notes.md` and the hand-over, never in a page.

### 5.5 tables/*.json

For each page with rollable tables, `tables/<page key>.json`: an array of
`{ "key", "title", "label", "dice", "rows": [[from, to, "result"], ...] }`.
`check_roll_tables.py "<work folder>"` checks their ranges cover the dice and
agree with the tables in `pages/`. The `tables` records in
`extra-records.json` are made from the same checked rows.

## 6. Phase A: set up the book (once)

1. **Name the game and check it.** From the cover, title page and credits,
   name the game and edition; run `npm run kpack:verify -- --games`. Not
   listed: **stop and ask** (section 2) before going further.
2. **Read the whole book.** Render and page through every page
   (`pdf_regions.py`). Note its kind (rules, adventure, setting, supplement);
   whether the PDF is **born-digital** (made in InDesign or Word: real text,
   lost drop caps, ligatures) or a **scan** (page pictures with an OCR text
   layer: misread letters, damaged tiles); its chapters and sections; and
   every thing that becomes a record.
3. **Write `ledger.csv`**: a row for every PDF page, `checked` empty.
4. **Write `inventory.json`** (section 4.2). Print the game's record shapes
   with `sample_record.mjs` for each type you will make.
5. **Write `kraken-pack.json`** (section 5.1) and `book-index.json` (section
   5.4) with the book's chapters and sections.

## 7. Phase B: the page loop

Repeat until every row of `ledger.csv` has `checked = yes`:

1. **Take the first row not checked.**
2. **Render its page** (`pdf_regions.py "<pdf>" <n> --output <proofing>/p<n>.png`)
   and read all of it before choosing a reading order: columns, boxes,
   sidebars, tables, art that crosses the gutter (section 13).
3. **Rebuild it** into its `pages/*.html` (section 5.4). Use the PDF's text
   (`pdf_regions.py ... --text`) only as a draft: read every line against the
   picture, and correct it. Crop the page's art into `images/` and place it.
4. **Make its records**: every inventory thing on this page, into
   `extra-records.json`, in the game's shape, linked from the page that
   describes it.
5. **Compare** the built page with the PDF page: run `build_book_records.py`
   and look at it (`render_book_proof.mjs`, or the Books window in a test
   copy): order, every word, every number, tables cell by cell, art in place,
   frames where the boxes are. You may build after a few pages rather than
   after each, but no row is marked until its own page was compared.
6. **Write the row**: `content`, `pack_record`, `notes`, then `checked = yes`.
   Save the ledger now. Never mark a row you have not done.

When a session must end, stop after step 6; the ledger says where the next one
starts. Before ending, write in `notes.md` anything half-done.

## 8. Phase C: build

```bash
python skills/pdf-to-kpack/scripts/build_book_records.py "<work folder>"
npm run kpack:make -- "<work folder>" --out "<test home>/Packs"
```

`build_book_records.py` writes `records.json` (always run it: a `records.json`
from an earlier build is stale). `kpack:make` counts the records, makes the
thumbnail, writes `<test home>/Packs/<game>/<name>.kpack` and runs
`kpack:check` on it. Build into a test home (section 9), never straight into
the user's own packs folder: the finished pack is copied to
`Documents/Kraken VTT/Packs/<game>/` only when the gate says `DONE`.

## 9. Phase D: play it

The gate checks the book, not its numbers. Play it in a test copy of Maelstrom
that cannot touch the user's own campaigns and settings. Make a test folder
outside the repository with `profile/` and `home/Packs/<game>/` in it (phase C
builds the pack into that `home/Packs`), close any Maelstrom the user has open
only if they agree, build the app once if `dist/` is missing (`npm run build`),
and start the copy from the repository root:

```powershell
$env:KRAKEN_HOME = "<test folder>\home"; npx electron . --user-data-dir="<test folder>\profile"
```

`KRAKEN_HOME` makes the copy use the test folder in place of
`Documents/Kraken VTT` (its packs, its campaigns); `--user-data-dir` gives it
its own settings. Create a campaign of the book's game, make the pack active
in **Modules**, then:

- `node skills/pdf-to-kpack/scripts/check_book_reader.mjs . "<pack>"` opens every
  contents entry, its links and pictures as Books does; read a few chapters in
  Books yourself too;
- open every map: the grid lies on the art's squares;
- roll every table, every die face of a short one;
- a rules book: build a character with the wizard, buy gear, attack with a
  melee, a thrown and a missile weapon, roll a save and a skill, put three of
  the book's creatures on the tracker and fight;
- an adventure: add each battle to the tracker on its map (the creatures land
  in their room), open each encounter's links, hand out a parcel;
- pregenerated characters: build each through the wizard and compare it with
  the printed sheet.

Write each thing tried and what it showed in `playtest.md`. Fix what is wrong
(back to B or C) and try it again.

## 10. Phase E: the gate, then the hand-over

```bash
npm run kpack:verify -- "<pack>.kpack" --pdf "<book>.pdf" --work "<work folder>"
```

On `NOT DONE` each failing gate says what to fix: fix it (back to phase B for
the pages it names), rebuild (C), run the gate again. Loop until `DONE`. The
gates:

1. `kpack:check` has no errors or warnings (bar the built-in-game warning,
   which gate 2 settles).
2. The game is one Maelstrom plays. `Any` and a pack's own `game.json` pass
   only with the user's yes in `inventory.json`.
3. Every PDF page has a checked ledger row that lands in the pack; no record
   stands for more than 6 PDF pages.
4. Facsimile pages are pictures, not skipped text.
5. Every reflowed page holds at least 90% of its PDF page's words (words the
   scan's text layer misread, which the conversion corrected, are not
   counted).
6. Pages are rebuilt text: paragraphs, not the PDF's lines; headings; no
   run-together words; no notes about the conversion in the text; no
   picture-only page the ledger does not call a facsimile.
7. Every thing in `inventory.json` is a record, and creatures, items and spells
   carry their game data.
8. The contents list is not empty, opens every page it names, and names every
   page.
9. `playtest.md` says what phase D tried.

When it prints `DONE`, copy the pack from the test home into
`Documents/Kraken VTT/Packs/<game>/` (in Maelstrom: **Folders > Refresh**), and
hand over, and nothing less:

- the pack's file, where it now is;
- the gate's report, pasted as it printed;
- the facsimile pages and their reasons, and the pages with no usable PDF
  text layer (checked by eye only);
- what phase D tried and what it found;
- anything the app cannot do yet that the book needs.

## 11. Mistakes conversions have made (check for each)

- **A picture of every page with the PDF's raw text under it**, called a
  conversion. Gate 6 fails it.
- **A game Maelstrom lacks filed as "reference"** without asking (section 2).
- **Numbers read from the wrong row or column** of a printed table (a class's
  to-hit one level band off): check each band's first and last level against
  the book's summary table, not only the class's own page.
- **A summary table, a detail entry and an example that disagree**: keep each
  printed reading in the Book, use the most specific for the record, and say
  which in `notes.md`.
- **Weapons without `damage`**, thrown and missile weapons without `range`:
  they are not attacks.
- **Things a shop sells without a `cost`**: they cannot be bought.
- **Things characters cannot wear typed as armour** (horse barding, siege
  engines): type them `Gear`.
- **Empty fields that mean "none"** (`xpbonus: {}`) where the book gives a
  value: leave a field out when the book is silent, fill it when it is not.
- **A rules book's monsters left as pages**: each is an `npc` record.
- **Monsters with no `ac`**; **ranges where the rules want dice** (`4-18` is
  `2d8+2`); **one damage for several attacks** (write one per attack in order,
  a word for an effect: `1d10/petrification`).
- **A `+` and a number in an attack's name** (`Sword +1`): the tracker reads it
  as another attack. Put the bonus in the attack or damage field.
- **A creature that saves as a class the game does not have**: give it its own
  `saves`.
- **An adventure printed inside a rules book** kept as pages only: give it its
  encounters, battles, creatures and treasure.
- **An adventure made a game of its own**: its `ruleset` is the game it is
  played in, and it carries no `game.json`.
- **An adventure carrying copies of the rules book's records**: link them.
- **The same item in several books of one game**: write it in the book that
  first sells it.
- **One game split into several rulesets** without meaning to: every book of
  one game uses the same `ruleset`.
- **Battle maps with no grid**, **oblong squares** (scale the picture so the
  squares are square), **battles with no `maplink`**, **parcels no encounter
  links**, **encounters with no links**.
- **Ships, wagons and airships as pages or creatures**: each is a `vehicle`.
- **Picture links with a made-up class**: use `imagewindow`.
- **Notes for the app inside the book's text**: they go in the hand-over.

## 12. The tools (skills/pdf-to-kpack/scripts/)

| script | what it does |
|---|---|
| `verify-conversion.mjs` | the gate (`npm run kpack:verify`); `--games` lists the games |
| `sample_record.mjs` | real records of a type from the game's installed packs, to copy their shape |
| `pdf_regions.py` | `"<pdf>" <page> [--region x0,y0,x1,y1] [--output file.png] [--text] [--dpi 180]`: render a page, crop a region (fractions of the page), or print its draft text |
| `pdf_polygon_art.py` | `"<pdf>" <page> <out.webp> x,y x,y ...`: cut art that wraps round text, by a traced outline |
| `compare_region_ocr.py` | `"<pdf>" <page> --region x0,y0,x1,y1`: the PDF's text against Tesseract OCR for one region |
| `recover_page_image.py` | `"<pdf>" <page> <xref> <out.jpg>`: a page's scan straight from its image, when the page renders blank |
| `restore_scan_tiles.py` | `<extracted.jpg> <out.png> --from-row <y> --shift <px> [--black n] [--gray-offset n] [--preserve-top n]`: realign a JPEG scan whose 16-pixel tiles shifted |
| `build_book_records.py` | `"<work folder>"`: `book-index.json` + `pages/*.html` + `extra-records.json` into `records.json`, checking markup and pictures |
| `build_monster_records.py` | `<groups.json> "<work folder>"`: monster stat tables for the Book and their `npc` records from the same checked cells |
| `check_roll_tables.py` | `"<work folder>"`: `tables/*.json` against the tables in `pages/` |
| `audit_book_text.py` | `"<pdf>" "<work folder>" [--first n] [--last n]`: words in the PDF missing from the pages' HTML, to look at |
| `check_book_reader.mjs` | `<repo> "<pack>"`: open every contents entry, link and picture as Books does |
| `render_book_proof.mjs` | `<repo> "<pack>" <out dir> <chromium.exe> [page titles...]`: render pages with the app's stylesheet, check pictures and table widths, save screenshots. `<chromium.exe>` is any Chrome or Edge, for example `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| `pdf_text.py` | a PDF's text per page (the gate uses it) |
| `check_page_ledger.py` | an older ledger check; the gate replaces it |

## 13. Problems and what works

Findings from earlier conversions, by symptom. **New lessons:** one that any
book could hit goes here, a paragraph under its symptom; a number for one book
(a seam's row and shift, a misprint) goes in that book's `notes.md`. There is
never a second guide.

**Reading order.** View the whole page before choosing an order. Text can run
across upper regions first, then restart below a full-width rule; a paragraph
can continue mid-sentence in another column; titles and art can cross the
gutter. One PDF text block can hold lines from two columns: split by each
line's coordinates. Extraction can return the left half of every table row
before the right: pair cells by y, assign columns by x. Bound prose around a
table above and below so a late column does not leak in.

**The PDF's text is a draft.** OCR layers misread letters ("po&ble", "magac",
"thcy"), drop words and initials, and put spaces inside words ("R oom"); MuPDF's
`TEXT_INHIBIT_SPACES` flag can recover those. Born-digital PDFs lose drop caps
("his chapter" for "This chapter") and ligatures, and run words together. A
re-typeset PDF can keep an older OCR's mistakes in clean type. Read every line
against the picture; recover a missing initial from its printed shape.

**Damaged scans.** A sudden horizontal split with the columns wrapping round is
a shifted JPEG tile stream: take the embedded image out (PyMuPDF), find the
first bad row and the shift on a preview, repair a copy with
`restore_scan_tiles.py` in the proofing folder, and read every line crossing
the seam. A page blank in two renderers may have a broken content stream with
its image intact: `recover_page_image.py`. Colour damage: try each channel (the
blue channel can keep text RGB lost). CCITT and Flate damage can cut a page
short: compare MuPDF and Poppler, and look for the same plate in another
printing or an installed pack, noting where it came from in the ledger.

**Art.** Crop art from the page at its place in the reading flow; trace a
polygon (`pdf_polygon_art.py`) when it wraps round text. Check orientation (a
stored image can be upside down under its page transform). Keep forms and
handouts whole, at a size that keeps their small print legible. Check every
crop for stray letters and clipped strokes.

**Boxes and frames.** A read-aloud box can be four thin vector shapes, one strip
per line (Word), or a raster border on a scan: propose them by detection, accept
only those confirmed on the page. A box crossing a column is one frame; crossing
a page, close it and open it again at the page break. Count the boxes on the
page and in the built page.

**Tables.** Inspect every table by row and column (multi-line cells, headers,
footnotes, units, signs, dice). The Book table and the rollable table come from
the same checked cells. A roll needing a separate check per column (treasure):
a fixed one-row parent with a nested table link per category. Overlapping
printed ranges: keep them in the Book, give the competing results on the shared
face in the rollable table. Test every die face.

**Maps.** Measure the grid across many squares on the exported crop itself (not
a reduced proof), give one size, and the offset from the crop's top left;
overlay it and check margins and centre. Several levels on one plate: one crop
each. Hex grids: orientation, centre phase and both neighbour pitches;
Maelstrom's hex size is the distance between adjacent centres. Read each map's
own printed scale. Region maps may stay ungridded.

**Creatures in the tracker.** Fixed damage is the bare number. An effect-only
attack gets a word, not dice; an attack left blank gets a default attack. One
battle row loads at most 20 creatures: split a larger group into rows. A keyed
creature (fixed HP, a magic weapon) is its own record when it differs from the
bestiary. Check every attack in the tracker, not only in the record.

**Pregenerated characters.** Build each through the wizard with gear named
exactly as the shop names it; compare HP, AC, scores, spells and equipment with
the printed sheet, and note any difference.

**Branching solo adventures.** One page per numbered entry; check every choice's
target against the print, then walk the links from the first entry and report
any entry missing or unreachable.

## 14. Licensing

Convert only books the user owns, for their own use. A book's content is its
publisher's: packs made from licensed books, their work folders and proofing
are never committed to the Maelstrom repository, uploaded or shared.
