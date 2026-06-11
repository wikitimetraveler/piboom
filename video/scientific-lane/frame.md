# Scientific Lane — presentation design spec

Brand source: `public/family/css/lane-scientific-lane.css` (Scientific Lane page).

## Colors

| Role | Hex |
| --- | --- |
| Background | `#0f1218` |
| Surface (plates/panels) | `#171b24` |
| Surface 2 | `#1e2430` |
| Text | `#ece8df` |
| Muted | `#9a958a` |
| Accent (observatory blue) | `#8eb4d9` |
| Accent warm (brass gold) | `#c4a574` |
| Border | `rgba(236, 232, 223, 0.12)` |

## Typography

- Titles: Georgia, 'Times New Roman', serif — archival, quiet
- Kickers: sans, uppercase, letter-spacing 0.22em, gold
- Body: system sans

## Mood & motion

- Quiet observatory at night. Deterministic starfield (seeded PRNG) on cosmic scenes.
- Crossfades only between scenes; slow Ken Burns drift on the portrait sketch and crater plate.
- The portrait study is the hero beat: long hold, slow push toward the face.
- Thin gold rules; plate-style frames (1px border, soft shadow) for archival images.

## What NOT to do

- No saturated colors outside the blue/brass family.
- No full-screen linear gradients on dark bg (banding) — solid + localized radial glows only.
- No bouncy eases; power/expo/sine outs.
