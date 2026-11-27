"""Flag local PDF text absent from a page's proof fragment for visual inspection."""
import argparse
import collections
from pathlib import Path
import re
import unicodedata
import xml.etree.ElementTree as ET

import fitz


def words(text):
    value = unicodedata.normalize("NFKC", text.lower())
    value = re.sub(r"([a-z])-\s*\n\s*(?=[a-z])", r"\1", value)
    return collections.Counter(re.findall(r"[a-z]{4,}", value))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("pack_source", type=Path)
    parser.add_argument("--first", type=int, default=1)
    parser.add_argument("--last", type=int)
    args = parser.parse_args()
    with fitz.open(args.pdf) as pdf:
        for pos in range(args.first, (args.last or pdf.page_count) + 1):
            paths = sorted((args.pack_source / "pages").glob(f"{pos:03}*.html"))
            if not paths:
                print(f"{pos:03} no mapped fragments")
                continue
            markup = "".join(path.read_text(encoding="utf-8") for path in paths)
            root = ET.fromstring(f"<root>{markup}</root>")
            body = " ".join(root.itertext())
            if not body.strip():
                continue
            embedded = words(pdf[pos - 1].get_text())
            converted = words(body)
            missing = sorted((word for word in embedded.keys() - converted.keys()), key=lambda word: (-embedded[word], word))
            ratio = sum(embedded[w] for w in missing) / max(1, embedded.total())
            print(f"{pos:03} {ratio:5.1%} {', '.join(missing[:23])}")


if __name__ == "__main__":
    main()
