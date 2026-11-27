// The dice-set skill (skills/dice-set) against the code: the script embedded in SKILL.md is dice_pack.py; its lists and
// the skill's tables name exactly the table's dice themes, materials, effects and fonts (electron/tableServer.cjs); the
// shipped example .kpack is the example work folder packed; a pack the script makes is read by Maelstrom
// (electron/dicePacks.cjs) with every set and no problems, a .kpack winning over a folder of the same name; a broken
// work folder fails the check. Needs Python with Pillow.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";

const require = createRequire(import.meta.url);
const table = require("../electron/tableServer.cjs");
const { createDicePacks } = require("../electron/dicePacks.cjs");
const SKILL = "skills/dice-set";
const EXAMPLE_WORK = `${SKILL}/example/Kraken Sea Glass`;
const EXAMPLE_PACK = "skills/kraken-content/folders/Dice/examples/Kraken Sea Glass.kpack";
const failures = [];
const report = [];
const check = (ok, message) => (ok ? report.push(`ok   ${message}`) : failures.push(message));

// 1. The script in SKILL.md is dice_pack.py.
const skill = readFileSync(`${SKILL}/SKILL.md`, "utf8").replace(/\r\n/g, "\n");
const embedded = /<!-- dice_pack\.py begins -->\n```python\n([\s\S]*?)\n```\n<!-- dice_pack\.py ends -->/.exec(skill)?.[1];
const script = readFileSync(`${SKILL}/dice_pack.py`, "utf8").replace(/\r\n/g, "\n").trimEnd();
check(embedded === script, "SKILL.md's embedded script is dice_pack.py (copy dice_pack.py into section 12 when it changes)");

