// Find a game: the games listed now (/api/lobby/games), the player's own past games (kept in this browser, their
// state from /api/lobby/status), and joining by address. Joining goes straight to the GM's table, in the browser
// (its address, the password in the #fragment, as an invite link) or in Maelstrom (a maelstrom:// link).
const HISTORY_KEY = "mvtt-history";
const table = document.querySelector("#games");
const tbody = table.tBodies[0];
const search = document.querySelector("#search");
const count = document.querySelector("#count");
const empty = document.querySelector("#list-empty");
const sortStatus = document.querySelector("#sort-status");
const historyList = document.querySelector("#history");
const historyEmpty = document.querySelector("#history-empty");
const dialog = document.querySelector("#join");
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const lockIcon = () => {
  const span = el("span", { className: "lock", title: "Needs a password" });
  span.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z"/></svg>';
  span.append(el("span", { className: "visually-hidden", textContent: "Password" }));
  return span;
};

// --- History, in this browser only.
function readHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function writeHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* kept for this visit only */
  }
}
const sameGame = (a, b) => (a.id ? a.id === b.id : !b.id && a.address === b.address && Number(a.port) === Number(b.port));
function remember(game) {
  writeHistory([{ ...game, at: Date.now() }, ...readHistory().filter((other) => !sameGame(other, game))]);
  renderHistory();
}

// --- Going to a table.
const pwFragment = (password) => (password ? `#pw=${encodeURIComponent(password)}` : "");
function openBrowser(url, password) {
  window.location.assign(`${url}${pwFragment(password)}`);
}
function openApp(address, port) {
  window.location.assign(`maelstrom://join?address=${encodeURIComponent(address)}&port=${encodeURIComponent(port)}`);
}
async function joinListed(game, how, password) {
  const response = await fetch(`/api/lobby/join?id=${encodeURIComponent(game.id)}`);
  const reply = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(reply.error ?? "That game could not be found.");
  remember({ id: game.id, gm: game.gm, campaign: game.campaign, ruleset: game.ruleset, locked: game.locked });
  if (how === "app") openApp(reply.address, reply.port);
  else openBrowser(reply.url, password);
}

// The join dialog: a password when the game has one, then the browser or Maelstrom.
let joining = null;
function askJoin(game) {
  joining = game;
  dialog.querySelector("#join-title").textContent = `Join ${game.campaign}`;
  dialog.querySelector("#join-what").textContent = `Hosted by ${game.gm}${game.ruleset ? ` · ${game.ruleset}` : ""}`;
  dialog.querySelector("#join-password-field").hidden = !game.locked;
  dialog.querySelector("#join-error").textContent = "";
  dialog.querySelector("#join-form").reset();
  // A dialog keeps its last answer: closed with Escape, it must not repeat it.
  dialog.returnValue = "";
  dialog.showModal();
}
dialog.addEventListener("close", async () => {
  const how = dialog.returnValue;
  const game = joining;
  joining = null;
  if (!game || (how !== "browser" && how !== "app")) return;
  const password = dialog.querySelector("input[name=password]").value;
  try {
    await joinListed(game, how, password);
  } catch (error) {
    joining = game;
    dialog.querySelector("#join-error").textContent = error.message;
    dialog.returnValue = "";
    dialog.showModal();
  }
});

// --- The list of games hosted now.
let games = [];
function gameRow(game) {
  const join = el("button", { type: "button", className: "btn small", textContent: "Join" });
  join.addEventListener("click", () => askJoin(game));
  const row = el(
    "tr",
    {},
    el("td", { className: "lock-col" }, game.locked ? lockIcon() : ""),
    el("td", { className: "join-col" }, join),
    el("td", { textContent: game.gm }),
    el("td", { textContent: game.campaign }),
    el("td", { textContent: game.ruleset }),
    el("td", { className: "num", textContent: String(game.players) }),
  );
  row.dataset.search = `${game.gm} ${game.campaign} ${game.ruleset}`.toLowerCase();
  return row;
}
function applyFilter() {
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const row of tbody.rows) {
    row.hidden = !words.every((word) => row.dataset.search.includes(word));
    if (!row.hidden) shown += 1;
  }
  const open = games.filter((game) => !game.locked).length;
  count.textContent = games.length ? `${shown === games.length ? games.length : `${shown} of ${games.length}`} games · ${open} without a password` : "";
  empty.hidden = games.length > 0;
}
async function loadGames() {
  try {
    const response = await fetch("/api/lobby/games", { cache: "no-store" });
    games = (await response.json()).games ?? [];
  } catch {
    count.textContent = "The list is not answering. Try again soon.";
    return;
  }
  tbody.replaceChildren(...games.map(gameRow));
  const sorted = table.tHead.querySelector("th[aria-sort]");
  if (sorted) sortRows(sorted, sorted.getAttribute("aria-sort"));
  applyFilter();
}

