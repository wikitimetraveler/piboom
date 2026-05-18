# Genealogy source file.
# Author: Levi Lane.

"""
Extract embedded raster images from data/lanegenealogies01chap.pdf and write a manifest.

Outputs:
  - JPEG files under public/family/assets/lane-pdf/ (1-based page in filename: p{page}-i{idx}.jpg)
  - data/lane-pdf-image-manifest.json

Requires: pypdf (and Pillow via pypdf image handling).
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, UTC
from pathlib import Path

from pypdf import PdfReader
ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "data" / "lanegenealogies01chap.pdf"
OUT_DIR = ROOT / "public" / "family" / "assets" / "lane-pdf"
MANIFEST_PATH = ROOT / "data" / "lane-pdf-image-manifest.json"


def _save_jpeg(pil_img, dest: Path) -> None:
    im = pil_img
    if im.mode in ("RGBA", "P", "LA"):
        im = im.convert("RGB")
    elif im.mode != "RGB":
        im = im.convert("RGB")
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, format="JPEG", quality=85, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract images from Lane genealogy PDF")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Write manifest only (dimensions, counts) without exporting JPEG files",
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=None,
        metavar="N",
        help="Stop after N images (for testing)",
    )
    args = parser.parse_args()

    if not PDF_PATH.is_file():
        print(json.dumps({"error": f"PDF not found: {PDF_PATH}"}, indent=2))
        raise SystemExit(1)

    reader = PdfReader(str(PDF_PATH))
    images_out: list[dict] = []
    ok_count = 0
    skipped_count = 0

    for page_index, page in enumerate(reader.pages):
        pdf_page = page_index + 1  # match sourceRefs.pdfPageNumber convention
        page_images = getattr(page, "images", None)
        if not page_images:
            continue
        try:
            n_images = len(page_images)
        except Exception as exc:
            images_out.append(
                {
                    "imageId": f"p{pdf_page}-i0",
                    "pdfPage": pdf_page,
                    "imageIndex": 0,
                    "status": "skipped",
                    "reason": f"page images unavailable: {exc}",
                }
            )
            skipped_count += 1
            continue

        for image_index in range(n_images):
            try:
                img_file = page_images[image_index]
            except Exception as exc:
                images_out.append(
                    {
                        "imageId": f"p{pdf_page}-i{image_index}",
                        "pdfPage": pdf_page,
                        "imageIndex": image_index,
                        "status": "skipped",
                        "reason": str(exc),
                    }
                )
                skipped_count += 1
                continue

            try:
                pil = img_file.image
                w, h = pil.size
            except Exception as exc:
                images_out.append(
                    {
                        "imageId": f"p{pdf_page}-i{image_index}",
                        "pdfPage": pdf_page,
                        "imageIndex": image_index,
                        "status": "skipped",
                        "reason": str(exc),
                    }
                )
                skipped_count += 1
                continue

            file_name = f"p{pdf_page}-i{image_index}.jpg"
            public_url = f"/family/assets/lane-pdf/{file_name}"
            dest = OUT_DIR / file_name

            if not args.dry_run:
                _save_jpeg(pil, dest)

            images_out.append(
                {
                    "imageId": f"p{pdf_page}-i{image_index}",
                    "pdfPage": pdf_page,
                    "imageIndex": image_index,
                    "width": w,
                    "height": h,
                    "fileName": file_name,
                    "publicUrl": public_url,
                    "status": "ok",
                }
            )
            ok_count += 1
            if args.max_images is not None and ok_count >= args.max_images:
                break
        if args.max_images is not None and ok_count >= args.max_images:
            break

    manifest = {
        "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "sourcePdf": str(PDF_PATH).replace("\\", "/"),
        "pdfPageCount": len(reader.pages),
        "extractedOkCount": ok_count,
        "skippedCount": skipped_count,
        "listedImageSlots": len(images_out),
        "images": images_out,
    }

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(
        json.dumps(
            {
                "ok": True,
                "dryRun": args.dry_run,
                "extractedOkCount": ok_count,
                "skippedCount": skipped_count,
                "manifest": str(MANIFEST_PATH),
                "exportDir": str(OUT_DIR),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
