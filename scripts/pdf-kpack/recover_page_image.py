"""Recover a visually identified JPEG resource from a scanned PDF page."""
import argparse
from io import BytesIO
from pathlib import Path

import fitz
from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("page", type=int, help="one-based PDF position")
    parser.add_argument("xref", type=int, help="JPEG image object referenced by the page")
    parser.add_argument("output", type=Path, help="new JPEG outside the pack source")
    args = parser.parse_args()
    if args.output.suffix.lower() not in (".jpg", ".jpeg"):
        parser.error("use a JPEG output extension")

    with fitz.open(args.pdf) as document:
        if not 1 <= args.page <= document.page_count:
            parser.error("page position is outside the PDF")
        page = document[args.page - 1]
        resources = {image[0]: image for image in page.get_images(full=True)}
        if args.xref not in resources:
            parser.error(f"image is not in this page's resources: {sorted(resources)}")
        resource = resources[args.xref]
        if resource[8] != "DCTDecode":
            parser.error("the referenced image is not a DCT JPEG stream")
        data = document.xref_stream_raw(args.xref)

    if not data:
        parser.error("no bytes survived for the referenced image")
    with Image.open(BytesIO(data)) as image:
        if image.format != "JPEG" or image.size != resource[2:4]:
            parser.error("original bytes do not match the page's JPEG resource")
        image.load()
        width, height = image.size

    with args.output.open("xb") as out:
        out.write(data)
    print(f"Recovered PDF position {args.page}, xref {args.xref}, {width}×{height}: {args.output}")


if __name__ == "__main__":
    main()
