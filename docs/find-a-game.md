# Find a game (maelstromvtt.com/find/)

A list of the games GMs are hosting now, on the website, so players can find
a table, get back to the games they played before, and join in their browser
or in Maelstrom. The list only points the way: players connect straight to
the GM's table, as with an invite link. Hosting, invite links and LAN play
work the same with the list off, or if the website is down.

## 1. The GM: List this game

On the start screen, with **Internet** on, the GM ticks **List this game on
maelstromvtt.com** (remembered on that computer). When the table starts, the
app (`electron/lobby.cjs`) checks in every 3 minutes with the campaign's name,
the GM's name, the ruleset, whether there is a password, the players seated
and the port. Stopping takes it off at once. The invite card says how it
went: on the list; listed but the site could not reach the port (players do
not see it until the port is open); or not listed, and why. A failure never
stops the table.

- **One key per computer** (`preferences.json` `lobby.key`, never in a
  campaign) and **one listing id per campaign** (`lobby.ids`): the same
  campaign is the same game in players' histories, whatever its address
  today.
- `kraken_host` takes `listed`; its `invites.listed` says what the site said.
- `KRAKEN_LOBBY_URL` points the app at another list (`wrangler dev`).

## 2. The website

`website/src/worker.js` runs before the static site for `/api/*` and `/find`
(and sends `www.` to the plain address, so a player's history is in one
place). The listings are in the D1 database `maelstrom-lobby`
(`website/schema.sql`).

| Call | What it does |
|---|---|
| `POST /api/lobby/checkin` | `{id, key, gm, campaign, ruleset, locked, players, port, version}`. The address is the one the check-in came from (IPv4), never one the app gives. The Worker opens a TCP connection to it (`cloudflare:sockets`, 4 s) and keeps whether it answered. Only the key that made a listing may change it (its SHA-256 is kept). At most 5 games listed at once from one address; fields cut to length. |
| `POST /api/lobby/close` | `{id, key}`: off the list at once, kept for players' histories. |
| `GET /api/lobby/games` | The games seen in the last 7 minutes whose port answered: no addresses. |
| `GET /api/lobby/status?ids=` | Each of a player's past games: its listing, `online`, `reachable`. |
| `GET /api/lobby/join?id=` | The table's address, only when someone joins it. |

A listing not seen for 60 days is deleted (a daily cron).

## 3. The players: the page

- **Open games:** sortable by host, campaign, game and players (header
  buttons, invoker commands with a click fallback), searched by any word,
  a lock on games with a password. Join asks for the password when there is
  one, then **Play in browser** (the table's address, the password in the
  `#pw=` fragment as in an invite link) or **Open in Maelstrom**.
- **Your games:** the games joined from the page, kept in that browser
  (`localStorage` `mvtt-history`): green when on, red when off, amber when on
  but its port does not answer; games joined by address are grey (a website
  may not look at a home network).
- **Join by address:** an address and port (and password), for a LAN game
  or an address the GM gave.

## 4. maelstrom:// links

`maelstrom://join?address=…&port=…` opens Maelstrom on Join a Game with the
address and port filled in (`electron/launchLink.cjs`; the player still
presses Connect; a link carries no password). The installers register the
link type (`build.protocols`), and a packaged copy registers it again when it
runs (not yet tried on an installed copy, nor on the AppImage, which registers
links only when the desktop integrates it). A browser asks before opening it. Maelstrom takes no single-instance lock
(a GM and a player copy run side by side), so a link opens a new copy.

## 5. Running it

```powershell
npm run lobby
```

checks the app's side against a fake list (and the link parser). The site
locally, with its database:

```powershell
cd website; npx wrangler d1 execute maelstrom-lobby --local --file schema.sql; npx wrangler dev
```

Deploy with `npx wrangler deploy` from `website/`. The site before the list
was version `391a2a1d-cd2a-47f0-a301-fa449ea99e92`
(`npx wrangler rollback 391a2a1d-cd2a-47f0-a301-fa449ea99e92`).
