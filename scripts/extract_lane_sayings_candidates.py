#!/usr/bin/env python3
"""
Heuristic extraction of candidate 'sayings' from the Lane genealogy PDF (parallel to parse_lane_pdf.py).
Outputs a review file with status pending_review — merge approved rows into data/lane-book-sayings.json.
"""
from __future__ import annotations

import argparse
import json
import re
import hashlib
from datetime import datetime, UTC
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "data" / "lanegenealogies01chap.pdf"
DEFAULT_OUT = ROOT / "data" / "lane-book-sayings-extracted.json"

# Section / chapter style lines (OCR-tolerant)
HEAD_PATTERNS = [
    re.compile(r"^\s*NUMBER\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|\d+)\b", re.I | re.M),
    re.compile(r"WILLIAM\s+LANE\s+AND\s+FAMILY", re.I),
    re.compile(r"^\s*CHAPTER\s+[IVX\d]+\b", re.I | re.M),
]

# Quoted spans (ASCII and common Unicode quotes)
QUOTE_RE = re.compile(
    r'"(?:[^"\\]|\\.){3,200}"|'  # double ASCII
    r"'(?:[^'\\]|\\.){3,120}'|"  # single ASCII
    r"[\u201c\u2018]([^\u201d\u2019]{3,200})[\u201d\u2019]"  # curly pairs
)


def stable_id(pdf_page: int, text: str, salt: str) -> str:
    h = hashlib.sha256(f"{pdf_page}:{salt}:{text[:120]}".encode()).hexdigest()[:12]
    return f"cand-p{pdf_page}-{h}"


def extract_quote_candidates(page_text: str, pdf_page: int, prefatory_max: int) -> list[dict]:
    out = []
    if not page_text or len(page_text.strip()) < 8:
        return out

    # Whole-line heads
    for line in page_text.splitlines():
        s = line.strip()
        if len(s) < 12:
            continue
        for pat in HEAD_PATTERNS:
            if pat.search(s) and len(s) < 500:
                out.append(
                    {
                        "id": stable_id(pdf_page, s, "head"),
                        "quote": s[:480],
                        "description": "Heuristic chapter/section line match.",
                        "pdfPage": pdf_page,
                        "tags": ["head", "heuristic"],
                        "kind": "head",
                        "status": "pending_review",
                    }
                )
                break

    # Quoted substrings (stronger signal in preface window)
    if pdf_page <= prefatory_max:
        for m in QUOTE_RE.finditer(page_text):
            raw = m.group(0)
            inner = m.groups()[0] if m.lastindex else raw
            text = inner if inner and len(inner) > 6 else raw
            text = text.strip()
            if len(text) < 8 or len(text) > 400:
                continue
            # Skip obvious vitals fragments
            if re.search(r"\bb\.\s*\d", text, re.I) and re.search(r"\bm\.\s*\d", text, re.I):
                continue
            out.append(
                {
                    "id": stable_id(pdf_page, text, "quote"),
                    "quote": text[:400],
                    "description": "Quoted span from page text (regex).",
                    "pdfPage": pdf_page,
                    "tags": ["quote", "heuristic"],
                    "kind": "quoted",
                    "status": "pending_review",
                }
            )

    return out


def dedupe(entries: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for e in entries:
        key = (e["pdfPage"], e["quote"][:100])
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)
    return unique


def main():
    ap = argparse.ArgumentParser(description="Extract candidate Lane book sayings for human review.")
    ap.add_argument("--pdf", type=Path, default=DEFAULT_PDF, help="Path to lanegenealogies01chap.pdf")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output JSON path")
    ap.add_argument(
        "--prefatory-max",
        type=int,
        default=30,
        help="Apply quote-regex more aggressively for PDF pages <= this number (1-based).",
    )
    ap.add_argument(
        "--max-pages",
        type=int,
        default=0,
        help="If >0, only scan first N pages of the PDF.",
    )
    args = ap.parse_args()

    if not args.pdf.is_file():
        raise SystemExit(f"PDF not found: {args.pdf}")

    reader = PdfReader(str(args.pdf))
    n = len(reader.pages)
    limit = min(n, args.max_pages) if args.max_pages > 0 else n

    all_entries: list[dict] = []
    for i in range(limit):
        pdf_page = i + 1
        text = reader.pages[i].extract_text() or ""
        all_entries.extend(extract_quote_candidates(text, pdf_page, args.prefatory_max))

    all_entries = dedupe(all_entries)
    doc = {
        "version": 1,
        "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "source": args.pdf.name,
        "prefatoryMaxPage": args.prefatory_max,
        "candidateCount": len(all_entries),
        "entries": all_entries,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(all_entries)} candidates to {args.out}")


if __name__ == "__main__":
    main()
