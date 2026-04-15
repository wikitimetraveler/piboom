import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANE_DATA = ROOT / "data" / "laneData.json"

TITLE_WORDS = {
    "deacon", "rev", "capt", "captain", "lt", "esq", "hon", "major", "dr", "mrs", "mr", "miss"
}
BAD_TOKENS = {
    "ife", "ifewas", "idowm", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv",
    "no", "had", "and", "his", "wife"
}


def clean_name(name: str) -> str:
    if not name:
        return ""
    x = name
    x = re.sub(r"^[\W_]+", " ", x)
    x = re.sub(r"\b(?:no|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv)\b[-\.\s]*", " ", x, flags=re.IGNORECASE)
    x = re.sub(r"([a-z])([A-Z])", r"\1 \2", x)
    x = re.sub(r"[^A-Za-z\s'-.]", " ", x)
    x = re.sub(r"\s+", " ", x).strip()
    tokens = []
    for t in x.split():
        tl = t.lower().strip(".")
        if tl in TITLE_WORDS or tl in BAD_TOKENS:
            continue
        if len(re.sub(r"[^A-Za-z]", "", t)) < 2:
            continue
        tokens.append(t)
    tokens = tokens[:4]
    if not tokens:
        return ""
    return " ".join(t.capitalize() for t in tokens)


def valid_last_name(value: str) -> bool:
    if not (value and re.match(r"^[A-Za-z][A-Za-z' -]{1,30}$", value)):
        return False
    return value.lower() not in BAD_TOKENS


def main():
    data = json.loads(LANE_DATA.read_text(encoding="utf-8"))
    nodes = data.get("nodes", [])
    links = data.get("links", [])
    node_by_id = {n.get("id"): n for n in nodes}

    parent_last_name_by_child = defaultdict(list)
    for link in links:
        if link.get("relation") not in {"father", "mother"}:
            continue
        child_id = link.get("source")
        parent_id = link.get("target")
        parent = node_by_id.get(parent_id)
        if not parent:
            continue
        pln = (parent.get("lastName") or "").strip()
        if valid_last_name(pln):
            parent_last_name_by_child[child_id].append(pln)

    fixed_names = 0
    fixed_last_names = 0
    for node in nodes:
        nid = node.get("id", -1)
        if nid < 132:
            continue

        original_name = node.get("name") or ""
        name = clean_name(original_name)
        if name and name != original_name:
            node["name"] = name
            fixed_names += 1

        ln = (node.get("lastName") or "").strip()
        if not valid_last_name(ln):
            inferred = ""
            nname = node.get("name", "")
            parts = [p for p in nname.split() if p]
            if parts:
                candidate = parts[-1]
                if valid_last_name(candidate):
                    inferred = candidate
            if not inferred and parent_last_name_by_child.get(nid):
                inferred = parent_last_name_by_child[nid][0]
            if not inferred:
                inferred = "Lane"
            if inferred:
                node["lastName"] = inferred
                fixed_last_names += 1

        # Ensure single-token first names inherit lastName for readability.
        parts = [p for p in (node.get("name") or "").split() if p]
        if len(parts) == 1:
            ln2 = (node.get("lastName") or "").strip()
            if valid_last_name(ln2) and parts[0].lower() != ln2.lower():
                node["name"] = f"{parts[0]} {ln2}"

        # If cleaned name is still suspicious, use a safe fallback with last name.
        cleaned = clean_name(node.get("name", ""))
        if not cleaned or any(tok in BAD_TOKENS for tok in [t.lower() for t in cleaned.split()]):
            ln3 = (node.get("lastName") or "Lane").strip()
            node["name"] = f"Unknown {ln3}"

    LANE_DATA.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print({
        "fixedNames": fixed_names,
        "fixedLastNames": fixed_last_names,
        "nodesChecked": len([n for n in nodes if n.get('id', -1) >= 132])
    })


if __name__ == "__main__":
    main()
