import json
import re
import argparse
from collections import Counter
from pathlib import Path
from datetime import datetime, UTC
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "data" / "lanegenealogies01chap.pdf"
LANE_DATA_PATH = ROOT / "data" / "laneData.json"
BAD_NAME_TOKENS = {
    "ife", "ifewas", "ideacon", "idowm", "had", "and", "his", "wife",
    "no", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv"
}
PROSE_HINTS = {
    "note", "appendix", "preface", "records", "history", "register",
    "committee", "published", "volume", "chapter", "pages", "church"
}

# Occupation / role keywords common in Lane genealogy (OCR-tolerant).
OCCUPATION_TERMS = (
    "cordwainer", "tailor", "shoemaker", "tanner", "blacksmith", "farmer",
    "merchant", "physician", "lawyer", "cooper", "carpenter", "mason",
    "wheelwright", "saddler", "minister", "deacon", "selectman", "clerk",
    "schoolmaster", "teacher", "surveyor", "gentleman", "esquire",
)

MILITARY_HINTS = (
    "soldier", "capt.", "captain", "lt.", "lieutenant", "col.", "colonel",
    "maj.", "major", "sergeant", "militia", "regiment", "company",
    "king philip", "philip's war", "indian war", "french and indian",
    "revolutionary", "revolution", "continental", "civil war",
)

EDUCATION_HINTS = (
    "harvard", "yale", "dartmouth", "brown", "college", "academy",
    "graduated", "a.b.", "a. m.", "ll.b.", "degree", "tutor",
)


