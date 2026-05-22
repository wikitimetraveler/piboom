# Lane Major Achievers — Lane Genealogies Vol. I (1891)

Staged research from the 1891 book and existing site curation, with conservative web corroboration.

**Machine-readable source:** [`data/lane-major-achievers.json`](../data/lane-major-achievers.json)  
**Book facsimile:** [Lane Genealogies Vol. I — Internet Archive](https://archive.org/details/lanegenealogies01chap)

---

## Summary

| Metric | Count |
|--------|------:|
| Achievers documented | 22 |
| Tier A (book + external source) | 12 |
| Tier B (book emphasis; verify before national claims) | 9 |
| Tier C (meta — the volume itself) | 1 |
| Missing `personId` in graph | 7 (compilers/committee) |

**Tier A** = named in preface, illustrations, or museum spotlight **and** at least one stable external URL (NHHS, Archive, Wikipedia, Wikisource, USGS).  
**Tier B** = strong Vol. I narrative (military, civic, frontier) but evidence tier remains compilation until rolls or town records confirm.

---

## Tier A — Book emphasis + external recognition

### Genealogy compilers and record chain

| Person | Era | Achievement | External |
|--------|-----|-------------|----------|
| **Rev. Jacob Chapman** | 1810–1903 | Completed Vol. I from prior manuscripts; signed preface | [Archive — Lane Genealogies](https://archive.org/details/lanegenealogies01chap) |
| **Rev. James H. Fitts** | 1829–1900 | Co-author; Candia/Chester lines; NEHGR member | [History of Newfields (Archive)](https://archive.org/details/historyofnewfiel00fitt) |
| **Rev. James P. Lane** | d. 1889 | 20 years gathering; NEHGR + pamphlets | [Open Library](https://openlibrary.org/authors/OL1278195A/James_P._Lane) |
| **Deacon Edmund J. Lane** | 1802–1884 | 30+ years collecting from 1839; NEHGR 1873 abstract; Dover bookstore | [NHHS Lane papers](https://www.nhhistory.org/finding_aids/finding_aids/M1991.095_Lane_Family%20Papers.pdf) |
| **Deacon Jeremiah Lane** | c. 1765 | Earliest named chart in preface chain | Book preface only |
| **Levi E. Lane** | 19th c. | Preface acknowledgment; illustrated p. 116; George G. note | Book + site exhibit |
| **1891 committee** | Hampton meeting | Geo. W., Rev. John Wm., Dr. Edw. B., Fitts, Chapman | [Historians page](/family/lane-historians.html) |

### Published primary sources

| Person | Achievement | External |
|--------|-------------|----------|
| **Deacon Samuel Lane** (Stratham, 1718–1806) | Town clerk 1774; diaries/journals — classic NH Revolutionary source | [NHHS diary catalog](https://www.nhhistory.org/object/290310/samuel-lane-s-diary-1750-1799) |

### National / scientific footprint

| Person | Achievement | External |
|--------|-------------|----------|
| **Jonathan Homer Lane** (1819–1880) | Gaseous-sun analysis; Lane–Emden equation; lunar crater | [Wikipedia](https://en.wikipedia.org/wiki/Jonathan_Homer_Lane), [USGS crater](https://planetarynames.wr.usgs.gov/Feature/3315) |
| **George G. Lane** (Hampton Falls) | Popular Science *Was He an Idiot?* (May 1884) calendrical profile | [Wikisource](https://en.wikisource.org/wiki/Popular_Science_Monthly/Volume_25/May_1884/Was_He_an_Idiot%3F) |
| **Capt. Aaron G. Lane** (1817–1883) | Mojave pioneer; Lane's Crossing (1859) | [Wikipedia](https://en.wikipedia.org/wiki/Lane%27s_Crossing) |

### Colonial anchor (family significance)

| Person | Achievement |
|--------|-------------|
| **William Lane (I) of Boston** | Vol. I subject; freeman 1657; pedigree anchor for Boston → Hampton → Hadley lines |

---

## Tier B — Strong in Vol. I; verify before upgrading

| Person | Branch | Book claim | Next verification |
|--------|--------|------------|-------------------|
| John Lane (William¹) | Boston | King Philip's War, Capt. Poole, Mar. 1675 | Muster rolls |
| Samuel Lane (William¹) | Hadley | Capt. Turner, 1676 | Muster rolls |
| Capt. John Lane | York / Hampton | Frontier captain; Dummer-era report | NEHGR XLV:130; York histories |
| Cornet John Lane⁴ | Chester | Horse troop cornet, 1754 | NH provincial rolls |
| Lt. Ezekiel Lane | Chester | Killed Bennington, 1777 | CMSR / NH rolls |
| Lt. John Lane | Chester | Bennington; promoted after Ezekiel | CMSR / NH rolls |
| Sarah (Dickinson) Lane | Hadley | 1704 captivity narrative | Deerfield raid records |
| William Lane (II) | Hampton | Tything Man Boston 1686 | Town records |
| Thomas³ Lane | Hampton | Church sexton | Parish records |

---

## Tier C — Meta achievement

**Lane Genealogies, Volume I (1891)** — 125+ years of manuscript labor distilled into a limited print run at Exeter; Chapman called it a "portable monument" beside the Hampton granite monument to William Lane.

---

## What the book itself says about "achievement"

Chapman's preface (in [`lane-historians.json`](../data/lane-historians.json)) frames achievement as **moral example and record-keeping**, not fame:

- Deacons and treasurers elected "from the Lane family"
- "Slow to speak of themselves… left their works to praise them"
- Extended sketches of Dea. E. J. Lane, Jabez, and others as "specimens of Lane character"

That local civic pattern (deacon, town clerk, sexton, surveyor) is historically significant even when it does not produce national biographies.

---

## Rejected / out of scope for this pass

- **Allied-family illustrations** (French, Swett) — pictured in book but not Lane achievers
- **WikiTree / GEDCOM-only claims** — leads only, not proof
- **Forced merges** across multiple "John Lane" / "Capt. John" branches

---

## Suggested next steps

1. ~~Add a **Lane Magazine Issue 2 spread** or trading-card pack sourced from `lane-major-achievers.json`~~ — **Done:** [`data/lane-magazine-issue-02.json`](../data/lane-magazine-issue-02.json) + `/family/lane-magazine.html?issue=02`; browse page at [`/family/lane-major-achievers.html`](../public/family/lane-major-achievers.html)
2. Extend [`lane-historians.json`](../data/lane-historians.json) compiler entries with one-line external achievements
3. Run military Tier B against NH Revolutionary rolls for Bennington officers

---

## Site integration (2026-05)

| Surface | Path |
|---------|------|
| Browse page | `/family/lane-major-achievers.html` — tier/category filters, deep links `?tier=A` / `?slug=` |
| Hub card | [`lane-family.html`](../public/family/lane-family.html) Explore section |
| Historians cross-link | Section “Major achievers (Vol. I)” on [`lane-historians.html`](../public/family/lane-historians.html) |
| Museum callout | Hero on [`lane-museum.html`](../public/family/lane-museum.html) |
| Magazine Issue 2 | `/family/lane-magazine.html?issue=02` |
