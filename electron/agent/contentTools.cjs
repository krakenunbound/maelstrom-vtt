// The agent's tools for the campaign's own content (electron/content.cjs):
// the same functions the table's messages call, as the GM.
const content = require("../content.cjs");

const out = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const string = (description) => ({ type: "string", description });
const number = (description) => ({ type: "number", description });
const object = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
function needTable(ctx) {
  const table = ctx.table();
  if (!table) throw new Error("Not hosting. Host a campaign first (kraken_host).");
  return table.agent;
}
const LINK = { type: "object", description: "A Kraken link (as a quick slot holds one): { kind: picture, book, file, label } or { kind: book, book, page, label }, or any other link" };
const FRAME_IDS = ["parchment", "boxed", "sea", "sidebar", "note", "warning", "stone", "picture"];
const BLOCKS = { type: "array", description: "The pages in order: { kind: text, text } | { kind: columns, text, text2 } | { kind: header, text (plain) } | { kind: image, link } | { kind: imageleft or imageright, link, text } | { kind: page, link } | { kind: separator, style: scroll|knot|rule|stars }. Any but a separator may have frame (" + FRAME_IDS.join("|") + "; boxed and sea are read-aloud boxes) and color (#rrggbb background).", items: { type: "object" } };

const TOOLS = [
  {
    name: "kraken_record_duplicate",
    description:
      "FG's Duplicate and Copy to campaign, as a record's right-click menu and its window: a copy of a campaign record named \"<name> (copy)\" (id), or a book's record copied into the campaign under its own name (id of an active book's record, or book + path for a record a book's page links to). The copy is the campaign's own (no book), hidden from the players, with a new id; edit it with kraken_record_update.",
    inputSchema: object({ id: string("The record to copy"), name: string("The copy's name (default: \"<name> (copy)\", or the book record's name)"), book: string("A book's id (with path)"), path: string("A record's FG path in that book") }),
    run: async (args, ctx) => out(await content.copyRecord(needTable(ctx), args)),
  },
  {
    name: "kraken_story",
    description:
      "The campaign's story (FG's story records, with the Story Template's pages): its chapters are the list's categories. action create (name, chapter, order, blocks or text, visibility); copy (path: an adventure's story entry, as kraken_library list kind story gives it, copied into the campaign); set (id: name, chapter, order, blocks: the whole list of pages); add-block (id, kind, text (formatted text: <p>, <h>, <b>, <i>, <u>, <list><li>, <table><tr><td>, <frame> for boxed read-aloud text, <link class recordname>), text2 (columns), link, frame, color, style, at); set-block (id, at, and any of text, text2, link, frame, color, style; frame or color \"\" clears it); remove-block (id, at). Share it with kraken_record_update visibility (all, or a list of players' names).",
    inputSchema: object(
      {
        action: { type: "string", enum: ["create", "copy", "set", "add-block", "set-block", "remove-block", "generate"] },
        template: string("generate (FG's story templates): words with [Table name], [Table name|column], [1d6] and [2x] rolled into a new story"),
        id: string("The story record (set, add-block, remove-block)"),
        name: string("Its name"),
        chapter: string("Its chapter (the story list's category)"),
        order: number("Its place in the chapter"),
        text: string("FG's formatted text (create: the first page; add-block)"),
        blocks: BLOCKS,
        kind: { type: "string", enum: ["text", "columns", "header", "image", "imageleft", "imageright", "page", "separator"] },
        text2: string("columns: the right-hand column's formatted text"),
        frame: { type: "string", description: "The page's frame: " + FRAME_IDS.join(", ") + " (\"\" none)" },
        color: string("The page's background colour, #rrggbb (\"\" none)"),
        style: { type: "string", enum: ["scroll", "knot", "rule", "stars"], description: "A separator's look" },
        link: LINK,
        at: number("A page's index (add-block: where; set-block and remove-block: which)"),
        path: string("copy: the story entry's FG path"),
        visibility: { description: "gm, all, or a list of players' names", anyOf: [{ type: "string", enum: ["gm", "all"] }, { type: "array", items: { type: "string" } }] },
      },
      ["action"],
    ),
    run: (args, ctx) => out(content.storyAction(needTable(ctx), args)),
  },
  {
    name: "kraken_table",
    description:
      "Random tables, as FG's: action roll (id, or name, or path for an adventure's table; column: a column's label or number, default every column; dice: other dice, as /rollon -d; hide: the GM's eyes only, as /rollon -hide; output parcel: the results into a new treasure parcel). A result's [2d6] is rolled into it, [3x] rolls the tables it links three times, [Other Table] and a result linking a table roll them too (ten deep at most); the table's \"hide roll results\" keeps it the GM's. create (name, dice, mod, data: FG's table fields); edit (id: name, dice, mod, resultscols, labels [..], rows [{ from, to, results: [text or { result, resultlink }] }], hiderollresults 0/1, output); import (FG's Import Table: name, text pasted, delimiter \"\" (simple: \"1-3 words\", columns two spaces apart) or , | : ;, header (first row the column labels), ranges (first column the ranges)). Returns the roll's results, nested ones too.",
    inputSchema: object(
      {
        action: { type: "string", enum: ["roll", "create", "edit", "import"] },
        id: string("The table record"),
        name: string("A table's name (roll by name, create, import, edit)"),
        path: string("roll: an adventure's table by its FG path (kraken_library list kind table)"),
        column: string("roll: a column's label or number"),
        dice: string("roll: other dice (2d6); create, edit: the table's die (d20, d100)"),
        hide: { type: "boolean", description: "roll: for the GM alone" },
        output: { type: "string", enum: ["", "parcel", "story", "encounter"], description: "roll: the results into a new treasure parcel, story or encounter (FG's table output); edit: the table's own output" },
        mod: number("The table's modifier"),
        resultscols: number("edit: how many columns"),
        labels: { type: "array", items: { type: "string" }, description: "edit: the columns' labels" },
        rows: { type: "array", items: { type: "object" }, description: "edit: every row, { from, to, results }" },
        hiderollresults: number("edit: 1 to keep its rolls the GM's"),
        data: { type: "object", description: "create: FG's table fields; roll: a table's fields as read from a book's page (a rulebook's table, which the campaign does not copy in), with name" },
        text: string("import: the pasted table"),
        delimiter: { type: "string", enum: ["", ",", "|", ":", ";"] },
        header: { type: "boolean" },
        ranges: { type: "boolean" },
      },
      ["action"],
    ),
    run: (args, ctx) => out(content.tableAction(needTable(ctx), args, needTable(ctx).seat, "GM")),
  },
  {
    name: "kraken_item_identify",
    description:
      "FG's Identified toggle (the GM's): on false makes an item unidentified (the players then see only its unidentified name and notes: name, notes set them; the host strips the rest from every player's screen, the party sheet and chat), on true identifies it. id: an item record; or a character, the party (\"party\": its parcel) or a treasure parcel with item: the row's key in its gear or parcel.",
    inputSchema: object({ id: string("An item, a character, \"party\" or a treasure parcel"), item: string("The row's key in that character's gear, the party's parcel or the treasure parcel"), on: { type: "boolean", description: "true: identified (default); false: unidentified" }, name: string("The unidentified name (nonid_name)"), notes: string("The unidentified notes (nonid_notes)") }, ["id"]),
    run: (args, ctx) => out(content.identify(needTable(ctx), args)),
  },
  {
    name: "kraken_encounter",
    description:
      "The campaign's encounters (FG's battle records), as the encounter window: action create (name); generate (FG's Generate: id, or path for a book's random encounter: a new encounter with every count rolled now ($PC: the party's members), a creature that comes to 0 left out; name to give it another); add-npc (id, npc: an NPC record, count: a number or dice rolled when it is added (a random encounter: 1d4+1), faction friend|neutral|foe; as an NPC dropped on it); set-npc (id, row, count, faction, unidentified: FG's identified magnifier, what the players call the creature until they know it, empty for identified; its tokens carry that name); remove-npc (id, row); xp (the total from its creatures, the game's own field); place (Place on this map: the open map's tokens of its creatures, where they stand now, kept as its spots on that map; spots { row: [{ x, y }] } to give them); run (Add to tracker: its NPCs onto the combat tracker, counts rolled, tokens hidden at its spots when this map has them; place false: tracker only); end (End encounter: its XP onto the party sheet's Encounters to award; xp to give another total).",
    inputSchema: object(
      {
        action: { type: "string", enum: ["create", "generate", "add-npc", "set-npc", "remove-npc", "xp", "place", "run", "end"] },
        id: string("The encounter"),
        path: string("generate: a book's encounter or random encounter by its FG path (battlerandom.x@Book), instead of id"),
        name: string("create: its name"),
        npc: string("add-npc: an NPC record's id"),
        count: string("A number, or dice and $PC (the party's members): 1d4+1, $PC+1"),
        faction: { type: "string", enum: ["friend", "neutral", "foe"] },
        row: string("The NPC's row key"),
        unidentified: string("set-npc: what the players call it until they know it (\"\": identified)"),
        spots: { type: "object", description: "place: { row: [{ x, y }] } (map pixels)" },
        place: { type: "boolean" },
        xp: number("end: the XP to give, instead of its total"),
      },
      ["action"],
    ),
    run: async (args, ctx) => out(await content.encounterAction(needTable(ctx), args, "Agent")),
  },
  {
    name: "kraken_parcel",
    description:
      "Treasure parcels (FG's): action create (name); add (id: item (an item record: its whole record, identified or not) and count, or name for a plain item; or coin (the game's money: GP, Cr, Supply...) and amount); remove (id, key of an item row, coin true for a coin row); party (id: into the party sheet's parcel to hand out, as a parcel dropped on the party sheet); character (id, character: its items into that sheet's gear, its coins into the purse, as a parcel dropped on a sheet). A table rolled with output parcel fills a new one.",
    inputSchema: object(
      {
        action: { type: "string", enum: ["create", "add", "remove", "party", "character"] },
        id: string("The parcel"),
        name: string("create: its name; add: a plain item's name"),
        item: string("add: an item record's id"),
        count: number("add: how many"),
        coin: string("add: a coin's name"),
        amount: number("add: how many coins"),
        key: string("remove: the row's key"),
        character: string("character: the character's id"),
      },
      ["action"],
    ),
    run: async (args, ctx) => out(await content.parcelAction(needTable(ctx), args, "Agent")),
  },
  {
    name: "kraken_quest",
    description: "Quests (FG's quest records): action create (name, xp, text (FG's formatted text), status open|done, visibility); set (id: name, xp, text, status); party (id: onto the party sheet's XP tab, to award there with kraken_party_award, as a quest dropped on that tab).",
    inputSchema: object({ action: { type: "string", enum: ["create", "set", "party"] }, id: string("The quest"), name: string("Its name"), xp: number("Its XP"), text: string("Its text"), status: { type: "string", enum: ["open", "done"] }, visibility: { type: "string", enum: ["gm", "all"] } }, ["action"]),
    run: (args, ctx) => out(content.questAction(needTable(ctx), args)),
  },
  {
    name: "kraken_npc_import",
    description:
      "FG's Import NPC from text: a 5E stat block pasted as text (2014: 'Armor Class', 'STR DEX CON...', 'Challenge'; 2024: 'AC ... Initiative', 'Str 8 -1 -1', 'CR ... (XP ...; PB ...)') becomes a campaign NPC record (GM only), its traits, actions, bonus actions, reactions and legendary actions as entries. Returns the record and what could not be read (problems).",
    inputSchema: object({ text: string("The whole stat block, its name on the first line") }, ["text"]),
    run: async (args, ctx) => out(await content.npcImport(needTable(ctx), args)),
  },
  {
    name: "kraken_item_forge",
    description:
      "FG's Item Forge (5E): base items and templates merged into new campaign items (GM only). Each entry is a campaign record id, or { book, path } for a book's record (path: its FG path, as data.fgPath gives it: item.longsword@<module>). Templates are item templates, or items and spells used as them: 'Weapon, +1, +2, or +3' on a Longsword makes 'Longsword, +1' (bonus picks +1 to +3 and the rarity it names); 'Weapon of Warning' makes 'Longsword of Warning'; a spell on a Spell Scroll makes 'Spell Scroll of <spell>' at the spell level's rarity. Names, rarity, bonus, properties, damage, AC, cost and description combine; every base gets every template. With no base, the first template is the base and the result is an item template. Returns the new records (made) and any warning (problems).",
    inputSchema: object(
      {
        base: { type: "array", description: "Base items: record ids, or { book, path }", items: {} },
        templates: { type: "array", description: "Templates: item templates, items or spells (record ids, or { book, path })", items: {} },
        bonus: number("For a '+1, +2, or +3' template: which bonus (1 to 3; default 1)"),
      },
      ["templates"],
    ),
    run: async (args, ctx) => out(await content.itemForge(needTable(ctx), args)),
  },
  {
    name: "kraken_race_import",
    description:
      "FG's race import (5E): a race pasted as text becomes a campaign race record (GM only), with a subrace record for each subrace. The name on the first line; its description until '<Race> Traits'; each trait a line beginning with its name and a full stop ('Darkvision. You have...'); a subrace a line '<Word> <Race>' ('High Elf') or a '<Subrace> Traits' header. 2024's 'Creature Type:', 'Size:' and 'Speed:' lines fill the race's fields. Returns the race, its subraces and what could not be read (problems).",
    inputSchema: object({ text: string("The whole race as text, its name on the first line") }, ["text"]),
    run: async (args, ctx) => out(await content.raceImport(needTable(ctx), args)),
  },
  {
    name: "kraken_item_import",
    description:
      "FG's Import Item (5E): items pasted as text become campaign items (GM only). Either a table (list): its type on line 1 ('Weapon'), its subtype on line 2 ('Martial Melee Weapons'), the column names on line 3 ('Name | Damage | Properties | Mastery | Weight | Cost'; armor: 'Armor | Armor Class (AC) | Strength | Stealth | Weight | Cost'), then a row per item, cells split by '|' or tabs; with text giving each its description (a line with the item's name, then its words). Or no table, magic items as the books print them in text: the name, then 'Weapon (Any Melee Weapon), Rare (Requires Attunement)', then its text; as many as are given. Returns the items made and what could not be read (problems).",
    inputSchema: object({ list: string("The table (optional): type, subtype, column names, rows"), text: string("The descriptions for the table's items, or magic items as printed") }),
    run: async (args, ctx) => out(await content.itemImport(needTable(ctx), args)),
  },
  {
    name: "kraken_module_export",
    description:
      "FG's module export (/export): the campaign's own records into a Maelstrom pack (.kpack, its module) in the packs folder, under the game's folder (or Any), so another campaign makes it active in Modules (GM only). types: whole kinds (image: the campaign's images and maps, each with its picture (Map Studio's painted one, if any), walls, doors, lights and grid, opening in the other campaign as the same map; npc, item, itemtemplate, spell, vehicle, character (as pregenerated characters), story (as story entries), battle (encounters), treasureparcel, table, class, race, race_subrace, background, feat...); ids: single records. Links between exported records point into the pack; other pictures (an NPC's portrait) keep pointing where they are. name (required, also the file's name), title, category, author, anyGame (any game's campaigns), forPlayers (the players may read it; else the GM's, or an adventure when it has story). A pack not exported from a campaign is never written over. Returns the file and what it holds.",
    inputSchema: object(
      {
        name: string("The module's name (its file's name too)"),
        title: string("Its title in the lists (default the name)"),
        category: string("Its category (default Campaign Exports)"),
        author: string("Its author"),
        types: { type: "array", items: { type: "string" }, description: "Whole kinds of the campaign's records" },
        ids: { type: "array", items: { type: "string" }, description: "Single records by id" },
        anyGame: { type: "boolean", description: "For any game's campaigns, not only this game's" },
        forPlayers: { type: "boolean", description: "The players may read it" },
      },
      ["name"],
    ),
    run: async (args, ctx) => out(content.moduleExport(needTable(ctx), args)),
  },
  {
    name: "kraken_bastion",
    description:
      "Bastions (5E 2024, on when the house rule HRBASTION is): a character's bastion and its facilities, as the party sheet's Bastion tab. action name (character, name: the bastion's), add (character, name, or link: a record (a location) as a facility), rename (character, facility, name), remove (character, facility), order (character, facility, order: Craft, Empower, Harvest, Maintain, Recruit, Research or Trade; the same order again adds a turn), clear (character, facility: no order), advance (the bastion turn: the log gets it, every order counts down a turn), log (the log and turn), log-clear, turn (turn: the count). Returns the bastion, or the log.",
    inputSchema: object({
      action: { type: "string", enum: ["name", "add", "rename", "remove", "order", "clear", "advance", "log", "log-clear", "turn"] },
      character: string("The character's id"),
      facility: string("A facility's key (id-00001)"),
      name: string("A name"),
      order: string("Craft, Empower, Harvest, Maintain, Recruit, Research or Trade"),
      link: { type: "object", description: "A record as a facility: { kind: record, record, label }" },
      turn: number("The turn count"),
    }, ["action"]),
    run: (args, ctx) => out(require("../bastion.cjs").bastionAction(needTable(ctx), { role: "dm", name: "GM" }, args)),
  },
  {
    name: "kraken_module_set",
    description:
      "FG's module sets (its Modules window's export and import): the books active in this campaign, and those shared with the players, kept by name with the GM for any campaign of the game. action list; save (name: what is active and shared now); apply (name: makes active and shares what the set names, makes inactive the rest; missing: books of the set not on this computer); remove (name).",
    inputSchema: object({ action: { type: "string", enum: ["list", "save", "apply", "remove"] }, name: string("The set's name") }, ["action"]),
    run: async (args, ctx) => out(await needTable(ctx).moduleSet(args)),
  },
];

module.exports = { TOOLS };
