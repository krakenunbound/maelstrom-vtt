"""Check manually transcribed roll ranges against the corresponding Book tables."""
from collections import Counter
import argparse
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET


def verify_book_tables(root, spec_path):
    specs = json.loads(spec_path.read_text(encoding="utf-8"))
    markup = (root / "pages" / spec_path.with_suffix(".html").name).read_text(encoding="utf-8")
    book_tables = []
    for table in ET.fromstring(f"<root>{markup}</root>").iter("table"):
        book_tables.append(tuple(tuple("".join(cell.itertext()) for cell in row) for row in table.findall("tr")))

    count = 0
    for spec in specs:
        dice = re.fullmatch(r"(\d*)d(\d+)", spec["dice"])
        if not dice:
            raise ValueError(f"{spec['key']}: invalid dice expression {spec['dice']!r}")
        dice_count = int(dice[1] or 1)
        dice_sides = int(dice[2])
        rows = spec["rows"]
        actual = Counter(value for first, last, _ in rows for value in range(first, last + 1))
        expected = Counter(range(dice_count, dice_count * dice_sides + 1))
        if actual != expected:
            raise ValueError(f"{spec['key']}: expected each {spec['dice']} total to occur exactly once")
        expected_rows = tuple((str(a) if a == b else f"{a}-{b}", result) for a, b, result in rows)
        matches = [table for table in book_tables if table[1:] == expected_rows and table[0][-1] == spec["label"]]
        if len(matches) != 1:
            raise ValueError(f"{spec['key']}: expected one matching Book table with the checked rows")
        count += len(rows)
    return len(specs), count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("book", type=Path, help="work folder with tables/ and pages/")
    args = parser.parse_args()
    specs = sorted((args.book / "tables").glob("*.json"))
    if not specs:
        parser.error("no table specifications found")
    for spec in specs:
        tables, rows = verify_book_tables(args.book, spec)
        print(f"PDF {spec.stem}: {tables} tables, {rows} results, dice coverage and Book values agree.")


if __name__ == "__main__":
    main()
