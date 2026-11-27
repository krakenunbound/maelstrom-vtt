"""Realign displaced 16px JPEG scan tiles in a separate proofing image."""
import argparse
from pathlib import Path

from PIL import Image


TILE = 16


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="extracted grayscale JPEG")
    parser.add_argument("output", type=Path, help="reconstructed grayscale PNG")
    parser.add_argument("--from-row", type=int, required=True, help="pixel y at the damaged tile row")
    parser.add_argument("--shift", type=int, required=True, help="signed horizontal pixel displacement of lower tiles")
    parser.add_argument("--black", type=int, default=0, help="lower-region gray value to map to black")
    parser.add_argument("--gray-offset", type=int, default=0, help="gray value to add to the restored region")
    parser.add_argument("--preserve-top", type=int, choices=range(TILE), default=0, help="unchanged scan lines at the start of the damaged tile row")
    args = parser.parse_args()
    if args.from_row < 0 or args.from_row % TILE or not args.shift or args.shift % TILE:
        parser.error("displacement and repair row must align to 16-pixel tiles")
    if not 0 <= args.black < 255:
        parser.error("--black must be between 0 and 254")

    with Image.open(args.source) as source:
        image = source.convert("L")
    width, height = image.size
    if args.from_row >= height or abs(args.shift) >= width:
        parser.error("repair region or displacement exceeds the image")
    padded_width = ((width + TILE - 1) // TILE) * TILE
    padded_height = ((height + TILE - 1) // TILE) * TILE
    padded = Image.new("L", (padded_width, padded_height), 255)
    padded.paste(image)

    repaired = Image.new("L", padded.size, 255)
    repaired.paste(image.crop((0, 0, width, args.from_row)))
    for y in range(args.from_row, padded_height, TILE):
        if args.shift > 0:
            band = padded.crop((args.shift, y, padded_width, y + TILE))
            repaired.paste(band, (0, y))
            if y + TILE < padded_height:
                wrapped = padded.crop((0, y + TILE, args.shift, y + 2 * TILE))
                repaired.paste(wrapped, (padded_width - args.shift, y))
        else:
            boundary = padded_width + args.shift
            band = padded.crop((0, y, boundary, y + TILE))
            repaired.paste(band, (-args.shift, y))
            if y >= TILE:
                wrapped = padded.crop((boundary, y - TILE, padded_width, y))
                repaired.paste(wrapped, (0, y))
    if args.black or args.gray_offset:
        lower = repaired.crop((0, args.from_row, width, height))
        def adjust(gray):
            return max(0, min(255, int((gray + args.gray_offset - args.black) * 255 / (255 - args.black))))
        repaired.paste(lower.point(adjust), (0, args.from_row))
    if args.preserve_top:
        y = args.from_row
        repaired.paste(image.crop((0, y, width, y + args.preserve_top)), (0, y))
    repaired.crop((0, 0, width, height)).save(args.output)


if __name__ == "__main__":
    main()
