// Join a Game's lists, in the app: the player's past games (each one's state: a listed game's from
// maelstromvtt.com, one joined by address asked of the table itself) and the games hosted now on the Find a
// game list (docs/find-a-game.md). Picking one fills the Take your seat form; players connect straight to the GM.
import { useEffect, useMemo, useState } from "react";
import type { LobbyGame } from "../kraken";

export type PastGame = { name: string; address: string; port: number; password: string; at: number; lobbyId?: string; gm?: string; campaign?: string; ruleset?: string };
type State = "on" | "off" | "unreachable" | "checking";
const STATE_LABEL: Record<State, string> = { on: "Hosting now", off: "Not answering now", unreachable: "Hosting, but its port does not answer", checking: "Checking…" };
const keyOf = (game: PastGame) => game.lobbyId ?? `${game.address}:${game.port}`;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function Lock() {
  return (
    <span className="lobby-lock" title="Needs a password">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
      </svg>
      <span className="visually-hidden">Password</span>
    </span>
  );
}
function Refresh({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ghost lobby-refresh" aria-label="Refresh" title="Refresh" onClick={onClick}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
      </svg>
    </button>
  );
}

// The player's past games, with whether each is on now.
export function PastGames({ games, busy, onJoin, onEdit, onForget }: { games: PastGame[]; busy: boolean; onJoin: (game: PastGame) => void; onEdit: (game: PastGame) => void; onForget: (game: PastGame) => void }) {
  const [states, setStates] = useState<Record<string, State>>({});
  const [tick, setTick] = useState(0);
  const wanted = games.map(keyOf).join("|");
  useEffect(() => {
    let live = true;
    const kraken = window.kraken;
    if (!kraken) return;
    setStates((current) => Object.fromEntries(games.map((game) => [keyOf(game), current[keyOf(game)] ?? "checking"])));
    const listed = games.filter((game) => game.lobbyId);
    const direct = games.filter((game) => !game.lobbyId);
    void kraken
      .lobbyStatus?.(listed.map((game) => game.lobbyId as string))
      .then((reply) => {
        if (!live) return;
        const found = new Map((reply.games ?? []).map((game) => [game.id, game]));
        setStates((current) => ({
          ...current,
          ...Object.fromEntries(listed.map((game) => {
            const state = found.get(game.lobbyId as string);
            return [keyOf(game), !reply.ok ? "checking" : state?.reachable ? "on" : state?.online ? "unreachable" : "off"];
          })),
        }));
      })
      .catch(() => undefined);
    void kraken
      .tableProbe?.(direct.map(({ address, port }) => ({ address, port })))
      .then((open) => live && setStates((current) => ({ ...current, ...Object.fromEntries(direct.map((game, index) => [keyOf(game), open[index] ? "on" : "off"])) })))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, tick]);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section className="lobby-panel glass" aria-labelledby="past-games-title" data-panel="past-games">
      <div className="lobby-head">
        <h2 id="past-games-title">Your games</h2>
        <Refresh onClick={() => setTick((value) => value + 1)} />
      </div>
      {games.length === 0 ? <p className="hint">Games you join are kept here, each shown on or off.</p> : null}
      <ul className="past-games">
        {games.map((game) => {
          const state = states[keyOf(game)] ?? "checking";
          return (
            <li key={keyOf(game)} data-past={keyOf(game)} data-state={state}>
              <span className={`lobby-dot ${state}`} title={STATE_LABEL[state]}>
                <span className="visually-hidden">{STATE_LABEL[state]}</span>
              </span>
              <button type="button" className="past-join" disabled={busy} title={`Join as ${game.name}`} onClick={() => onJoin(game)}>
                <b>{game.campaign || `${game.address}:${game.port}`}</b>
                <small>{game.gm ? `${game.gm}${game.ruleset ? ` · ${game.ruleset}` : ""}` : "Joined by address"} · as {game.name}</small>
              </button>
              {game.password ? <Lock /> : null}
              <button type="button" className="ghost past-edit" title="Fill the form with it, to change something first" onClick={() => onEdit(game)}>
                Edit
              </button>
              <button type="button" className="ghost past-forget" aria-label={`Forget ${game.campaign || `${game.address}:${game.port}`}`} title="Forget it" onClick={() => onForget(game)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type SortKey = "gm" | "campaign" | "ruleset" | "players";
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "gm", label: "Host" },
  { key: "campaign", label: "Campaign" },
  { key: "ruleset", label: "Game" },
  { key: "players", label: "Players" },
];

// The games hosted now, from maelstromvtt.com.
export function OpenGames({ busy, onPick }: { busy: boolean; onPick: (game: LobbyGame) => void }) {
  const [games, setGames] = useState<LobbyGame[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "gm", dir: 1 });
  const load = () => {
    void window.kraken
      ?.lobbyGames?.()
      .then((reply) => {
        setError(reply.ok ? "" : reply.error ?? "The list is not answering.");
        if (reply.ok) setGames(reply.games ?? []);
      })
      .catch(() => setError("The list is not answering."));
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, []);
  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = (games ?? []).filter((game) => words.every((word) => `${game.gm} ${game.campaign} ${game.ruleset}`.toLowerCase().includes(word)));
    return [...list].sort((a, b) => sort.dir * (sort.key === "players" ? a.players - b.players : collator.compare(a[sort.key], b[sort.key])));
  }, [games, query, sort]);
  const open = (games ?? []).filter((game) => !game.locked).length;
  return (
    <section className="lobby-panel glass open-games" aria-labelledby="open-games-title" data-panel="open-games">
      <div className="lobby-head">
        <h2 id="open-games-title">Games hosted now</h2>
        <Refresh onClick={load} />
      </div>
      <input type="search" className="lobby-search" placeholder="Search by host, campaign or game" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search the games" />
      <div className="lobby-table" role="region" aria-labelledby="open-games-title" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col" className="lock-col">
                <span className="visually-hidden">Password</span>
              </th>
              {COLUMNS.map((column) => (
                <th key={column.key} scope="col" aria-sort={sort.key === column.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined} className={column.key === "players" ? "num" : undefined}>
                  <button type="button" onClick={() => setSort((current) => ({ key: column.key, dir: current.key === column.key ? (-current.dir as 1 | -1) : 1 }))}>
                    {column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((game) => (
              <tr key={game.id} data-game={game.id}>
                <td className="lock-col">{game.locked ? <Lock /> : null}</td>
                <td>
                  <button type="button" className="lobby-pick" disabled={busy} title={`Join ${game.campaign}`} onClick={() => onPick(game)}>
                    {game.gm}
                  </button>
                </td>
                <td title={game.campaign}>{game.campaign}</td>
                <td>{game.ruleset}</td>
                <td className="num">{game.players}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {games && games.length === 0 ? <p className="hint lobby-empty">No one is hosting a listed game right now. GMs list theirs with List this game when they host over the internet.</p> : null}
        {!games && !error ? <p className="hint lobby-empty">Looking…</p> : null}
      </div>
      <p className="hint lobby-count" role="status">
        {error || (games && games.length ? `${shown.length === games.length ? games.length : `${shown.length} of ${games.length}`} games · ${open} without a password` : "")}
      </p>
    </section>
  );
}