// Sorting: by the header buttons (invoker commands, a click where there are none).
const move = (row) => (tbody.moveBefore ? tbody.moveBefore(row, null) : tbody.append(row));
function sortRows(th, direction) {
  const factor = direction === "ascending" ? 1 : -1;
  const index = th.cellIndex;
  const value = (row) => row.cells[index].textContent.trim();
  const rows = [...tbody.rows].sort((a, b) => factor * (th.dataset.type === "number" ? Number(value(a)) - Number(value(b)) : collator.compare(value(a), value(b))));
  rows.forEach(move);
}
function sortBy(button) {
  const th = button.closest("th");
  const direction = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
  for (const header of table.tHead.rows[0].cells) header.removeAttribute("aria-sort");
  th.setAttribute("aria-sort", direction);
  sortRows(th, direction);
  sortStatus.textContent = `Sorted by ${button.textContent.trim()}, ${direction}`;
}
table.addEventListener("command", (event) => {
  if (event.command === "--sort") sortBy(event.source);
});
if (!("commandForElement" in HTMLButtonElement.prototype)) {
  for (const button of table.tHead.querySelectorAll('button[command="--sort"]')) button.addEventListener("click", () => sortBy(button));
}
search.addEventListener("input", applyFilter);
document.querySelector("#refresh").addEventListener("click", () => {
  void loadGames();
  void refreshHistory();
});

// --- The player's games, each with whether it is on now.
let states = new Map();
function renderHistory() {
  const list = readHistory();
  historyEmpty.hidden = list.length > 0;
  historyList.replaceChildren(
    ...list.map((game) => {
      const state = game.id ? states.get(game.id) : null;
      const live = game.id ? (state ? { ...game, ...state } : game) : game;
      const status = !game.id ? "direct" : !state ? "unknown" : state.reachable ? "on" : state.online ? "unreachable" : "off";
      const label = { direct: "Joined by address", unknown: "Checking", on: "Hosting now", unreachable: "Hosting, but its port does not answer", off: "Not hosting now" }[status];
      const dot = el("span", { className: `dot ${status}`, title: label }, el("span", { className: "visually-hidden", textContent: label }));
      const title = game.id ? `${live.campaign}` : `${game.address}:${game.port}`;
      const detail = game.id ? `${live.gm}${live.ruleset ? ` · ${live.ruleset}` : ""}` : "On your network or the internet";
      const play = el("button", { type: "button", className: "btn small", textContent: "Join", disabled: game.id ? status === "off" : false });
      play.addEventListener("click", () => {
        if (game.id) askJoin(live);
        else {
          const form = document.querySelector("#lan-form");
          form.address.value = game.address;
          form.port.value = game.port;
          form.password.focus();
        }
      });
      const forget = el("button", { type: "button", className: "icon-button", title: "Forget it", ariaLabel: `Forget ${title}`, textContent: "×" });
      forget.addEventListener("click", () => {
        writeHistory(readHistory().filter((other) => !sameGame(other, game)));
        renderHistory();
      });
      return el("li", {}, dot, el("span", { className: "what" }, el("strong", { textContent: title }), el("small", { textContent: detail })), game.locked ? lockIcon() : "", play, forget);
    }),
  );
}
async function refreshHistory() {
  const ids = readHistory()
    .filter((game) => game.id)
    .map((game) => game.id);
  if (ids.length) {
    try {
      const reply = await (await fetch(`/api/lobby/status?ids=${ids.join(",")}`, { cache: "no-store" })).json();
      states = new Map((reply.games ?? []).map((game) => [game.id, game]));
      // A game no longer listed at all is off.
      for (const id of ids) if (!states.has(id)) states.set(id, { online: false, reachable: false });
    } catch {
      /* shown as checking */
    }
  }
  renderHistory();
}

// --- Join by address.
document.querySelector("#lan-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  let address = form.address.value.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  // "address:port" typed together.
  const both = address.match(/^([^:\]]+|\[[^\]]+\]):(\d+)$/);
  if (both) [address, form.port.value] = [both[1].replace(/^\[|\]$/g, ""), both[2]];
  const port = Number(form.port.value);
  if (!address || !Number.isInteger(port)) return;
  remember({ address, port });
  if (event.submitter?.value === "app") openApp(address, port);
  else openBrowser(`http://${address.includes(":") ? `[${address}]` : address}:${port}/`, form.password.value);
});

renderHistory();
void loadGames();
void refreshHistory();
setInterval(() => {
  if (document.visibilityState === "visible") {
    void loadGames();
    void refreshHistory();
  }
}, 90000);
