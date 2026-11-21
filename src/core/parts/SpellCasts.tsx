// The spells a character knows (its `spells` list, one name a line), each with
// Cast: the host reads the book's spell from its words and casts it at the
// character's targets (3.5E and 2E: slots, saves, damage by caster level,
// effects; an area spell with no targets asks the map for its template). A
// spell's button also drags onto a creature, to cast at it alone.
import { useSheet } from "../sheet/context";
import { ACTION_DRAG } from "../../effects/drops";

const plain = (html: unknown) => {
  const source = html && typeof html === "object" ? ((html as { __rich?: unknown }).__rich ?? "") : html;
  return String(source ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};

export function SpellCasts() {
  const { record, session, editable, data } = useSheet();
  const known = (Array.isArray(data.spells) ? data.spells : String(data.spells ?? "").split("\n")).map((name) => String(name).trim()).filter(Boolean);
  if (!known.length) return null;
  const book = Object.values(session.records).filter((item) => item.type === "spell" || item.type === "spelldesc");
  const rowsByName = new Map(
    Object.entries((data.spellrows && typeof data.spellrows === "object" ? data.spellrows : {}) as Record<string, { name?: string; memorized?: number; cast?: number }>).map(([key, row]) => [String(row?.name ?? "").toLowerCase(), { key, row }]),
  );
  return (
    <ul className="five-spells core-spell-casts">
      {known.map((name) => {
        const spell = book.find((item) => item.name.toLowerCase() === name.toLowerCase());
        const level = spell ? String(spell.data.level ?? "") : "";
        // A game that memorizes (its rules keep spellrows: 2E): how many copies, and how many are cast today.
        const memo = rowsByName.get(name.toLowerCase());
        return (
          <li key={name} data-spell={name}>
            <b>{name}</b> {level ? <small className="hint">{/^\d+$/.test(level) ? `level ${level}` : level}</small> : null}
            {memo ? (
              <span className="spell-memo">
                <label title="Copies memorized for the day: each cast uses one (back after a long rest)">
                  Memorized{" "}
                  <input type="number" min={0} max={20} className="cc-field number" aria-label={`${name} memorized`} disabled={!editable} value={Number(memo.row.memorized ?? 0)} onChange={(event) => void session.editCharacter(record.id, [{ path: `spellrows.${memo.key}.memorized`, value: Math.max(0, Math.round(Number(event.target.value) || 0)) }])} />
                </label>
                {Number(memo.row.memorized ?? 0) > 0 ? <small className="hint" data-spell-cast={name}>{`${Number(memo.row.cast ?? 0)} of ${Number(memo.row.memorized)} cast today`}</small> : null}
              </span>
            ) : null}
            {editable && spell && spell.data.castinitiative !== undefined && spell.data.castinitiative !== "" ? (
              // A spell with a casting time in initiative (FG 2E's castinitiative): initiative cast with it (the caster is Casting until its turn).
              <button type="button" className="d2e-init" data-action="spell-init" title={`Initiative casting ${name}: d10 + its casting time (${spell.data.castinitiative}); hit before it goes off, the spell is lost`} onClick={(event) => session.ct("init", { recordId: record.id, spell: name, ...(event.shiftKey ? { force: true } : {}) })}>
                {String(spell.data.castinitiative)}
              </button>
            ) : null}
            {editable ? (
              <button
                type="button"
                data-action="cast"
                title={spell ? "Cast it at your targets (an area spell with none: place its template on the map)" : "Not in the active books: the host cannot cast it"}
                disabled={!spell}
                draggable
                onDragStart={(event) => event.dataTransfer.setData(ACTION_DRAG, JSON.stringify({ kind: "cast", recordId: record.id, power: name }))}
                onClick={() => session.ct("cast", { recordId: record.id, power: name })}
              >
                Cast
              </button>
            ) : null}
            {spell ? <p className="hint">{plain(spell.data.shortdescription || spell.data.description).slice(0, 220)}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
