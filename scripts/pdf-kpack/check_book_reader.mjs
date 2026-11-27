import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const [repo, artifact] = process.argv.slice(2);
if (!repo || !artifact) {
  console.error("Usage: node check_book_reader.mjs <Maelstrom checkout> <pack file>");
  process.exit(2);
}

const require = createRequire(import.meta.url);
const { createBookShelf } = require(resolve(repo, "electron/books.cjs"));
const { readPack } = require(resolve(repo, "electron/packs.cjs"));
const { records, info } = readPack(resolve(artifact));
const folder = dirname(resolve(artifact));
const shelf = createBookShelf({ folder: join(folder, "no-modules"), packsFolder: folder });
const book = shelf.list().find((item) => item.name === info.name);
assert(book?.hasBook, "The book is absent from Books.");
const contents = shelf.contents(book.id);
const entries = contents.chapters.flatMap((chapter) => chapter.sections.flatMap((section) => section.pages));
assert(entries.length > 0, "The book has an empty contents list.");

const pageIds = new Set(entries.map((entry) => entry.id));
assert.equal(pageIds.size, entries.length, "The contents list has duplicate page IDs.");
const pageRecords = records.filter((record) => record.type === "refpage");
assert.equal(entries.length, pageRecords.length, "Some page records are missing from the contents list.");

const readPictures = new Set();
const links = new Set();
for (const entry of entries) {
  const page = shelf.page(book.id, entry.id);
  assert(page.blocks.length, `Empty page: ${page.name}`);
  for (const block of page.blocks) {
    const html = [block.html, block.html2].filter(Boolean).join("\n");
    assert(!html.includes('class="book-link dead"'), `Unresolved link on ${page.name}`);
    if (block.file && !readPictures.has(block.file)) {
      assert(shelf.picture(book.id, block.file)?.bytes.length, `Missing image: ${block.file}`);
      readPictures.add(block.file);
    }
    for (const link of html.matchAll(/data-page="([^"]+)"/g)) {
      links.add(link[1]);
    }
  }
}
for (const id of links) assert(pageIds.has(id), `Page link is absent from the book contents: ${id}`);

const tables = records.filter((record) => record.type === "tables");
for (const table of tables) {
  const found = shelf.record(book.id, table.data.fgPath);
  assert(found?.data?.tablerows, `Unresolved rollable table: ${table.name}`);
}

console.log(`Maelstrom Books read ${entries.length} pages, ${readPictures.size} images, ${links.size} page-link targets, and ${tables.length} rollable tables.`);
