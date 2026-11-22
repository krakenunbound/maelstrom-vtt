// Is a natural 20 or 1 on this roll cheered (the die's flare, the fanfare or the trombone)? Only on a test the game
// names (its manifest's naturalTests: a label tag such as [ATTACK] or [SAVE]), or on a d20 with no tag at all (a free
// roll from the tray or the chat). A roll tagged anything else ([INIT], a table's, a hit die) is a number only. A game
// that names none cheers every d20 thrown alone, as before.
/** @param {string | undefined} label @param {string[] | undefined} tests */
export function naturalCheered(label, tests) {
  if (!tests) return true;
  const tags = [...String(label ?? "").matchAll(/\[([A-Z][A-Z ]*[A-Z])\]/g)].map((match) => match[1]).filter((tag) => !["TOWER", "MANUAL", "ADV", "DIS", "BLIND", "GM"].includes(tag));
  if (!tags.length) return true;
  return tags.some((tag) => tests.includes(tag));
}
