# Lane PDF Match Report

Generated: 2026-04-20

## Scope
- Reviewed PDF-photo candidate join data from `data/lane-pdf-photo-candidates.json`.
- Validated priority candidates against person records in `data/laneData.json`.
- Wrote confirmed portrait mappings to `data/lane-pdf-person-portraits.json`.

## Confirmed mappings
- `p244-i0` -> `personId 2888` (`Samuel Lane Removed`)
  - Rationale: candidate set `[2888, 2889]`; `2889` is spouse-only OCR fragment.
- `p248-i0` -> `personId 3645` (`William Lane`)
  - Rationale: candidate set `[2892, 3645, 3646]`; `3645` has clean name + 1750-1823 years.
- `p253-i0` -> `personId 2896` (`Charles Lane`)
  - Rationale: single-candidate match `[2896]`.

## Rejected alternatives (for confirmed pages)
- `p244-i0`: rejected `2889` (non-portrait spouse fragment).
- `p248-i0`: rejected `2892` (byline-heavy OCR blend), `3646` (non-person OCR artifact).

## Deferred / ambiguous
- `p270-i0` with candidates `[2907, 3652, 3653]` remains unresolved.
  - Reason: split/duplicated Captain John variants on same page; requires visual identity check against plate.

## Queue recommendation (next pass)
1. Resolve `p270-i0` after side-by-side face/plate comparison and lineage context.
2. Review low-cardinality ambiguous pages: `p268-i0`, `p299-i0`, `p327-i0`, `p330-i0`, `p332-i0`.
3. Exclude obvious non-person singletons early: `p245-i0`, `p246-i0`, `p344-i0`.

## Verification
- Runtime check of `getLanePdfGalleryData()` reports `portraitCount: 3` with person names:
  - `2888` Samuel Lane Removed
  - `3645` William Lane
  - `2896` Charles Lane
