import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// FG's Dice: Manual entry (MANUALROLL, each person's own): a roll asks for the faces this person's own dice show,
// then the host rolls with exactly those. Settings > You at the table: Type in my own dice.
type Ask = { formula: string; dice: number[]; resolve: (values: number[] | null) => void };
let asking: Ask | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

// The dice of a formula, one entry a die (its sides): "2d6+1d20+3" is [6, 6, 20]; "dF" a Fate die (3 faces).
export function diceOf(formula: string): number[] {
  const out: number[] = [];
  for (const match of formula.matchAll(/(\d*)d(\d+|F|%)/gi)) {
    const count = Math.min(40, Math.max(1, Number(match[1]) || 1));
    const sides = /F/i.test(match[2]) ? 3 : match[2] === "%" ? 100 : Number(match[2]);
    for (let i = 0; i < count; i++) out.push(sides);
  }
  return out.slice(0, 40);
}

export const manualDice = {
  // The faces typed in, or null when the person cancelled (the roll is not made).
  ask(formula: string): Promise<number[] | null> {
    const dice = diceOf(formula);
    if (!dice.length) return Promise.resolve([]);
    asking?.resolve(null);
    return new Promise((resolve) => {
      asking = { formula, dice, resolve };
      changed();
    });
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  current: () => asking,
};

export function ManualDiceDialog() {
  const ask = useSyncExternalStore(manualDice.subscribe, manualDice.current);
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<string[]>([]);
  useEffect(() => {
    setValues(ask ? ask.dice.map(() => "") : []);
    if (ask && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!ask && dialog.current?.open) dialog.current.close();
  }, [ask]);
  const finish = (result: number[] | null) => {
    const current = asking;
    asking = null;
    changed();
    current?.resolve(result);
  };
  const valid = ask ? values.length === ask.dice.length && values.every((value, index) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= ask.dice[index]) : false;
  return (
    <dialog ref={dialog} className="manual-dice" aria-labelledby="manual-dice-title" onCancel={(event) => {
      event.preventDefault();
      finish(null);
    }}>
      {ask ? (
        <form
          method="dialog"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) finish(values.map(Number));
          }}
        >
          <h3 id="manual-dice-title">Your dice: {ask.formula}</h3>
          <div className="manual-dice-faces">
            {ask.dice.map((sides, index) => (
              <label key={index}>
                <span>{sides === 3 ? "dF (1 = -, 2 = 0, 3 = +)" : `d${sides}`}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={sides}
                  required
                  autoFocus={index === 0}
                  data-manual-die={index}
                  value={values[index] ?? ""}
                  onChange={(event) => setValues((list) => list.map((value, at) => (at === index ? event.target.value : value)))}
                />
              </label>
            ))}
          </div>
          <div className="manual-dice-buttons">
            <button type="button" onClick={() => finish(null)}>
              Cancel
            </button>
            <button type="submit" disabled={!valid} data-action="manual-dice-roll">
              Roll
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
