// What a campaign's own records can be exported as in a pack (electron/exportPack.cjs; the Modules window's
// Export): the kinds a book's records bring to a campaign and the kinds its lists read, and the kind each is kept
// as in the book (FG's: story entries, treasure parcels, tables, pregenerated characters).
export const BOOK_TYPE = { story: "encounter", treasureparcel: "treasureparcels", table: "tables", character: "pregencharsheet" };
export const EXPORTABLE = ["npc", "item", "itemtemplate", "spell", "vehicle", "character", "story", "battle", "treasureparcel", "table", "class", "class_specialization", "race", "race_subrace", "background", "feat", "skill", "siegepackage", "siegepower", "fateskill", "fatestunt", "ironmove", "ironasset", "ironoracle", "irondelve", "playbook", "crewtype", "cairntable", "forgedtable"];
