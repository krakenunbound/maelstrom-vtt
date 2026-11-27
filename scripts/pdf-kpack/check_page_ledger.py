"""Check that each source folio has a recorded destination and comparison."""
import argparse
import csv
from pathlib import Path

import fitz


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("ledger", type=Path)
    args = parser.parse_args()
    with fitz.open(args.pdf) as pdf:
        count = pdf.page_count
    with args.ledger.open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if [int(row["pdf_page"]) for row in rows] != list(range(1, count + 1)):
        parser.error("ledger must account for each PDF position once and in order")
    open_rows = [
        row for row in rows
        if row["source_layout_reviewed"] != "yes"
        or row["comparison"] != "verified"
        or not row["pack_record"].strip()
    ]
    if open_rows:
        sample = ", ".join(row["pdf_page"] for row in open_rows[:10])
        parser.exit(1, f"{len(open_rows)} of {count} PDF positions lack a verified comparison and destination (first positions: {sample}).\n")
    print(f"All {count} source positions have a verified comparison and destination.")


if __name__ == "__main__":
    main()
