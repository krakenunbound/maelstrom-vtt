"""Turn reviewed HTML sections into Maelstrom refpage and refindex records."""
import argparse
import json
from pathlib import Path, PurePosixPath
import re
import xml.etree.ElementTree as ET


MARKER = re.compile(r"^<!--\s*(image:\s*[^\r\n]+?|frame:\s*[^\r\n]+?|end frame)\s*-->\s*$", re.MULTILINE)
FRAMES = {"blue", "green", "brown", "pink", "yellow", "grey", "sidebar", "book", "page", "picture", "noframe", *(f"text{i}" for i in range(1, 6))}


def entries(objects):
    return {f"id-{index:05}": item for index, item in enumerate(objects, 1)}


def page_blocks(fragment, root):
    blocks = []
    frame = None
    cursor = 0

    def add_text(markup):
        markup = markup.strip()
        if not markup:
            return
        ET.fromstring(f"<root>{markup}</root>")
        block = {"blocktype": "singletext", "order": len(blocks) + 1, "text": markup}
        if frame:
            block["frame"] = frame
        blocks.append(block)

    for match in MARKER.finditer(fragment):
        add_text(fragment[cursor:match.start()])
        cursor = match.end()
        directive, _, value = match.group(1).partition(":")
        value = value.strip()
        if directive == "image":
            image = PurePosixPath(value)
            if frame or image.is_absolute() or ".." in image.parts or not (root / image).is_file():
                raise ValueError(f"invalid image marker: {value}")
            blocks.append({"blocktype": "image", "order": len(blocks) + 1, "align": "center",
                           "scale": 100, "image": {"layers": {"layer": {"bitmap": value}}}})
        elif directive == "frame" and not frame and value in FRAMES:
            frame = value
        elif directive == "end frame" and frame:
            frame = None
        else:
            raise ValueError(f"invalid frame marker: {match.group(1)}")
    add_text(fragment[cursor:])
    if frame or not blocks:
        raise ValueError("section has an open frame or no content")
    return entries(blocks)


def build_records(root, name, chapters):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    records = []
    chapter_index = []
    seen = set()

    def record(path, kind, title, data, visibility):
        return {"id": f"{slug}:{path}", "type": kind, "name": title,
                "visibility": visibility, "source": name, "data": {"name": title, "fgPath": f"{path}@{name}", **data}}

    for chapter_order, chapter in enumerate(chapters, 1):
        section_index = []
        for section_order, section in enumerate(chapter["sections"], 1):
            page_index = []
            for page_order, page in enumerate(section["pages"], 1):
                key = page["key"]
                if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", key) or key in seen:
                    raise ValueError(f"invalid or duplicate page key: {key}")
                seen.add(key)
                path = f"reference.refmanualdata.{key}"
                file = root / page["file"]
                try:
                    blocks = page_blocks(file.read_text(encoding="utf-8"), root)
                except (OSError, ValueError, ET.ParseError) as error:
                    raise ValueError(f"{file}: {error}") from error
                records.append(record(path, "refpage", page["name"], {"blocks": blocks}, page.get("visibility", "gm")))
                link = {"class": "reference_manualtextwide", "recordname": f"{path}@{name}"}
                page_index.append({"name": page["name"], "order": page_order,
                                   "keywords": page.get("keywords", ""), "listlink": link})
            section_index.append({"name": section["name"], "order": section_order, "refpages": entries(page_index)})
        chapter_index.append({"name": chapter["name"], "order": chapter_order, "subchapters": entries(section_index)})

    if not records:
        raise ValueError("no pages in book index")
    records.append(record("reference.refmanualindex", "refindex", name, {"chapters": entries(chapter_index)}, "gm"))
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("book", type=Path, help="work folder with kraken-pack.json and book-index.json")
    args = parser.parse_args()
    root = args.book
    index = json.loads((root / "book-index.json").read_text(encoding="utf-8"))
    manifest = json.loads((root / "kraken-pack.json").read_text(encoding="utf-8"))
    records = build_records(root, manifest["name"], index["chapters"])
    for filename in ("extra-records.json", "monster-records.json"):
        extra = root / filename
        if extra.exists():
            records.extend(json.loads(extra.read_text(encoding="utf-8")))
    if len({record["id"] for record in records}) != len(records):
        parser.error("duplicate record IDs")
    output = root / "records.json"
    temporary = output.with_suffix(".json.part")
    temporary.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)
    print(f"Wrote {len(records)} records to {output}")


if __name__ == "__main__":
    main()
