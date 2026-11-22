import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

// Maelstrom's own questions, in its own window and look: never the browser's confirm, alert or prompt boxes (no
// "127.0.0.1 says…" window freezing the table). Asked one at a time; each answer comes back as a promise.
type Ask =
  | { kind: "confirm"; message: string; ok: string; danger: boolean; resolve: (value: boolean) => void }
  | { kind: "notice"; message: string; ok: string; danger: false; resolve: (value: boolean) => void }
  | { kind: "text"; message: string; ok: string; danger: false; value: string; resolve: (value: string | null) => void };
const queue: Ask[] = [];
const listeners = new Set<() => void>();
let head: Ask | null = null;
const changed = () => {
  head = queue[0] ?? null;
  listeners.forEach((listener) => listener());
};
const push = (ask: Ask) => {
  queue.push(ask);
  changed();
};

/** Yes or no: true when the person chose ok. */
export function askConfirm(message: string, { ok = "OK", danger = false }: { ok?: string; danger?: boolean } = {}) {
  return new Promise<boolean>((resolve) => push({ kind: "confirm", message, ok, danger, resolve }));
}
/** Something to know, with OK. */
export function tellUser(message: string) {
  return new Promise<boolean>((resolve) => push({ kind: "notice", message, ok: "OK", danger: false, resolve }));
}
/** A word or a name: what was typed, or null when cancelled. */
export function askText(message: string, value = "") {
  return new Promise<string | null>((resolve) => push({ kind: "text", message, ok: "OK", danger: false, value, resolve }));
}

export function AskHost() {
  const ask = useSyncExternalStore(
    (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
    () => head,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const own = useId();
  const [text, setText] = useState("");
  useEffect(() => {
    setText(ask?.kind === "text" ? ask.value : "");
    if (ask && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!ask && dialog.current?.open) dialog.current.close();
  }, [ask]);
  const finish = (yes: boolean) => {
    const current = queue.shift();
    changed();
    if (!current) return;
    if (current.kind === "text") current.resolve(yes ? text : null);
    else current.resolve(yes);
  };
  return (
    <dialog ref={dialog} className="ask-dialog" aria-labelledby={`${own}-message`} onCancel={(event) => (event.preventDefault(), finish(false))} data-ask={ask?.kind ?? ""}>
      {ask ? (
        <form method="dialog" onSubmit={(event) => (event.preventDefault(), finish(true))}>
          <p id={`${own}-message`}>{ask.message}</p>
          {ask.kind === "text" ? <input value={text} autoFocus onChange={(event) => setText(event.target.value)} aria-labelledby={`${own}-message`} data-ask-text /> : null}
          <div className="ask-buttons">
            {ask.kind !== "notice" ? (
              <button type="button" onClick={() => finish(false)} data-ask-answer="cancel">
                Cancel
              </button>
            ) : null}
            <button type="submit" className={ask.danger ? "danger" : ""} autoFocus={ask.kind !== "text"} data-ask-answer="ok">
              {ask.ok}
            </button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
