# Converting a PDF to a .kpack

**This is the only guide for turning a PDF book into a Maelstrom pack.** Every
other note that says how (an agent's skill, an old checklist) points here. If
something here disagrees with anything else, this page wins; fix the other.

The pack format itself (fields, record shapes, where packs go) is
[kpack-format.md](kpack-format.md). Game rules for packs that define a game are
[pack-games.md](pack-games.md) and, for BECMI, [becmi-packs.md](becmi-packs.md).

## The one rule

**You are done when `npm run kpack:verify` prints `DONE` (phase E), and not before.**
Its report is the hand-over. A pack that opens, or that passes
`kpack:check`, is not done: `kpack:check` checks the format, not the book.

A real conversion takes hours: every page read against its picture, every
creature, item, table and map made into a record. A 300-page book finished in
minutes has skipped the work. If you are close to "done" fast, run the gate;
it will say what is missing.

The gate catches shortcuts, not lies. It trusts that a ledger row marked
`checked` was compared with its page and that `playtest.md` says what really
happened. The user spot-checks both.

## Stop and ask the user (never decide these yourself)

Stop, say what you found, and wait for an answer when:

1. **The book's game is not a Maelstrom game.** `npm run kpack:verify -- --games`
   lists the games. Do not file the book as `Any`, as "reference", or under
   Worldbuilding, do not invent a ruleset name, and do not give the pack a
   `game.json` of your own. Ask: add the game (its `game.json`,
   [pack-games.md](pack-games.md), and its rules in Maelstrom: a project of its
   own) or file the book under a game the user names. When the user says `Any`
   or to add the game, record it in `inventory.json`
   (`"approvedByUser": { "ruleset": "Any" }` or `{ "gameJson": "<game>" }`);
   gate 2 fails without it. A new game's record types and fields are settled
   when the game is added, in its `game.json`; its books are converted after.
2. **Pages are missing or unreadable** (blank in two renderers, cut off, a
   listed insert or map not in the PDF), after trying the repairs in the
   appendix. Say which pages, and what is lost.
3. **The user did not supply the book** or it is not theirs to convert.

## The work folder

One folder per book, **outside the Maelstrom repository** (books are licensed;
never commit them or anything made from them). Everything the conversion knows
lives in these files, so any session can stop and another carry on from them:

```text
<book> work/
  ledger.csv          one row per PDF page: the state of the loop
  inventory.json      every creature, item, spell, table, map... by name
  kraken-pack.json    the manifest (kpack-format.md section 3)
  book-index.json     chapters > sections > pages (for build_book_records.py)
  pages/*.html        the book's text, rebuilt
  tables/*.json       rollable tables, checked against pages/
  extra-records.json  the game records (npc, item, spell, tables, image...)
  images/             cover, art crops, maps (WebP)
  playtest.md         what phase D tried in Maelstrom and what it showed
  notes.md            this book's own findings (scan repairs, printed errors)
proofing/             renders, OCR drafts, repaired scans: never in the pack
```

`ledger.csv` columns:

| column | what goes in it |
|---|---|
| `pdf_page` | 1, 2, 3... every PDF page once, in order (not the printed number) |
| `printed_folio` | the number printed on the page, if any |
| `section` | the book section it belongs to |
| `pack_record` | the record path(s) holding it, as `build_book_records.py` names a page from its `key` in `book-index.json` (`reference.refmanualdata.<key>`); several joined with `;`. One book page per section: a record is named by at most 6 PDF pages |
| `content` | `reflowed` (text rebuilt), `blank`, or `facsimile:<reason>` (kept as a picture) with reason `cover`, `art`, `map`, `form`, `handout`, `advertisement`, `credits` or `index` |
| `checked` | `yes` only after you compared the built page with the PDF page (step B5) |
| `notes` | printed errors kept, repairs made, anything unresolved |

A page of rules or story text is never a facsimile. Pages that are mostly
pictures (a map, the character sheet, a handout) are, and the text on them that
matters is also transcribed where it is used.

`inventory.json`:

```json
{ "things": [
  { "type": "npc", "name": "Goblin", "page": 31 },
  { "type": "item", "name": "Revolver, .38", "page": 251 },
  { "type": "tables", "name": "Ideology and Beliefs", "page": 53 }
] }
```

`type` is the record type it will be (kpack-format.md section 4); `name` the
record's name; `page` the PDF page (for the reviewer). The gate checks that each
is in the pack, and that every `npc`, `item` and `spell` has its game data, not
only a name.

## Phase A: set up (once per book)

1. **Check the game first.** From the cover, title page and credits, name the
   game and edition, then run `npm run kpack:verify -- --games`. Not listed:
   **stop and ask** (above) before reading further.
2. **Read the whole book.** Page through every page (render them;
   `scripts/pdf-kpack/pdf_regions.py`). Note its kind (rules, adventure,
   setting, supplement), whether the PDF is **born-digital** (InDesign, Word:
   real text) or a **scan** (pictures with an OCR layer), its chapters, and
   everything in it that is a thing in play.
3. **Write `ledger.csv`** with a row for every PDF page, `checked` empty.
4. **Write `inventory.json`**: every creature and NPC, item (weapons, armour,
   gear, anything with a price), spell, class, race, skill, occupation or other
   character option, random table, map, handout, encounter and treasure, by
   name and page. Copy each type's data shape from that game's existing packs
   (kpack-format.md section 5). Rules books: their monster chapter, equipment
   lists and option lists are records. Adventures: every keyed area is an
   `encounter`, every fight a `battle`, every hoard a `treasureparcels`.
5. **Write `kraken-pack.json`** (kpack-format.md section 3; `"from": { "kind": "pdf", "name": "<file>" }`).

## Phase B: the loop (one page at a time)

Repeat until no row of `ledger.csv` lacks `checked = yes`:

1. **Take the first row not checked.**
2. **Render the page** and read all of it before choosing a reading order
   (columns, boxes, sidebars, tables, art that crosses the gutter).
3. **Rebuild it** into `pages/*.html`: the text in `<p>` paragraphs (never the
   PDF's line breaks), headings as `<h>`, emphasis, lists, boxed read-aloud
   text in frames, every printed table as a `<table>`, art cropped from the
   page as an image directive at its place in the text. Use the PDF's text
   only as a draft: read every line against the picture.
4. **Make the records** for every inventory thing on the page, in its game's
   shape, linked from the page that describes it.
5. **Compare** the built page (`build_book_records.py`, then
   `render_book_proof.mjs` or the app's Books window) with the PDF page: order,
   every word, every number, tables cell by cell, art in place. You may build
   after a few pages instead of after each, but no row is marked until its own
   page was compared.
6. **Write the row**: `content`, `pack_record`, `notes`, then `checked = yes`.
   Save the ledger now, after every page. Never mark rows you have not done.

Do not stop the loop to report. When the session must end, the ledger says
where the next one starts.

## Phase C: build

```bash
python scripts/pdf-kpack/build_book_records.py "<book> work"
npm run kpack:make -- "<book> work"
```

`kpack:make` writes the pack to `Documents/Kraken VTT/Packs/<game>/`. Always
run `build_book_records.py` first: a `records.json` left from an earlier build
is stale.

## Phase D: play it

The gate checks the book, not the numbers. In a test copy of Maelstrom (its own
profile, `--user-data-dir`), with the pack active:

- open every chapter in Books (`scripts/pdf-kpack/check_book_reader.mjs` opens
  every contents entry, its links and pictures);
- open every map: its grid on the art's squares;
- roll every table;
- rules books: build a character with the wizard, buy gear, attack with a melee,
  a thrown and a missile weapon, roll a save or skill, fight three of the
  book's creatures on the tracker;
- adventures: add each battle to the tracker on its map, and open each
  encounter's links.

Write `playtest.md`: each thing tried, and what it showed. Fix anything wrong
(back to B or C) and try it again.

## Phase E: the gate (loop until DONE), then hand over

```bash
npm run kpack:verify -- "<the made .kpack>" --pdf "<book>.pdf" --work "<book> work"
```

On `NOT DONE`, each failing gate says what to fix: fix it (back to phase B for
the pages it names), rebuild (C), and run the gate again. The gates:

1. `kpack:check` has no errors or warnings (bar the built-in-game warning,
   which gate 2 settles).
2. The game is one Maelstrom plays (else: stop and ask). `Any` and a pack's
   own `game.json` pass only with the user's yes in `inventory.json`.
3. Every PDF page has a checked ledger row that lands in the pack; no record
   stands for more than 6 PDF pages.
4. Facsimile pages are pictures, not skipped text.
5. Every reflowed page holds at least 90% of its PDF page's words (words the
   scan's text layer misread are left out of the count).
6. Pages are rebuilt text: paragraphs, not the PDF's lines; headings; no
   run-together words; no notes about the conversion in the book's text; no
   picture-only page the ledger does not call a facsimile.
7. Every thing in `inventory.json` is a record, and creatures, items and spells
   carry their game data.
8. The contents list is not empty, opens every page it names, and names every
   page.
9. `playtest.md` says what phase D tried.

When it prints `DONE`, hand over to the user, and nothing less:

- the pack's file;
- the `kpack:verify` report, pasted as it printed;
- the facsimile pages and their reasons, and the pages with no PDF text layer;
- what phase D tried and what it found;
- anything the app cannot do yet (never written into the book's pages).

## Mistakes conversions have made (check for each)

- **A picture of every page with the PDF's raw text under it**, called a
  conversion. Gate 6 fails it.
- **A game Maelstrom lacks filed as "reference" without asking.** Stop and ask.
- **Numbers read from the wrong row or column** of a printed table (a class's
  to-hit one level band off). Check each class's first and last level of
  every band against the book's summary table, not only its own page.
- **Weapons without `damage`**, thrown and missile weapons without `range`:
  they do not appear as attacks.
- **Things characters cannot wear typed as armor** (horse barding, siege
  engines as weapons): type them `Gear`.
- **Empty fields that mean "none"** (`xpbonus: {}`) where the book gives a
  value: leave a field out when the book is silent, fill it when it is not.
- **A rules book's monsters left as pages.** Each monster is an `npc` record.
- **An adventure printed inside a rules book** kept as pages only: give it its
  encounters, battles, creatures and treasure, or its own `adventure` pack.
- **Battle maps with no grid**: give dungeon and building maps their grid;
  region maps may stay without one.
- **An adventure made a game of its own**: an adventure's `ruleset` is the game
  it is played in, and it carries no `game.json`.
- **An adventure carrying copies of the rules book** (classes, equipment,
  spells, standard monsters): it carries only what it adds and links the rules
  book's records (`npc.goblin@Set 1: Basic Rules`).
- **Battles with no map positions**: give each battle row its `maplink`
  (`imageref`, and `imagex`, `imagey` from the picture's centre, y down). From
  a PDF, a position near the room's key number is enough.
- **Treasure parcels no story links**: link each from its room's encounter.
- **Maps with oblong squares**: scale the picture so the squares are square.
- **One game split into several rulesets** without meaning to: every book of
  one game uses the same `ruleset`.
- **The same item in several books of one game**: write it in the book that
  first sells it.
- **Notes for the app inside the book's text**: book text is the book's words;
  what the app cannot do goes in the hand-over.
- **One damage for several attacks**: write a damage for each attack in order
  (`1d10/petrification`).
- **Things a shop sells without a `cost`**, **monsters with no `ac`**,
  **ranges where the rules want dice** (`4-18` is `2d8+2`).
- **A creature that saves as a class the game does not have**: give it its own
  `saves`.
- **Picture links with a made-up class**: use `imagewindow` with the image's
  record (`image.ark-5@Champions of Mystara`).
- **Ships and vehicles as pages or creatures**: make each a `vehicle` record.
- **Story records with no links**: an `encounter` links its creatures, battles,
  treasure and maps.

## The tools (scripts/pdf-kpack/)

| script | what it does |
|---|---|
| `verify-conversion.mjs` | the gate (`npm run kpack:verify`) |
| `pdf_text.py` | a PDF's text per page, for the gate |
| `pdf_regions.py` | render a page, or crop or read a region of it |
| `pdf_polygon_art.py` | cut art that wraps around text, by a traced outline |
| `compare_region_ocr.py` | the PDF's text against Tesseract OCR for one region |
| `recover_page_image.py` | take a page's scan straight from the PDF's image (page renders blank) |
| `restore_scan_tiles.py` | realign a JPEG scan whose tiles shifted |
| `build_book_records.py` | `book-index.json` + `pages/*.html` + `extra-records.json` into `records.json` |
| `build_monster_records.py` | monster stat tables and their `npc` records from the same checked cells |
| `check_roll_tables.py` | `tables/*.json` against the tables in `pages/` |
| `audit_book_text.py` | words in the PDF missing from a page's HTML |
| `check_book_reader.mjs` | open every contents entry, link and picture as Books does |
| `render_book_proof.mjs` | render pages with the app's stylesheet, check pictures and table widths |
| `check_page_ledger.py` | older ledger check (the gate replaces it) |

They need Python with PyMuPDF and Pillow, and Node.

## Appendix: problems and what works

Generic findings, by symptom. **Where new lessons go:** a lesson any book could
hit goes here, one paragraph under its symptom; numbers for one book (a seam's
row and shift, a misprint) go in that book's `notes.md`; game rules go in
[pack-games.md](pack-games.md) or [becmi-packs.md](becmi-packs.md). Nothing
else grows a second guide.

**Reading order.** View the whole page before choosing an order. Text can run
across upper regions first, then restart below a full-width rule; a paragraph
can continue mid-sentence in another column; titles and art can cross the
gutter. One PDF text block can hold lines from two columns: split by each
line's coordinates. Extraction can return the left half of every table row
before the right: pair cells by y, assign columns by x. Bound prose around a
table above and below so a late column does not leak in.

**The PDF's text is a draft.** OCR layers misread letters ("po&ble",
"magac", "thcy"), drop words and initials, and put spaces inside words
("R oom"); MuPDF's `TEXT_INHIBIT_SPACES` can recover those. Born-digital PDFs
lose drop caps and ligatures and run words together. Read every line against
the picture; recover a missing initial from its printed shape.

**Damaged scans.** A sudden horizontal split with columns wrapping round is a
shifted JPEG tile stream: extract the embedded image (PyMuPDF), find the row
and shift on a preview, repair with `restore_scan_tiles.py`, keep the repair in
`proofing/` and read every line crossing the seam. A page blank in two
renderers may have a broken content stream with its image intact:
`recover_page_image.py`. Colour damage: try each channel separately (the blue
channel can hold text RGB lost). CCITT and Flate damage can truncate a page;
compare MuPDF and Poppler, and look for the same plate in another printing or
pack (record where it came from in the ledger).

**Art.** Crop art from the page at its place in the reading flow; trace a
polygon (`pdf_polygon_art.py`) when it wraps round text. Check orientation (a
stored image can be upside down under its page transform). Keep forms and
handouts whole at a size that keeps small print legible. Check every crop for
stray letters and clipped strokes.

**Boxes and frames.** Read-aloud boxes may be four thin vector shapes, one strip
per line (Word), or raster borders on a scan: propose them by detection, accept
only those confirmed on the page. A box crossing a column joins into one frame;
crossing a page, close and reopen it at the page break. Each frame marker on its
own line. Count the boxes on the page and in the built page.

**Tables.** Inspect every table by row and column (multi-line cells, headers,
footnotes, units, signs, dice). The Book table and the rollable table come from
the same checked cells. A roll needing separate checks per column (treasure):
a fixed one-row parent with a nested table link per category. Overlapping
printed ranges: keep them in the Book, give the competing choices on the shared
face in the rollable table. A record link in a table cell is `resultlink`. Test
every die face.

**Maps.** Measure the grid across many squares on the exported crop (not a
reduced proof), give one size, and the offset from the crop's top left; overlay
it and check margins and centre. Several levels on one plate: one crop each.
Hex grids: orientation, centre phase and both neighbour pitches; Maelstrom's
hex size is the distance between adjacent centres. Read each map's own printed
scale. Region maps may stay ungridded. Keep keyed maps GM-only, player maps
`all`.

**Repeated values that disagree.** A summary table, a detail entry and an
example can disagree. Keep each printed reading in the Book, choose one for the
playable record from the most specific source, and say which in `notes.md`.

**Book markup.** Books renders `h`, `b`, `i`, `u`, `list`/`li`, `table`, `tr`,
`th`, `td` (numeric `colspan`), `sup`, `sub`, `br`, frames and links. Use `<h>`,
not `<h2>` (dropped). `ol` is stripped: keep printed numbers in the text. Close
`<br/>`. Every record needs `data.fgPath` (`path@Pack Name`);
`build_book_records.py` sets it for pages. Image directives on their own line
(`<!-- image: images/x.webp -->`); inline `<img>` disappears.

**NPC records and the tracker.** A `+` and number in an attack name is read as
another attack: put bonuses in the attack or damage fields. Fixed damage is the
bare number. Effect-only attacks get a word, not dice; leaving an attack blank
gives a default attack. Factions are `friend`, `neutral`, `foe`. One battle row
loads at most 20 creatures: split larger groups. Check every attack in the
tracker, not only in the record.

**Pregenerated characters.** Build each through the real wizard
(`fromPregen`), with gear named exactly as the shop names it; compare HP, AC,
scores, spells and equipment with the printed sheet, and record any difference.

**Branching solo adventures.** One page per numbered entry; check every choice's
target against the print, then walk the links from the first entry and report
any entry missing or unreachable.
