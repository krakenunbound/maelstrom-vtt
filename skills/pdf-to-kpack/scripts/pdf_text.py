"""Print a PDF's page count and each page's words as JSON, for the conversion gate (kpack-verify-conversion.mjs)."""
import json
import sys
import unicodedata

import fitz


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: pdf_text.py <book.pdf>")
    pages = []
    with fitz.open(sys.argv[1]) as pdf:
        for page in pdf:
            # Words with the hyphens at line ends joined, as a reader would read them.
            # Ligatures (fi, fl) made plain letters.
            text = unicodedata.normalize("NFKC", page.get_text("text")).replace("-\n", "")
            pages.append(text)
    json.dump({"count": len(pages), "pages": pages}, sys.stdout)


if __name__ == "__main__":
    main()
