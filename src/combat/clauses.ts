// FG's clause rolls on an NPC's actions (PowerManager.parsePower): the pieces of an action's words that can be
// rolled, found in place: an attack ("+4 to hit", 2024's "Attack Roll: +14"), damage ("5 (1d6 + 2) slashing
// damage": its dice), healing ("regains 10 (3d6) hit points"), a save ("DC 13 Constitution saving throw", 2024's
// "Dexterity Saving Throw: DC 21"). The text cut into plain runs and clauses, in order.
export type Clause =
  | { kind: "attack"; bonus: number }
  | { kind: "damage"; formula: string; damageType: string }
  | { kind: "heal"; formula: string }
  | { kind: "save"; dc: number; stat: string; half?: boolean }
  // FG's effect clause: a condition the action puts on ("is grappled", "knocked prone", 2024's "has the Frightened
  // condition"), with how long when the words say ("for 1 minute", "until the end of its next turn").
  | { kind: "effect"; condition: string; duration?: number; units?: "minute" | "hour" | "day" };
export type Piece = { text: string; clause?: Clause };

const STAT = "(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)";
const TYPES = "(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)";
const CONDITION = "(blinded|charmed|deafened|frightened|grappled|incapacitated|paralyzed|petrified|poisoned|restrained|stunned|unconscious)";
const titled = (word: string) => word[0].toUpperCase() + word.slice(1).toLowerCase();
const DICE = "(\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?)";
const PATTERNS: { re: RegExp; make: (match: RegExpExecArray) => Clause }[] = [
  { re: /([+-]\s*\d+)\s+to hit/gi, make: (m) => ({ kind: "attack", bonus: Number(m[1].replace(/\s+/g, "")) }) },
  { re: /Attack Roll:\s*([+-]\s*\d+)/gi, make: (m) => ({ kind: "attack", bonus: Number(m[1].replace(/\s+/g, "")) }) },
  // "bludgeoning or slashing damage" and "slashing, magic damage": the first type.
  { re: new RegExp(`\\b\\d+\\s*\\(${DICE}\\)\\s*(?:([A-Za-z]+)(?:,\\s*magic)?(?:\\s+or\\s+[A-Za-z]+)?\\s+)?damage`, "gi"), make: (m) => ({ kind: "damage", formula: m[1].replace(/\s+/g, ""), damageType: (m[2] ?? "").toLowerCase() }) },
  { re: new RegExp(`regains?\\s+\\d+\\s*\\(${DICE}\\)\\s*hit points`, "gi"), make: (m) => ({ kind: "heal", formula: m[1].replace(/\s+/g, "") }) },
  // A set amount, no dice: "Hit: 1 piercing damage", "regains 10 hit points".
  { re: new RegExp(`\\b(\\d+)\\s+${TYPES}\\s+damage`, "gi"), make: (m) => ({ kind: "damage", formula: m[1], damageType: m[2].toLowerCase() }) },
  { re: /regains?\s+(\d+)\s+hit points?\b/gi, make: (m) => ({ kind: "heal", formula: m[1] }) },
  // Conditions put on: 2014's "is grappled", "knocked prone"; 2024's "has the Frightened condition".
  { re: new RegExp(`\\b(?:is|are|be|becomes?)\\s+(?:[a-z]+ly\\s+|also\\s+|then\\s+)?${CONDITION}\\b`, "gi"), make: (m) => ({ kind: "effect", condition: titled(m[1]) }) },
  { re: /\b(?:knocked|falls?|fall|knocks? it|knocks? the target)\s+prone\b/gi, make: () => ({ kind: "effect", condition: "Prone" }) },
  { re: /\b(?:falls?|fall|drops?|remains?)\s+unconscious\b|\bfalls?\s+asleep\b/gi, make: () => ({ kind: "effect", condition: "Unconscious" }) },
  { re: new RegExp(`\\bha(?:s|ve) the\\s+${CONDITION}\\s+condition`, "gi"), make: (m) => ({ kind: "effect", condition: titled(m[1]) }) },
  { re: new RegExp(`DC\\s*(\\d+)\\s+${STAT}\\s+saving throw`, "gi"), make: (m) => ({ kind: "save", dc: Number(m[1]), stat: m[2].toLowerCase() }) },
  { re: new RegExp(`${STAT}\\s+Saving Throw:\\s*DC\\s*(\\d+)`, "gi"), make: (m) => ({ kind: "save", dc: Number(m[2]), stat: m[1].toLowerCase() }) },
];

export function clausesOf(words: string): Piece[] {
  const found: { at: number; end: number; clause: Clause }[] = [];
  for (const { re, make } of PATTERNS) {
    re.lastIndex = 0;
    for (let match = re.exec(words); match; match = re.exec(words)) found.push({ at: match.index, end: match.index + match[0].length, clause: make(match) });
  }
  found.sort((a, b) => a.at - b.at || b.end - a.end);
  // FG's onmissdamage: half the damage on a successful save, where the words say so; a condition's time from its
  // sentence ("for 1 minute"; "until the end of its next turn" is a round).
  const half = /half (?:as much )?damage on a successful|half as much on a successful|half damage on a success|(?:successful|succeeds?|success)[^.]*\btakes? half\b|takes? half (?:as much|the \w+ damage|that damage)/i.test(words);
  // A condition named but not put on: "can't be frightened", "if the target is grappled", "immune to being charmed".
  for (let index = found.length - 1; index >= 0; index--) {
    const item = found[index];
    if (item.clause.kind === "effect" && /\b(?:can't|cannot|can not|isn't|aren't|not|never|if\s+(?:the\s+|a\s+)?(?:target|creature|it|they|\w+)?|while|unless|already|immune to|immunity to)\s*$/i.test(words.slice(Math.max(0, item.at - 40), item.at))) found.splice(index, 1);
  }
  for (const item of found) {
    if (item.clause.kind === "save" && half) item.clause = { ...item.clause, half: true };
    if (item.clause.kind === "effect") {
      const sentence = words.slice(item.at).split(/(?<=[.])\s/)[0];
      const span = /\bfor (\d+) (minute|hour|day)s?\b/i.exec(sentence);
      if (span) item.clause = { ...item.clause, duration: Number(span[1]), units: span[2].toLowerCase() as "minute" | "hour" | "day" };
      else if (/until the end of (?:its|the \w+'s|your) next turn/i.test(sentence)) item.clause = { ...item.clause, duration: 1 };
    }
  }
  const pieces: Piece[] = [];
  let from = 0;
  for (const item of found) {
    if (item.at < from) continue;
    if (item.at > from) pieces.push({ text: words.slice(from, item.at) });
    pieces.push({ text: words.slice(item.at, item.end), clause: item.clause });
    from = item.end;
  }
  if (from < words.length) pieces.push({ text: words.slice(from) });
  return pieces;
}
