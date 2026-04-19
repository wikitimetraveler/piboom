#!/usr/bin/env python3
"""
One-off: move leading military rank tokens from person name into title (laneData.json).

Collision: if title already exists (e.g. Deacon), append new rank with "; ".

Usage: python scripts/migrate_lane_military_ranks.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import parse_lane_pdf as p  # noqa: E402


def titles_to_genealogy_field(titles: list) -> str:
    """Match Deacon-style field: no trailing period."""
    parts = []
    for t in titles or []:
        s = str(t).strip().rstrip(".")
        if s and s not in parts:
            parts.append(s)
    return "; ".join(parts)


def repair_lieutenant_enant_bug(nodes: list) -> int:
    """Restore names corrupted when Lieut. matched inside Lieutenant (fixed in parser)."""
    fixed = 0
    for node in nodes:
        n = (node.get("name") or "").strip()
        if n.lower().startswith("enant "):
            node["name"] = "Lieutenant " + n[6:].strip()
            fixed += 1
        elif len(n) >= 5 and n[:5].lower() == "enant" and (len(n) == 5 or n[5].isspace()):
            node["name"] = ("Lieutenant " + n[5:]).strip()
            fixed += 1
    return fixed


def main() -> None:
    path = ROOT / "data" / "laneData.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    nodes = data.get("nodes") or []
    rep = repair_lieutenant_enant_bug(nodes)
    if rep:
        print(f"repair_lieutenant_enant_bug: fixed {rep} names")
    updated = 0
    for node in nodes:
        name = node.get("name")
        if not name or not str(name).strip():
            continue
        # Do not unfuse here: unfuse is for jammed OCR in PDF lines; laneData names are usually spaced.
        clean, titles = p.split_honorifics_from_name(str(name))
        if not titles:
            continue
        if clean == str(name).strip():
            continue
        new_title = titles_to_genealogy_field(titles)
        old_title = (node.get("title") or "").strip()
        node["name"] = clean
        if not old_title:
            node["title"] = new_title
        elif new_title and new_title.lower() not in old_title.lower():
            node["title"] = f"{old_title}; {new_title}"
        updated += 1
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"migrate_lane_military_ranks: updated {updated} nodes -> {path}")


if __name__ == "__main__":
    main()
