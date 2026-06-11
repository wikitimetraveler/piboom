# Lane Legacy Museum — video design spec

Brand source: `public/family/css/lane-museum.css` (Museum Dark theme) from the Lane family site.

## Colors

| Role | Hex |
| --- | --- |
| Background | `#13151a` |
| Surface (panels/cards) | `#1b1e26` |
| Surface soft | `#232830` |
| Text | `#ece8df` |
| Muted text | `#b6b0a5` |
| Accent (brass/gold) | `#ae9a78` |
| Link / warm gold | `#c4b896` |
| Border | `rgba(236, 232, 223, 0.14)` |

## Typography

- Titles: Georgia, 'Times New Roman', serif — quiet, archival, museum-plaque tone
- Kickers: sans-serif, uppercase, letter-spacing 0.2em, accent color
- Body: system sans (`system-ui, 'Segoe UI', Roboto, sans-serif`)

## Mood & motion

- Quiet, chronological, gallery-paced. Crossfades only — no whip-pans or shaders.
- Slow Ken Burns drift on archival images.
- Thin 1px gold rules as dividers; plate-style image frames (1px border, slight inset shadow).
- Corners: 2px radius (museum panel style). Depth: soft large shadows, no neon glows.

## What NOT to do

- No bright saturated colors; stay in the brass/parchment family.
- No full-screen linear gradients on the dark background (banding) — solid bg + localized radial glow only.
- No playful bouncy eases; prefer power/expo outs.
