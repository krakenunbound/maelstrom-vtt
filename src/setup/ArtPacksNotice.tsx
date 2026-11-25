import { useEffect, useState } from "react";
import type { ArtPackState } from "../kraken";

// Maelstrom's art packs on the start screen (the installer offers them too; Linux has no installer page): how many are
// installed, and a box for each to download, with Select all / Select none. Shown while any pack is missing.
export function ArtPacksNotice() {
  const api = window.kraken;
  const [state, setState] = useState<ArtPackState | null>(null);
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState<string[]>([]);
  const [error, setError] = useState("");
  const read = () => void api?.artPacks?.().then(setState).catch(() => undefined);
  useEffect(read, [api]);
  // While a download runs: its progress, each second.
  useEffect(() => {
    if (!state?.downloading) return;
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, [state?.downloading?.id]);
  if (!api?.artPacks || !state) return null;
  const missing = state.packs.filter((pack) => !pack.installed);
  if (!missing.length && !state.downloading && !state.failed.length) return null;
  const installed = state.packs.length - missing.length;
  const toggle = (id: string, on: boolean) => setWanted((list) => (on ? [...new Set([...list, id])] : list.filter((item) => item !== id)));
  const download = () => {
    setError("");
    void api
      .artPacksDownload?.(wanted)
      .then((next) => {
        setState(next);
        setWanted([]);
      })
      .catch((reason: Error) => setError(String(reason.message ?? reason).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")));
  };
  const titleOf = (id: string) => state.packs.find((pack) => pack.id === id)?.title ?? id;
  return (
    <aside className="update-notice art-packs" data-art-packs={`${installed}/${state.packs.length}`} aria-live="polite">
      <div className="update-line">
        <b>Art packs</b>
        <span className="update-current">
          {installed} of {state.packs.length} installed: portraits and tokens for characters and creatures.
        </span>
      </div>
      {state.downloading ? (
        <label className="art-pack-progress">
          Downloading {titleOf(state.downloading.id)}… {state.downloading.percent}%{state.downloading.queued.length ? ` (then ${state.downloading.queued.map(titleOf).join(", ")})` : ""}
          <progress max={100} value={state.downloading.percent} data-art-progress={state.downloading.id} />
        </label>
      ) : !open ? (
        <div className="update-actions">
          <button type="button" className="play-button" data-action="art-packs-choose" onClick={() => setOpen(true)}>
            Choose art packs
          </button>
        </div>
      ) : (
        <fieldset className="art-pack-list">
          <legend>Download into Documents/Kraken VTT/Art Packs</legend>
          {state.packs.map((pack) => (
            <label key={pack.id} className="art-pack-row" data-art-pack={pack.id}>
              <input type="checkbox" checked={pack.installed || wanted.includes(pack.id)} disabled={pack.installed} onChange={(event) => toggle(pack.id, event.target.checked)} />
              <span>
                <b>{pack.title}</b> <small>{pack.blurb}</small>
              </span>
              <small className="art-pack-size">{pack.installed ? "installed" : pack.mb >= 1000 ? `${(pack.mb / 1024).toFixed(1)} GB` : `${pack.mb} MB`}</small>
            </label>
          ))}
          <div className="update-actions">
            <button type="button" className="ghost" data-action="art-packs-all" onClick={() => setWanted(missing.map((pack) => pack.id))}>
              Select all
            </button>
            <button type="button" className="ghost" data-action="art-packs-none" onClick={() => setWanted([])}>
              Select none
            </button>
            <button type="button" className="play-button" data-action="art-packs-download" disabled={!wanted.length} onClick={download}>
              Download
            </button>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </fieldset>
      )}
      {state.failed.length ? (
        <p className="error" role="alert">
          {state.failed.map((item) => `${titleOf(item.id)} did not download (${item.reason}).`).join(" ")}
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
