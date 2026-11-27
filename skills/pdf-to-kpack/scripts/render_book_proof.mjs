import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [repo, artifact, output, executablePath, ...requestedTitles] = process.argv.slice(2);
if (!repo || !artifact || !output || !executablePath) {
  console.error("Usage: node render_book_proof.mjs <checkout> <pack> <proof directory> <Chromium executable> [exact page titles...]");
  process.exit(2);
}
const require = createRequire(resolve(repo, "package.json"));
const { chromium } = require("playwright-core");
const { createBookShelf } = require("./electron/books.cjs");
const { readManifest } = require("./electron/packs.cjs");
const { name } = readManifest(artifact);
const folder = dirname(artifact);
const shelf = createBookShelf({ folder: join(folder, "no-modules"), packsFolder: folder });
const book = shelf.list().find((entry) => entry.name === name);
assert(book?.hasBook);
const contents = shelf.contents(book.id);
const entries = contents.chapters.flatMap((chapter) => chapter.sections.flatMap((section) => section.pages));
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
mkdirSync(output, { recursive: true });
const images = new Map();
const sections = [];
for (const entry of entries) {
  const page = shelf.page(book.id, entry.id);
  const title = escape(page.name);
  const markup = page.blocks.map((block) => {
    if (block.file) {
      if (!images.has(block.file)) {
        const result = shelf.picture(book.id, block.file);
        assert(result?.bytes.length, block.file);
        const file = join(output, basename(block.file));
        writeFileSync(file, result.bytes);
        images.set(block.file, pathToFileURL(file).href);
      }
      return `<div class="book-block kind-picture"><figure class="book-figure"><img src="${images.get(block.file)}"></figure></div>`;
    }
    const classes = block.frame ? `book-text framed ${escape(block.frame)}` : "book-text";
    return `<div class="book-block kind-text"><div class="${classes}">${block.html ?? ""}</div></div>`;
  });
  sections.push(`<section class="book-page-sheet" data-page="${escape(entry.id)}"><header class="book-page-head"><h2>${title}</h2></header>${markup.join("")}</section>`);
}
const style = readFileSync(resolve(repo, "src/desktop.css"), "utf8");
const proof = join(output, "book-proof.html");
const documentOf = (body) => `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(name)}</title>
<style>${style}
:root { --line: #51545b; --brass: #e8bc73; }
html { background: #161b23; color: #e8e8ed; font-family: system-ui; }
body { margin: 0; }
.book-page { width: min(100%, 900px); margin: 0 auto; box-sizing: border-box; }
.book-page-sheet { overflow-wrap: break-word; }
</style><main class="book-page">${body}</main></html>`;
writeFileSync(proof, documentOf(sections.join("")));
const staging = join(output, "book-proof-viewport.html");
writeFileSync(staging, documentOf(""));
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({viewport: {width: 1050, height: 860}});
  await page.goto(pathToFileURL(staging).href);
  const show = async (markup) => {
    await page.evaluate((section) => {
      document.querySelector(".book-page").innerHTML = section;
      window.scrollTo(0, 0);
    }, markup);
    await page.evaluate(() => Promise.allSettled(Array.from(document.images, (img) => img.decode())));
  };
  const audit = { sections: 0, tables: 0, headings: 0, emphasis: 0, brokenImages: [], overwide: [] };
  // Auditing small batches caps decoded bitmap memory on long scanned books.
  for (let offset = 0; offset < sections.length; offset += 12) {
    await show(sections.slice(offset, offset + 12).join(""));
    const chunk = await page.evaluate(() => ({
      sections: document.querySelectorAll(".book-page-sheet").length,
      tables: document.querySelectorAll("table").length,
      headings: document.querySelectorAll(".book-text h3").length,
      emphasis: document.querySelectorAll(".book-text strong, .book-text b, .book-text em, .book-text i").length,
      brokenImages: Array.from(document.images).filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
      overwide: Array.from(document.querySelectorAll("table")).filter(table => table.offsetWidth > table.closest(".book-page-sheet").clientWidth).map(table => table.closest(".book-page-sheet").querySelector("h2").textContent),
    }));
    for (const key of ["sections", "tables", "headings", "emphasis"]) audit[key] += chunk[key];
    audit.brokenImages.push(...chunk.brokenImages);
    audit.overwide.push(...chunk.overwide);
  }
  assert.equal(audit.sections, entries.length);
  assert.equal(audit.brokenImages.length, 0, audit.brokenImages.join(", "));
  const samples = [
    ["ability-tables", contents.chapters[0].sections.flatMap(x=>x.pages).findIndex(x=>x.name.includes("Class Requirements"))],
    ["missile-fire", entries.findIndex(x=>x.name === "Missile Weapons")],
    ["mistamere-opening", entries.findIndex(x=>x.name.startsWith("Pre-Game Checklist"))],
    ["dragon-stats", entries.findIndex(x=>x.name.startsWith("Giant Centipedes"))],
    ["treasure-types", entries.findIndex(x=>x.name.startsWith("Random, Placed"))],
  ];
  const selections = requestedTitles.length ? requestedTitles.map((title) => {
    const index = entries.findIndex((entry) => entry.name === title);
    assert(index >= 0, `No Book page titled "${title}"`);
    return [`page-${String(index + 1).padStart(3, "0")}`, index];
  }) : samples;
  for (const [slug, index] of selections) {
    if (index < 0) continue;
    // A long book can exceed Chromium's screenshot coordinate limit.
    // Keep the full-book audit above, then frame one page at the origin.
    await show(sections[index]);
    await page.screenshot({ path: join(output, `${slug}.png`), fullPage: true });
  }
  console.log(JSON.stringify(audit));
} finally {
  await browser.close();
}
