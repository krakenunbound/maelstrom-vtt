import { categoryOf, categoryOrder } from "../../shared/records/categorize.mjs";
import { rulesetFor } from "../../shared/rulesets/registry.mjs";
import { castsSpell as castsBy, spellCasters } from "../../shared/rulesets/summary.mjs";
import { Fragment, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { inlineRollNodes } from "../ui/InlineRolls";
import type { QuickSlot, Session, TableRecord } from "../session/useSession";
import { Icon } from "../ui/icons";
import { linkFrom, SLOT_DRAG, slotDrag, TABLE_RESULT_DRAG, useOpenLink } from "../ui/QuickSlots";
import { recordLabel, statblockFor } from "../rulesets/statblocks";
import { useBookWindows, useContextMenu, usePictureActions } from "./Books";
import { ReadAloudButton } from "./readAloud";
import { decodeEntities, isFormatted, linkOfRecordname } from "../../shared/text/formatted.mjs";
import { LinkChip } from "../core/fields/RichText";
import { CORE_VIEWS, DropZone, IdentifyBar, openUnlocked, RecordFields, ShareMenu, TableEditor, TableRollBar, useRecordActions, useRecordMenu } from "./RecordEditor";
import { GM } from "../ui/gmTitle";

// FG's campaign lists (the sidebar's Campaign and Character groups, each a
// master index): the records of this campaign and its active books, a list per
// kind, grouped by category. The GM sees them all and shares one with the
// players or hides it again (FG's Share and Unshare, and the list's sharing
// icon); the All / Shared button shows only what is shared. A player sees only
// what is shared with them (FG's player lists), read only. A name opens the
// record; it is a link (drag it to a quick slot, a note or a story).

// The lists, in FG's order: what a record's type (and, for C&C's packages, its
// package type) is listed under.
const LISTS: { id: string; label: string; group: string }[] = [
  { id: "npc", label: "NPCs", group: "Campaign" },
  { id: "item", label: "Items", group: "Campaign" },
  { id: "itemtemplate", label: "Item Templates", group: "Campaign" },
  { id: "background", label: "Backgrounds", group: "Character" },
  { id: "class", label: "Classes", group: "Character" },
  { id: "class_specialization", label: "Subclasses", group: "Character" },
  { id: "feat", label: "Feats", group: "Character" },
  { id: "skill", label: "Skills", group: "Character" },
  { id: "race", label: "Races", group: "Character" },
  { id: "race_subrace", label: "Subraces", group: "Character" },
  { id: "spell", label: "Spells", group: "Character" },
  // Forged in the Dark: the playbooks and the crew types.
  { id: "playbook", label: "Playbooks", group: "Character" },
  { id: "crewtype", label: "Crew Types", group: "Character" },
  { id: "siegepackage:class", label: "Classes", group: "Character" },
  { id: "siegepackage:race", label: "Races", group: "Character" },
  { id: "siegepackage", label: "Packages", group: "Character" },
  { id: "siegepower", label: "Spells", group: "Character" },
  // Fate: the skills (FAE's approaches) and stunts.
  { id: "fateskill", label: "Skills", group: "Character" },
  { id: "fatestunt", label: "Stunts", group: "Character" },
  // Ironsworn and Starforged (their Reference books).
  { id: "ironmove", label: "Moves", group: "Character" },
  { id: "ironasset", label: "Assets", group: "Character" },
  { id: "ironoracle", label: "Oracles", group: "Campaign" },
  { id: "irondelve", label: "Delve Themes and Domains", group: "Campaign" },
  // The core's own kinds (the campaign's story, tables, quests, encounters and parcels).
  { id: "story", label: "Story", group: "Campaign" },
  { id: "table", label: "Tables", group: "Campaign" },
  { id: "quest", label: "Quests", group: "Campaign" },
  { id: "battle", label: "Encounters", group: "Campaign" },
  { id: "treasureparcel", label: "Parcels", group: "Campaign" },
  // FG's Vehicles (ships and wagons, starships and tanks) and Locations (places, with what is in them).
  { id: "vehicle", label: "Vehicles", group: "Campaign" },
  { id: "location", label: "Locations", group: "World" },
];
// Not lists: what has its own window (characters, the party, notes) or is the game's own setup.

// FG's list filters from a record's own fields (5E's spell level and ritual, an NPC's CR, an item's rarity and
// attunement): each shown only when the list's records hold two values or more of it; no game is named here.
type FieldFilter = { key: string; label: string; all: string; value: (data: Record<string, unknown>) => string; show?: (value: string) => string; order?: (a: string, b: string) => number };
const plainField = (key: string) => (data: Record<string, unknown>) => String(data[key] ?? "").replace(/<[^>]+>/g, "").trim();
const crValue = (value: string) => (/^\d+\/\d+$/.test(value) ? Number(value.split("/")[0]) / Number(value.split("/")[1]) : Number(value) || 0);
const FIELD_FILTERS: Record<string, FieldFilter[]> = {
  spell: [
    { key: "level", label: "Level", all: "All levels", value: plainField("level"), show: (value) => (value === "0" ? "Cantrips" : `Level ${value}`), order: (a, b) => Number(a) - Number(b) },
    { key: "ritual", label: "Ritual", all: "Ritual or not", value: (data) => (/^(1|yes|true)$/i.test(String(data.ritual ?? "")) || /ritual/i.test(String(data.castingtime ?? "")) ? "Ritual" : "Not a ritual") },
  ],
  npc: [{ key: "cr", label: "CR", all: "Every CR", value: plainField("cr"), show: (value) => `CR ${value}`, order: (a, b) => crValue(a) - crValue(b) }],
  item: [
    { key: "rarity", label: "Rarity", all: "Every rarity", value: (data) => String(data.rarity ?? "").replace(/\(.*\)/, "").replace(/<[^>]+>/g, "").trim() },
    { key: "attunement", label: "Attunement", all: "Attunement or not", value: (data) => (String(data.rarity ?? "") ? (/attunement/i.test(`${String(data.rarity ?? "")} ${String(data.description ?? "")}`) ? "Requires attunement" : "No attunement") : "") },
  ],
};

const NOT_LISTED = new Set(["character", "party", "note", "siegegame", "fatetable"]);

// A new record for a list: its type, and for C&C's Classes and Races the package's kind.
// A new vehicle or location starts with FG's fields, to fill in.
const STARTER: Record<string, Record<string, string | number>> = {
  // FG 5E's vehicle record (record_vehicle.xml): type, size, cost, crew, cargo; AC and its words, hit points, the damage and mishap thresholds, speed; resistances and immunities.
  vehicle: { type: "", size: "", cost: "", crew: "", cargo: "", ac: 0, actext: "", hp: 0, damagethreshold: 0, mishapthreshold: 0, speed: "", damageresistances: "", damageimmunities: "", conditionimmunities: "", text: "" },
  // FG's location (CoreRPG record_location.xml): a place, its type, its words and the GM's notes; the places inside it are links in its text.
  location: { type: "", text: "", gmnotes: "" },
};
function recordFor(list: string, name: string) {
  const [type, kind] = list.split(":");
  return { type, name, visibility: "gm" as const, data: kind ? { packagetype: kind[0].toUpperCase() + kind.slice(1) } : { ...(STARTER[type] ?? {}) } };
}
// A record a book's page links to (FG opens it from the book): the campaign's
// copy when the book is active (its live record), else the book's own.
export function BookRecordWindow({ session, book, path }: { session: Session; book: string; path: string }) {
  const live = Object.values(session.records).find((item) => item.data?.fgPath === path);
  const [read, setRead] = useState<TableRecord | null>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    if (live) return;
    let current = true;
    session
      .bookFetch<{ id: string; type: string; name: string; source: string; data: Record<string, unknown> }>("record", { book, path })
      .then((found) => current && setRead({ id: found.id, type: found.type, name: found.name, source: found.source, data: found.data, owner: "", visibility: "gm" } as unknown as TableRecord))
      .catch((error) => current && setProblem(error instanceof Error ? error.message : String(error)));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, path, Boolean(live)]);
  if (live) return <RecordWindow session={session} id={live.id} />;
  if (problem) return <p className="hint record-window">{problem}</p>;
  if (!read) return <p className="hint record-window">Opening…</p>;
  return <RecordWindow session={session} id={read.id} record={read} book={book} />;
}

