import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Session } from "../session/useSession";
import { rulesetFor } from "../../shared/rulesets/registry.mjs";
import { levelUpPlan } from "../../shared/dnd5e/levelup.mjs";

// FG's level up through the character wizard (a game's manifest levelUpChoices): the next level's features, a
// subclass to choose, an Ability Score Improvement or a feat, and its hit points rolled or fixed; then the host
// raises the level with those choices. A game without it levels up at once.
type Ask = { session: Session; id: string; key?: string };
let asking: Ask | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());
const store = { subscribe: (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener)), current: () => asking };

/** A level up from a sheet's button: the dialog where the game declares choices, else at once. */
export function levelUpWith(session: Session, id: string, key?: string) {
  if (!rulesetFor(session.ruleset ?? "").levelUpChoices) return session.levelUp(id, key);
  asking = { session, id, key };
  changed();
}

type SpellOption = { name: string; level: number };
const STATS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const short = (stat: string) => stat.slice(0, 3).toUpperCase();

export function LevelUpDialog() {
  const ask = useSyncExternalStore(store.subscribe, store.current);
  const dialog = useRef<HTMLDialogElement>(null);
  const own = useId();
  const [hp, setHp] = useState<"roll" | "average">("roll");
  const [subclass, setSubclass] = useState("");
  const [improve, setImprove] = useState<"two" | "split" | "feat">("two");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [feat, setFeat] = useState("");
  const [expert, setExpert] = useState<string[]>([]);
  const [spells, setSpells] = useState<string[]>([]);
  const [spellSearch, setSpellSearch] = useState("");
  const record = ask ? ask.session.records[ask.id] : null;
  const plan = useMemo(() => {
    if (!ask || !record) return null;
    const all = Object.values(ask.session.records);
    const lib = { classes: all.filter((item) => item.type === "class"), subclasses: all.filter((item) => item.type === "class_specialization"), feats: all.filter((item) => item.type === "feat"), spells: all.filter((item) => item.type === "spell") };
    return levelUpPlan(record.data, lib, ask.key ?? "");
  }, [ask, record]);
  useEffect(() => {
    setHp("roll");
    setSubclass("");
    setImprove("two");
    setFirst("");
    setSecond("");
    setFeat("");
    setExpert([]);
    setSpells([]);
    setSpellSearch("");
    if (ask && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!ask && dialog.current?.open) dialog.current.close();
  }, [ask]);
  const close = () => {
    asking = null;
    changed();
  };
  // No plan (a class the books lack): the level up as before.
  useEffect(() => {
    if (ask && record && !plan) {
      ask.session.levelUp(ask.id, ask.key);
      close();
    }
  }, [ask, record, plan]);
  const scores = (record?.data as { abilities?: Record<string, { score?: number }> } | undefined)?.abilities ?? {};
  const room = (stat: string, n: number) => (Number(scores[stat]?.score) || 10) + n <= 20;
  const asi: Record<string, number> = !plan?.asi || improve === "feat" ? {} : improve === "two" ? (first ? { [first]: 2 } : {}) : first && second && first !== second ? { [first]: 1, [second]: 1 } : {};
  const asiDone = !plan?.asi || (improve === "feat" ? Boolean(feat) : Object.keys(asi).length > 0);
  // A feat asked for where the books have none of its kind: not held up.
  const ready = Boolean(plan) && (!plan?.subclasses || Boolean(subclass)) && asiDone && (!plan?.feat || Boolean(feat) || !plan.feats.length) && expert.filter(Boolean).length === Math.min(plan?.expertise ?? 0, plan?.skills.length ?? 0);
  const go = () => {
    if (!ask || !plan || !ready) return;
    ask.session.levelUp(ask.id, ask.key, { hp, ...(subclass ? { subclass } : {}), ...(Object.keys(asi).length ? { asi } : {}), ...(feat && (improve === "feat" || plan.feat) ? { feat } : {}), ...(expert.filter(Boolean).length ? { expertise: expert.filter(Boolean) } : {}), ...(spells.length ? { spells } : {}) });
    close();
  };
  return (
    <dialog ref={dialog} className="level-up-dialog" aria-labelledby={`${own}-title`} onCancel={(event) => (event.preventDefault(), close())} data-level-up-dialog>
      {ask && plan ? (
        <form method="dialog" onSubmit={(event) => (event.preventDefault(), go())}>
          <h3 id={`${own}-title`}>
            {record?.name}: {plan.className} {plan.classLevel}
          </h3>
          <fieldset>
            <legend>Hit points</legend>
            <label>
              <input type="radio" name={`${own}-hp`} checked={hp === "roll"} onChange={() => setHp("roll")} data-level-hp="roll" /> Roll the d{plan.die}
            </label>
            <label>
              <input type="radio" name={`${own}-hp`} checked={hp === "average"} onChange={() => setHp("average")} data-level-hp="average" /> Take {Math.floor(plan.die / 2) + 1}
            </label>
          </fieldset>
          {plan.features.length ? (
            <div className="level-up-features">
              <b>New at this level</b>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature.name}>{feature.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {plan.subclasses ? (
            <label className="level-up-row">
              Subclass
              <select value={subclass} onChange={(event) => setSubclass(event.target.value)} required data-level-subclass>
                <option value="">Choose…</option>
                {plan.subclasses.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {plan.asi ? (
            <fieldset>
              <legend>Ability Score Improvement</legend>
              <label>
                <input type="radio" name={`${own}-asi`} checked={improve === "two"} onChange={() => setImprove("two")} data-level-asi="two" /> +2 to one
              </label>
              <label>
                <input type="radio" name={`${own}-asi`} checked={improve === "split"} onChange={() => setImprove("split")} data-level-asi="split" /> +1 to two
              </label>
              {plan.feats.length ? (
                <label>
                  <input type="radio" name={`${own}-asi`} checked={improve === "feat"} onChange={() => setImprove("feat")} data-level-asi="feat" /> A feat
                </label>
              ) : null}
              {improve !== "feat" ? (
                <span className="level-up-row">
                  <select value={first} onChange={(event) => setFirst(event.target.value)} aria-label="Score to raise" data-level-score="first">
                    <option value="">Score…</option>
                    {STATS.filter((stat) => room(stat, improve === "two" ? 2 : 1)).map((stat) => (
                      <option key={stat} value={stat}>
                        {short(stat)} {Number(scores[stat]?.score) || 10}
                      </option>
                    ))}
                  </select>
                  {improve === "split" ? (
                    <select value={second} onChange={(event) => setSecond(event.target.value)} aria-label="Second score to raise" data-level-score="second">
                      <option value="">Score…</option>
                      {STATS.filter((stat) => stat !== first && room(stat, 1)).map((stat) => (
                        <option key={stat} value={stat}>
                          {short(stat)} {Number(scores[stat]?.score) || 10}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </span>
              ) : null}
            </fieldset>
          ) : null}
          {plan.expertise && plan.skills.length ? (
            <fieldset>
              <legend>Expertise</legend>
              {Array.from({ length: Math.min(plan.expertise, plan.skills.length) }, (_, index) => (
                <select key={index} value={expert[index] ?? ""} aria-label={`Expertise ${index + 1}`} data-level-expertise={index} onChange={(event) => setExpert((now) => Object.assign([...now], { [index]: event.target.value }))}>
                  <option value="">Skill…</option>
                  {plan.skills
                    .filter((skill) => skill.key === expert[index] || !expert.includes(skill.key))
                    .map((skill) => (
                      <option key={skill.key} value={skill.key}>
                        {skill.label}
                      </option>
                    ))}
                </select>
              ))}
            </fieldset>
          ) : null}
          {plan.spells && plan.spells.options.length ? (
            <fieldset className="level-up-spells" data-level-spells>
              {(() => {
                const levelOf = (name: string) => plan.spells?.options.find((spell: SpellOption) => spell.name === name)?.level ?? 0;
                const cantrips = spells.filter((name) => levelOf(name) === 0).length;
                const leveled = spells.length - cantrips;
                const wanted = spellSearch.trim().toLowerCase();
                return (
                  <>
                    <legend>
                      New spells
                      {plan.spells.cantrips ? ` · cantrips ${cantrips} of ${plan.spells.cantrips}` : ""}
                      {plan.spells.spells ? ` · spells ${leveled} of ${plan.spells.spells}` : ""}
                    </legend>
                    <input type="search" value={spellSearch} onChange={(event) => setSpellSearch(event.target.value)} placeholder="Find a spell" aria-label="Find a spell" />
                    <div className="level-up-spell-list">
                      {plan.spells.options
                        .filter((spell: SpellOption) => (spell.level === 0 ? plan.spells!.cantrips > 0 : plan.spells!.spells > 0) && (!wanted || spell.name.toLowerCase().includes(wanted) || spells.includes(spell.name)))
                        .map((spell: SpellOption) => {
                          const on = spells.includes(spell.name);
                          const full = spell.level === 0 ? cantrips >= plan.spells!.cantrips : leveled >= plan.spells!.spells;
                          return (
                            <label key={spell.name} data-level-spell={spell.name}>
                              <input type="checkbox" checked={on} disabled={!on && full} onChange={() => setSpells((now) => (on ? now.filter((name) => name !== spell.name) : [...now, spell.name]))} />
                              {spell.name} <small className="hint">{spell.level ? `level ${spell.level}` : "cantrip"}</small>
                            </label>
                          );
                        })}
                    </div>
                  </>
                );
              })()}
            </fieldset>
          ) : null}
          {((plan.asi && improve === "feat") || plan.feat) && plan.feats.length ? (
            <label className="level-up-row">
              {plan.feat && plan.feat !== "any" ? plan.feat : "Feat"}
              <select value={feat} onChange={(event) => setFeat(event.target.value)} required data-level-feat>
                <option value="">Choose…</option>
                {plan.feats.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="level-up-buttons">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button type="submit" disabled={!ready} data-action="level-up-confirm">
              Level up
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
