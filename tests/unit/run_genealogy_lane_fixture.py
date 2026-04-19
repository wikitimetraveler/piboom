"""Regression checks for scripts/parse_lane_pdf.py (invoked by Jest)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import parse_lane_pdf as p  # noqa: E402

# Sus Anna–style: OCR birth year, death on same line, spouse birthplace after marriage cut.
LINE = (
    "II. Sus ANNA 6, b. 20 Apr., I 778 ; d. 26 May, 1865. "
    "She married Abraham Lane, b. in Candia, d. 1880."
)


def main():
    assert p.parse_birth_year_from_line(LINE) == 1778, "birth year from b. clause + OCR repair"
    vf = p.extract_vital_facts(LINE)
    assert vf["deathYear"] == 1865, "subject death year (not spouse 1880)"
    child = p.parse_child_line(LINE)
    assert child is not None
    assert child["birthYear"] == 1778
    subj_locs = p.extract_locations_and_hints(LINE, include_spouse_places=False)[0]
    assert not any("Candia" in x for x in subj_locs), "Candia must not appear in subject-only locations"
    _locs_all, hints = p.extract_locations_and_hints(LINE, include_spouse_places=True)
    spouse_candia = [h for h in hints if h.get("text") and "Candia" in h["text"] and h.get("scope") == "spouse"]
    assert spouse_candia, "Candia should appear as a spouse-scoped hint"
    bio = p.extract_bio_facts(LINE)
    assert bio.get("deathYear") == 1865
    print("ok")


def test_eu_dox_glued_header_line():
    """Child line must not parse as family header; death date + year for subject vitals."""
    line = (
        "II. Eu Dox A 5, b. 1797, d. 17 May, 1798. COL. ISAAC LANE 4 m. (2) SARAH (RANDALL) and had:"
    )
    assert p.parse_parent_header(line) is None
    bio = p.extract_bio_facts(line)
    assert bio.get("deathYear") == 1798
    assert bio.get("deathDateText") and "1798" in bio["deathDateText"]
    assert not bio.get("military"), "honorific COL on child line is not military service"


def test_header_lifespan_and_honorific():
    line = (
        "No. 12. COL. ISAAC LANE 4 (Dan), 1765-1833, of Buxton, merchant, "
        "and his (1) w. RUTH (MERRILL,) had b. in Salmon Falls, Me. :"
    )
    h = p.parse_parent_header(line)
    assert h is not None
    father, mother, titles = h
    assert father == "Isaac Lane"
    assert mother == "Ruth"
    assert any("Col" in x for x in titles)
    assert p.parse_birth_year_from_line(line) == 1765
    assert p.extract_bio_facts(line).get("deathYear") == 1833


def test_split_segments_glued_no():
    glued = "No.12 COL. ISAAC LANE 4 had b. in Buxton, Me. :"
    segs = p.split_segments(glued)
    assert len(segs) >= 1
    assert any("ISAAC" in s or "Isaac" in s for s in segs)


def test_ocr_name_fix():
    assert "Jacob" in p.apply_ocr_name_fixes("Facob Lane")


def test_split_honorifics_lieutenant_and_captain():
    n, titles = p.split_honorifics_from_name("Lieutenant Edmund Chadwick Lane")
    assert n == "Edmund Chadwick Lane"
    assert any("Lieutenant" in x for x in titles)
    n2, t2 = p.split_honorifics_from_name("Capt. Samuel Lane")
    assert n2 == "Samuel Lane"
    assert any("Capt" in x for x in t2)


def test_unfuse_jammed_lieutenant_ocr():
    out = p.unfuse_rank_prefix_ocr("LIEUTENANTEDMUND CHADWICK LANE")
    assert "LIEUTENANT EDMUND" in out.upper()
    assert p.unfuse_rank_prefix_ocr("Lieutenant Edmund Chadwick Lane") == "Lieutenant Edmund Chadwick Lane"


if __name__ == "__main__":
    main()
    test_eu_dox_glued_header_line()
    test_header_lifespan_and_honorific()
    test_split_segments_glued_no()
    test_ocr_name_fix()
    test_split_honorifics_lieutenant_and_captain()
    test_unfuse_jammed_lieutenant_ocr()
