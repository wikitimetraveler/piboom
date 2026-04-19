#!/usr/bin/env python3
"""Emit JSON array of { pdfPage, text } for a page range (for LLM staging scripts)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "data" / "lanegenealogies01chap.pdf"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    ap.add_argument("--from-page", type=int, default=1, dest="from_page")
    ap.add_argument("--to-page", type=int, default=30, dest="to_page")
    ap.add_argument("--max-chars", type=int, default=12000, help="Truncate each page text.")
    args = ap.parse_args()

    reader = PdfReader(str(args.pdf))
    n = len(reader.pages)
    lo = max(1, args.from_page)
    hi = min(n, args.to_page)
    out = []
    for i in range(lo - 1, hi):
        text = reader.pages[i].extract_text() or ""
        if len(text) > args.max_chars:
            text = text[: args.max_chars]
        out.append({"pdfPage": i + 1, "text": text})
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
