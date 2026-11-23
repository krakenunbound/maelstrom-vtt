// The character art library (games/characters, scripts/import-character-art.mjs, docs/character-art.md): portrait and
// token pairs by race, class or role and gender. Which of them a campaign's game uses, and the pair a new character
// gets: its race, class and gender if there is one, else the nearest (race and class, race and gender, race), chosen
// at random among those that fit. Shared by the host (a character built) and the wizards (the picture shown first).

// Maelstrom's games and the library's names for the systems whose art fits them. A game not here (Worldbuilding,
// Fate, Ironsworn, Cairn...) uses the art shared by every system (in_common).
export const ART_RULESETS = {
  "D&D 5E": ["D&D 5e (2014)", "D&D 5e (2024)"],
  "Descending Darkness": ["D&D 5e (2014)", "D&D 5e (2024)"],
  "D&D 3.5E": ["D&D 3.5e", "D&D 3.0e"],
  "AD&D 2E": ["AD&D 2e", "AD&D 1e"],
  "Castles & Crusades": ["Castles & Crusades"],
  Traveller: ["Traveller 2e (2022)"],
  "Forged in the Dark": ["Blades in the Dark"],
  "Basic Fantasy": ["Old School Essentials", "D&D Basic (B/X)"],
  "D&D BECMI": ["D&D BECMI Basic", "D&D BECMI Expert", "D&D BECMI Companion", "D&D BECMI Master", "D&D BECMI / Rules Cyclopedia", "D&D Immortals Rules"],
  "Apeira Astra": ["Starfinder 1e", "Starfinder 2e"],
};
export const COMMON = "in_common";

// Whether a pair (its folder's ruleset and the systems it serves) belongs in a campaign of this game.
/** @param {{ ruleset: string, rulesets?: string[] }} pair @param {string} game */
export function servesGame(pair, game) {
  const names = ART_RULESETS[game];
  if (!names) return pair.ruleset === COMMON;
  return (pair.rulesets ?? []).some((name) => names.includes(name)) || names.includes(pair.ruleset);
}

// "Female", "Male", or "" from what a sheet or wizard says (f, woman, she...).
/** @param {unknown} text */
export function genderOf(text) {
  const words = String(text ?? "").trim().toLowerCase();
  if (!words) return "";
  if (/^(f|female|woman|girl|she|lady|her)\b/.test(words)) return "Female";
  if (/^(m|male|man|boy|he|him|gentleman)\b/.test(words)) return "Male";
  return "";
}

const same = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

// The portraits that fit, best first: race, class and gender; race and class; race and gender; race; else (no race
// match) class and gender. items: the art list's portraits that carry their pair (race, cls, gender, pair).
/** @param {any[]} items @param {{ race?: string, cls?: string, gender?: string }} want */
export function fitting(items, { race = "", cls = "", gender = "" }) {
  const pairs = items.filter((item) => item.kind === "portrait" && item.pair && item.race);
  const g = genderOf(gender);
  const tiers = [
    (item) => same(item.race, race) && same(item.cls, cls) && (!g || item.gender === g),
    (item) => same(item.race, race) && same(item.cls, cls),
    (item) => same(item.race, race) && (!g || item.gender === g),
    (item) => same(item.race, race),
    (item) => cls && same(item.cls, cls) && (!g || item.gender === g),
  ];
  for (const test of tiers) {
    const found = pairs.filter(test);
    if (found.length) return found;
  }
  return [];
}

// A pair at random among the best that fit: { portrait, token } ids, or null. avoid: a portrait id not to give again
// (a gender rolled again shows another face when there is one).
/** @param {any[]} items @param {{ race?: string, cls?: string, gender?: string }} want @param {{ random?: () => number, avoid?: string }} [opts] */
export function pickPair(items, want, { random = Math.random, avoid = "" } = {}) {
  const found = fitting(items, want);
  const choices = found.length > 1 ? found.filter((item) => item.id !== avoid) : found;
  if (!choices.length) return null;
  const portrait = choices[Math.floor(random() * choices.length) % choices.length];
  return { portrait: portrait.id, token: portrait.pair };
}
