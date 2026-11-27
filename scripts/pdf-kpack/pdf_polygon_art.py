"""Extract interlocking original artwork from a PDF using a manually traced polygon."""
import argparse
from pathlib import Path

import fitz
from PIL import Image, ImageDraw


def point(text):
    try:
        x, y = map(float, text.split(","))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("use x,y") from exc
    if not (0 <= x <= 1 and 0 <= y <= 1):
        raise argparse.ArgumentTypeError("use page fractions from 0 to 1")
    return x, y


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("page", type=int)
    parser.add_argument("output", type=Path)
    parser.add_argument("points", type=point, nargs="+", help="polygon vertices as x,y page fractions")
    parser.add_argument("--dpi", type=int, default=350)
    args = parser.parse_args()
    if len(args.points) < 3 or args.dpi < 1 or args.output.suffix.lower() != ".webp":
        parser.error("choose at least three vertices, a positive DPI, and a WebP output path")
    with fitz.open(args.pdf) as document:
        if not 1 <= args.page <= document.page_count:
            parser.error("page position is outside the PDF")
        page = document[args.page - 1]
        vertices = [(x * page.rect.width, y * page.rect.height) for x, y in args.points]
        xs, ys = zip(*vertices)
        region = fitz.Rect(min(xs), min(ys), max(xs), max(ys))
        if region.is_empty:
            parser.error("polygon bounds have no area")
        pixmap = page.get_pixmap(dpi=args.dpi, clip=region, annots=False)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        mask = Image.new("L", image.size)
        ratio = args.dpi / 72
        points = [(round(x * ratio - pixmap.x), round(y * ratio - pixmap.y)) for x, y in vertices]
        ImageDraw.Draw(mask).polygon(points, fill=255)
        image.putalpha(mask)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        image.save(args.output, lossless=True)


if __name__ == "__main__":
    main()