// 2. The lists, in the script and in the skill's tables, are the table's.
const list = (name) => JSON.parse(new RegExp(`^${name} = (\\[[^\\]]*\\])`, "m").exec(script)[1].replace(/'/g, '"'));
const same = (a, b) => [...a].sort().join(",") === [...b].sort().join(",");
const codeThemes = [...table.DICE_THEMES].filter((theme) => theme !== "picture");
check(same([...list("THEMES"), ...list("DESIGNS")], codeThemes), `themes and designs match the code (${codeThemes.length})`);
check(same(list("MATERIALS"), table.DICE_MATERIALS), "materials match the code");
check(same(list("EFFECTS"), table.DICE_EFFECTS), "effects match the code");
check(same(list("FONTS"), table.DICE_FONTS), "fonts match the code");
const windowGroups = [...readFileSync("src/dice/diceStore.ts", "utf8").matchAll(/\{ name: "([^"]+)", sets: \[/g)].map((match) => match[1]);
check(windowGroups.length > 0 && same(list("GROUPS"), windowGroups), `the groups match the Dice window's (${windowGroups.join(", ")})`);
const prose = skill.split("<!-- dice_pack.py begins -->")[0];
const missingGroups = windowGroups.filter((name) => !prose.includes(`\`${name}\``));
check(missingGroups.length === 0, `the skill names every group${missingGroups.length ? ` (missing: ${missingGroups.join(", ")})` : ""}`);
const missing = [...codeThemes, ...table.DICE_MATERIALS, ...table.DICE_EFFECTS, ...table.DICE_FONTS].filter((value) => !prose.includes(`\`${value}\``));
check(missing.length === 0, `the skill's tables name every value${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);

const work = mkdtempSync(path.join(tmpdir(), "dice-skill-"));
try {
  const python = (...args) => spawnSync("python", [`${SKILL}/dice_pack.py`, ...args], { encoding: "utf8" });

  // 3. The shipped example is the example work folder, packed.
  const shipped = unzipSync(new Uint8Array(readFileSync(EXAMPLE_PACK)));
  const manifest = JSON.parse(strFromU8(shipped["kraken-pack.json"]));
  check(manifest.kind === "dice-pack" && manifest.name === "Kraken Sea Glass", "the shipped example says kind dice-pack");
  check(strFromU8(shipped["dice.json"]).replace(/\r\n/g, "\n") === readFileSync(`${EXAMPLE_WORK}/dice.json`, "utf8").replace(/\r\n/g, "\n"), "the shipped example's dice.json is the work folder's (make it again from skills/dice-set/example)");

  // 4. The check passes the example; make packs it; Maelstrom reads the pack, and a .kpack wins over a folder.
  const checked = python("check", EXAMPLE_WORK);
  check(checked.status === 0 && /READY: 4 sets/.test(checked.stdout), `check passes the example (${checked.stdout.trim().split("\n").pop()})`);
  const dice = path.join(work, "Dice");
  mkdirSync(dice);
  const made = python("make", EXAMPLE_WORK, "--out", dice);
  check(made.status === 0 && /Packed:/.test(made.stdout), "make packs the example");
  cpSync(EXAMPLE_WORK, path.join(dice, "Kraken Sea Glass"), { recursive: true });
  const packs = createDicePacks({ folder: dice, lookOf: table.diceLook }).list();
  const pack = packs.find((item) => item.id === "Kraken Sea Glass");
  check(packs.length === 1 && pack?.kind === "kpack" && pack.sets.length === 4 && pack.problems.length === 0, `Maelstrom reads the made .kpack, 4 sets, no problems, over the folder of the same name (${JSON.stringify(packs.map((item) => [item.id, item.kind, item.sets.length, item.problems]))})`);
  check(pack?.sets.find((set) => set.name === "Kraken Hide")?.texture === "Kraken Sea Glass/kraken-hide.webp", "a picture set's texture keeps its id (<pack>/<file>)");

  // 5. A broken work folder fails, and is not packed.
  const broken = path.join(work, "Broken");
  mkdirSync(broken);
  writeFileSync(path.join(broken, "dice.json"), JSON.stringify({ kraken: "dice-pack", version: 1, name: "Broken", sets: [{ name: "Grey on grey", theme: "marble", body: "#555555", ink: "#666666" }, { name: "Lost", texture: "gone.webp", body: "#000000", ink: "#ffffff" }, { name: "Odd", theme: "plaid", body: "#000000", ink: "#ffffff", shine: 2 }] }));
  const bad = python("check", broken);
  check(bad.status === 1 && /too alike/.test(bad.stdout) && /gone\.webp/.test(bad.stdout) && /plaid/.test(bad.stdout) && /"shine"/.test(bad.stdout), "check fails a broken folder: unreadable ink, a missing picture, an unknown theme, an unknown field");
  check(python("make", broken, "--out", dice).status !== 0, "make refuses a broken folder");

  // 6. A texture that does not tile fails; the same texture made seamless passes.
  const tile = path.join(work, "Tile");
  mkdirSync(tile);
  execFileSync("python", ["-c", "from PIL import Image, ImageDraw\nim = Image.new('RGB', (512, 512), (40, 40, 40))\nd = ImageDraw.Draw(im)\nd.rectangle((0, 0, 255, 511), fill=(200, 200, 200))\nim.save(r'" + path.join(tile, "half.png") + "')\nsm = Image.new('RGB', (512, 512), (90, 70, 50))\nsm.save(r'" + path.join(tile, "flat.png") + "')"]);
  writeFileSync(path.join(tile, "dice.json"), JSON.stringify({ kraken: "dice-pack", version: 1, name: "Tile", sets: [{ name: "Half", texture: "half.png", body: "#202020", ink: "#ff2020" }] }));
  check(/does not tile/.test(python("check", tile).stdout), "a texture whose edges do not meet fails");
  writeFileSync(path.join(tile, "dice.json"), JSON.stringify({ kraken: "dice-pack", version: 1, name: "Tile", sets: [{ name: "Flat", texture: "flat.png", body: "#5a4632", ink: "#f4ecd8" }] }));
  check(python("check", tile).status === 0, "an even, seamless texture passes");
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(report.join("\n"));
if (failures.length) {
  console.log(failures.map((line) => `FAIL ${line}`).join("\n"));
  process.exit(1);
}
console.log(`check-dice-skill: all ${report.length} checks pass`);