// FG's grouped list (a 5E book's Armor Table, Weapons Table): sections, each a
// table of its items' short fields, an item's name its link.
type GroupRow = { name: string; link: string; cells: Record<string, string> };
function groupsOf(data: Record<string, unknown>) {
  const groupsIn = data.groups;
  if (!groupsIn || typeof groupsIn !== "object") return null;
  const groups = Object.keys(groupsIn as object)
    .sort()
    .map((key) => {
      const group = (groupsIn as Record<string, Record<string, unknown>>)[key] ?? {};
      const listKey = Object.keys(group).find((name) => group[name] && typeof group[name] === "object" && name !== "link");
      const rowsIn = (listKey ? group[listKey] : {}) as Record<string, Record<string, unknown>>;
      const rows: GroupRow[] = Object.values(rowsIn)
        .filter((row) => row && typeof row === "object")
        .map((row) => ({
          name: String(row.name ?? ""),
          link: String((row.link as { recordname?: string } | undefined)?.recordname ?? ""),
          cells: Object.fromEntries(Object.entries(row).filter(([name, value]) => name !== "name" && name !== "link" && (typeof value === "string" || typeof value === "number")).map(([name, value]) => [name, String(value)])),
        }));
      const columns = [...new Set(rows.flatMap((row) => Object.keys(row.cells)))];
      return { title: String(group.description ?? ""), columns, rows };
    })
    .filter((group) => group.rows.length);
  return groups.length ? groups : null;
}

// An FG table (its column labels, die and rows of results), as FG's table window shows it.
const TABLE_FIELDS = /^(tablerows|labelcol[0-9]+|resultscols|dice|mod|hiderollresults|output|table_positionoffset|description)$/;
function tableOf(data: Record<string, unknown>) {
  const rowsIn = data.tablerows;
  if (!rowsIn || typeof rowsIn !== "object") return null;
  const columns = Math.max(1, Number(data.resultscols) || 1);
  const labels = Array.from({ length: columns }, (_, index) => String(data[`labelcol${index + 1}`] ?? (columns === 1 ? "Result" : "")));
  const rows = Object.values(rowsIn as Record<string, { fromrange?: number; torange?: number; results?: Record<string, { result?: string }> }>)
    .map((row) => ({ from: Number(row.fromrange) || 0, to: Number(row.torange) || Number(row.fromrange) || 0, results: Object.keys(row.results ?? {}).sort().map((key) => String(row.results?.[key]?.result ?? "")) }))
    .sort((a, b) => a.from - b.from);
  return { dice: String(data.dice ?? "").trim(), labels, rows };
}

