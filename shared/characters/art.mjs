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
  // "Giant" before another word only says its size (a Giant Bat is a bat, not a giant; a Hill Giant is one).
  const words = ` ${String(name ?? "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z' -]+/g, " ").replace(/\bgiant\s+(?=[a-z])/g, "")} `;
  // Whole words only ("Goblin" is not in "Hobgoblin"); a plural too ("Goblins").
  const loose = words.replace(/-/g, " ");
  const known = [...races].sort((a, b) => b.length - a.length).find((race) => [words, loose].some((text) => text.includes(` ${race.toLowerCase()} `) || text.includes(` ${race.toLowerCase()}s `)));
  const alias = Object.keys(CREATURE_WORDS).sort((a, b) => b.length - a.length).find((word) => words.includes(` ${word} `) || words.includes(` ${word}s `));
  const race = known ?? (alias ? CREATURE_WORDS[alias].race : "");
  if (!race) return null;
  const role = ROLE_WORDS.find(([pattern]) => pattern.test(name))?.[1] ?? (alias && !known ? CREATURE_WORDS[alias].cls : undefined) ?? [];
  // byWord: only a class or a title said it (a "Lord", a "Cleric"), not a race: its record's kind may say better.
  return { race, classes: role, ...(known ? {} : { byWord: true }) };
}
// What a creature's record says it is, beyond its name: its description's kind words ("9-HD nosferatu": a vampire;
// "Turn Undead holds the creature": undead), its class (its "Save As" code C5, MU5, or "Cleric 5" in its text), its
// gender (a title, Lady or Lord; its text's he or she). The words its kind shows a token by ("Zombie").
const KIND_WORDS = [
  [/\b(nosferatu|vampire)\b/i, { race: "Vampire" }],
  [/\bdrow\b/i, { race: "Drow" }],
  [/\b(lightning zombie|zombie)\b/i, { token: "Zombie" }],
  [/\bskeleton\b/i, { token: "Skeleton" }],
  [/\bghoul\b/i, { token: "Ghoul" }],
  [/\bwight\b/i, { token: "Wight" }],
  [/\bmummy\b/i, { token: "Mummy" }],
  [/\b(demon|tanar'?ri)\b/i, { token: "Demon" }],
  [/\bdevil\b/i, { token: "Devil" }],
  // Turned or held by Turn Undead: undead, a zombie's look unless it says more.
  [/\bturn undead\b/i, { token: "Zombie" }],
];
const SAVE_CLASSES = { C: ["Cleric"], MU: ["Magic-User", "Wizard"], M: ["Magic-User", "Wizard"], F: ["Fighter"], T: ["Thief", "Rogue"], D: ["Fighter"], E: ["Fighter", "Wizard"], H: ["Fighter"], DR: ["Druid"], MY: ["Monk"] };
/** @param {{ name?: string, data?: any } | string} who */
export function creatureProfile(who) {
  const name = typeof who === "string" ? who : String(who?.name ?? "");
  const data = typeof who === "string" ? {} : (who?.data ?? {});
  const text = String(data.text ?? data.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const kind = KIND_WORDS.find(([pattern]) => pattern.test(name))?.[1] ?? KIND_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  const code = /^\s*([A-Z]+)\s*\d/.exec(String(data.saveas ?? data.saveAs ?? "").toUpperCase())?.[1] ?? "";
  const textClass = /\b(cleric|magic-user|wizard|fighter|thief|druid)\s+\d+/i.exec(text)?.[1]?.toLowerCase() ?? "";
  const classes = textClass ? (textClass === "magic-user" || textClass === "wizard" ? ["Magic-User", "Wizard"] : [textClass[0].toUpperCase() + textClass.slice(1)]) : (SAVE_CLASSES[code] ?? []);
  // A class from its save or text means a person (a human unless something says otherwise); a plain monster's
  // "Save As F2" does not, so only when its name or text names the class or its save is a caster's.
  const person = Boolean(textClass) || ["C", "MU", "M", "T", "DR"].includes(code);
  const titled = /\b(lady|queen|princess|duchess|baroness|countess|mistress|priestess|sister|mother|madam|witch)\b/i.test(name) ? "Female" : /\b(lord|king|prince|duke|baron|count|sir|master|brother|father)\b/i.test(name) ? "Male" : "";
  const she = (text.match(/\b(she|her|hers|herself)\b/gi) ?? []).length;
  const he = (text.match(/\b(he|him|his|himself)\b/gi) ?? []).length;
  const gender = titled || (she > he ? "Female" : he > she ? "Male" : "");
  return { name, text, kind, classes, person, gender };
}
// A creature's portrait and its own token: of its race (its name's, else its record's kind or a person's: human),
// its class (its role's, its save's), its gender when known; the same one each time for the same seed (its
// record's id), or null when the library has none of its kind. who: a record ({ name, data }) or a name.
/** @param {any[]} items @param {{ name?: string, data?: any } | string} who @param {string} seed */
export function creaturePair(items, who, seed) {
  const portraits = items.filter((item) => item.kind === "portrait" && item.pair && item.race && !item.unlike);
  const profile = creatureProfile(who);
  const fromName = creatureRace([...new Set(portraits.map((item) => item.race))], profile.name);
  // A race its name gives wins; a class or title in its name ("Lord", "Cleric") does not beat its record's kind.
  const named = fromName && !fromName.byWord ? fromName : null;
  // A kind its record shows that is not a race (a zombie): its token, not a face.
  if (!named && profile.kind?.token) return null;
  const race = named?.race ?? profile.kind?.race ?? fromName?.race ?? (profile.person ? "Human" : "");
  if (!race) return null;
  const classes = profile.classes.length ? profile.classes : (fromName?.classes ?? []);
  const ofRace = portraits.filter((item) => same(item.race, race));
  const ofGender = profile.gender ? ofRace.filter((item) => item.gender === profile.gender) : ofRace;
  const pool = ofGender.length ? ofGender : ofRace;
  const ofRole = pool.filter((item) => classes.some((cls) => same(item.cls, cls)));
  const choices = (ofRole.length ? ofRole : pool).sort((a, b) => a.id.localeCompare(b.id));
  if (!choices.length) return null;
  const portrait = choices[hashOf(String(seed || profile.name)) % choices.length];
  return { portrait: portrait.id, token: portrait.pair };
}

// The creature a token picture shows, from its file name: "Dire_Wolf_A1_Large_Beast_01" is "dire wolf",
// "Owlbear_A1_Large_Scale130_Monstrosity_01" is "owlbear" (the words before the variant code).
/** @param {string} name */
export const tokenCreature = (name) => String(name ?? "").replace(/[_ ](portrait|token)$/i, "").replace(/[_-]+/g, " ").replace(/\s+[A-Z]\d+\b.*$/, "").replace(/\s+\d+$/, "").trim().toLowerCase();
const squash = (/** @type {string} */ text) => text.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z]+/g, "");
// A token of the creature's own kind from a token library (any picture whose file names it): the name exactly
// ("Owl Bear" is "Owlbear"), else one whose name holds every word of it ("Fire Beetle": "Giant Fire Beetle");
// the same one for the same seed. items: the art list's tokens that are not the character art's.
/** @param {any[]} items @param {string} name @param {string} seed @param {"token" | "portrait"} [kind] */
export function creatureToken(items, name, seed, kind = "token") {
  const wanted = squash(name);
  const words = String(name ?? "").toLowerCase().replace(/\([^)]*\)/g, " ").split(/[^a-z]+/).filter((word) => word.length > 2);
  if (!wanted || !words.length) return null;
  // Never a placeholder (Fantasy Grounds' "tokens/placeholders/id-00373-Shrieker.png" is a card saying TOKEN); the
  // app's own token folders (kraken/: Forgotten Adventures) first, a campaign's folders only when they have none.
  const usable = items.filter((item) => item.kind === kind && !item.pair && !item.video && !/placeholder/i.test(String(item.id)) && !/^id[-_ ]\d{3,}/i.test(String(item.name)));
  // Its own picture first: one named for it exactly, its parentheses too ("Sprackle (Lesser)").
  const whole = (/** @type {string} */ text) => text.toLowerCase().replace(/[^a-z()]+/g, "");
  const madeFor = usable.filter((item) => whole(String(item.name).replace(/[_ ](portrait|token)$/i, "")) === whole(String(name)));
  // The GM's own art folders (kraken/: art made for it) before any shipped picture of the same name.
  const mine = madeFor.filter((item) => String(item.id).startsWith("kraken/"));
  const named = mine.length ? mine : madeFor;
  if (named.length) return named.sort((a, b) => a.id.localeCompare(b.id))[hashOf(String(seed || name)) % named.length].id;
  const last = words.at(-1) ?? "";
  const matching = (/** @type {any[]} */ tokens) => {
    const exact = tokens.filter((item) => squash(tokenCreature(item.name)) === wanted);
    if (exact.length) return exact;
    const near = tokens.filter((item) => {
      // Its words without punctuation (a book's "Red Dragon, Adult").
      const base = tokenCreature(item.name).split(/[^a-z]+/).filter(Boolean);
      return base.length && words.every((word) => base.includes(word) || base.includes(word.replace(/s$/, "")));
    });
    if (near.length || words.length < 2) return near;
    // Last: a book's kind before its comma ("Boar, Wild": a Boar), else the name's last word ("Normal Bat": a Bat).
    const head = /,/.test(String(name)) ? squash(String(name).split(",")[0]) : "";
    const byHead = head ? tokens.filter((item) => squash(tokenCreature(item.name)) === head) : [];
    return byHead.length ? byHead : tokens.filter((item) => tokenCreature(item.name) === last);
  };
  const own = matching(usable.filter((item) => String(item.id).startsWith("kraken/")));
  const found = own.length ? own : matching(usable);
  // Its words in brackets choose among them ("Elemental (Fire, 12 HD)" a fire one, "Dragon, Red (Young)" a young
  // one; a hatchling is a wyrmling), then the plainest (a "Zombie" before a "Zombie Kobold"): the fewest words.
  const noted = [...String(name ?? "").toLowerCase().matchAll(/\(([^)]*)\)/g)].flatMap((match) => match[1].split(/[^a-z]+/)).filter((word) => word.length > 2).map((word) => (word === "hatchling" ? "wyrmling" : word));
  const wordsOf = (/** @type {any} */ item) => tokenCreature(item.name).split(/[^a-z]+/).filter(Boolean);
  const told = (/** @type {any} */ item) => noted.filter((word) => wordsOf(item).includes(word)).length;
  const most = Math.max(0, ...found.map(told));
  const count = (/** @type {any} */ item) => wordsOf(item).length;
  const fewest = Math.min(...found.filter((item) => told(item) === most).map(count));
  const choices = found.filter((item) => told(item) === most && count(item) === fewest).sort((a, b) => a.id.localeCompare(b.id));
  return choices.length ? choices[hashOf(String(seed || name)) % choices.length].id : null;
}
