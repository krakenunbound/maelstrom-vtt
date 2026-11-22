// A 5E race pasted as text (FG's race import, scripts/manager_import_species.lua), into race records as the books
// keep theirs: the name on the first line; the description until "<Race> Traits"; then each trait a line beginning
// with its heading ("Darkvision. You have..."), its text running on until the next; a subrace a line
// "<Word> <Race>" (2014: "High Elf") or a "<Subrace> Traits" header (2024 lineages, Monsters of the Multiverse),
// its traits after it. Beyond FG's: 2024's "Creature Type:", "Size:" and "Speed:" lines (and 2014's Size and
// Speed traits) fill the race's own fields; a subrace of one word ("Drow Traits") is found by its header; and
// sentences ("You have Darkvision.") are not taken for headings.

/** @param {string} text */
const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SMALL = new Set(["of", "to", "from", "and", "the", "with", "a", "an", "in", "on", "or", "for"]);
// Words a sentence starts with, never a trait's name.
const SENTENCE = /^(you|your|if|when|whenever|while|as|this|these|that|the|a|an|it|its|each|once|at|on|in|for|some|most|many|they|their|members|unlike|although)\b/i;

/** A trait's heading: Proper Case ("Breath Weapon", "Gift of the Ancients"), or a few words that are not a sentence. */
export function isTraitHeading(heading) {
  const words = String(heading ?? "").replace(/[.!:]$/, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.join(" ").length < 3 || !/^[A-Z]/.test(words[0])) return false;
  if (words.length > 8) return false;
  const proper = words.every((word) => SMALL.has(word.toLowerCase()) || /^[A-Z0-9("']/.test(word));
  return proper || (words.length <= 4 && !SENTENCE.test(words[0]));
}

/** "<p>..</p>" for plain lines. @param {string[]} lines */
// An option inside a trait ("Forest Gnome. You know...") is kept as { bold, rest }: its heading in bold.
/** @param {(string | { bold: string; rest: string })[]} lines */
const paragraphs = (lines) => lines.map((line) => (typeof line === "string" ? `<p>${escape(line)}</p>` : `<p><b>${escape(line.bold)}.</b> ${escape(line.rest)}</p>`)).join("");
/** A trait's lines as plain words. @param {(string | { bold: string; rest: string })[]} lines */
const plain = (lines) => lines.map((line) => (typeof line === "string" ? line : `${line.bold}. ${line.rest}`)).join(" ");
const lastWord = (/** @type {string} */ heading) => heading.replace(/[.!)]+$/, "").split(/[\s(]+/).pop()?.toLowerCase() ?? "";

/**
 * @param {string} input the pasted text
 * @returns {{ name: string; data: Record<string, any>; subraces: { name: string; data: Record<string, any> }[]; problems: string[] }}
 */
export function parseRace(input) {
  const lines = String(input ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!lines.length) throw new Error("Paste a race: its name on the first line.");
  const problems = [];
  const name = lines.shift().replace(/\s+traits$/i, "");
  const lower = name.toLowerCase();
  /** @typedef {{ name: string; text: (string | { bold: string; rest: string })[]; options?: string }} Trait */
  /** @typedef {{ name: string; intro: string[]; traits: Trait[] }} Part */
  /** @type {Part} */
  const race = { name, intro: [], traits: [] };
  /** @type {Part[]} */
  const subraces = [];
  let part = race;
  let inTraits = false;
  /** @type {Trait | null} */
  let trait = null;
  const fields = { type: "", size: "", speed: "" };
  const startSub = (subName) => {
    part = { name: subName, intro: [], traits: [] };
    subraces.push(part);
    trait = null;
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const bare = line.replace(/\s+traits$/i, "");
    // "<Race> Traits": the traits begin (a generic line after it, "As an elf, you have these traits.", is the race's).
    if (!inTraits && line.toLowerCase() === `${lower} traits`) {
      inTraits = true;
      if (/traits\.$/i.test(lines[index + 1] ?? "")) race.intro.push(lines[(index += 1)]);
      continue;
    }
    // A subrace: "High Elf" or "High Elf Traits" (two words ending in the race's name), or after the race's traits
    // any "<Name> Traits" header ("Drow Traits").
    const endsInRace = bare.toLowerCase().endsWith(` ${lower}`) && bare.split(" ").length === 2 && !/[.!:]/.test(bare);
    const header = inTraits && /\straits$/i.test(line) && bare.split(" ").length <= 3 && isTraitHeading(bare) && bare.toLowerCase() !== lower;
    if (endsInRace || header) {
      inTraits = true;
      startSub(bare.replace(/\b\w/g, (letter) => letter.toUpperCase()));
      continue;
    }
    // 2024's labelled lines: "Creature Type: Humanoid", "Size: Medium (about 4-7 feet tall)", "Speed: 30 feet".
    const labelled = /^(creature type|size|speed):\s*(.+)$/i.exec(line);
    if (labelled && part === race) {
      fields[labelled[1].toLowerCase() === "creature type" ? "type" : labelled[1].toLowerCase()] = labelled[2].trim();
      continue;
    }
    const start = /^([^.!:]{2,60}[.!])\s+(.*)$/.exec(line);
    // A trait whose words end "...the following options:" lists its options next, each with a heading of the same
    // last word ("Forest Gnome.", "Rock Gnome."; "Cloud's Jaunt (Cloud Giant).", "Fire's Burn (Fire Giant)."): they
    // stay in it, until a heading of another shape starts the next trait.
    const heading = start?.[1].replace(/[.!]$/, "").trim() ?? "";
    const last = trait?.text.at(-1);
    if (inTraits && start && trait && (trait.options ? lastWord(heading) === trait.options : typeof last === "string" && /:$/.test(last))) {
      trait.options = lastWord(heading);
      trait.text.push({ bold: heading, rest: start[2] });
    } else if (inTraits && start && isTraitHeading(start[1])) {
      trait = { name: heading, text: [start[2]] };
      part.traits.push(trait);
    } else if (trait) trait.text.push(line);
    else part.intro.push(line);
  }
  if (!inTraits) problems.push(`No "${name} Traits" line: everything after the name is its description.`);

  // 2014's Size and Speed traits fill the fields too ("Your size is Medium.", "Your base walking speed is 30 feet.").
  const said = (traitName) => plain(race.traits.find((row) => row.name.toLowerCase() === traitName)?.text ?? []);
  if (!fields.size) fields.size = /\b(Tiny|Small|Medium|Large)\b/.exec(said("size"))?.[1] ?? "";
  if (!fields.speed) fields.speed = /(\d+)\s*feet/i.exec(said("speed"))?.[0] ?? "";
  // 2014's Ability Score Increase ("Your Dexterity score increases by 2"), as the builder reads it ("Dex +2").
  const adjust = (/** @type {Part} */ p) =>
    [...plain(p.traits.find((row) => /ability score increase/i.test(row.name))?.text ?? []).matchAll(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma) scores? (?:each )?increases? by (\d)/gi)]
      .map((match) => `${match[1][0].toUpperCase()}${match[1].slice(1, 3).toLowerCase()} +${match[2]}`)
      .join(", ");
  const traitList = (/** @type {Part} */ p) => Object.fromEntries(p.traits.map((row, i) => [`id-${String(i + 1).padStart(5, "0")}`, { name: row.name, text: paragraphs(row.text) }]));
  const version = fields.type || subraces.some((sub) => /lineage|legacy/i.test(sub.traits.map((row) => row.name).join(" "))) ? "2024" : "2014";
  const facts = [["Creature Type", fields.type], ["Size", fields.size], ["Speed", fields.speed]].filter(([, value]) => value);
  const data = {
    name,
    version,
    ...(fields.type ? { type: fields.type } : {}),
    ...(fields.size ? { size: fields.size } : {}),
    ...(fields.speed ? { speed: fields.speed } : {}),
    ...(adjust(race) ? { abilityadjust: adjust(race) } : {}),
    text: `${paragraphs(race.intro)}${version === "2024" ? facts.map(([label, value]) => `<p><b>${label}:</b> ${escape(value)}</p>`).join("") : ""}`,
    traits: traitList(race),
  };
  if (!race.traits.length) problems.push("No traits found (a trait is a line beginning with its name and a full stop).");
  return {
    name,
    data,
    subraces: subraces.map((sub) => ({ name: sub.name, data: { name: sub.name, race: name, version, ...(adjust(sub) ? { abilityadjust: adjust(sub) } : {}), text: paragraphs(sub.intro), traits: traitList(sub) } })),
    problems,
  };
}
