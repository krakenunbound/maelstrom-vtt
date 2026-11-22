// FG's clause rolls on an NPC's actions (PowerManager.parsePower): the pieces of an action's words that can be
// rolled, found in place: an attack ("+4 to hit", 2024's "Attack Roll: +14"), damage ("5 (1d6 + 2) slashing
// damage": its dice), healing ("regains 10 (3d6) hit points"), a save ("DC 13 Constitution saving throw", 2024's
// "Dexterity Saving Throw: DC 21"). The text cut into plain runs and clauses, in order.
export type Clause =
  | { kind: "attack"; bonus: number }
  | { kind: "damage"; formula: string; damageType: string }
  | { kind: "heal"; formula: string }
  | { kind: "save"; dc: number; stat: string };
export type Piece = { text: string; clause?: Clause };

const STAT = "(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)";
const DICE = "(\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?)";
const PATTERNS: { re: RegExp; make: (match: RegExpExecArray) => Clause }[] = [
  { re: /([+-]\s*\d+)\s+to hit/gi, make: (m) => ({ kind: "attack", bonus: Number(m[1].replace(/\s+/g, "")) }) },
  { re: /Attack Roll:\s*([+-]\s*\d+)/gi, make: (m) => ({ kind: "attack", bonus: Number(m[1].replace(/\s+/g, "")) }) },
  { re: new RegExp(`\\b\\d+\\s*\\(${DICE}\\)\\s*([A-Za-z]+)?\\s*damage`, "gi"), make: (m) => ({ kind: "damage", formula: m[1].replace(/\s+/g, ""), damageType: (m[2] ?? "").toLowerCase() }) },
  { re: new RegExp(`regains?\\s+\\d+\\s*\\(${DICE}\\)\\s*hit points`, "gi"), make: (m) => ({ kind: "heal", formula: m[1].replace(/\s+/g, "") }) },
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
