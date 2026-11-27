"""Render a source page or inspect a visually selected crop of it."""
import argparse
from pathlib import Path

import fitz
from PIL import Image


def region(value):
    try:
        x0, y0, x1, y1 = map(float, value.split(","))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("use x0,y0,x1,y1") from exc
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        raise argparse.ArgumentTypeError("region must lie inside the page (0 to 1)")
    return x0, y0, x1, y1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("page", type=int, help="one-based PDF page position")
    parser.add_argument("--region", type=region, default=(0, 0, 1, 1))
    parser.add_argument("--output", type=Path, help="PNG or lossless WebP crop")
    parser.add_argument("--dpi", type=int, default=180)
    parser.add_argument("--text", action="store_true", help="print draft PDF text")
    args = parser.parse_args()
    if not args.output and not args.text:
        parser.error("choose --output, --text, or both")
    if args.dpi < 1:
        parser.error("--dpi must be positive")
    if args.output and args.output.suffix.lower() not in {".png", ".webp"}:
        parser.error("--output must be PNG or WebP")

    with fitz.open(args.pdf) as document:
        if not 1 <= args.page <= document.page_count:
            parser.error(f"page must be between 1 and {document.page_count}")
        page = document[args.page - 1]
        x0, y0, x1, y1 = args.region
        width, height = page.rect.width, page.rect.height
        crop = fitz.Rect(x0 * width, y0 * height, x1 * width, y1 * height)
        if args.text:
            print(page.get_text(clip=crop * page.derotation_matrix, sort=True), end="")
        if args.output:
            pixmap = page.get_pixmap(dpi=args.dpi, clip=crop, annots=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            options = {"lossless": True} if args.output.suffix.lower() == ".webp" else {}
            image.save(args.output, **options)


if __name__ == "__main__":
    main()
