"""Render manually checked monster stat tables and compile Maelstrom NPC records."""
import argparse
import json
import re
from pathlib import Path
from xml.sax.saxutils import escape

STAT_FIELDS = (
    ("Armor Class", "ac"), ("Hit Dice", "hd"), ("Move", "move"),
    ("Attacks", "attacks"), ("Damage", "damage"), ("No. Appearing", "noappearing"),
    ("Save As", "saveas"), ("Morale", "morale"), ("Treasure Type", "treasure"),
    ("Alignment", "alignment"), ("XP value", "xp"),
)
MARKER = re.compile(r"^<!-- monster stats: ([a-z0-9-]+) -->$", re.MULTILINE)


def render_table(group):
    rows = group["rows"]
    headings = group.get("headings", [])
    columns = len(headings) or 1
    if len(rows) != len(STAT_FIELDS) or any(len(row) != columns for row in rows):
        raise ValueError(f"{group['key']}: each statistic must have a cell for every column")
    markup = ["<table>"]
    if headings:
        markup.append("<tr><th></th>" + "".join(f"<th><i>{escape(label)}</i></th>" for label in headings) + "</tr>")
    for (label, _), row in zip(STAT_FIELDS, rows):
        cells = "".join(f"<td>{escape(cell).replace(chr(10), '<br/>')}</td>" for cell in row)
        markup.append(f"<tr><td>{label}:</td>{cells}</tr>")
    markup.append("</table>")
    return "\n".join(markup)


def dice_from_range(match):
    low, high = map(int, match.groups())
    # Basic DM p. 16 uses a die per minimum point when it maps to a regular die.
    regular = {2, 3, 4, 6, 8, 10, 12, 20, 100}
    for flat in range(low):
        roll_count = low - flat
        faces, remainder = divmod(high - flat, roll_count)
        if not remainder and faces in regular:
            suffix = f"+{flat}" if flat else ""
            return f"{roll_count}d{faces}{suffix}"
    return match.group()


def playable_damage(markup):
    if re.fullmatch(r"By weapon(?: \+ \d+)?", markup, re.IGNORECASE):
        bonus = "".join(markup.split()[2:])
        return f"1d6{bonus} or {markup.lower()}"
    return re.sub(r"(?<![\w-])(\d+)-(\d+)(?![\w-])", dice_from_range, markup)


def records_for_group(group, pack, slug):
    for position, monster in enumerate(group.get("playable", [])):
        if monster is None:
            continue
        column = monster.get("column", position)
        fields = {field: group["rows"][index][column] for index, (_, field) in enumerate(STAT_FIELDS)}
        fields["damage"] = playable_damage(fields["damage"])
        fields.update(monster.get("overrides", {}))
        for field in ("ac", "morale", "xp"):
            try:
                fields[field] = int(fields[field])
            except (TypeError, ValueError):
                fields.pop(field)
        key = monster["id"]
        title = monster["name"]
        yield {
            "id": f"{slug}:npc.{key}", "type": "npc", "name": title,
            "visibility": "gm", "source": pack,
            "data": {"name": title, "fgPath": f"npc.{key}@{pack}", **fields, "text": monster["text"]},
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="JSON with reviewed page and stat group definitions")
    parser.add_argument("book", type=Path, help="pack source folder")
    args = parser.parse_args()
    pack = json.loads((args.book / "kraken-pack.json").read_text(encoding="utf-8"))["name"]
    slug = re.sub(r"[^a-z0-9]+", "-", pack.lower()).strip("-")
    pages = json.loads(args.source.read_text(encoding="utf-8"))
    records = []
    output_pages = []
    for page in pages:
        by_key = {group["key"]: group for group in page["groups"]}
        html_path = args.source.parent / page["template"]
        markup = html_path.read_text(encoding="utf-8")
        if set(MARKER.findall(markup)) != by_key.keys():
            raise ValueError(f"{html_path}: stat groups and template markers must match")
        output_pages.append((args.book / page["file"], MARKER.sub(lambda match: render_table(by_key[match[1]]), markup)))
        for group in page["groups"]:
            records.extend(records_for_group(group, pack, slug))
    if len({record["id"] for record in records}) != len(records):
        raise ValueError("duplicate NPC record IDs in stat groups")
    for path, markup in output_pages:
        path.write_text(markup, encoding="utf-8")
    (args.book / "monster-records.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Rendered {len(output_pages)} Bestiary pages and wrote {len(records)} NPC records.")


if __name__ == "__main__":
    main()
