"""Compare embedded PDF text and an independent local OCR reading of one region."""
import argparse
from difflib import SequenceMatcher
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata

import fitz

from pdf_regions import region


def tokens(text):
    normalized = unicodedata.normalize("NFKC", text)
    normalized = normalized.translate(str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"'}))
    normalized = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "", normalized)
    return re.findall(r"\w+(?:[-']\w+)*|[^\w\s]", normalized)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("page", type=int, help="one-based PDF page position")
    parser.add_argument("--region", type=region, required=True, help="visually checked x0,y0,x1,y1 fractions")
    parser.add_argument("--tesseract", default=shutil.which("tesseract"), help="tesseract executable")
    parser.add_argument("--psm", default=6, type=int, help="Tesseract page segmentation mode")
    parser.add_argument("--dpi", default=300, type=int)
    args = parser.parse_args()
    if args.tesseract is None:
        parser.error("Tesseract is not on PATH. Supply its executable with --tesseract.")
    if args.dpi < 1:
        parser.error("--dpi must be positive")

    with fitz.open(args.pdf) as document:
        if not 1 <= args.page <= document.page_count:
            parser.error("page position is outside the document")
        page = document[args.page - 1]
        x0, y0, x1, y1 = args.region
        width, height = page.rect.width, page.rect.height
        crop = fitz.Rect(x0 * width, y0 * height, x1 * width, y1 * height)
        embedded = page.get_text(clip=crop * page.derotation_matrix, sort=True)
        image = page.get_pixmap(clip=crop, dpi=args.dpi, colorspace=fitz.csGRAY, annots=False)
        result = subprocess.run(
            [args.tesseract, "stdin", "stdout", "--dpi", str(args.dpi), "--psm", str(args.psm)],
            input=image.tobytes("png"), check=True, capture_output=True, timeout=45,
        )
        ocr = result.stdout.decode("utf-8")

    left, right = tokens(embedded), tokens(ocr)
    for tag, a, b, c, d in SequenceMatcher(None, left, right, autojunk=False).get_opcodes():
        if tag == "equal":
            continue
        before = " ".join(left[max(0, a - 4):a])
        after = " ".join(left[b:b + 4])
        print(f"In: {before} […] {after}")
        print("  PDF:", " ".join(left[a:b]) or "(none)")
        print("  OCR:", " ".join(right[c:d]) or "(none)")


if __name__ == "__main__":
    main()