export function listOf(record: TableRecord) {
  if (record.type === "siegepackage") {
    const kind = String(record.data.packagetype ?? "").toLowerCase();
    if (kind === "class" || kind === "race") return `siegepackage:${kind}`;
  }
  return record.type;
}
function listLabel(id: string) {
  return LISTS.find((item) => item.id === id)?.label ?? id.replace(/^siegepackage:/, "").replace(/[_-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

// Shared: with everyone, or with some of the players.
const shared = (record: TableRecord) => record.visibility === "all" || (Array.isArray(record.visibility) && record.visibility.length > 0);
const LIMIT = 400;

// The lists the sidebar shows in a group (FG's Campaign and Character
// categories): those this table has records for, in FG's order.
// A game's own word for a list (its manifest's records: Descending Darkness calls species "Kin").
export function sidebarLists(records: Record<string, TableRecord>, group: string, ruleset = "") {
  const present = new Set<string>();
  for (const record of Object.values(records)) if (!NOT_LISTED.has(record.type)) present.add(listOf(record));
  return LISTS.filter((item) => item.group === group && present.has(item.id)).map((item) => ({ id: item.id, label: recordLabel(ruleset, item.id) ?? item.label }));
}
export { listLabel };

// only: the sidebar's list (one window a list, as FG's); without it, every
// list with a button for each.
export function RecordsWindow({ session, onOpen, only }: { session: Session; onOpen: (record: TableRecord) => void; only?: string }) {
  const gm = session.role === "dm";
  const all = useMemo(() => Object.values(session.records).filter((record) => !NOT_LISTED.has(record.type)), [session.records]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const record of all) map.set(listOf(record), (map.get(listOf(record)) ?? 0) + 1);
    return map;
  }, [all]);
  const lists = [...LISTS.filter((item) => counts.has(item.id)).map((item) => item.id), ...[...counts.keys()].filter((id) => !LISTS.some((item) => item.id === id)).sort()];
  const [chosen, setChosen] = useState("");
  const list = only ?? (lists.includes(chosen) ? chosen : lists[0] ?? "");
  const [search, setSearch] = useState("");
  const [sharedOnly, setSharedOnly] = useState(false);
  const [status, setStatus] = useState("");
  const [newName, setNewName] = useState("");
  const wanted = search.trim().toLowerCase();
  // Grouped by type (Weapons, Armor & Shields...; Humanoids, Undead...; Level 1...) or by book; filtered by either.
  const [groupChoice, setGroupBy] = useState<"type" | "book" | "group" | null>(null);
  // FG's list groups: the GM's own categories, kept with the campaign (the table's options), any record in one.
  const [groupWanted, setGroupWanted] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [typeWanted, setTypeWanted] = useState("");
  const [bookWanted, setBookWanted] = useState("");
  // Spells: by school, and by the class that casts them.
  const [schoolWanted, setSchoolWanted] = useState("");
  const [classWanted, setClassWanted] = useState("");
  const [fieldWanted, setFieldWanted] = useState<Record<string, string>>({});
  // Another list: its own types and books, so the filters start again.
  useEffect(() => {
    setTypeWanted("");
    setBookWanted("");
    setSchoolWanted("");
    setFieldWanted({});
    setClassWanted("");
    setGroupBy(null);
  }, [list]);
  const inList = useMemo(() => all.filter((record) => listOf(record) === list).map((record) => ({ record, ...categoryOf(record), book: record.source || "Campaign" })), [all, list]);
  // Lists with types of their own (items, creatures, spells) start by type; the rest by book.
  const typed = inList.some((row) => ["item", "npc", "spell", "spelldesc"].includes(row.record.type));
  const spells = inList.some((row) => row.record.type === "spell" || row.record.type === "spelldesc");
  // Which classes cast a spell: as the campaign's game declares it (its manifest's spells.casters).
  const game = rulesetFor(session.ruleset ?? "");
  const spellClasses = (record: TableRecord) => spellCasters(game, record);
  const castsSpell = (name: string, record: TableRecord) => castsBy(game, name, record);
  // A player sees the spells their own characters' classes cast, and none if they cast none.
  const me = session.players.find((seat) => seat.id === session.selfId)?.name ?? "";
  const myClasses = useMemo(
    () => (gm ? [] : session.roster.filter((entry) => entry.owner === me).flatMap((entry) => entry.classes.split(/\s*\/\s*/).map((name) => name.replace(/\d+/g, "").trim()).filter(Boolean))),
    [gm, session.roster, me],
  );
  const mine = (record: TableRecord) => gm || myClasses.some((name) => castsSpell(name, record));
  const schoolNames = useMemo(() => (spells ? [...new Set(inList.map((row) => row.sub).filter(Boolean))].sort() : []), [inList, spells]);
  const classNames = useMemo(() => (spells ? [...new Set(inList.filter((row) => mine(row.record)).flatMap((row) => spellClasses(row.record)))].sort() : []), [inList, spells, myClasses]);
  const groupNames = (session.options.groupNames ?? {})[list] ?? [];
  const recordGroups = session.options.recordGroups ?? {};
  const groupOf = (record: TableRecord) => (groupNames.includes(recordGroups[record.id] ?? "") ? recordGroups[record.id] : "");
  const setGroups = (names: string[], moves: Record<string, string | null> = {}) => {
    const nextGroups = { ...recordGroups };
    for (const [id, name] of Object.entries(moves)) {
      if (name) nextGroups[id] = name;
      else delete nextGroups[id];
    }
    session.setTableOptions({ groupNames: { ...(session.options.groupNames ?? {}), [list]: names }, recordGroups: nextGroups } as never);
  };
  const groupBy = groupChoice === "group" && !groupNames.length ? (typed ? "type" : "book") : groupChoice ?? (typed ? "type" : "book");
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of inList) if (row.category && (!bookWanted || row.book === bookWanted)) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    return [...counts].sort((a, b) => categoryOrder(a[0], b[0]));
  }, [inList, bookWanted]);
  const bookNames = useMemo(() => [...new Set(inList.map((row) => row.book))].sort((a, b) => (a === "Campaign" ? -1 : b === "Campaign" ? 1 : a.localeCompare(b))), [inList]);
  // The record-field filters this list has (two values or more among its records).
  const fieldFilters = (FIELD_FILTERS[list] ?? [])
    .map((filter) => ({ filter, values: [...new Set(inList.map((row) => filter.value((row.record.data ?? {}) as Record<string, unknown>)).filter(Boolean))].sort(filter.order ?? ((a, b) => a.localeCompare(b))) }))
    .filter((item) => item.values.length > 1);
  const picked = inList
    .filter((row) => !groupWanted || (groupWanted === "-" ? !groupOf(row.record) : groupOf(row.record) === groupWanted))
    .filter((row) => fieldFilters.every(({ filter }) => !fieldWanted[filter.key] || filter.value((row.record.data ?? {}) as Record<string, unknown>) === fieldWanted[filter.key]))
    .filter((row) => (!wanted || row.record.name.toLowerCase().includes(wanted)) && (!sharedOnly || shared(row.record)) && (!typeWanted || row.category === typeWanted) && (!bookWanted || row.book === bookWanted))
    .filter((row) => !spells || ((!schoolWanted || row.sub === schoolWanted) && (!classWanted || castsSpell(classWanted, row.record) || spellClasses(row.record).includes(classWanted)) && mine(row.record)))
    .sort((a, b) => a.record.name.localeCompare(b.record.name));
  const rows = picked.map((row) => row.record);
  // By type: the type, then its kind within (Martial Melee, Magic; Human; Evocation). By book: the book, then the type.
  const groups = new Map<string, Map<string, TableRecord[]>>();
  for (const row of picked.slice(0, LIMIT)) {
    const head = groupBy === "group" ? groupOf(row.record) || "Uncategorized" : groupBy === "type" ? row.category || row.book : row.book;
    const sub = groupBy === "group" ? "" : groupBy === "type" ? (row.category ? row.sub : "") : row.category;
    const inHead = groups.get(head) ?? new Map<string, TableRecord[]>();
    inHead.set(sub, [...(inHead.get(sub) ?? []), row.record]);
    groups.set(head, inHead);
  }
  for (const [head, subs] of groups) groups.set(head, new Map([...subs].sort((a, b) => (a[0] === "" ? -1 : b[0] === "" ? 1 : groupBy === "book" ? categoryOrder(a[0], b[0]) : a[0].localeCompare(b[0])))));
  const books = [...groups.keys()].sort((a, b) => (groupBy === "type" ? categoryOrder(a, b) : a === "Campaign" ? -1 : b === "Campaign" ? 1 : a.localeCompare(b)));
  const recordMenu = useRecordMenu(session);

  return (
    <div className={only ? "records-window single" : "records-window"} data-window="records" data-records-only={only}>
      {only ? null : <nav className="records-lists" aria-label="Lists">
        {lists.length === 0 ? <p className="hint">{gm ? "Nothing yet: make a book active (Modules) or add NPCs and items." : GM("The GM has shared nothing yet.")}</p> : null}
        {lists.map((id) => (
          <button key={id} type="button" className={id === list ? "on" : ""} aria-pressed={id === list} data-records-list={id} onClick={() => setChosen(id)}>
            {listLabel(id)} <small>{counts.get(id)}</small>
          </button>
        ))}
      </nav>}
      <section className="records-main">
        <div className="records-head">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" aria-label="Search the list" />
          {typeCounts.length > 1 ? (
            <select aria-label="Type" data-filter="type" value={typeWanted} onChange={(event) => setTypeWanted(event.target.value)} title="Show one type">
              <option value="">All types</option>
              {typeCounts.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
          ) : null}
          {schoolNames.length > 1 ? (
            <select aria-label="School" data-filter="school" value={schoolWanted} onChange={(event) => setSchoolWanted(event.target.value)} title="Show one school of magic">
              <option value="">All schools</option>
              {schoolNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : null}
          {classNames.length > 1 ? (
            <select aria-label="Class" data-filter="class" value={classWanted} onChange={(event) => setClassWanted(event.target.value)} title="Show the spells one class casts">
              <option value="">All classes</option>
              {classNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : null}
          {fieldFilters.map(({ filter, values }) => (
            <select key={filter.key} aria-label={filter.label} data-filter={filter.key} value={fieldWanted[filter.key] ?? ""} onChange={(event) => setFieldWanted((now) => ({ ...now, [filter.key]: event.target.value }))} title={`Show one ${filter.label.toLowerCase()}`}>
              <option value="">{filter.all}</option>
              {values.map((value) => (
                <option key={value} value={value}>
                  {filter.show ? filter.show(value) : value}
                </option>
              ))}
            </select>
          ))}
          {bookNames.length > 1 ? (
            <select aria-label="Book" data-filter="book" value={bookWanted} onChange={(event) => setBookWanted(event.target.value)} title="Show one book's">
              <option value="">All books</option>
              {bookNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : null}
          {groupNames.length ? (
            <select aria-label="Group" data-filter="group" value={groupWanted} onChange={(event) => setGroupWanted(event.target.value)} title="Show one of your groups">
              <option value="">All groups</option>
              {groupNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="-">Uncategorized</option>
            </select>
          ) : null}
          {groupNames.length ? (
            <button type="button" className={groupBy === "group" ? "ghost on" : "ghost"} data-action="records-by-group" aria-pressed={groupBy === "group"} title="Grouped by your own groups" onClick={() => setGroupBy(groupBy === "group" ? null : "group")}>
              By group
            </button>
          ) : null}
          <button type="button" className="ghost" data-action="records-group" title={groupBy === "type" ? "Grouped by type: click to group by book" : "Grouped by book: click to group by type"} onClick={() => setGroupBy(groupBy === "type" ? "book" : "type")}>
            {groupBy === "type" ? "By type" : "By book"}
          </button>
          {gm ? (
            <button type="button" className={sharedOnly ? "on" : ""} aria-pressed={sharedOnly} data-action="records-shared-only" title="Filter by sharing mode" onClick={() => setSharedOnly(!sharedOnly)}>
              {sharedOnly ? "Shared" : "All"}
            </button>
          ) : null}
        </div>
        {gm && list ? (
          // FG's groups: chips to drop records on (or click to show), a new group, × to take one away.
          <div className="records-groups cc-inline" aria-label="Groups">
            {groupNames.map((name) => (
              <span
                key={name}
                className={groupWanted === name ? "records-group-chip on" : "records-group-chip"}
                data-group={name}
                title={`${name}: drop a record here to put it in; click to show only it`}
                onClick={() => setGroupWanted(groupWanted === name ? "" : name)}
                onDragOver={(event) => {
                  if ([...event.dataTransfer.types].includes(SLOT_DRAG)) event.preventDefault();
                }}
                onDrop={(event) => {
                  const link = linkFrom(event);
                  if (link?.kind !== "record" || !link.record) return;
                  event.preventDefault();
                  setGroups(groupNames, { [link.record]: name });
                }}
              >
                {name}
                <button type="button" className="ghost" aria-label={`Remove the group ${name}`} title="Remove the group (its records become uncategorized)" onClick={(event) => {
                  event.stopPropagation();
                  if (groupWanted === name) setGroupWanted("");
                  setGroups(groupNames.filter((item) => item !== name), Object.fromEntries(Object.entries(recordGroups).filter(([, group]) => group === name).map(([id]) => [id, null])));
                }}>
                  ×
                </button>
              </span>
            ))}
            <form onSubmit={(event) => {
              event.preventDefault();
              const name = newGroup.trim().slice(0, 40);
              if (name && !groupNames.includes(name)) setGroups([...groupNames, name]);
              setNewGroup("");
            }}>
              <input value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="New group" aria-label="New group" />
              <button type="submit" disabled={!newGroup.trim()} data-action="records-new-group">
                + Group
              </button>
            </form>
          </div>
        ) : null}
        {gm && list === "npc" ? <NpcImport session={session} onMade={(record) => onOpen(record)} /> : null}
        {gm && list === "race" && rulesetFor(session.ruleset ?? "").raceImport ? <RaceImport session={session} onMade={(record) => onOpen(record)} /> : null}
        {gm && (list === "item" || list === "itemtemplate") && rulesetFor(session.ruleset ?? "").forge ? <ItemForge session={session} onMade={(record) => onOpen(record)} /> : null}
        {gm && only ? (
          // FG's + on a campaign list: a new record of the list's kind, opened to fill in.
          <form
            className="records-new cc-inline"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newName.trim();
              if (!name) return;
              void session
                .op({ op: "create", input: recordFor(only, name) })
                .then((id) => {
                  setNewName("");
                  // A new record opens with its lock open, to fill in.
                  if (id) openUnlocked.add(String(id));
                  if (id) onOpen({ id: String(id), name, type: only } as TableRecord);
                })
                .catch((error) => setStatus(error instanceof Error ? error.message : "Could not make that."));
            }}
          >
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={`New ${listLabel(only).replace(/s$/, "")}`} aria-label={`New ${listLabel(only).replace(/s$/, "")} name`} />
            <button type="submit" data-action="record-new" title={`Make a new ${listLabel(only).replace(/s$/, "").toLowerCase()}`} disabled={!newName.trim()}>
              <Icon name="plus" size={15} /> New
            </button>
          </form>
        ) : null}
        {status ? (
          <p className="hint" role="status">
            {status}
          </p>
        ) : null}
        <div className="records-list">
          {books.map((book) => (
            <section key={book} data-records-book={book}>
              <h4>{book}</h4>
              {[...(groups.get(book) ?? [])].map(([category, items]) => (
              <Fragment key={category}>
              {category ? <h5 className="records-category">{category}</h5> : null}
              {items.map((record) => (
                <div key={record.id} className="records-row" data-record-row={record.id} onContextMenu={gm ? (event) => recordMenu.show(event, record) : undefined}>
                  {gm ? <ShareMenu session={session} record={record} /> : null}
                  <button type="button" className="records-name" title={gm ? `Open ${record.name} (right-click: Duplicate, Delete)` : `Open ${record.name}`} onClick={() => onOpen(record)} {...slotDrag({ kind: "record", record: record.id, label: record.name })}>
                    {record.name}
                  </button>
                </div>
              ))}
              </Fragment>
              ))}
            </section>
          ))}
          {rows.length > LIMIT ? <p className="hint">{rows.length - LIMIT} more: search to narrow the list.</p> : null}
          {list && rows.length === 0 ? <p className="hint" data-records-empty>{sharedOnly ? "Nothing in this list is shared." : wanted ? "Nothing by that name." : spells && !gm && inList.length > 0 ? (myClasses.length ? "Your character's class casts none of these spells." : "Take a character first: you see the spells its class casts.") : gm ? "Nothing here yet: make a book active (Modules)." : GM("The GM has shared nothing here yet.")}</p> : null}
          {recordMenu.element}
        </div>
      </section>
    </div>
  );
}

// FG's formatted text, as elements: only the tags FG's text uses, never raw
// HTML (a record's text comes from a module or another seat).
const TAGS: Record<string, string> = { p: "p", b: "b", strong: "b", i: "i", em: "i", u: "u", h: "h4", list: "ul", ul: "ul", ol: "ol", li: "li", table: "table", tr: "tr", td: "td", th: "th", frame: "blockquote", linklist: "ul", sup: "sup", sub: "sub" };
// A link in a record's text: followed when the record is a book's (onLink), else shown as its words;
// a Kraken link (a chip the editor made: a page, a picture, a sound...) opens with onOpen.
type OnLink = (linkClass: string, recordname: string, words: string) => void;
type OnOpen = (link: QuickSlot) => void;
function nodes(parent: Node, key = "n", onLink?: OnLink, onOpen?: OnOpen): ReactNode[] {
  const out: ReactNode[] = [];
  parent.childNodes.forEach((child, index) => {
    const id = `${key}.${index}`;
    // Words, with their dice as roll chips ([[1d20+3]], 2d6 + 3).
    if (child.nodeType === 3 || child.nodeType === 4) out.push(...inlineRollNodes(child.nodeValue ?? "", id));
    if (child.nodeType !== 1) return;
    const tag = (child as Element).tagName.toLowerCase();
    if (tag === "br") return void out.push(<br key={id} />);
    const inner = nodes(child, id, onLink, onOpen);
    if (tag === "link") {
      const element = child as Element;
      const words = element.textContent?.trim() || "Link";
      const kraken = linkOfRecordname(element.getAttribute("recordname"));
      if (kraken) return void out.push(onOpen ? <LinkChip key={id} link={kraken as QuickSlot} words={words} onOpen={onOpen} /> : <span key={id} className="rt-chip">{words}</span>);
      return void out.push(
        onLink ? (
          <a key={id} href="#" className="record-link" onClick={(event) => (event.preventDefault(), onLink(element.getAttribute("class") ?? "", element.getAttribute("recordname") ?? "", words))}>
            {words}
          </a>
        ) : (
          <span key={id} className="record-link">{words}</span>
        ),
      );
    }
    const html = TAGS[tag];
    if (!html) return void out.push(<Fragment key={id}>{inner}</Fragment>);
    // A list of links: one row a link (the spaces between them are not rows).
    if (tag === "linklist") return void out.push(<ul key={id}>{inner.filter((item) => typeof item !== "string" || item.trim()).map((item, n) => <li key={n}>{item}</li>)}</ul>);
    // FG's boxed text (read-aloud): the GM reads it to the table with a click.
    if (tag === "frame") {
      const words = (child as Element).textContent ?? "";
      return void out.push(
        <blockquote key={id} className="read-aloud-frame">
          <ReadAloudButton text={() => words} />
          {inner}
        </blockquote>,
      );
    }
    const Tag = html as "p";
    out.push(tag === "table" ? <table key={id}><tbody>{inner}</tbody></table> : <Tag key={id}>{inner}</Tag>);
  });
  return out;
}
export function FormattedText({ text, onLink, onOpen }: { text: string; onLink?: OnLink; onOpen?: OnOpen }) {
  const content = useMemo(() => {
    // An old note's plain words: a paragraph a line.
    if (!isFormatted(text)) return decodeEntities(text).split("\n").map((line, index) => <p key={index}>{line}</p>);
    const xml = new DOMParser().parseFromString(`<root>${text}</root>`, "application/xml");
    const root = xml.getElementsByTagName("parsererror").length ? new DOMParser().parseFromString(text, "text/html").body : xml.documentElement;
    return nodes(root, "n", onLink, onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return <div className="formatted-text">{content}</div>;
}

// The fields a record window leaves out: FG's bookkeeping, or shown on their own.
const HIDDEN = new Set(["name", "fgPath", "fgCategory", "version", "picture", "public", "token", "isidentified", "locked", "ccgen", "nonid_name", "nonidentified", "abilities", "packagetype", "token3Dflat", "text"]);
const LABELS: Record<string, string> = { savingthrows: "Saving throws", abilityadjust: "Ability increases", castingtime: "Casting time", ac: "AC", hp: "Hit points", hd: "Hit dice", cr: "Challenge", xp: "XP", acbonus: "AC bonus", bth: "BtH", subtype: "Subtype", damagetype: "Damage type" };
const labelOf = (key: string) => LABELS[key] ?? key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
const isText = (value: unknown) => typeof value === "string" && /<\/?(p|b|i|h|list|li|table|frame|linklist)\b/.test(value);
const STATS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

// One record, read only (FG's record window as a player sees it; the GM's
// with the share button). Its short fields as a table, a creature's abilities
// in a row, its actions and traits as lists, its text as FG wrote it.
export function RecordWindow({ session, id, record: given, book }: { session: Session; id: string; record?: TableRecord; book?: string }) {
  const record = given ?? session.records[id];
  const { openBook, openRecord } = useBookWindows();
  // A book's record: its links go where the book's own do (a page, or another record of the book).
  const onLink: OnLink | undefined = book
    ? (linkClass, recordname, words) => {
        const [inner, moduleName] = recordname.split("@");
        if (moduleName && given?.source && moduleName !== given.source && !String(given.id).endsWith(`@${moduleName}`)) return;
        const page = /^reference\.refmanualdata\.([^.]+)$/.exec(inner);
        if (page) openBook(book, given?.source ?? "Book", page[1]);
        else if (!/^image\./.test(inner) && linkClass !== "imagewindow") openRecord(book, `${inner}@${String(given?.id ?? "").split("@").slice(1).join("@")}`, words);
      }
    : undefined;
  // FG's lock: shut, the record is read; open (the pencil), it is edited. A new record opens with it open.
  const [unlocked, setUnlocked] = useState(() => openUnlocked.delete(id));
  const actions = useRecordActions(session);
  const openLink = useOpenLink(session);
  const [status, setStatus] = useState("");
  const pictureActions = usePictureActions(session);
  const pictureMenu = useContextMenu();
  if (!record) return <p className="hint record-window">This is not shown to you any more.</p>;
  // A record read from a book (a page's link) is the book's: shown, not shared or edited.
  const gm = session.role === "dm" && !given;
  const me = session.players.find((seat) => seat.id === session.selfId)?.name ?? "";
  // The GM, or the record's owner (records.cjs canEdit), edits the campaign's own records.
  const canEdit = !given && (session.role === "dm" || (record.owner !== "" && record.owner === me));
  const editing = canEdit && unlocked;
  const CoreView = CORE_VIEWS[record.type];
  const data = record.data ?? {};
  const fields: [string, string][] = [];
  const texts: [string, string][] = [];
  const lists: [string, { name: string; desc: string }[]][] = [];
  for (const [key, value] of Object.entries(data)) {
    // FG's bookkeeping as values: a list it keeps elsewhere (true), an unused number (0).
    if ((data.tablerows && TABLE_FIELDS.test(key)) || (data.groups && (key === "groups" || key === "description")) || HIDDEN.has(key) || value === null || value === undefined || value === "" || value === true || value === 0) continue;
    if (isText(value)) texts.push([key, String(value)]);
    else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") fields.push([key, String(value === false ? "No" : value)]);
    else if (typeof value === "object") {
      const rows = Object.values(value as Record<string, unknown>).filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && typeof (row as { name?: unknown }).name === "string");
      if (rows.length && rows.every((row) => typeof row.desc === "string" || typeof row.description === "string" || typeof row.text === "string"))
        lists.push([key, rows.map((row) => ({ name: String(row.name), desc: String(row.desc ?? row.description ?? row.text ?? "") }))]);
    }
  }
  // An NPC's description (FG's text), first; and its portrait from its book.
  const npc = record.type === "npc";
  // The game's own block for an NPC, the GM's (Traveller's), instead of the core's fields.
  const Block = gm && npc ? statblockFor(session.ruleset, "npc") : null;
  // The campaign's own record's text (its editor's Description) too, and a book's story entry's (a map pin's
  // room: FG keeps its whole text there).
  if (typeof data.text === "string" && data.text.trim()) texts.unshift(["description", data.text]);
  // A creature's portrait, an item's or a vehicle's picture (each from its own book).
  const pictured = npc || record.type === "item" || record.type === "itemtemplate" || record.type === "vehicle";
  const portrait = pictured && (data.picture || data.token) ? session.recordArtUrl(record.id, "portrait") : "";
  // The picture's file in its book ("mm/images/Goblin.webp@B2 ..."), to open full size and share.
  const pictureRef = String(data.picture || data.token || "");
  const pictureBook = pictureRef.split("@")[1]?.trim() || record.source || "";
  const pictureOf = portrait && pictureBook && !pictureRef.startsWith("art:") ? { book: pictureBook, file: pictureRef.split("@")[0], name: record.name } : null;
  const table = tableOf(data);
  const grouped = groupsOf(data);
  const abilities = data.abilities && typeof data.abilities === "object" ? (data.abilities as Record<string, { score?: number; bonus?: number } | undefined>) : null;
  return (
    <article className="record-window" data-record={record.id}>
      {portrait ? (
        // Its picture: click to see it full size; right-click to share it with the players (all or one).
        <img
          className="record-portrait"
          data-record-portrait
          src={portrait}
          alt={record.name}
          title={pictureOf ? "Click to see it full size; right-click to share it" : record.name}
          draggable={false}
          onClick={pictureOf ? () => pictureActions.toPictures(pictureOf) : undefined}
          onContextMenu={pictureOf ? (event) => pictureMenu.show(event, pictureActions.items(pictureOf, "book")) : undefined}
          onError={(event) => (event.currentTarget.style.display = "none")}
        />
      ) : null}
      {pictureMenu.element}
      <header>
        <h3 {...slotDrag({ kind: "record", record: record.id, label: record.name })}>{record.name}</h3>
        <small className="hint">
          {listLabel(listOf(record))}
          {record.source ? ` · ${record.source}` : ""}
          {typeof data.fgCategory === "string" ? ` · ${data.fgCategory}` : ""}
        </small>
        <span className="record-tools">
          {canEdit && !Block ? (
            <button type="button" className={editing ? "records-lock on" : "records-lock"} data-action="record-lock" aria-pressed={editing} title={editing ? "Lock it (done editing)" : "Unlock it to edit"} aria-label={editing ? "Lock" : "Edit"} onClick={() => setUnlocked(!editing)}>
              <Icon name={editing ? "unlock" : "pen"} size={15} />
            </button>
          ) : null}
          {gm ? <ShareMenu session={session} record={record} words /> : null}
          {/* FG's Send to chat: the record's link in the chat; the GM's also posts its text as the players know it. */}
          <button type="button" className="ghost" data-action="record-to-chat" title={gm ? "Send to chat: its link and its text, as the players know it" : "Send to chat: its link"} aria-label="Send to chat" onClick={() => session.sendChat("", { link: { kind: "record", record: record.id, label: record.name }, ...(gm ? { share: true } : {}) })}>
            <Icon name="chat" size={15} />
          </button>
          {session.role === "dm" && (given || record.source) ? (
            <button
              type="button"
              data-action="record-copy-campaign"
              title="Copy it into the campaign, to change it there (the book's stays as it is)"
              onClick={() => void actions.copyToCampaign(record, book).catch((error) => setStatus(error instanceof Error ? error.message : "Could not copy that."))}
            >
              <Icon name="import" size={15} /> Copy to campaign
            </button>
          ) : null}
          {gm && !record.source ? (
            <>
              <button type="button" className="ghost" data-action="record-duplicate" title="Duplicate: a copy, named (copy)" aria-label="Duplicate" onClick={() => void actions.duplicate(record)}>
                <Icon name="plus" size={15} />
              </button>
              <button type="button" className="ghost" data-action="record-delete" title="Delete (Undo comes up for a moment)" aria-label="Delete" onClick={() => void actions.remove(record)}>
                <Icon name="trash" size={15} />
              </button>
            </>
          ) : null}
        </span>
      </header>
      {status ? <p className="hint" role="status">{status}</p> : null}
      {gm && record.type === "item" && !record.source ? <IdentifyBar session={session} record={record} /> : null}
      {table ? <TableRollBar session={session} record={record} book={book} /> : null}
      {CoreView ? (
        <CoreView session={session} record={record} editable={editing} />
      ) : editing && !Block ? (
        table ? <TableEditor session={session} record={record} /> : <RecordFields session={session} record={record} />
      ) : (
      <>
      {Block ? <Block session={session} record={record} /> : null}
      {grouped
        ? grouped.map((group, index) => (
            <section key={index} className="record-grouped" data-record-group={group.title}>
              {group.title ? <h4>{group.title}</h4> : null}
              <table className="record-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    {group.columns.map((column) => (
                      <th key={column}>{labelOf(column)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td>
                        {row.link && onLink ? (
                          <a href="#" className="record-link" onClick={(event) => (event.preventDefault(), onLink("", row.link.replace(/@\*$/, ""), row.name))}>
                            {row.name}
                          </a>
                        ) : (
                          row.name
                        )}
                      </td>
                      {group.columns.map((column) => (
                        <td key={column}>{row.cells[column] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        : null}
      {table ? (
        <table className="record-table" data-record-table>
          <thead>
            <tr>
              {table.dice ? <th>{table.dice}</th> : null}
              {table.labels.map((label, index) => (
                <th key={index}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr
                key={index}
                draggable
                data-table-row={index}
                title="Drag this result into chat"
                onDragStart={(event) => {
                  // A result dragged into the chat's entry goes into the line being typed.
                  const said = row.results.filter(Boolean).join(" · ");
                  event.dataTransfer.setData(TABLE_RESULT_DRAG, said);
                  event.dataTransfer.setData("text/plain", said);
                  event.dataTransfer.effectAllowed = "copy";
                }}
              >
                {table.dice ? <td className="record-table-roll">{row.from === row.to ? row.from : `${row.from}-${row.to}`}</td> : null}
                {row.results.map((result, column) => (
                  <td key={column}>{result}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {Block ? null : abilities && STATS.some((stat) => abilities[stat]) ? (
        <div className="record-abilities">
          {STATS.map((stat) => (
            <span key={stat}>
              <b>{stat.slice(0, 3).toUpperCase()}</b> {abilities[stat]?.score ?? "-"}
              {abilities[stat]?.bonus !== undefined ? ` (${Number(abilities[stat]?.bonus) >= 0 ? "+" : ""}${abilities[stat]?.bonus})` : ""}
            </span>
          ))}
        </div>
      ) : null}
      {fields.length && !Block ? (
        <dl className="record-fields">
          {fields.map(([key, value]) => (
            <Fragment key={key}>
              <dt>{labelOf(key)}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
      {lists.map(([key, rows]) => (
        <section key={key} className="record-list">
          <h4>{labelOf(key)}</h4>
          {rows.map((row, index) => (
            <p key={index}>
              <b>{row.name}.</b> {isText(row.desc) ? <FormattedText text={row.desc} onLink={onLink} /> : row.desc}
            </p>
          ))}
        </section>
      ))}
      {(Block ? [] : texts).map(([key, value]) => (
        <section key={key} className="record-text">
          {texts.length > 1 || key !== "description" ? <h4>{labelOf(key)}</h4> : null}
          <FormattedText text={value} onLink={onLink} onOpen={openLink} />
        </section>
      ))}
      </>
      )}
    </article>
  );
}

// FG's Import NPC from text: a 5E stat block pasted (2014 or 2024), a campaign NPC made of it and opened.
function NpcImport({ session, onMade }: { session: Session; onMade: (record: TableRecord) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  return (
    <details className="table-import npc-import">
      <summary>Import from a stat block (paste it)</summary>
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a 5E stat block: its name on the first line, then size, type and alignment, AC, HP, the abilities…" aria-label="The stat block, pasted" rows={8} />
      <button
        type="button"
        data-action="npc-import"
        disabled={!text.trim()}
        onClick={() =>
          void session
            .content<TableRecord & { problems?: string[] }>("npc-import", { text })
            .then((record) => {
              setStatus(record.problems?.length ? `Made ${record.name}. Not found: ${record.problems.join(" ")}` : `Made ${record.name}.`);
              setText("");
              onMade(record);
            })
            .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not read that."))
        }
      >
        Import
      </button>
      {status ? <p className="hint" role="status">{status}</p> : null}
    </details>
  );
}

// FG's Item Forge: base items and templates (item templates, or items and spells used as them) merged by the
// game's forge rules into new campaign items. Drag records onto Base items or Templates, or pick them by name.
const FORGE_TYPES = ["item", "itemtemplate", "spell"];
const BONUS_CHOICE = /,?\s*\+1,\s*\+2,?\s*or\s*\+3$/i;
function ItemForge({ session, onMade }: { session: Session; onMade: (record: TableRecord) => void }) {
  const [bases, setBases] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [bonus, setBonus] = useState(1);
  const [status, setStatus] = useState("");
  // The names to pick from (an active book's thousand and more), made only while the forge is open.
  const [open, setOpen] = useState(false);
  const own = useId();
  const byName = useMemo(
    () => new Map(open ? Object.values(session.records).filter((record) => FORGE_TYPES.includes(record.type)).map((record) => [`${record.name}${record.source ? ` (${record.source})` : ""}`, record]) : []),
    [open, session.records],
  );
  const accepts = (link: QuickSlot) => link.kind === "record" && FORGE_TYPES.includes(session.records[link.record]?.type ?? "");
  const add = (set: (fn: (list: string[]) => string[]) => void, id: string) => set((list) => (list.includes(id) ? list : [...list, id].slice(0, 20)));
  const choice = templates.some((id) => BONUS_CHOICE.test(session.records[id]?.name ?? ""));
  const slot = (label: string, ids: string[], set: typeof setBases, which: string, spellsToo: boolean) => (
    <DropZone label={which} accepts={(link) => accepts(link) && link.kind === "record" && (spellsToo || session.records[link.record]?.type !== "spell")} onLink={(link) => link.kind === "record" && add(set, link.record)}>
      <div className="forge-slot" data-forge={which}>
        <strong>{label}</strong>
        {ids.length ? (
          <ul>
            {ids.map((id) => (
              <li key={id}>
                <span className="records-name" {...slotDrag({ kind: "record", record: id, label: session.records[id]?.name ?? id })}>{session.records[id]?.name ?? id}</span>
                <button type="button" className="ghost" title="Take out" aria-label={`Take ${session.records[id]?.name ?? "it"} out`} onClick={() => set((list) => list.filter((other) => other !== id))}>
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{spellsToo ? "Drop templates, magic items or spells here" : "Drop items here"}</p>
        )}
        <form
          className="cc-inline"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem("pick") as HTMLInputElement;
            const record = byName.get(input.value);
            if (!record || (!spellsToo && record.type === "spell")) return setStatus(`No ${spellsToo ? "item, template or spell" : "item"} named ${input.value}.`);
            add(set, record.id);
            input.value = "";
          }}
        >
          <label htmlFor={`${own}-${which}`} className="sr-only">
            Add to {label} by name
          </label>
          <input id={`${own}-${which}`} name="pick" list={`${own}-names`} placeholder="Name…" autoComplete="off" data-forge-pick={which} />
          <button type="submit" title={`Add to ${label}`} aria-label={`Add to ${label}`}>
            <Icon name="plus" />
          </button>
        </form>
      </div>
    </DropZone>
  );
  return (
    <details className="table-import item-forge" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Item Forge</summary>
      <datalist id={`${own}-names`} data-forge-names="">
        {[...byName.keys()].map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className="forge-slots">
        {slot("Base items", bases, setBases, "bases", false)}
        {slot("Templates", templates, setTemplates, "templates", true)}
      </div>
      <div className="cc-inline">
        {choice ? (
          <label>
            Bonus{" "}
            <select value={bonus} onChange={(event) => setBonus(Number(event.target.value))} data-forge="bonus">
              <option value={1}>+1</option>
              <option value={2}>+2</option>
              <option value={3}>+3</option>
            </select>
          </label>
        ) : null}
        <button
          type="button"
          data-action="item-forge"
          disabled={!templates.length || (!bases.length && templates.length < 2)}
          onClick={() =>
            void session
              .content<{ made: TableRecord[]; problems: string[] }>("item-forge", { base: bases, templates, bonus })
              .then(({ made, problems }) => {
                setStatus(`Forged ${made.map((record) => record.name).join(", ")}.${problems.length ? ` ${problems.join(" ")}` : ""}`);
                if (made[0]) onMade(made[0]);
              })
              .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not forge that."))
          }
        >
          Forge
        </button>
        <button type="button" className="ghost" data-action="item-forge-reset" disabled={!bases.length && !templates.length} onClick={() => (setBases([]), setTemplates([]), setStatus(""))}>
          Reset
        </button>
      </div>
      <p className="hint" role="status">
        {status}
      </p>
    </details>
  );
}

// FG's race import: a race pasted as text, a campaign race (and its subraces) made of it and opened.
function RaceImport({ session, onMade }: { session: Session; onMade: (record: TableRecord) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const own = useId();
  return (
    <details className="table-import race-import">
      <summary>Import a race (paste it)</summary>
      <label htmlFor={own} className="sr-only">
        The race, pasted
      </label>
      <textarea id={own} value={text} onChange={(event) => setText(event.target.value)} placeholder={"Paste a race: its name on the first line, its description, then \u201c<Race> Traits\u201d and each trait (Darkvision. You have\u2026); subraces after (High Elf, or Drow Traits)"} rows={8} />
      <button
        type="button"
        data-action="race-import"
        disabled={!text.trim()}
        onClick={() =>
          void session
            .content<TableRecord & { subraces?: TableRecord[]; problems?: string[] }>("race-import", { text })
            .then((record) => {
              const subs = record.subraces?.length ? ` and ${record.subraces.map((sub) => sub.name).join(", ")}` : "";
              setStatus(`Made ${record.name}${subs}.${record.problems?.length ? ` ${record.problems.join(" ")}` : ""}`);
              setText("");
              onMade(record);
            })
            .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not read that."))
        }
      >
        Import
      </button>
      <p className="hint" role="status">
        {status}
      </p>
    </details>
  );
}
