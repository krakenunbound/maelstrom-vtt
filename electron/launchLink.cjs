// maelstrom:// links (Find a game's "Open in Maelstrom" on maelstromvtt.com): maelstrom://join?address=…&port=…
// started this copy. Only a table's address and port are taken, checked, and only to fill Join a Game: a link
// never connects by itself, and carries no password.
const HOST = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,62})(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}))*|[0-9A-Fa-f:.]{2,45})$/;

function parseLaunchLink(argv) {
  const raw = (argv ?? []).find((arg) => typeof arg === "string" && /^maelstrom:\/\//i.test(arg));
  if (!raw || raw.length > 400) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.hostname !== "join" && url.pathname.replace(/^\/+/, "") !== "join") return null;
  const address = (url.searchParams.get("address") ?? "").replace(/^\[|\]$/g, "");
  const port = Number(url.searchParams.get("port"));
  if (!HOST.test(address) || address.length > 253) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { address, port };
}

module.exports = { parseLaunchLink };
