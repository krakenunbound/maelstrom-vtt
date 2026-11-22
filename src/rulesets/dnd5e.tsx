import { spellRows } from "../../shared/dnd5e/spellrows.mjs";
import { useState } from "react";
import { classLine, signed, spellSlug } from "../../shared/dnd5e/rules.mjs";
import { num, rows, useSheet, type Row } from "../core/sheet/context";
import { GM } from "../ui/gmTitle";

// D&D 5E's own parts, where no core part fits (docs/core-ui-design.md 4.4,
// level 3), shared with Descending Darkness (its variant): the Spells page
// (the save DC and attack, slots to tick, each spell known with Cast and the
// book's words), Descending Darkness's Dread, its bleeding out at 0 Health and
// 5E's death saves. Everything else on the sheet is the core's, laid out by
// shared/dnd5e/manifest.mjs; the words (Species or Kin, AC or Defense) are its labels.

const titled = (word: string) => word[0].toUpperCase() + word.slice(1);
// A book's words as plain text: its HTML, or Kraken's rich text ({ __rich: "<p>...</p>" }, the packs' form).
const plain = (html: unknown) => {
  const source = html && typeof html === "object" ? ((html as { __rich?: unknown }).__rich ?? "") : html;
  return String(source ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};

// The class's name and level, from the character's packages (FG 5E's class package).
// Multiclass: every class and its level ("Fighter 3 / Wizard 2").
export const dnd5eClassName = (data: Row) => classLine(data);

// Spells, as FG's Actions tab: the save DC and attack, the slots (used boxes; the maximum by hand, Pact Magic
// named), the spells by level with a prepared box and Cast, and the class resources (Rage, Ki) with their uses.
export function Dnd5eSpells() {
  const { record, session, editable, data, change } = useSheet();
  const casting = (data.spellcasting ?? null) as Row | null;
  const slots = rows(data.slots).sort((a, b) => a[0].localeCompare(b[0]));
  const known = (Array.isArray(data.spells) ? data.spells : []).map(String);
  const book = Object.values(session.records).filter((item) => item.type === "spell");
  const prepared = (data.prepared ?? {}) as Row;
  const levelOf = (name: string) => num(book.find((item) => item.name.toLowerCase() === name.toLowerCase())?.data.level);
  const levels = [...new Set(known.map(levelOf))].sort((a, b) => a - b);
  const preparedCount = known.filter((name) => levelOf(name) > 0 && num(prepared[spellSlug(name)]) > 0).length;
  // FG's upcast: the slot levels with one free (spell slots and the pact's), for a spell of a level.
  const freeLevels = [...new Set([...rows(data.slots), ...rows(data.pactslots)].filter(([, slot]) => num(slot.used) < num(slot.max)).map(([key]) => Number(key.slice(1))))].sort((a, b) => a - b);
  const [slotFor, setSlotFor] = useState<Record<string, number>>({});
  return (
    <section className="cc-panel cc-page" data-tab-page="spells">
      {casting ? (
        <>
          <p className="cc-inline">
            <b>Spell save DC</b> <span className="cc-num" data-stat="spell-dc">{num(casting.dc)}</span> <b>Spell attack</b> <span className="cc-num">{signed(num(casting.attack))}</span> <small className="hint">{titled(String(casting.stat ?? ""))}</small> <small className="hint" data-stat="prepared">Prepared {preparedCount}</small>
          </p>
          {Array.isArray(casting.classes) ? (
            // Multiclass: each casting class's own DC and attack (FG's power groups).
            <p className="cc-inline five-casting-classes">
              {(casting.classes as Row[]).map((row) => (
                <small key={String(row.name)} className="hint" data-casting-class={String(row.name)}>
                  {String(row.name)}: DC {num(row.dc)}, attack {signed(num(row.attack))}
                </small>
              ))}
            </p>
          ) : null}
          <div className="five-slots">
            {casting.pact ? <b className="five-pact">Pact Magic</b> : null}
            {slots.map(([key, slot]) => (
              <span key={key} className="five-slot" data-slot={key}>
                <b>Level {key.slice(1)}</b>{" "}
                {Array.from({ length: num(slot.max) }, (_, index) => (
                  <input key={index} type="checkbox" checked={index < num(slot.used)} disabled={!editable} aria-label={`Level ${key.slice(1)} slot ${index + 1} used`} onChange={(event) => change(`slots.${key}.used`, event.target.checked ? index + 1 : index)} />
                ))}
                {editable ? (
                  <input type="number" className="tiny" min={0} value={num(slot.max)} title="Most slots of this level (beyond the class's: a feat, a magic item)" aria-label={`Level ${key.slice(1)} slots`} onChange={(event) => change(`slots.${key}.extra`, num(slot.extra) + (Number(event.target.value) || 0) - num(slot.max))} />
                ) : null}
              </span>
            ))}
          </div>
          {rows(data.pactslots).length ? (
            <div className="five-slots" data-pact>
              <b className="five-pact">Pact Magic</b>
              {rows(data.pactslots).map(([key, slot]) => (
                <span key={key} className="five-slot" data-pact-slot={key}>
                  <b>Level {key.slice(1)}</b>{" "}
                  {Array.from({ length: num(slot.max) }, (_, index) => (
                    <input key={index} type="checkbox" checked={index < num(slot.used)} disabled={!editable} aria-label={`Pact slot ${index + 1} used`} onChange={(event) => change(`pactslots.${key}.used`, event.target.checked ? index + 1 : index)} />
                  ))}
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="hint empty-state">No spellcasting in this class.</p>
      )}
      {levels.map((level) => (
        <div key={level} className="five-spell-level" data-spell-level={level}>
          <h4>{level ? `Level ${level}` : "Cantrips"}</h4>
          <ul className="five-spells">
            {known
              .filter((name) => levelOf(name) === level)
              .map((name) => {
                const spell = book.find((item) => item.name.toLowerCase() === name.toLowerCase());
                const slug = spellSlug(name);
                return (
                  <li key={name} data-spell={name}>
                    {level ? <input type="checkbox" checked={num(prepared[slug]) > 0} disabled={!editable} title="Prepared" aria-label={`${name} prepared`} onChange={(event) => change(`prepared.${slug}`, event.target.checked ? 1 : 0)} /> : null}
                    <b>{name}</b>
                    {editable && level > 0 && freeLevels.filter((at) => at >= level).length > 1 ? (
                      // FG's upcast: which slot it is cast with (the lowest free by default).
                      <select aria-label={`${name}: cast with a slot of level`} title="Cast with a slot of this level (higher: it does more)" data-spell-slot={name} value={slotFor[name] ?? 0} onChange={(event) => setSlotFor({ ...slotFor, [name]: Number(event.target.value) })}>
                        <option value={0}>Lowest slot</option>
                        {freeLevels
                          .filter((at) => at >= level)
                          .map((at) => (
                            <option key={at} value={at}>
                              Level {at}
                            </option>
                          ))}
                      </select>
                    ) : null}
                    {editable ? (
                      <button type="button" data-action="cast" onClick={() => session.ct("cast", { recordId: record.id, power: name, ...(slotFor[name] ? { slot: slotFor[name] } : {}) })}>
                        Cast
                      </button>
                    ) : null}
                    <p className="hint">{plain(spell?.data.description).slice(0, 220)}</p>
                    {/* FG's power action rows, each in words. */}
                    {spell ? (
                      <ul className="five-spell-rows" data-spell-rows={name}>
                        {spellRows(spell.data.actions as Record<string, unknown>, casting ? { dc: num(casting.dc), attack: num(casting.attack) } : {}).map((row, index) => (
                          <li key={index} data-spell-row={row.type}>
                            {row.text}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <Dnd5eResources />
    </section>
  );
}

// FG's class resources (a power group's uses and period): Rage, Ki, Channel Divinity. Each with its uses ticked off,
// its most, and when it comes back (a short rest, or a long one); rests give them back.
function Dnd5eResources() {
  const { data, editable, change } = useSheet();
  const list = rows(data.resources);
  const add = () => {
    const next = list.reduce((most, [key]) => Math.max(most, Number(key.replace(/\D/g, "")) || 0), 0) + 1;
    const key = `id-${String(next).padStart(5, "0")}`;
    change(`resources.${key}.name`, "New resource");
  };
  if (!list.length && !editable) return null;
  return (
    <div className="five-resources" data-part="resources">
      <h4>Class resources</h4>
      <ul>
        {list.map(([key, row]) => (
          <li key={key} data-resource={String(row.name)}>
            <input type="text" defaultValue={String(row.name ?? "")} disabled={!editable} aria-label="Resource name" onBlur={(event) => event.target.value !== row.name && change(`resources.${key}.name`, event.target.value)} />
            {Array.from({ length: num(row.max) }, (_, index) => (
              <input key={index} type="checkbox" checked={index < num(row.used)} disabled={!editable} aria-label={`${String(row.name)} use ${index + 1}`} onChange={(event) => change(`resources.${key}.used`, event.target.checked ? index + 1 : index)} />
            ))}
            <input type="number" className="tiny" min={0} value={num(row.max)} disabled={!editable} aria-label={`${String(row.name)} uses`} title="How many uses" onChange={(event) => change(`resources.${key}.max`, Number(event.target.value) || 0)} />
            <select value={String(row.period ?? "long")} disabled={!editable} aria-label={`${String(row.name)} comes back`} onChange={(event) => change(`resources.${key}.period`, event.target.value)}>
              <option value="short">Short rest</option>
              <option value="long">Long rest</option>
            </select>
            {editable ? (
              <button type="button" className="icon-button" aria-label={`Remove ${String(row.name)}`} title="Remove" onClick={() => change(`resources.${key}`, null)}>
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {editable ? (
        <button type="button" data-action="add-resource" onClick={add}>
          + Resource
        </button>
      ) : null}
    </div>
  );
}

// Descending Darkness's Dread: 3 or more, disadvantage on Wisdom; 6, the character breaks.
export function Dnd5eDread() {
  const { data, editable, change } = useSheet();
  const dread = num(data.dread);
  return (
    <div className="five-big five-dread" data-stat="dread" title={GM("Dread: horrors, darkness and loss build it; a night's rest by a fire lowers it by 1. At 3 or more, disadvantage on Wisdom checks and saves; at 6 the character breaks (the GM says how).")}>
      <small>Dread</small>
      <span className="five-dread-track">
        {Array.from({ length: 6 }, (_, index) => (
          <button key={index} type="button" className={index < dread ? "on" : ""} disabled={!editable} aria-label={`Dread ${index + 1}`} onClick={() => change("dread", dread === index + 1 ? index : index + 1)} />
        ))}
      </span>
      <span className="hint">{dread >= 6 ? "Broken" : dread >= 3 ? "Shaken: disadvantage on Wisdom" : ""}</span>
    </div>
  );
}

// Descending Darkness at 0 Health: dying, a Health lost each turn until steadied.
export function Dnd5eDying() {
  const { data } = useSheet();
  const hp = (data.hp ?? {}) as Row;
  return (
    <div className="five-big five-death" data-dying>
      <small>Dying</small>
      {/* "Health" its own text node, as the hand-made sheet wrote the game's word. */}
      <span className="hint">Loses 1 {"Health"} each turn until an ally steadies them (Wisdom 12); dead at {-num(hp.total)}.</span>
    </div>
  );
}

// 5E at 0 hit points: the death saves (FG's three boxes each, ticked by hand), and their roll in a fight.
export function Dnd5eDeathSaves() {
  const { data, session, record, editable, change } = useSheet();
  const saves = (data.deathsaves ?? {}) as Row;
  const inFight = session.combat.entries.find((entry) => entry.recordId === record.id);
  const boxes = (key: "success" | "failure", mark: string, word: string) => (
    <span className={`five-death-${key}`}>
      {[1, 2, 3].map((n) => (
        <button key={n} type="button" className={num(saves[key]) >= n ? "on" : ""} disabled={!editable} aria-label={`${word} ${n}`} aria-pressed={num(saves[key]) >= n} onClick={() => change(`deathsaves.${key}`, num(saves[key]) === n ? n - 1 : n)}>
          {mark}
        </button>
      ))}
    </span>
  );
  return (
    <div className="five-big five-death" data-death-saves>
      <small>Death saves</small>
      {boxes("success", "✓", "Success")}
      {boxes("failure", "✗", "Failure")}
      {inFight && editable ? (
        <button type="button" data-action="death-save" onClick={() => session.ct("death-save", { id: inFight.id })}>
          Roll
        </button>
      ) : null}
    </div>
  );
}

// FG's hit dice on the sheet: the die, how many are left, and one rolled (spent) apart from a rest.
export function Dnd5eHitDice() {
  const { data, session, record, editable, change } = useSheet();
  const dice = (data.hitdice ?? {}) as Row;
  const total = num(dice.total) || num(data.level) || 1;
  const left = Math.max(0, total - num(dice.used));
  const [status, setStatus] = useState("");
  const spend = (die?: number) => void session.bookkeeping(record.id, "hitdie", die ? { die } : {}).then(() => setStatus("")).catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)));
  // FG's per class (multiclass): each class's die, how many left, one of them rolled.
  const pools = Array.isArray(dice.pools) ? (dice.pools as Row[]) : [];
  const SIX = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
  return (
    <div className="five-big five-hitdice" data-stat="hitdice" title="Hit Point Dice: a short rest spends them, or roll one here">
      <small>Hit dice</small>
      <b>
        {left}/{total}
      </b>
      <span className="hint">d{num(dice.die) || 8}{num(dice.mod) ? ` ${num(dice.mod) > 0 ? "+" : ""}${num(dice.mod)}` : ""}</span>
      {editable && pools.length > 1 ? (
        <span className="five-hitdice-pools">
          {pools.map((pool) => (
            <button key={String(pool.name)} type="button" data-action="hit-die-class" data-die={num(pool.die)} disabled={!num(pool.left)} title={`Roll a ${String(pool.name)} die (d${num(pool.die)}): ${num(pool.left)} of ${num(pool.total)} left`} onClick={() => spend(num(pool.die))}>
              d{num(pool.die)} ({num(pool.left)})
            </button>
          ))}
        </span>
      ) : editable ? (
        <button type="button" data-action="hit-die" disabled={!left} onClick={() => spend()}>
          Roll one
        </button>
      ) : null}
      {/* FG's Hit Dice details: the ability added (Constitution), a second one, and misc. */}
      {editable ? (
        <details className="five-hitdice-details">
          <summary>Details</summary>
          <label>
            Ability{" "}
            <select value={String(dice.stat ?? "constitution")} aria-label="Hit die ability" onChange={(event) => change("hitdice.stat", event.target.value)}>
              {SIX.map((stat) => (
                <option key={stat} value={stat}>
                  {stat.slice(0, 3).toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            2nd{" "}
            <select value={String(dice.stat2 ?? "")} aria-label="Hit die second ability" onChange={(event) => change("hitdice.stat2", event.target.value)}>
              <option value="">–</option>
              {SIX.map((stat) => (
                <option key={stat} value={stat}>
                  {stat.slice(0, 3).toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Misc <input type="number" className="tiny" value={num(dice.misc)} aria-label="Hit die misc" onChange={(event) => change("hitdice.misc", Number(event.target.value) || 0)} />
          </label>
        </details>
      ) : null}
      {status ? <span className="hint" role="status">{status}</span> : null}
    </div>
  );
}

// FG's attunement count: the attuned items of the slots allowed (the house rule HRAS: 3, 4, 5, 2 or the
// proficiency bonus; plus the class's and misc), red when over.
export function Dnd5eAttunement() {
  const { data, session, editable, change } = useSheet();
  const tuned = (data.attunement ?? {}) as Row;
  const rule = String((session.options as { rules?: Record<string, unknown> }).rules?.HRAS ?? "3");
  const base = rule === "prof" ? num(data.prof) : Number(rule) || 3;
  const allowed = base + num(tuned.class) + num(tuned.misc);
  const used = num(tuned.used);
  return (
    <div className="five-attunement" data-attunement={`${used}/${allowed}`} data-over={used > allowed ? "" : undefined} title="Magic items attuned, of the slots allowed (the GM's house rule, your class's, and others)">
      <small>Attuned</small>
      <b className={used > allowed ? "danger" : ""}>
        {used} / {allowed}
      </b>
      <label>
        Class{" "}
        <input type="number" className="tiny" value={num(tuned.class)} disabled={!editable} aria-label="Attunement slots from your class" onChange={(event) => change("attunement.class", Number(event.target.value) || 0)} />
      </label>
      <label>
        Misc{" "}
        <input type="number" className="tiny" value={num(tuned.misc)} disabled={!editable} aria-label="Other attunement slots" onChange={(event) => change("attunement.misc", Number(event.target.value) || 0)} />
      </label>
    </div>
  );
}

// FG's Classes window, on the sheet: each class, its level and hit die, one more level in it, and a class added
// (multiclass) from the campaign's classes.
export function Dnd5eClasses() {
  const { data, session, record, editable } = useSheet();
  const classes = rows(data.packages).filter(([, item]) => String(item.packagetype).toLowerCase() === "class");
  const pools = (Array.isArray((data.hitdice as Row | undefined)?.pools) ? (data.hitdice as Row).pools : []) as Row[];
  const gm = session.role === "dm";
  const ready = gm || (num(data.expnext) > 0 && num(data.exp) >= num(data.expnext));
  const room = num(data.level) < 20;
  const owned = new Set(classes.map(([, item]) => String(item.name).toLowerCase()));
  const others = [...new Set(Object.values(session.records).filter((item) => item.type === "class").map((item) => item.name))].filter((name) => !owned.has(name.toLowerCase())).sort();
  const [pick, setPick] = useState("");
  if (!classes.length) return null;
  return (
    <div className="five-classes" data-part="classes">
      <small>Classes</small>
      <ul>
        {classes.map(([key, item]) => {
          const pool = pools.find((row) => String(row.name) === String(item.name));
          const level = classes.length > 1 ? num(item.level) : num(data.level);
          return (
            <li key={key} data-class={String(item.name)}>
              <b>{String(item.name)}</b> {level} <small className="hint">d{num(item.hitdie) || 8}{pool ? ` · ${num(pool.left)} of ${num(pool.total)} left` : ""}</small>
              {editable && ready && room ? (
                <button type="button" className="cc-levelup" data-action="class-level-up" title={`One level more as a ${String(item.name)}`} aria-label={`${String(item.name)}: one level more`} onClick={() => session.levelUp(record.id, key)}>
                  +
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable && ready && room && others.length ? (
        <span className="five-add-class">
          <select value={pick} onChange={(event) => setPick(event.target.value)} aria-label="Another class">
            <option value="">Another class…</option>
            {others.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button type="button" data-action="add-class" disabled={!pick} onClick={() => {
            session.levelUp(record.id, pick);
            setPick("");
          }}>
            Take a level
          </button>
        </span>
      ) : null}
    </div>
  );
}
