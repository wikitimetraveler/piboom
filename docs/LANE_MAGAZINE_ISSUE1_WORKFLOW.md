# Lane Magazine Issue 1 Workflow

This runbook covers the manual Phase A path for assembling a small family PDF issue from assets that already exist in the repo.

## Goal

Build a 16-page shareable PDF issue with:

- 1891 book context
- historians and compilers
- curated plates
- first-edition trading cards
- one war spotlight (Aaron only under Mexican-American War framing)

## Source files

- Issue outline JSON: `data/lane-magazine-issue-01.json`
- Historians data: `data/lane-historians.json`
- Museum content: `data/lane-museum-content.json`
- Trading cards data: `data/lane-trading-cards-first-edition.json`
- Plate images: `public/family/assets/lane-pdf/`
- Aaron portrait: `public/family/assets/aaron-g-lane.png`

## Export steps

1. Open `/family/lane-trading-cards.html`
2. Export:
   - `Download catalog PDF`
   - Optional `Download 9-card sheet PDF`
3. Open `/family/lane-museum.html`
4. Export 1-2 poster pages for Issue 1 (William opening exhibit recommended)
5. Open `/family/lane-pdf-gallery.html`
6. Collect plate images listed in Issue 1 JSON (for example `p1-i0`, `p4-i0`, `p5-i0`)
7. Use the Aaron portrait image directly from:
   - `public/family/assets/aaron-g-lane.png`

## Assemble in external layout tool

Use Canva, Word, InDesign, or Affinity.

- Set page size to US Letter (8.5 x 11)
- Keep a simple two-column body style for text-heavy pages
- Preserve period texture for plate images (do not over-sharpen)
- Keep context and evidence language separate in captions

## Pagination recommendation

Use the spread order in `data/lane-magazine-issue-01.json`.

- Cover
- Editorial letter
- Historians feature
- Timeline
- Museum opening exhibit
- Plate spread A
- Plate spread B
- Trading cards intro
- Aaron card spotlight
- War spotlight (Mexican-American War scope only)
- Continuation branches
- Occupations
- Book sayings
- Sources
- Back cover
- Credits

## Final quality checks

- Aaron appears only in Mexican-American War framing
- Captions avoid overstating uncertain claims
- Source links are present on source page
- PDF exports cleanly and prints legibly in grayscale

## Delivery

- Save final as `lane-magazine-issue-01.pdf`
- Link from Lane hub or lane-magazine page for download