def normalize_name(value: str) -> str:
    value = value.lower()
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(r"[^a-z0-9\s'-]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def title_case(value: str) -> str:
    return " ".join(part.capitalize() for part in value.strip().split())


def clean_text(value: str) -> str:
    value = value.replace("\u2019", "'").replace("\u2018", "'")
    value = value.replace("\u2014", "-").replace("\u2013", "-")
    value = value.replace("\ufb01", "fi").replace("\ufb02", "fl")
    value = re.sub(r"([a-z])([A-Z])", r"\1 \2", value)
    value = re.sub(r"([A-Za-z])(\d)", r"\1 \2", value)
    value = re.sub(r"(\d)([A-Za-z])", r"\1 \2", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def parse_year(text: str):
    match = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", text)
    return int(match.group(1)) if match else None


def detect_content_start(pages):
    for idx, text in enumerate(pages):
        raw = text or ""
        if re.search(r"\bNo\.\s*\d+\b", raw) and re.search(r"\bhad\b", raw, flags=re.IGNORECASE):
            return idx
    return 0


def extract_ocr_content_pages(pdf_path: Path, content_offset: int, content_count: int):
    import numpy as np
    import cv2
    import pypdfium2 as pdfium
    from rapidocr_onnxruntime import RapidOCR

    pdf = pdfium.PdfDocument(str(pdf_path))
    engine = RapidOCR()

    # Detect start by scanning first chunk with OCR text.
    start_index = 0
    probe_limit = min(len(pdf), 60)
    for idx in range(probe_limit):
        page = pdf[idx]
        pil = page.render(scale=2.0).to_pil()
        arr = np.array(pil)
        if arr.ndim == 3 and arr.shape[2] == 4:
            arr = cv2.cvtColor(arr, cv2.COLOR_RGBA2RGB)
        result, _ = engine(arr)
        if not result:
            continue
        text = " ".join([clean_text(r[1]) for r in result if len(r) >= 2 and clean_text(r[1])])
        if re.search(r"\bNo\.\s*\d+\b", text) and re.search(r"\bhad\b", text, flags=re.IGNORECASE):
            start_index = idx
            break

    batch_start = start_index + content_offset
    batch_end = min(batch_start + content_count, len(pdf))
    pages = []
    for idx in range(batch_start, batch_end):
        page = pdf[idx]
        pil = page.render(scale=2.5).to_pil()
        arr = np.array(pil)
        if arr.ndim == 3 and arr.shape[2] == 4:
            arr = cv2.cvtColor(arr, cv2.COLOR_RGBA2RGB)
        result, _ = engine(arr)
        if not result:
            pages.append("")
            continue
        # Sort lines top-to-bottom by average y-coordinate.
        sorted_lines = sorted(result, key=lambda r: sum(p[1] for p in r[0]) / max(len(r[0]), 1))
        lines = [clean_text(r[1]) for r in sorted_lines if len(r) >= 2 and clean_text(r[1])]
        pages.append("\n".join(lines))

    return start_index, pages


def first_name_from_segment(segment: str):
    segment = re.sub(r"^\(?\d+\)?\s*", "", segment)
    segment = re.sub(r"^[IVXLCDM]+\.\s*", "", segment)
    segment = clean_text(segment)
    if "," in segment:
        segment = segment.split(",", 1)[0]
    segment = re.sub(r"\b(b|m|d)\.\s*$", "", segment, flags=re.IGNORECASE)
    segment = re.sub(r"\b(?:b|m|d|had|who|and|of|in|res|rem)\b.*$", "", segment, flags=re.IGNORECASE)
    segment = re.sub(r"\d", "", segment)
    segment = re.sub(r"[^A-Za-z\s'-.]", " ", segment)
    segment = re.sub(r"\s+", " ", segment).strip()
    tokens = [t for t in segment.split() if re.match(r"^[A-Za-z][A-Za-z'.-]*$", t)]
    tokens = [t for t in tokens if t.lower().strip("-.") not in BAD_NAME_TOKENS]
    if not tokens:
        return None
    # Keep first likely person-name tokens only.
    tokens = tokens[:4]
    segment = " ".join(tokens)
    if len(segment) < 3:
        return None
    return title_case(segment)


def is_plausible_name(name: str) -> bool:
    if not name:
        return False
    cleaned = re.sub(r"[^A-Za-z\s'-]", " ", name)
    tokens = [t.lower().strip("-.") for t in cleaned.split() if t.strip("-.")]
    if not tokens:
        return False
    if any(t in BAD_NAME_TOKENS for t in tokens):
        return False
    if len(tokens) == 1 and len(tokens[0]) < 3:
        return False
    if any(re.fullmatch(r"[ivxlcdm]+", t) for t in tokens):
        return False
    return True


def extract_locations(text: str):
    text = clean_text(text)
    locations = []
    patterns = [
        r"\bb\.\s*in\s+([A-Z][A-Za-z\s.'-]{2,60})",
        r"\bborn\s+in\s+([A-Z][A-Za-z\s.'-]{2,60})",
        r"\bof\s+([A-Z][A-Za-z\s.'-]{2,60})",
        r"\bin\s+([A-Z][A-Za-z\s.'-]{2,60})"
    ]
    for pat in patterns:
        for m in re.finditer(pat, text, flags=re.IGNORECASE):
            candidate = clean_text(m.group(1))
            candidate = re.sub(r"\b(?:and|who|had|m\.|d\.)\b.*$", "", candidate, flags=re.IGNORECASE)
            candidate = candidate.strip(" ,;:.")
            if len(candidate) >= 3 and candidate not in locations:
                locations.append(candidate)
    return locations[:5]


def strip_name_qualifiers(name: str) -> str:
    """Remove parenthetical surnames from extracted spouse tokens."""
    n = clean_text(name)
    n = re.sub(r"\([^)]*\)", " ", n)
    n = re.sub(r"\s+", " ", n).strip(" ,.;:")
    return n


def extract_bio_facts(line: str) -> dict:
    """Pull occupation, military, education, and children notes from a raw line."""
    low = line.lower()
    jobs = []
    for term in OCCUPATION_TERMS:
        if term in low:
            jobs.append(title_case(term))

    military = []
    if any(h in low for h in MILITARY_HINTS):
        # Keep a short evidence phrase for UI / text merge.
        for m in re.finditer(
            r"([^.]{10,120}(?:soldier|militia|capt\.|captain|king philip|war|company|regiment)[^.]{0,120})",
            line,
            flags=re.IGNORECASE,
        ):
            snippet = clean_text(m.group(1))
            if len(snippet) > 12 and snippet not in military:
                military.append(snippet[:240])
        if not military:
            military.append(clean_text(line)[:240])

    education = []
    for hint in EDUCATION_HINTS:
        if hint not in low:
            continue
        idx = low.find(hint)
        if idx == -1:
            continue
        start = max(0, idx - 40)
        end = min(len(line), idx + len(hint) + 60)
        snippet = clean_text(line[start:end])
        if snippet and snippet not in education:
            education.append(snippet[:200])

    children_note = None
    m = re.search(r"\bhad\s+(\d+)\s+ch", low)
    if m:
        children_note = f"{m.group(1)} children (from text)"
    m = re.search(r"\b(\d+)\s+ch\b", low)
    if m and not children_note:
        children_note = f"{m.group(1)} ch. (from text)"
    if re.search(r"\bs\.\s*p\.|sine\s+prole|without\s+issue", low):
        children_note = (children_note + "; " if children_note else "") + "sine prole (from text)"

    return {
        "occupation": list(dict.fromkeys(jobs)),
        "military": military[:3],
        "education": education[:3],
        "childrenNote": children_note,
    }


def extract_spouse_names(line: str) -> list:
    """Find spouse given names from marriage / wife phrases (conservative)."""
    s = clean_text(line)
    low = s.lower()
    if re.search(r"\bunm\.|unmarried|single\b", low):
        return []

    names = []

    def add_name(raw: str):
        raw = strip_name_qualifiers(raw)
        if not raw or len(raw) < 2:
            return
        parts = [p for p in raw.split() if re.match(r"^[A-Za-z][A-Za-z'.-]*$", p)]
        parts = [p for p in parts if p.lower() not in BAD_NAME_TOKENS and len(p) > 1]
        if not parts:
            return
        # Drop obvious place words trailing "of Connecticut"
        if len(parts) > 2 and parts[-2].lower() == "of":
            parts = parts[:-2]
        cand = " ".join(parts[:3])
        if is_plausible_name(cand):
            names.append(title_case(cand))

    for m in re.finditer(
        r"(?:his\s+)?wife\s+was\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})",
        s,
        flags=re.IGNORECASE,
    ):
        add_name(m.group(1))

    for m in re.finditer(
        r"\bmarried\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\b",
        s,
        flags=re.IGNORECASE,
    ):
        add_name(m.group(1))

    # m. <date stuff>, NAME — capture capitalized name after first comma following m.
    for m in re.finditer(
        r"\bm\.\s*[^,]{0,48},\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})",
        s,
        flags=re.IGNORECASE,
    ):
        add_name(m.group(1))

    # "and his w. ELIZABETH ..." (handled in header; repeat for inline)
    for m in re.finditer(
        r"\b(?:his\s+)?w\.\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})\s*(?:,|had|\.|$)",
        s,
        flags=re.IGNORECASE,
    ):
        add_name(m.group(1))

    # Dedupe preserving order
    out = []
    seen = set()
    for n in names:
        k = normalize_name(n)
        if k not in seen:
            seen.add(k)
            out.append(n)
    return out[:4]


def merge_bio_dict(target: dict, incoming: dict) -> None:
    if not incoming:
        return
    for k in ("occupation", "military", "education"):
        cur = target.setdefault(k, [])
        for item in incoming.get(k, []) or []:
            if item and item not in cur:
                cur.append(item)
    cn = incoming.get("childrenNote")
    if cn:
        prev = target.get("childrenNote")
        target["childrenNote"] = f"{prev}; {cn}" if prev else cn


def parse_parent_header(line: str):
    line_clean = clean_text(line)
    squashed = re.sub(r"[^a-z]", "", line_clean.lower())
    if "had" not in squashed and "wifewas" not in squashed and "theirchildren" not in squashed:
        return None
    # Common forms:
    # "SAMUEL LANE ... and his w. ELIZABETH ... had"
    # "DEACONJOSHUALANE...andhisw.BATHSHEBA...had"
    lane_match = re.search(r"([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})\s*LANE", line_clean)
    if not lane_match:
        return None
    father_name = title_case(lane_match.group(1) + " Lane")
    if not is_plausible_name(father_name):
        return None

    spouse_name = None
    spouse_match = re.search(r"(?:wife|his\s*w\.?|w\.)\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})\s*(?:\(|,|had|$)", line_clean, flags=re.IGNORECASE)
    if spouse_match:
        spouse_name = title_case(spouse_match.group(1))
        if not is_plausible_name(spouse_name):
            spouse_name = None
    return father_name, spouse_name


def parse_child_line(line: str):
    line_clean = clean_text(line)
    if not re.match(r"^\(?\d+\)?\s*[IVXLCDM]+[\.\-]|^[IVXLCDM]+[\.\-]", line_clean):
        return None
    marker_level = 1
    if re.match(r"^\(\d+\)\s*[IVXLCDM]+[\.\-]", line_clean):
        # Numbered descendant marker plus Roman numeral generally indicates
        # a deeper descendant tier under the active parent context.
        marker_level = 2
    name = first_name_from_segment(line_clean)
    if not name:
        return None
    birth_year = parse_year(line_clean)
    locations = extract_locations(line_clean)
    return {
        "name": name,
        "birthYear": birth_year,
        "rawText": line_clean,
        "locations": locations,
        "markerLevel": marker_level,
    }


def looks_like_prose_or_header(line: str) -> bool:
    txt = clean_text(line)
    low = txt.lower()
    if len(txt) > 140 and not re.search(r"\bb\.|\bm\.|\bd\.|had\b", low):
        return True
    if re.search(r"\bno\.\s*\d+\b", low):
        return False
    if re.search(r"^[ivxlcdm]+\.", low):
        return False
    if sum(1 for h in PROSE_HINTS if h in low) >= 2 and not re.search(r"\bb\.|\bm\.|\bd\.", low):
        return True
    return False


def split_segments(page_text: str):
    text = (page_text or "").replace("\n", " ")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"(--\s*\d+\s*of\s*\d+\s*--)", r"\n\1\n", text, flags=re.IGNORECASE)
    text = re.sub(r"(\bNo\.\s*\d+\.)", r"\n\1", text)
    text = re.sub(r"(\(\d+\)\s*[IVXLCDM]+[\.\-])", r"\n\1", text)
    text = re.sub(r"((?<![A-Za-z])[IVXLCDM]{1,5}[\.\-]\s)", r"\n\1", text)
    text = re.sub(r"(and\s+his\s+w\.\s*)", r"\n\1", text, flags=re.IGNORECASE)
    return [clean_text(seg) for seg in text.split("\n") if clean_text(seg)]


def parse_pages_to_people(pages, page_offset):
    people = {}
    relation_candidates = []
    review_queue = []

    current_father = None
    current_mother = None

    current_family_generation = 0

    def ensure_person(name, birth_year=None, meta=None, locations=None, generation=None):
        key = f"{normalize_name(name)}|{birth_year if birth_year else 'unknown'}"
        if key not in people:
            people[key] = {
                "key": key,
                "name": name,
                "birthYear": birth_year,
                "generation": generation if generation is not None else None,
                "sources": [],
                "notes": [],
                "locations": []
            }
        elif generation is not None and people[key].get("generation") is None:
            people[key]["generation"] = generation
        if meta:
            bio = meta.get("bio")
            if bio:
                merge_bio_dict(people[key].setdefault("bio", {}), bio)
            people[key]["sources"].append(meta)
            raw = meta.get("rawText")
            if raw and raw not in people[key]["notes"]:
                people[key]["notes"].append(raw)
        if locations:
            for loc in locations:
                if loc not in people[key]["locations"]:
                    people[key]["locations"].append(loc)
        return key

    for page_index, page_text in enumerate(pages):
        absolute_page = page_offset + page_index + 1
        lines = split_segments(page_text)
        if not lines:
            review_queue.append({
                "type": "page",
                "pdfPageNumber": absolute_page,
                "reason": "Empty extracted page"
            })
            continue

        for line_number, line in enumerate(lines, start=1):
            if looks_like_prose_or_header(line):
                continue
            if re.search(r"^No\.\s*\d+", line, flags=re.IGNORECASE):
                current_father = None
                current_mother = None
                current_family_generation = 0

            header = parse_parent_header(line)
            if not header:
                header_match = re.search(r"([A-Z][A-Z\s.'-]{2,}?\s+LANE[^:]{0,220}?\bhad\b)", line, flags=re.IGNORECASE)
                if header_match:
                    header = parse_parent_header(header_match.group(1))
            if header:
                father_name, mother_name = header
                father_birth = parse_year(line)
                line_bio = extract_bio_facts(line)
                current_father = ensure_person(father_name, father_birth, {
                    "pdfPageNumber": absolute_page,
                    "lineNumber": line_number,
                    "rawText": line,
                    "bio": line_bio,
                }, extract_locations(line), generation=current_family_generation)
                if mother_name:
                    current_mother = ensure_person(mother_name, None, {
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "rawText": line,
                        "bio": {},
                    }, extract_locations(line), generation=current_family_generation)
                    relation_candidates.append({
                        "relation": "spouse",
                        "sourceKey": current_father,
                        "targetKey": current_mother,
                        "confidence": 0.9,
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "rawText": line
                    })
                # Extra spouses named on the same line (e.g. second marriages are rare in one line; still link if clear).
                for extra_spouse in extract_spouse_names(line):
                    if mother_name and normalize_name(extra_spouse) == normalize_name(mother_name):
                        continue
                    sp_key = ensure_person(extra_spouse, None, {
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "rawText": line,
                        "bio": {},
                    }, [], generation=current_family_generation)
                    relation_candidates.append({
                        "relation": "spouse",
                        "sourceKey": current_father,
                        "targetKey": sp_key,
                        "confidence": 0.75,
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "rawText": line,
                    })

            child = parse_child_line(line)
            if child:
                if not is_plausible_name(child["name"]):
                    review_queue.append({
                        "type": "child-line",
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "reason": "Rejected implausible parsed name",
                        "rawText": line
                    })
                    continue
                line_bio = extract_bio_facts(line)
                child_key = ensure_person(child["name"], child["birthYear"], {
                    "pdfPageNumber": absolute_page,
                    "lineNumber": line_number,
                    "rawText": line,
                    "bio": line_bio,
                }, child.get("locations"), generation=(
                    current_family_generation + max(child.get("markerLevel", 1), 1)
                    if current_father else None
                ))
                if current_father:
                    relation_candidates.append({
                        "relation": "father",
                        "sourceKey": child_key,
                        "targetKey": current_father,
                        "confidence": 0.85,
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "rawText": line
                    })
                else:
                    review_queue.append({
                        "type": "relationship",
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "reason": "Child found without active father context",
                        "rawText": line
                    })

                if current_mother:
                    relation_candidates.append({
                        "relation": "mother",
                        "sourceKey": child_key,
                        "targetKey": current_mother,
                        "confidence": 0.82,
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "rawText": line
                    })

                child_gen = people[child_key].get("generation")
                for sp_name in extract_spouse_names(line):
                    if current_mother:
                        mom_nm = (people.get(current_mother) or {}).get("name", "")
                        if mom_nm and normalize_name(sp_name) == normalize_name(mom_nm):
                            continue
                    sp_key = ensure_person(sp_name, None, {
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "rawText": line,
                        "bio": {},
                    }, [], generation=child_gen)
                    relation_candidates.append({
                        "relation": "spouse",
                        "sourceKey": child_key,
                        "targetKey": sp_key,
                        "confidence": 0.78,
                        "pdfPageNumber": absolute_page,
                        "lineNumber": line_number,
                        "rawText": line,
                    })

    return {"people": people, "relationCandidates": relation_candidates, "reviewQueue": review_queue}


def strict_gate(people, relation_candidates):
    accepted = []
    rejected = []
    seen = set()
    for rel in relation_candidates:
        source = people.get(rel["sourceKey"])
        target = people.get(rel["targetKey"])
        if not source or not target:
            rel["rejectReason"] = "Missing source/target person"
            rejected.append(rel)
            continue
        if rel["confidence"] < 0.7:
            rel["rejectReason"] = "Low confidence"
            rejected.append(rel)
            continue
        if rel["relation"] in ("father", "mother"):
            source_year = source.get("birthYear")
            target_year = target.get("birthYear")
            if source_year and target_year:
                delta = source_year - target_year
                if delta < 13 or delta > 80:
                    rel["rejectReason"] = "Temporal sanity failed"
                    rejected.append(rel)
                    continue
        edge_key = (rel["relation"], rel["sourceKey"], rel["targetKey"])
        if edge_key in seen:
            continue
        seen.add(edge_key)
        accepted.append(rel)
    return accepted, rejected


def infer_gender(name: str):
    first = (name.split()[0] if name else "").lower()
    female_tokens = {"mary", "sarah", "elizabeth", "hannah", "abigail", "anna", "lydia", "bathsheba", "betsey", "martha"}
    male_tokens = {"john", "william", "samuel", "thomas", "joshua", "james", "daniel", "joseph", "ebenezer", "isaiah", "gad"}
    if first in female_tokens:
        return "F"
    if first in male_tokens:
        return "M"
    return "U"


def merge_parsed_bio_into_node(node: dict, person: dict) -> None:
    """Merge OCR-derived occupation/military/education/children hints into a laneData node."""
    bio = person.get("bio") or {}
    if not bio:
        return
    if not any([bio.get("occupation"), bio.get("military"), bio.get("education"), bio.get("childrenNote")]):
        return

    imp = node.setdefault("importMeta", {})
    if not isinstance(imp, dict):
        imp = {}
        node["importMeta"] = imp
    facts = imp.setdefault("ocrFacts", {})
    for key in ("occupation", "military", "education"):
        items = bio.get(key) or []
        if not items:
            continue
        cur = facts.setdefault(key, [])
        for it in items:
            if it and it not in cur:
                cur.append(it)
    if bio.get("childrenNote"):
        prev = facts.get("childrenNote")
        facts["childrenNote"] = f"{prev}; {bio['childrenNote']}" if prev else bio["childrenNote"]

    existing_occ = node.get("occupation")
    if not isinstance(existing_occ, list):
        existing_occ = []
    new_occ = list(existing_occ)

    for job in bio.get("occupation", []):
        if not job:
            continue
        low = job.lower()
        if not any(isinstance(o, dict) and (o.get("job") or "").lower() == low for o in new_occ):
            new_occ.append({"job": low})

    for mil in bio.get("military", []):
        def _svc_match(o):
            if not isinstance(o, dict) or not o.get("service"):
                return False
            try:
                return o["service"][0].get("text") == mil
            except (IndexError, TypeError, KeyError):
                return False

        if mil and not any(_svc_match(o) for o in new_occ):
            new_occ.append({"service": [{"text": mil}]})

    if new_occ != existing_occ:
        node["occupation"] = new_occ

    extra_text = []
    if bio.get("education"):
        extra_text.append("Education (OCR): " + "; ".join(bio["education"][:2]))
    if bio.get("childrenNote"):
        extra_text.append("Children (OCR): " + bio["childrenNote"])
    if extra_text:
        prev = (node.get("text") or "").strip()
        add = " | ".join(extra_text)
        node["text"] = f"{prev} | {add}" if prev else add


def ensure_unique_node_ids(lane_data):
    nodes = lane_data.get("nodes", [])
    ids = [node.get("id") for node in nodes if node.get("id") is not None]
    dup_ids = {nid for nid, count in Counter(ids).items() if count > 1}
    if not dup_ids:
        return 0

    next_id = max(ids, default=-1) + 1
    first_seen = set()
    reassigned = 0
    for node in nodes:
        nid = node.get("id")
        if nid is None:
            node["id"] = next_id
            next_id += 1
            reassigned += 1
            continue
        if nid not in dup_ids:
            continue
        if nid not in first_seen:
            first_seen.add(nid)
            continue
        node["id"] = next_id
        next_id += 1
        reassigned += 1
    return reassigned


def append_to_lane_data(parsed_people, accepted_relations):
    lane_data = json.loads(LANE_DATA_PATH.read_text(encoding="utf-8"))
    ensure_unique_node_ids(lane_data)
    existing_nodes = lane_data.get("nodes", [])
    existing_links = lane_data.get("links", [])

    next_id = max((node.get("id", -1) for node in existing_nodes), default=-1) + 1
    existing_lookup = {}
    for node in existing_nodes:
        key = f"{normalize_name(node.get('name', ''))}|{node.get('birthYear') if node.get('birthYear') else 'unknown'}"
        existing_lookup[key] = node["id"]
    existing_by_id = {node.get("id"): node for node in existing_nodes}

    new_count = 0
    key_to_id = {}
    for key, person in parsed_people.items():
        if key in existing_lookup:
            existing_id = existing_lookup[key]
            key_to_id[key] = existing_id
            existing_node = existing_by_id.get(existing_id)
            if existing_node is not None:
                incoming_gen = person.get("generation")
                existing_gen = existing_node.get("generation")
                if incoming_gen is not None and existing_gen in ("", None):
                    existing_node["generation"] = incoming_gen
                merge_parsed_bio_into_node(existing_node, person)
            continue
        inferred_last_name = ""
        if person["name"]:
            parts = person["name"].split()
            if parts:
                inferred_last_name = parts[-1] if parts[-1].lower() not in {"jr", "sr"} else (parts[-2] if len(parts) > 1 else "")
        node = {
            "name": person["name"],
            "id": next_id,
            "text": " | ".join(person.get("notes", [])[:8]),
            "generation": person["generation"] if person.get("generation") is not None else 0,
            "gender": infer_gender(person["name"]),
            "lastName": inferred_last_name or ("Lane" if " lane" in person["name"].lower() else ""),
            "birthYear": person["birthYear"] if person["birthYear"] else "",
            "deathYear": "",
            "birthDate": "",
            "deathDate": "",
            "born": (person.get("locations") or [""])[0] if person.get("locations") else "",
            "deathPlace": "",
            "burial": "",
            "locations": person.get("locations", []),
            "sourceRefs": person.get("sources", []),
            "importMeta": {
                "source": "lanegenealogies01chap.pdf",
                "parser": "parse_lane_pdf.py"
            }
        }
        merge_parsed_bio_into_node(node, person)
        existing_nodes.append(node)
        key_to_id[key] = next_id
        next_id += 1
        new_count += 1

    link_seen = {(l.get("relation"), l.get("source"), l.get("target")) for l in existing_links}
    new_links = 0
    for rel in accepted_relations:
        source = key_to_id.get(rel["sourceKey"])
        target = key_to_id.get(rel["targetKey"])
        if source is None or target is None:
            continue
        edge = (rel["relation"], source, target)
        if edge in link_seen:
            continue
        link_seen.add(edge)
        existing_links.append({
            "source": source,
            "target": target,
            "color": "#39F" if rel["relation"] == "father" else "#F39" if rel["relation"] == "mother" else "#CC0",
            "relation": rel["relation"]
        })
        new_links += 1

    lane_data["nodes"] = existing_nodes
    lane_data["links"] = existing_links
    LANE_DATA_PATH.write_text(json.dumps(lane_data, indent=2), encoding="utf-8")
    return lane_data, new_count, new_links


def validate_lane_data(lane_data):
    node_ids = {node.get("id") for node in lane_data.get("nodes", [])}
    issues = []
    seen_ids = set()
    for node in lane_data.get("nodes", []):
        nid = node.get("id")
        if nid in seen_ids:
            issues.append({"severity": "error", "reason": "Duplicate node id", "id": nid})
        seen_ids.add(nid)
    for link in lane_data.get("links", []):
        if link.get("source") not in node_ids or link.get("target") not in node_ids:
            issues.append({"severity": "error", "reason": "Link references missing node", "link": link})
        if link.get("relation") not in ("father", "mother", "spouse"):
            issues.append({"severity": "error", "reason": "Unsupported relation", "relation": link.get("relation")})
    return {"valid": len([i for i in issues if i["severity"] == "error"]) == 0, "issues": issues}


def build_output_paths(content_offset, content_count):
    start_num = content_offset + 1
    end_num = content_offset + content_count
    base = f"lanegenealogies01chap-content{start_num}-{end_num}"
    structured = ROOT / "data" / f"{base}-structured.json"
    review = ROOT / "data" / f"{base}-review-queue.json"
    quality = ROOT / "data" / f"{base}-quality-report.json"
    return structured, review, quality


def main():
    parser = argparse.ArgumentParser(description="Parse genealogy PDF content pages and append to laneData.json")
    parser.add_argument("--content-offset", type=int, default=0, help="Offset into content pages after detected start")
    parser.add_argument("--content-count", type=int, default=100, help="Number of content pages to parse")
    parser.add_argument("--reset-added-from-id", type=int, default=None, help="Before append, remove nodes with id >= value and links referencing them")
    parser.add_argument("--use-ocr", action="store_true", help="Use true OCR page extraction instead of embedded PDF text")
    args = parser.parse_args()

    if args.use_ocr:
        start_index, selected_pages = extract_ocr_content_pages(PDF_PATH, args.content_offset, args.content_count)
        batch_start = start_index + args.content_offset
    else:
        reader = PdfReader(str(PDF_PATH))
        pages = [page.extract_text() or "" for page in reader.pages]
        start_index = detect_content_start(pages)
        batch_start = start_index + args.content_offset
        batch_end = batch_start + args.content_count
        selected_pages = pages[batch_start:batch_end]

    parsed = parse_pages_to_people(selected_pages, batch_start)
    accepted, rejected = strict_gate(parsed["people"], parsed["relationCandidates"])

    if args.reset_added_from_id is not None:
        lane_data_reset = json.loads(LANE_DATA_PATH.read_text(encoding="utf-8"))
        lane_data_reset["nodes"] = [n for n in lane_data_reset.get("nodes", []) if n.get("id", -1) < args.reset_added_from_id]
        valid_ids = {n.get("id") for n in lane_data_reset["nodes"]}
        lane_data_reset["links"] = [
            l for l in lane_data_reset.get("links", [])
            if l.get("source") in valid_ids and l.get("target") in valid_ids
        ]
        LANE_DATA_PATH.write_text(json.dumps(lane_data_reset, indent=2), encoding="utf-8")

    lane_data, appended_nodes, appended_links = append_to_lane_data(parsed["people"], accepted)
    validation = validate_lane_data(lane_data)
    structured_out_path, review_out_path, quality_out_path = build_output_paths(args.content_offset, args.content_count)

    structured_out = {
        "generatedAt": datetime.now(UTC).isoformat(),
        "sourcePdf": str(PDF_PATH),
        "detectedStartPdfPage": start_index + 1,
        "batchStartPdfPage": batch_start + 1,
        "parsedPageCount": len(selected_pages),
        "people": list(parsed["people"].values()),
        "acceptedRelationships": accepted
    }
    review_out = {
        "generatedAt": datetime.now(UTC).isoformat(),
        "detectedStartPdfPage": start_index + 1,
        "batchStartPdfPage": batch_start + 1,
        "rejectedRelationships": rejected,
        "reviewQueue": parsed["reviewQueue"]
    }
    quality_out = {
        "generatedAt": datetime.now(UTC).isoformat(),
        "detectedStartPdfPage": start_index + 1,
        "batchStartPdfPage": batch_start + 1,
        "parsedPageCount": len(selected_pages),
        "detectedPeople": len(parsed["people"]),
        "relationshipCandidates": len(parsed["relationCandidates"]),
        "acceptedRelationships": len(accepted),
        "rejectedRelationships": len(rejected),
        "reviewItems": len(parsed["reviewQueue"]) + len(rejected),
        "appendedNodes": appended_nodes,
        "appendedLinks": appended_links,
        "validation": validation
    }

    structured_out_path.write_text(json.dumps(structured_out, indent=2), encoding="utf-8")
    review_out_path.write_text(json.dumps(review_out, indent=2), encoding="utf-8")
    quality_out_path.write_text(json.dumps(quality_out, indent=2), encoding="utf-8")

    print(json.dumps({
        "startPage": start_index + 1,
        "batchStartPage": batch_start + 1,
        "parsedPages": len(selected_pages),
        "detectedPeople": len(parsed["people"]),
        "acceptedRelationships": len(accepted),
        "rejectedRelationships": len(rejected),
        "appendedNodes": appended_nodes,
        "appendedLinks": appended_links,
        "valid": validation["valid"],
        "structuredOut": str(structured_out_path),
        "reviewOut": str(review_out_path),
        "qualityOut": str(quality_out_path)
    }, indent=2))


if __name__ == "__main__":
    main()
