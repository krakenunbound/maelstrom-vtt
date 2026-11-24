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
  // Each BECMI set played as its own game ("D&D BECMI Expert", "D&D BECMI Companion"...) uses the line's art.
  const names = ART_RULESETS[game] ?? (/^D&D BECMI\b/.test(String(game)) ? ART_RULESETS["D&D BECMI"] : undefined);
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
  // Not one that does not look like its race (review.json's list).
  const pairs = items.filter((item) => item.kind === "portrait" && item.pair && item.race && !item.unlike);
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

// --- Creatures (an NPC with no picture of its own) ------------------------------------------------------------------
// Words in a creature's name that are not the library's race names: the race (and class) they show.
const CREATURE_WORDS = {
  gnoll: { race: "Kholo" },
  "lizard man": { race: "Lizardfolk" },
  "lizard men": { race: "Lizardfolk" },
  lizardman: { race: "Lizardfolk" },
  "normal human": { race: "Human" },
  "normal man": { race: "Human" },
  human: { race: "Human" },
  bandit: { race: "Human", cls: ["Thief", "Rogue"] },
  brigand: { race: "Human", cls: ["Fighter", "Thief", "Rogue"] },
  thief: { race: "Human", cls: ["Thief", "Rogue"] },
  acolyte: { race: "Human", cls: ["Cleric"] },
  priest: { race: "Human", cls: ["Cleric"] },
  veteran: { race: "Human", cls: ["Fighter"] },
  medium: { race: "Human", cls: ["Magic-User", "Wizard"] },
  mage: { race: "Human", cls: ["Magic-User", "Wizard"] },
  noble: { race: "Human", cls: ["Noble", "Fighter"] },
  merchant: { race: "Human", cls: ["Merchant"] },
  // A class or a title alone ("Cleric of Balthac", "Lady Lillith", "Lord Kazakk"): a human of that kind.
  cleric: { race: "Human", cls: ["Cleric"] },
  fighter: { race: "Human", cls: ["Fighter"] },
  "magic-user": { race: "Human", cls: ["Magic-User", "Wizard"] },
  wizard: { race: "Human", cls: ["Wizard", "Magic-User"] },
  knight: { race: "Human", cls: ["Knight", "Paladin", "Fighter"] },
  paladin: { race: "Human", cls: ["Paladin", "Fighter"] },
  druid: { race: "Human", cls: ["Druid"] },
  lord: { race: "Human", cls: ["Noble", "Fighter"] },
  lady: { race: "Human", cls: ["Noble", "Fighter"] },
  captain: { race: "Human", cls: ["Fighter"] },
  lieutenant: { race: "Human", cls: ["Fighter"] },
  guard: { race: "Human", cls: ["Fighter"] },
};
// A creature's role from its name: the classes to prefer for its face.
const ROLE_WORDS = [
  [/\b(chief|chieftain|king|queen|captain|leader|warrior|guard|sentry|bodyguard|soldier|champion|lord)\b/i, ["Fighter", "Warrior", "Barbarian"]],
  [/\b(shaman|priest|cleric|witch ?doctor)\b/i, ["Cleric", "Druid", "Shaman"]],
  [/\b(wizard|mage|sorcerer|magic-user|caster)\b/i, ["Wizard", "Magic-User", "Sorcerer"]],
  [/\b(archer|scout|hunter|rider)\b/i, ["Ranger", "Fighter"]],
  [/\b(thief|rogue|sneak|assassin)\b/i, ["Rogue", "Thief", "Assassin"]],
];
// A stable number from a text (the record's id): the same creature keeps the same face.
const hashOf = (/** @type {string} */ text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
// The race a creature's name shows: the library's longest race name in it ("Hobgoblin" before "Goblin"), else a
// word above; with the classes its name suggests.
/** @param {string[]} races @param {string} name */
export function creatureRace(races, name) {
  const words = ` ${String(name ?? "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z' -]+/g, " ")} `;
  // Whole words only ("Goblin" is not in "Hobgoblin"); a plural too ("Goblins").
  const loose = words.replace(/-/g, " ");
  const known = [...races].sort((a, b) => b.length - a.length).find((race) => [words, loose].some((text) => text.includes(` ${race.toLowerCase()} `) || text.includes(` ${race.toLowerCase()}s `)));
  const alias = Object.keys(CREATURE_WORDS).sort((a, b) => b.length - a.length).find((word) => words.includes(` ${word} `) || words.includes(` ${word}s `));
  const race = known ?? (alias ? CREATURE_WORDS[alias].race : "");
  if (!race) return null;
  const role = ROLE_WORDS.find(([pattern]) => pattern.test(name))?.[1] ?? (alias && !known ? CREATURE_WORDS[alias].cls : undefined) ?? [];
  return { race, classes: role };
}
// A creature's portrait and its own token: of its race (its role's class when there is one), the same one each
// time for the same seed (its record's id), or null when the library has none of its kind.
/** @param {any[]} items @param {string} name @param {string} seed */
export function creaturePair(items, name, seed) {
  const portraits = items.filter((item) => item.kind === "portrait" && item.pair && item.race && !item.unlike);
  const found = creatureRace([...new Set(portraits.map((item) => item.race))], name);
  if (!found) return null;
  const ofRace = portraits.filter((item) => same(item.race, found.race));
  const ofRole = ofRace.filter((item) => found.classes.some((cls) => same(item.cls, cls)));
  const choices = (ofRole.length ? ofRole : ofRace).sort((a, b) => a.id.localeCompare(b.id));
  if (!choices.length) return null;
  const portrait = choices[hashOf(String(seed || name)) % choices.length];
  return { portrait: portrait.id, token: portrait.pair };
}

// The creature a token picture shows, from its file name: "Dire_Wolf_A1_Large_Beast_01" is "dire wolf",
// "Owlbear_A1_Large_Scale130_Monstrosity_01" is "owlbear" (the words before the variant code).
/** @param {string} name */
export const tokenCreature = (name) => String(name ?? "").replace(/[_-]+/g, " ").replace(/\s+[A-Z]\d+\b.*$/, "").replace(/\s+\d+$/, "").trim().toLowerCase();
const squash = (/** @type {string} */ text) => text.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z]+/g, "");
// A token of the creature's own kind from a token library (any picture whose file names it): the name exactly
// ("Owl Bear" is "Owlbear"), else one whose name holds every word of it ("Fire Beetle": "Giant Fire Beetle");
// the same one for the same seed. items: the art list's tokens that are not the character art's.
/** @param {any[]} items @param {string} name @param {string} seed */
export function creatureToken(items, name, seed) {
  const wanted = squash(name);
  const words = String(name ?? "").toLowerCase().replace(/\([^)]*\)/g, " ").split(/[^a-z]+/).filter((word) => word.length > 2);
  if (!wanted || !words.length) return null;
  // Never a placeholder (Fantasy Grounds' "tokens/placeholders/id-00373-Shrieker.png" is a card saying TOKEN); the
  // app's own token folders (kraken/: Forgotten Adventures) first, a campaign's folders only when they have none.
  const usable = items.filter((item) => item.kind === "token" && !item.pair && !item.video && !/placeholder/i.test(String(item.id)) && !/^id[-_ ]\d{3,}/i.test(String(item.name)));
  const last = words.at(-1) ?? "";
  const matching = (/** @type {any[]} */ tokens) => {
    const exact = tokens.filter((item) => squash(tokenCreature(item.name)) === wanted);
    if (exact.length) return exact;
    const near = tokens.filter((item) => {
      const base = tokenCreature(item.name);
      return base && words.every((word) => base.split(" ").includes(word) || base.split(" ").includes(word.replace(/s$/, "")));
    });
    if (near.length || words.length < 2) return near;
    // Last: the name's last word alone ("Normal Bat": a Bat).
    return tokens.filter((item) => tokenCreature(item.name) === last);
  };
  const own = matching(usable.filter((item) => String(item.id).startsWith("kraken/")));
  const choices = (own.length ? own : matching(usable)).sort((a, b) => a.id.localeCompare(b.id));
  return choices.length ? choices[hashOf(String(seed || name)) % choices.length].id : null;
}
