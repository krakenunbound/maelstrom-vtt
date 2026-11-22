import { useId, useMemo, useState } from "react";
import { EXPORTABLE } from "../../shared/packs/exportable.mjs";
import type { QuickSlot, Session } from "../session/useSession";
import { Icon } from "../ui/icons";
import { slotDrag } from "../ui/QuickSlots";
import { DropZone } from "./RecordEditor";

// FG's module export (/export), the Modules window's Export: the campaign's own records, whole kinds (ticked) or
// single ones (dropped or picked), into a pack in the packs folder that any campaign of this game (or any game)
// makes active. Its name, title, category and author; whether the players may read it.
const KIND_LABELS: Record<string, string> = {
  npc: "NPCs",
  item: "Items",
  itemtemplate: "Item Templates",
  spell: "Spells",
  vehicle: "Vehicles",
  character: "Characters (as pregenerated characters)",
  story: "Story",
  battle: "Encounters",
  treasureparcel: "Parcels",
  table: "Tables",
  class: "Classes",
  class_specialization: "Subclasses",
  race: "Races",
  race_subrace: "Subraces",
  background: "Backgrounds",
  feat: "Feats",
  skill: "Skills",
};
const labelOf = (kind: string) => KIND_LABELS[kind] ?? kind.replace(/^./, (letter) => letter.toUpperCase());

export function ModuleExport({ session }: { session: Session }) {
  const own = useId();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [author, setAuthor] = useState("");
  const [kinds, setKinds] = useState<string[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [anyGame, setAnyGame] = useState(false);
  const [forPlayers, setForPlayers] = useState(false);
  const [status, setStatus] = useState("");
  // The campaign's own records (not a book's), by kind.
  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const record of Object.values(session.records)) if (!record.source && EXPORTABLE.includes(record.type)) out.set(record.type, (out.get(record.type) ?? 0) + 1);
    return out;
  }, [session.records]);
  const ownRecord = (link: QuickSlot) => link.kind === "record" && Boolean(session.records[link.record]) && !session.records[link.record].source && EXPORTABLE.includes(session.records[link.record].type);
  const chosen = ids.filter((id) => !kinds.includes(session.records[id]?.type ?? ""));
  const total = kinds.reduce((sum, kind) => sum + (counts.get(kind) ?? 0), 0) + chosen.length;
  return (
    <form
      className="module-export"
      data-module-export=""
      onSubmit={(event) => {
        event.preventDefault();
        setStatus("Writing the module…");
        void session
          .content<{ file: string; records: number; ruleset: string }>("module-export", { name, title, category, author, types: kinds, ids: chosen, anyGame, forPlayers })
          .then((made) => setStatus(`Exported ${made.records} record${made.records === 1 ? "" : "s"} to ${made.file}. It is in Modules (${made.ruleset}) for any campaign to make active.`))
          .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Could not export."));
      }}
    >
      <p className="hint">The campaign's own records as a module (a .kpack in the packs folder): another campaign makes it active in Modules.</p>
      <div className="module-export-fields">
        <label htmlFor={`${own}-name`}>Name</label>
        <input id={`${own}-name`} value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} placeholder="The Goblin Den" />
        <label htmlFor={`${own}-title`}>Title</label>
        <input id={`${own}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="As the name" />
        <label htmlFor={`${own}-category`}>Category</label>
        <input id={`${own}-category`} value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} placeholder="Campaign Exports" />
        <label htmlFor={`${own}-author`}>Author</label>
        <input id={`${own}-author`} value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={120} />
      </div>
      <fieldset className="module-export-kinds">
        <legend>Whole kinds</legend>
        {counts.size === 0 ? <p className="hint">The campaign has none of its own records to export yet.</p> : null}
        {[...counts].map(([kind, count]) => (
          <label key={kind}>
            <input type="checkbox" checked={kinds.includes(kind)} onChange={(event) => setKinds(event.target.checked ? [...kinds, kind] : kinds.filter((other) => other !== kind))} data-export-kind={kind} /> {labelOf(kind)} <small className="hint">({count})</small>
          </label>
        ))}
      </fieldset>
      <DropZone label="export" accepts={ownRecord} onLink={(link) => link.kind === "record" && setIds((list) => (list.includes(link.record) ? list : [...list, link.record]))}>
        <div className="module-export-singles">
          <strong>Single records</strong>
          {ids.length ? (
            <ul>
              {ids.map((id) => (
                <li key={id}>
                  <span className="records-name" {...slotDrag({ kind: "record", record: id, label: session.records[id]?.name ?? id })}>
                    {session.records[id]?.name ?? id}
                  </span>
                  <button type="button" className="ghost" title="Take out" aria-label={`Take ${session.records[id]?.name ?? "it"} out`} onClick={() => setIds((list) => list.filter((other) => other !== id))}>
                    <Icon name="close" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Drop the campaign's records here (from its lists) to export only those.</p>
          )}
        </div>
      </DropZone>
      <label>
        <input type="checkbox" checked={forPlayers} onChange={(event) => setForPlayers(event.target.checked)} data-export-players="" /> The players may read it
      </label>
      <label>
        <input type="checkbox" checked={anyGame} onChange={(event) => setAnyGame(event.target.checked)} data-export-any="" /> For any game (not only {session.ruleset || "this game"})
      </label>
      <button type="submit" data-action="module-export" disabled={!name.trim() || total === 0}>
        <Icon name="export" size={15} /> Export {total ? `${total} record${total === 1 ? "" : "s"}` : ""}
      </button>
      <p className="hint" role="status">
        {status}
      </p>
    </form>
  );
}
