// FG's power action rows (a spell's cast, attack, save, damage, heal and effect), each in words, for the sheet's
// spell list. casting: the caster's { dc, attack, stat }.
const word = (text) => String(text ?? "").replace(/^./, (c) => c.toUpperCase());
const signed = (n) => (n >= 0 ? `+${n}` : String(n));
const scaling = (row) => (row.scalestat === "upcast" && row.scaledice ? ` (+${row.scaledice} a slot above)` : row.scalestat === "cantrip" && row.scaledice ? " (more at 5th, 11th, 17th)" : "");
const rowsOf = (list) => Object.values(list && typeof list === "object" ? list : {}).filter((row) => row && typeof row === "object");

/** @param {Record<string, any>} actions @param {{ dc?: number; attack?: number }} [casting] @returns {{ type: string; text: string }[]} */
export function spellRows(actions, casting = {}) {
  const out = [];
  for (const row of rowsOf(actions)) {
    if (row.type === "cast") {
      const n = Number(row.targetingval) || 0;
      const aim = row.targeting === "self" ? "yourself" : row.targeting === "multihit" ? `${n || 3} darts` : ["sphere", "cube", "cone", "line", "cylinder", "radius"].includes(row.targeting) ? `a ${n} ft ${row.targeting}` : n > 1 ? `up to ${n} targets` : "1 target";
      out.push({ type: "cast", text: `Cast at ${aim}${row.allowupcast || row.targetscalestat === "upcast" ? "; a higher slot does more" : ""}` });
    } else if (row.type === "attack") {
      out.push({ type: "attack", text: `Attack (${row.atktype === "ranged" ? "ranged" : "melee"})${casting.attack !== undefined ? ` ${signed(Number(casting.attack) || 0)}` : ""}` });
    } else if (row.type === "powersave") {
      out.push({ type: "save", text: `Save: ${word(row.savetype)}${casting.dc ? ` DC ${casting.dc}` : ""}${row.onmissdamage === "half" ? ", half on a success" : ""}` });
    } else if (row.type === "damage") {
      const parts = rowsOf(row.damagelist).map((part) => `${part.dice ?? ""}${Number(part.bonus) ? signed(Number(part.bonus)) : ""}${part.stat ? " + modifier" : ""} ${part.type ?? ""}`.trim() + scaling(part));
      out.push({ type: "damage", text: `Damage: ${parts.join(", ")}` });
    } else if (row.type === "heal") {
      const parts = rowsOf(row.heallist).map((part) => `${part.dice ?? ""}${Number(part.bonus) ? signed(Number(part.bonus)) : ""}${part.stat ? " + casting modifier" : ""}`.trim() + scaling(part));
      out.push({ type: "heal", text: `${row.subtype === "temp" ? "Temporary hit points" : "Heal"}: ${parts.join(", ")}` });
    } else if (row.type === "effect") {
      const lasts = Number(row.durmod) ? ` (${row.durmod} ${row.durunit || "round"}${Number(row.durmod) === 1 ? "" : "s"})` : "";
      out.push({ type: "effect", text: `Effect: ${String(row.label ?? "")}${lasts}` });
    }
  }
  return out;
}
