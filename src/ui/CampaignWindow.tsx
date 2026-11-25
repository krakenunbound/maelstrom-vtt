import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";
import { GM } from "./gmTitle";
import { askConfirm, tellUser } from "./Ask";

// The GM's Save & Backups window (the disk button along the top): the campaign is saved by itself as it changes,
// and here the GM sees when it last was, saves now, backs it up under a name of their own ("Before the dragon"),
// puts a backup back (the table closes for it), exports it as a .zip and imports one. The newest ten automatic
// backups are kept (one each time it is hosted, one an hour while it is played); the GM's own are never removed.
type Backup = { id: string; at: number; reason: string; bytes: number; label?: string };

const KIND: Record<string, string> = {
  play: "When this sitting began",
  hourly: "Every hour",
  "before-restore": "Before a restore",
  manual: "Your backup",
};

const when = (at: number) => new Date(at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const size = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function CampaignWindow({ campaignId, leave }: { campaignId: string; leave: (force?: boolean) => void }) {
  const api = window.kraken;
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const manage = api?.manageCampaign;

  const load = useCallback(async () => {
    if (!manage || !campaignId) return;
    const status = (await manage({ action: "status", id: campaignId }).catch(() => null)) as { savedAt: number | null; unsaved: boolean } | null;
    if (status) {
      setSavedAt(status.savedAt);
      setUnsaved(status.unsaved);
    }
    const list = (await manage({ action: "backups", id: campaignId }).catch(() => null)) as { backups: Backup[] } | null;
    if (list) setBackups(list.backups);
  }, [manage, campaignId]);
  useEffect(() => {
    void load();
    // "Saved 2 minutes ago" stays true, and a save made by itself shows.
    const timer = window.setInterval(() => {
      tick((n) => n + 1);
      void load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const act = async (work: () => Promise<string>) => {
    setBusy(true);
    setNote("");
    try {
      setNote(await work());
      await load();
    } catch (error) {
      setNote(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (!manage) return <p className="hint">{GM("Saving and backups are in the GM's Maelstrom app.")}</p>;
  const ago = savedAt ? Math.round((Date.now() - savedAt) / 60000) : null;
  const savedText = savedAt ? (ago === 0 ? "Saved just now" : `Saved ${ago} minute${ago === 1 ? "" : "s"} ago`) : "Saved when anything changes";

  const save = () =>
    act(async () => {
      const done = (await manage({ action: "save", id: campaignId })) as { savedAt: number };
      setSavedAt(done.savedAt);
      return `Saved at ${new Date(done.savedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`;
    });
  const backUp = () =>
    act(async () => {
      const done = (await manage({ action: "backup", id: campaignId, label: label.trim() })) as { backup: Backup };
      setLabel("");
      return `Backed up${done.backup.label ? ` as "${done.backup.label}"` : ""}. Your backups are kept until you delete the campaign.`;
    });
  const restore = async (backup: Backup) => {
    const name = backup.label ? `"${backup.label}"` : `the backup from ${when(backup.at)}`;
    if (!(await askConfirm(`Put back ${name}? The table closes (players are disconnected), the campaign goes back to then, and what it is now is kept as a backup too. Host it again from My Campaigns.`, { ok: "Close the table and restore", danger: true }))) return;
    setBusy(true);
    leave(true);
    // The campaign is let go as the table closes; then it can be put back.
    let error = "";
    for (let wait = 0; wait < 40; wait++) {
      const status = (await manage({ action: "status", id: campaignId }).catch(() => null)) as { playing: boolean } | null;
      if (status && !status.playing) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    try {
      await manage({ action: "restore", id: campaignId, backup: backup.id });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    tellUser(error ? `Not restored: ${error}` : `Restored ${name}. Host the campaign again from My Campaigns to pick up from there.`);
  };
  const exportZip = () =>
    act(async () => {
      // The app asks where the .zip goes (a Save dialog); cancelled, nothing is written.
      const done = (await manage({ action: "export", id: campaignId })) as { path: string; bytes: number } | null;
      return done ? `Exported (${size(done.bytes)}) to ${done.path}` : "Not exported.";
    });
  const importZip = (file: File) =>
    act(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const done = (await manage({ action: "import", bytes })) as { campaign: { name: string } };
      return `Imported as "${done.campaign.name}". It is on My Campaigns: leave this table to host it.`;
    });

  return (
    <div className="campaign-window" data-window="campaign">
      <section className="campaign-save" aria-label="Saving">
        <p className="campaign-saved" data-saved={savedAt ?? ""}>
          <Icon name="save" size={18} /> {unsaved ? "Saving…" : savedText}
        </p>
        <p className="hint">Maelstrom saves the campaign by itself a moment after anything changes, and when you leave. Host it again later and the table is just as you left it.</p>
        <button type="button" data-action="campaign-save" disabled={busy} onClick={() => void save()}>
          <Icon name="save" size={16} /> Save now
        </button>
      </section>

      <form
        className="campaign-backup"
        aria-labelledby={`${labelId}-title`}
        onSubmit={(event) => {
          event.preventDefault();
          void backUp();
        }}
      >
        <h3 id={`${labelId}-title`}>Back up</h3>
        <label htmlFor={labelId}>Name it (optional)</label>
        <div className="campaign-backup-row">
          <input id={labelId} name="label" type="text" maxLength={80} value={label} placeholder="Before the dragon" onChange={(event) => setLabel(event.target.value)} />
          <button type="submit" data-action="campaign-backup" disabled={busy}>
            Back up now
          </button>
        </div>
      </form>

      <section className="campaign-backups" aria-label="Backups">
        <h3>Backups</h3>
        {backups.length ? (
          <ul>
            {backups.map((backup) => (
              <li key={backup.id} data-backup={backup.id}>
                <span className="campaign-backup-name">
                  {backup.label ?? KIND[backup.reason] ?? backup.reason}
                  <small>
                    {when(backup.at)} · {size(backup.bytes)}
                    {backup.label ? ` · ${KIND[backup.reason] ?? backup.reason}` : ""}
                  </small>
                </span>
                <button type="button" className="ghost" data-action="campaign-restore" disabled={busy} title="Close the table and put this backup back" onClick={() => void restore(backup)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">None yet: one is made each time you host, and every hour while you play.</p>
        )}
      </section>

      <section className="campaign-files" aria-label="Export and import">
        <h3>Export and import</h3>
        <div className="campaign-file-row">
          <button type="button" className="ghost" data-action="campaign-export" disabled={busy} title="The whole campaign as one .zip in Documents/Kraken VTT/Exports (to keep, or to take to another computer)" onClick={() => void exportZip()}>
            <Icon name="export" size={16} /> Export .zip
          </button>
          <button type="button" className="ghost" data-action="campaign-import" disabled={busy} title="A campaign exported as a .zip, added to My Campaigns as a new campaign" onClick={() => fileInput.current?.click()}>
            <Icon name="import" size={16} /> Import .zip
          </button>
          <button type="button" className="ghost" data-action="campaign-folder" title="Open the campaign's folder (its saves and backups)" onClick={() => void manage({ action: "folder", id: campaignId })}>
            <Icon name="folder" size={16} /> Folder
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importZip(file);
          }}
        />
      </section>

      {note ? (
        <p className="campaign-note" role="status" aria-live="polite">
          {note}
        </p>
      ) : null}
    </div>
  );
}
