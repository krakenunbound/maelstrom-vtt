-- The Find a game list (src/worker.js). Apply: npx wrangler d1 execute maelstrom-lobby --remote --file schema.sql
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,          -- the campaign's listing id, made by the GM's app
  key_hash TEXT NOT NULL,       -- SHA-256 of the GM's app key: only that app may change or close the listing
  gm TEXT NOT NULL,
  campaign TEXT NOT NULL,
  ruleset TEXT NOT NULL,
  locked INTEGER NOT NULL,      -- 1: the table has a password
  players INTEGER NOT NULL,
  ip TEXT NOT NULL,             -- the address the check-in came from (never one the app claims)
  port INTEGER NOT NULL,
  version TEXT NOT NULL,
  reachable INTEGER NOT NULL,   -- 1: the Worker could open a connection to ip:port
  last_seen INTEGER NOT NULL,   -- ms; set just past the online window when the GM stops hosting
  first_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS games_seen ON games (last_seen);
CREATE INDEX IF NOT EXISTS games_ip ON games (ip, last_seen);
