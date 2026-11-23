// @ts-check
// A game read from a pack's game.json, registered as a game (both the host and every seat call this).
import { readGame } from "./definition.mjs";
import { manifestOf } from "./manifest.mjs";
import { registerGame } from "../rulesets/registry.mjs";

/** @param {unknown} raw the game.json, or a definition already read */
export function registerPackGame(raw) {
  const game = readGame(raw);
  return registerGame(/** @type {any} */ (manifestOf(game)));
}
