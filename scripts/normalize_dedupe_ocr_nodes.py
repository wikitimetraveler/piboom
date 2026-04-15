import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANE_DATA_PATH = ROOT / "data" / "laneData.json"
OCR_NODE_MIN_ID = 132

TITLE_TOKENS = {
    "deacon", "rev", "capt", "captain", "lt", "major", "dr", "mr", "mrs", "ms", "esq", "hon", "col",
}
NOISE_TOKENS = {
    "no", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv",
    "had", "his", "wife", "ch", "children", "see", "reg", "gen"
}
COMMON_FIRST_NAMES = {
    "samuel", "sarah", "mary", "john", "johns", "joshua", "thomas", "abigail", "daniel", "james",
    "elizabeth", "hannah", "anna", "ruth", "jacob", "joseph", "eunice", "lydia", "peter", "martha",
    "ezekiel", "simon", "william", "david", "ebenezer", "enos", "gad", "olive", "ithamar"
}
CANONICAL_FIRST_NAME_MAP = {
    "yohns": "John",
    "yohn": "John",
    "johns": "John",
    "jo": "Jo",
    "simot": "Simon",
    "simonot": "Simon",
    "facob": "Jacob",
    "hannahe": "Hannah",
    "willaim": "William",
    "ezekiel": "Ezekiel",
    "mehitables": "Mehitable",
}


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def tokenize_name(name: str):
    name = name or ""
    name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
    name = re.sub(r"[^A-Za-z\s'.-]", " ", name)
    raw_tokens = normalize_spaces(name).split(" ")
    # Repair OCR-split short-token names, e.g. "Jo Hn" -> "John"
    repaired = []
    i = 0
    while i < len(raw_tokens):
        cur = raw_tokens[i]
        nxt = raw_tokens[i + 1] if i + 1 < len(raw_tokens) else None
        cur_alpha = re.sub(r"[^A-Za-z]", "", cur)
        nxt_alpha = re.sub(r"[^A-Za-z]", "", nxt) if nxt else ""
        if nxt and 1 <= len(cur_alpha) <= 2 and 1 <= len(nxt_alpha) <= 3:
            repaired.append(cur_alpha + nxt_alpha)
            i += 2
            continue
        repaired.append(cur)
        i += 1

    tokens = []
    for tok in repaired:
        t = tok.strip(".-' ").lower()
        if not t:
            continue
        if t in TITLE_TOKENS or t in NOISE_TOKENS:
            continue
        if len(t) == 1:
            continue
        tokens.append(tok.strip())
    return tokens


def extract_titles(name: str):
    raw = normalize_spaces(name or "")
    lowered = raw.lower()
    titles = []
    if re.search(r"\bdeacon\b", lowered):
        titles.append("Deacon")
    if re.search(r"\besq\.?\b", lowered):
        titles.append("Esq")
    return titles


def canonical_name(name: str) -> str:
    tokens = tokenize_name(name)
    if not tokens:
        return ""
    # Keep at most 3 tokens to avoid trailing OCR garbage.
    tokens = tokens[:3]
    fixed = []
    for idx, t in enumerate(tokens):
        low = t.lower()
        if idx == 0 and low in CANONICAL_FIRST_NAME_MAP:
            fixed.append(CANONICAL_FIRST_NAME_MAP[low])
        else:
            fixed.append(t.capitalize())
    return " ".join(fixed)


def name_key(name: str) -> str:
    return re.sub(r"[^a-z]", "", (name or "").lower())


def valid_last_name(last_name: str) -> bool:
    if not last_name:
        return False
    if not re.match(r"^[A-Za-z][A-Za-z' -]{1,30}$", last_name):
        return False
    if last_name.lower() in NOISE_TOKENS:
        return False
    if last_name.lower() in COMMON_FIRST_NAMES:
        return False
    return True


def infer_last_name(node, parent_last_names):
    last = normalize_spaces(node.get("lastName", ""))
    if valid_last_name(last):
        return last
    cname = canonical_name(node.get("name", ""))
    parts = cname.split(" ")
    if len(parts) >= 2 and valid_last_name(parts[-1]):
        return parts[-1]
    if parent_last_names:
        counts = Counter(parent_last_names)
        candidate = counts.most_common(1)[0][0]
        if valid_last_name(candidate):
            return candidate
    return "Lane"


def build_parent_last_name_map(nodes_by_id, links):
    parent_last = defaultdict(list)
    for link in links:
        if link.get("relation") not in {"father", "mother"}:
            continue
        child_id = link.get("source")
        parent_id = link.get("target")
        parent = nodes_by_id.get(parent_id)
        if not parent:
            continue
        pln = normalize_spaces(parent.get("lastName", ""))
        if valid_last_name(pln):
            parent_last[child_id].append(pln)
    return parent_last


