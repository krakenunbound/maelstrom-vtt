// A character wizard's page art as ink on nothing: the drawing's dark lines
// kept as alpha (white), the paper made transparent, so the page can colour
// the lines with the table's theme (a CSS mask) on its dark panels.
// bytes: any picture sharp reads. Returns a WebP.
const PAPER = 232; // this bright and up: paper, transparent
const INK = 40; // this dark and down: full ink

async function inkArt(bytes) {
  const sharp = require("sharp");
  const { data, info } = await sharp(bytes, { limitInputPixels: 200_000_000 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    const ink = Math.min(1, Math.max(0, (PAPER - lum) / (PAPER - INK)));
    // The picture's own transparency (a cut-out drawing's corners) stays transparent.
    data[i + 3] = Math.round(ink * data[i + 3]);
    data[i] = data[i + 1] = data[i + 2] = 255;
  }
  return sharp(data, { raw: info }).webp({ quality: 90, alphaQuality: 90 }).toBuffer();
}

module.exports = { inkArt };
