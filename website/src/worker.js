// maelstromvtt.com: the static site (public/) and the Find a game list's API (/api/lobby/*).
// A GM's Maelstrom app that ticked "List this game" checks in every few minutes; the list shows the games
// seen lately whose port answers. The list only points at tables: players connect straight to the GM.
import { connect } from "cloudflare:sockets";

const ONLINE_MS = 7 * 60 * 1000; // the app checks in every 3 minutes
const KEEP_MS = 60 * 24 * 60 * 60 * 1000; // a listing not seen for 60 days is deleted
const PER_ADDRESS = 5; // games listed at once from one address
const ID = /^[A-Za-z0-9_-]{16,40}$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const text = (value, max) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
const isV4 = (ip) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(ip) && ip.split(".").every((part) => Number(part) <= 255);

async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Whether the GM's table answers at ip:port (a TCP connection opened, then closed).
async function reachable(ip, port) {
  let socket;
  try {
    socket = connect({ hostname: ip, port });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
    await Promise.race([socket.opened, timeout]);
    return true;
  } catch {
    return false;
  } finally {
    socket?.close().catch(() => undefined);
  }
}

async function readBody(request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return null;
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

async function checkin(request, env) {
  const body = await readBody(request);
  if (!body) return json({ error: "Bad request." }, 400);
  const id = String(body.id ?? "");
  const key = String(body.key ?? "");
  const port = Number(body.port);
  if (!ID.test(id) || key.length < 24 || key.length > 128) return json({ error: "Bad listing id or key." }, 400);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 25) return json({ error: "Bad port." }, 400);
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  if (!isV4(ip)) return json({ error: "Listing needs an IPv4 address." }, 400);
  const keyHash = await sha256(key);
  const now = Date.now();
  const existing = await env.LOBBY.prepare("SELECT key_hash, first_seen FROM games WHERE id = ?").bind(id).first();
  if (existing && existing.key_hash !== keyHash) return json({ error: "This listing belongs to another app." }, 403);
  const others = await env.LOBBY.prepare("SELECT COUNT(*) AS n FROM games WHERE ip = ? AND id != ? AND last_seen > ?").bind(ip, id, now - ONLINE_MS).first();
  if ((others?.n ?? 0) >= PER_ADDRESS) return json({ error: "Too many games listed from this address." }, 429);
  const open = await reachable(ip, port);
  const row = {
    gm: text(body.gm, 24) || "GM",
    campaign: text(body.campaign, 60) || "Untitled",
    ruleset: text(body.ruleset, 40),
    locked: body.locked ? 1 : 0,
    players: Math.max(0, Math.min(99, Math.floor(Number(body.players) || 0))),
    version: text(body.version, 32),
  };
  await env.LOBBY.prepare(
    `INSERT INTO games (id, key_hash, gm, campaign, ruleset, locked, players, ip, port, version, reachable, last_seen, first_seen)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)
     ON CONFLICT(id) DO UPDATE SET gm = ?3, campaign = ?4, ruleset = ?5, locked = ?6, players = ?7, ip = ?8, port = ?9, version = ?10, reachable = ?11, last_seen = ?12`,
  )
    .bind(id, keyHash, row.gm, row.campaign, row.ruleset, row.locked, row.players, ip, port, row.version, open ? 1 : 0, now)
    .run();
  return json({ ok: true, reachable: open, address: `${ip}:${port}` });
}

async function close(request, env) {
  const body = await readBody(request);
  if (!body || !ID.test(String(body.id ?? ""))) return json({ error: "Bad request." }, 400);
  const keyHash = await sha256(String(body.key ?? ""));
  // Seen just too long ago to count as on: offline at once, and still kept for the players' history.
  await env.LOBBY.prepare("UPDATE games SET last_seen = ? WHERE id = ? AND key_hash = ?").bind(Date.now() - ONLINE_MS - 1, String(body.id), keyHash).run();
  return json({ ok: true });
}

const PUBLIC = "id, gm, campaign, ruleset, locked, players, version";

async function games(env) {
  const { results } = await env.LOBBY.prepare(`SELECT ${PUBLIC} FROM games WHERE last_seen > ? AND reachable = 1 ORDER BY gm COLLATE NOCASE LIMIT 1000`)
    .bind(Date.now() - ONLINE_MS)
    .all();
  return json({ games: results.map((row) => ({ ...row, locked: Boolean(row.locked) })) });
}

// The player's past games: each one's listing as it stands, and whether it is on now.
async function status(url, env) {
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => ID.test(id))
    .slice(0, 50);
  if (!ids.length) return json({ games: [] });
  const { results } = await env.LOBBY.prepare(`SELECT ${PUBLIC}, reachable, last_seen FROM games WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all();
  const since = Date.now() - ONLINE_MS;
  return json({
    games: results.map(({ reachable: open, last_seen: seen, ...row }) => ({ ...row, locked: Boolean(row.locked), online: seen > since, reachable: seen > since && Boolean(open) })),
  });
}

// A game's address, given only when a player asks to join it.
async function join(url, env) {
  const id = url.searchParams.get("id") ?? "";
  if (!ID.test(id)) return json({ error: "Bad request." }, 400);
  const row = await env.LOBBY.prepare("SELECT ip, port, last_seen FROM games WHERE id = ?").bind(id).first();
  if (!row || row.last_seen <= Date.now() - ONLINE_MS) return json({ error: "That game is not being hosted now." }, 404);
  return json({ url: `http://${row.ip}:${row.port}/`, address: row.ip, port: row.port });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // One address for the list, so a player's history (kept by the browser per site) is not split in two.
    if (url.hostname === "www.maelstromvtt.com") return Response.redirect(`https://maelstromvtt.com${url.pathname}${url.search}`, 301);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const route = `${request.method} ${url.pathname}`;
    try {
      if (route === "POST /api/lobby/checkin") return await checkin(request, env);
      if (route === "POST /api/lobby/close") return await close(request, env);
      if (route === "GET /api/lobby/games") return await games(env);
      if (route === "GET /api/lobby/status") return await status(url, env);
      if (route === "GET /api/lobby/join") return await join(url, env);
    } catch (error) {
      console.error(error);
      return json({ error: "The list is not answering. Try again soon." }, 500);
    }
    return json({ error: "Not found." }, 404);
  },
  async scheduled(_event, env) {
    await env.LOBBY.prepare("DELETE FROM games WHERE last_seen < ?").bind(Date.now() - KEEP_MS).run();
  },
};
