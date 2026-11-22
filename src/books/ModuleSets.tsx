import { useEffect, useId, useState } from "react";
import type { Session } from "../session/useSession";
import { Icon } from "../ui/icons";

// FG's module sets (its Modules window's export and import), on Modules > Activation: what is active (and shared
// with the players) saved under a name, kept with the GM for any campaign of this game; a set applied makes active
// and shares what it names and makes inactive the rest. The host's moduleSet.
type ModuleSet = { name: string; active: string[]; shared: string[] };

export function ModuleSets({ session }: { session: Session }) {
  const own = useId();
  const [sets, setSets] = useState<ModuleSet[]>([]);
  const [chosen, setChosen] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const ask = <T,>(body: Record<string, unknown>) => session.content<T>("module-set", body);
  const reload = () =>
    void ask<{ sets: ModuleSet[] }>({ action: "list" })
      .then((result) => setSets(result.sets))
      .catch(() => undefined);
  useEffect(reload, []);
  const fail = (error: unknown) => setStatus(error instanceof Error ? error.message : "Could not do that.");
  const set = sets.find((item) => item.name === chosen);
  return (
    <div className="module-sets" data-module-sets="">
      <div className="cc-inline">
        <label htmlFor={`${own}-set`}>Sets</label>
        <select id={`${own}-set`} value={chosen} onChange={(event) => setChosen(event.target.value)} data-field="module-set">
          <option value="">{sets.length ? "Choose a set…" : "No sets yet"}</option>
          {sets.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.active.length})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!set}
          data-action="module-set-apply"
          title={set ? `Make ${set.active.length} book${set.active.length === 1 ? "" : "s"} active (and the rest inactive)` : "Choose a set"}
          onClick={() =>
            void ask<{ applied: string; active: string[]; missing: string[] }>({ action: "apply", name: chosen })
              .then((result) => setStatus(`${result.applied}: ${result.active.length} active.${result.missing.length ? ` Not on this computer: ${result.missing.join(", ")}.` : ""}`))
              .catch(fail)
          }
        >
          Apply
        </button>
        <button type="button" className="ghost icon-button" disabled={!set} data-action="module-set-remove" title="Take the set out" aria-label="Take the set out" onClick={() => void ask({ action: "remove", name: chosen }).then(() => (setChosen(""), setStatus(`${chosen} taken out.`), reload())).catch(fail)}>
          <Icon name="trash" size={14} />
        </button>
      </div>
      <form
        className="cc-inline"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void ask<{ saved: string; active: number }>({ action: "save", name })
            .then((result) => {
              setStatus(`${result.saved}: ${result.active} active book${result.active === 1 ? "" : "s"} saved.`);
              setChosen(result.saved);
              setName("");
              reload();
            })
            .catch(fail);
        }}
      >
        <label htmlFor={`${own}-name`} className="sr-only">
          Save what is active now as a set
        </label>
        <input id={`${own}-name`} value={name} onChange={(event) => setName(event.target.value)} placeholder="Save what is active as…" maxLength={60} data-field="module-set-name" />
        <button type="submit" disabled={!name.trim()} data-action="module-set-save" title="Save the active books (and which the players may read) as a set">
          Save set
        </button>
      </form>
      {status ? (
        <p className="hint" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
