import type { Session } from "../session/useSession";
import { Icon } from "../ui/icons";
import { useWindows } from "../ui/Windows";
import { clausesOf, type Clause } from "./clauses";

// FG's combat tracker sections for a creature (the GM's): space and reach,
// offense, defense, and each trait and action as a name that opens its text
// in place (FG opens a window for each). The whole record is one click away.
type Row = { name?: unknown; desc?: unknown };
const SPACE: Record<string, number> = { tiny: 2.5, small: 5, medium: 5, large: 10, huge: 15, gargantuan: 20 };
const LISTS: [string, string][] = [
  ["traits", "Traits"],
  ["actions", "Actions"],
  ["bonusactions", "Bonus actions"],
  ["reactions", "Reactions"],
  ["legendaryactions", "Legendary actions"],
  ["lairactions", "Lair actions"],
];
const text = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value).trim() : "");
const rowsOf = (value: unknown): { name: string; desc: string }[] =>
  value && typeof value === "object"
    ? Object.values(value as Record<string, Row>)
        .filter((row) => row && typeof row === "object" && text(row.name))
        .map((row) => ({ name: text(row.name), desc: text(row.desc) }))
    : [];

type Attack = { key: string; name: string };
export function CreatureDetails({ session, recordId, name, spent = [], onSpend, entryId, attacks = [], targets = [] }: { session: Session; recordId: string; name: string; spent?: string[]; onSpend?: (action: string, on: boolean) => void; entryId?: string; attacks?: Attack[]; targets?: string[] }) {
  const windows = useWindows();
  const record = session.records[recordId];
  if (!record || record.type !== "npc") return null;
  const data = record.data ?? {};
  // FG's clause rolls: a piece of an action's words rolled in place. An attack or its damage goes through the
  // tracker (the creature's own attack of that name: its targets, their AC, the damage landing); healing is rolled;
  // a save is asked of each of its targets against the DC.
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const play = (rowName: string, clause: Clause) => {
    const own = attacks.find((attack) => attack.name.toLowerCase().startsWith(rowName.toLowerCase().replace(/\s*\(.*$/, "")));
    if (clause.kind === "attack") return own && entryId ? session.ct("attack", { id: entryId, weapon: own.key }) : session.roll(`1d20${signed(clause.bonus)}`, `[ATTACK] ${rowName}`, "", false, "public", name);
    if (clause.kind === "damage") return own && entryId ? session.ct("damage-roll", { id: entryId, weapon: own.key }) : session.roll(clause.formula, `[DAMAGE${clause.damageType ? ` (${clause.damageType})` : ""}] ${rowName}`, "", false, "public", name);
    if (clause.kind === "heal") return session.roll(clause.formula, `[HEAL] ${rowName}`, "", false, "public", name);
    for (const target of targets) session.ct("save", { id: target, attribute: clause.stat, cl: clause.dc });
  };
  const describe = (clause: Clause) =>
    clause.kind === "attack" ? `Roll the attack (d20 ${signed(clause.bonus)})` : clause.kind === "damage" ? `Roll the damage (${clause.formula}${clause.damageType ? ` ${clause.damageType}` : ""})` : clause.kind === "heal" ? `Roll the healing (${clause.formula})` : targets.length ? `Ask its ${targets.length} target${targets.length === 1 ? "" : "s"} for a DC ${clause.dc} ${clause.stat} save` : "Target someone to ask for this save";
  const actions = rowsOf(data.actions);
  // Reach: the record's own, else the longest "reach N ft." among its actions, else 5 ft.
  const reaches = actions.map((row) => Number(/reach (\d+)\s*ft/i.exec(row.desc)?.[1])).filter(Number.isFinite);
  const space = Number(data.space) || SPACE[text(data.size).toLowerCase()] || 0;
  const reach = Number(data.reach) || (reaches.length ? Math.max(...reaches) : space ? 5 : 0);
  // FG's space and reach, set on the tracker (the record's own, read by the map's reach ring).
  const setNumber = (field: "space" | "reach", value: string) => void session.op({ op: "update", id: record.id, patch: { data: { [field]: Math.max(0, Math.min(200, Number(value) || 0)) } } }).catch(() => undefined);
  const dex = Number((data.abilities as Record<string, { bonus?: number }> | undefined)?.dexterity?.bonus ?? 0);
  const init = dex + Number((data.initiative as { misc?: number } | undefined)?.misc ?? 0);
  const fields = (pairs: [string, string][]) => pairs.filter(([, value]) => value && value !== "-");
  const offense = fields([
    ["Init", signed(init)],
    ["Speed", text(data.speed)],
    ["Senses", text(data.senses)],
    ["Skills", text(data.skills)],
    ["Languages", text(data.languages)],
    ["CR", text(data.cr)],
  ]);
  const defense = fields([
    ["AC", [text(data.ac), text(data.actext)].filter(Boolean).join(" ")],
    ["Hit points", [text(data.hp), text(data.hd)].filter(Boolean).join(" ")],
    ["Saves", text(data.savingthrows)],
    ["Resistant", text(data.damageresistances)],
    ["Immune", text(data.damageimmunities)],
    ["Vulnerable", text(data.damagevulnerabilities)],
    ["Condition immune", text(data.conditionimmunities)],
  ]);
  const lists = LISTS.map(([key, label]) => [label, rowsOf(data[key])] as const).filter(([, rows]) => rows.length > 0);
  return (
    <div className="ct-creature" data-creature-details={recordId}>
      <div className="ct-creature-head">
        {space ? (
          <span className="ct-creature-chip" title="Space and reach (feet)">
            <Icon name="fit" size={13} /> {text(data.size) || "Space"}{" "}
            <input type="number" className="tiny" min={0} step={2.5} defaultValue={space} key={`s${space}`} aria-label={`${name}'s space in feet`} data-field="ct-space" onBlur={(event) => Number(event.target.value) !== space && setNumber("space", event.target.value)} /> ft · reach{" "}
            <input type="number" className="tiny" min={0} step={5} defaultValue={reach} key={`r${reach}`} aria-label={`${name}'s reach in feet`} data-field="ct-reach" onBlur={(event) => Number(event.target.value) !== reach && setNumber("reach", event.target.value)} /> ft
          </span>
        ) : null}
        <button type="button" className="ghost" data-action="open-creature" title={`Open ${name}'s record (its whole stat block)`} onClick={() => windows.open("record", record.name, record.id)}>
          <Icon name="open" size={13} /> Record
        </button>
      </div>
      {offense.length ? (
        <dl className="ct-creature-part" aria-label="Offense">
          <dt className="ct-creature-title">
            <Icon name="damage" size={13} /> Offense
          </dt>
          {offense.map(([label, value]) => (
            <dd key={label}>
              <b>{label}</b> {value}
            </dd>
          ))}
        </dl>
      ) : null}
      {defense.length ? (
        <dl className="ct-creature-part" aria-label="Defense">
          <dt className="ct-creature-title">
            <Icon name="shield" size={13} /> Defense
          </dt>
          {defense.map(([label, value]) => (
            <dd key={label}>
              <b>{label}</b> {value}
            </dd>
          ))}
        </dl>
      ) : null}
      {lists.map(([label, rows]) => (
        <div key={label} className="ct-creature-part" aria-label={label}>
          <span className="ct-creature-title">{label}</span>
          {rows.map((row) => (
            <details key={row.name} className="ct-trait" data-trait={row.name}>
              <summary>
                {row.name}
                {/* FG 5E's [USED]: a recharge power (a d6 at its turn brings it back) or one with uses a day. */}
                {onSpend && /recharge|\/\s*day/i.test(row.name) ? (
                  <button type="button" className={spent.includes(row.name) ? "ct-used on" : "ct-used"} data-action="spend" aria-pressed={spent.includes(row.name)} title={spent.includes(row.name) ? "Used: click when it is ready again" : "Mark it used"} onClick={(event) => {
                    event.preventDefault();
                    onSpend(row.name, !spent.includes(row.name));
                  }}>
                    {spent.includes(row.name) ? "[USED]" : "use"}
                  </button>
                ) : null}
              </summary>
              <p>
                {row.desc
                  ? clausesOf(row.desc).map((piece, index) =>
                      piece.clause ? (
                        <button key={index} type="button" className="ct-clause" data-clause={piece.clause.kind} title={describe(piece.clause)} onClick={() => void play(row.name, piece.clause as Clause)}>
                          {piece.text}
                        </button>
                      ) : (
                        <span key={index}>{piece.text}</span>
                      ),
                    )
                  : "No text."}
              </p>
            </details>
          ))}
        </div>
      ))}
    </div>
  );
}