def dedupe_key(node):
    cname = canonical_name(node.get("name", ""))
    b = node.get("birthYear")
    by = str(b).strip() if b not in (None, "") else "unknown"
    ln = normalize_spaces(node.get("lastName", ""))
    return f"{name_key(cname)}|{name_key(ln)}|{by}"


def fails_person_pattern(node):
    name = normalize_spaces(node.get("name", ""))
    if not name:
        return True
    if name.lower().startswith("unknown "):
        return True
    parts = name.split()
    if len(parts) < 2:
        return True
    # Reject names with obvious prose words
    bad_words = {"required", "record", "history", "committee", "appendix", "note", "volume", "chapter", "pages"}
    lower_parts = {p.lower().strip(".-") for p in parts}
    if lower_parts & bad_words:
        return True
    if any(len(p) == 1 for p in parts):
        return True
    return False


def main():
    data = json.loads(LANE_DATA_PATH.read_text(encoding="utf-8"))
    nodes = data.get("nodes", [])
    links = data.get("links", [])

    nodes_by_id = {n.get("id"): n for n in nodes}
    parent_last_names = build_parent_last_name_map(nodes_by_id, links)

    normalized_count = 0
    for node in nodes:
        nid = node.get("id", -1)
        if nid < OCR_NODE_MIN_ID:
            continue
        preserved_titles = extract_titles(node.get("name", ""))
        cname = canonical_name(node.get("name", ""))
        last = infer_last_name(node, parent_last_names.get(nid, []))
        if not cname:
            cname = f"Unknown {last}"
        elif len(cname.split(" ")) == 1 and valid_last_name(last) and cname.lower() != last.lower():
            cname = f"{cname} {last}"
        elif len(cname.split(" ")) == 1 and not valid_last_name(last):
            cname = f"{cname} Lane"
            last = "Lane"
        node["name"] = cname
        node["lastName"] = last
        if preserved_titles:
            existing_title = normalize_spaces(node.get("title", ""))
            merged = []
            for t in ([existing_title] if existing_title else []) + preserved_titles:
                if t and t not in merged:
                    merged.append(t)
            node["title"] = ", ".join(merged)
        normalized_count += 1

    # Build merge mapping for OCR-added nodes only.
    representative_for_key = {}
    merge_into = {}
    for node in sorted(nodes, key=lambda n: n.get("id", 10**9)):
        nid = node.get("id")
        if nid is None or nid < OCR_NODE_MIN_ID:
            continue
        key = dedupe_key(node)
        if key not in representative_for_key:
            representative_for_key[key] = nid
            continue
        merge_into[nid] = representative_for_key[key]

    # Rewrite links to representative IDs.
    for link in links:
        s = link.get("source")
        t = link.get("target")
        if s in merge_into:
            link["source"] = merge_into[s]
        if t in merge_into:
            link["target"] = merge_into[t]

    # Remove merged nodes.
    merged_ids = set(merge_into.keys())
    nodes = [n for n in nodes if n.get("id") not in merged_ids]

    # Drop self-referential parent links and dedupe exact edges.
    deduped_links = []
    seen_edges = set()
    for link in links:
        rel = link.get("relation")
        s = link.get("source")
        t = link.get("target")
        if rel in {"father", "mother"} and s == t:
            continue
        edge = (rel, s, t)
        if edge in seen_edges:
            continue
        seen_edges.add(edge)
        deduped_links.append(link)

    # Prune isolated OCR nodes that fail person-name checks.
    degree = Counter()
    for l in deduped_links:
        degree[l.get("source")] += 1
        degree[l.get("target")] += 1
    pruned_ids = set()
    kept_nodes = []
    for n in nodes:
        nid = n.get("id")
        if nid is None:
            continue
        if nid >= OCR_NODE_MIN_ID and degree.get(nid, 0) == 0 and fails_person_pattern(n):
            pruned_ids.add(nid)
            continue
        kept_nodes.append(n)
    nodes = kept_nodes
    if pruned_ids:
        deduped_links = [
            l for l in deduped_links
            if l.get("source") not in pruned_ids and l.get("target") not in pruned_ids
        ]

    data["nodes"] = nodes
    data["links"] = deduped_links
    LANE_DATA_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")

    # Post-check summary.
    node_ids = {n.get("id") for n in nodes}
    missing_refs = sum(1 for l in deduped_links if l.get("source") not in node_ids or l.get("target") not in node_ids)
    invalid_rel = sum(1 for l in deduped_links if l.get("relation") not in {"father", "mother", "spouse"})
    dup_ids = [k for k, v in Counter([n.get("id") for n in nodes]).items() if v > 1]
    print({
        "normalizedNodes": normalized_count,
        "mergedNodes": len(merged_ids),
        "prunedIsolatedBadNodes": len(pruned_ids),
        "remainingNodes": len(nodes),
        "remainingLinks": len(deduped_links),
        "missingRefs": missing_refs,
        "invalidRelations": invalid_rel,
        "duplicateIds": dup_ids[:10],
    })


if __name__ == "__main__":
    main()
