// Portraits (ComfyUI, Z-Image Turbo) and round tokens for an adventure's own creatures, into the GM's local art
// folders (%APPDATA%\kraken-vtt\assets\portraits\Creatures, tokens\Creatures), named after each creature.
//   node make.mjs [only-name]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(path.join(ROOT, "package.json"));
const sharp = require("sharp");

const ASSETS = path.join(process.env.APPDATA ?? path.join(process.env.HOME ?? "", ".config"), "kraken-vtt", "assets");
const OUT_P = path.join(ASSETS, "portraits", "Creatures");
const OUT_T = path.join(ASSETS, "tokens", "Creatures");
const LIST = process.argv[2];
const WORK = path.join(path.dirname(path.resolve(LIST)), "raw");
fs.mkdirSync(OUT_P, { recursive: true });
fs.mkdirSync(OUT_T, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const STYLE = "dark fantasy tabletop RPG creature portrait, painterly digital illustration, dramatic rim lighting, highly detailed, centered subject, head and upper body filling the frame, dark moody background, no text, no border";
const CREATURES = JSON.parse(fs.readFileSync(LIST, "utf8"));
const only = process.argv[3];

async function token(portrait, out) {
  const size = 512;
  const r = 240;
  const face = await sharp(portrait).resize(size, size).toBuffer();
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="256" cy="256" r="${r - 6}" fill="#fff"/></svg>`);
  const inner = await sharp(face).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const ring = Buffer.from(`<svg width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8d9a8"/><stop offset="0.45" stop-color="#8a6a2e"/><stop offset="0.7" stop-color="#d4b46a"/><stop offset="1" stop-color="#5a4320"/></linearGradient></defs><circle cx="256" cy="256" r="${r}" fill="none" stroke="url(#g)" stroke-width="18"/><circle cx="256" cy="256" r="${r - 10}" fill="none" stroke="#2a1e0c" stroke-width="2"/></svg>`);
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: inner }, { input: ring }]).webp({ quality: 88, alphaQuality: 90 }).toFile(out);
}

for (const creature of CREATURES) {
  if (only && creature.name !== only) continue;
  const raw = path.join(WORK, `${creature.file}.webp`);
  if (!fs.existsSync(raw)) {
    execFileSync("python", [path.join(ROOT, "games", "tools", "comfy_image.py"), raw, "1024", "1024", `${creature.prompt}, ${STYLE}`, String(creature.seed ?? 1000 + CREATURES.indexOf(creature))], { stdio: "inherit", env: { ...process.env, KRAKEN_COMFY: process.env.KRAKEN_COMFY ?? "http://127.0.0.1:8199" } });
  }
  const portrait = path.join(OUT_P, `${creature.name}_Portrait.webp`);
  await sharp(raw).webp({ quality: 88 }).toFile(portrait);
  await token(raw, path.join(OUT_T, `${creature.name}_Token.webp`));
  console.log("made", creature.name);
}
