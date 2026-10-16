# The Lane Chronicle: Four Centuries in Code and Voice

**Audience:** Lane family descendants, historians, DevConnect Labs visitors  
**Goal:** Experience ~400 years of verified Lane history as one continuous 16:9 film — ancestor HeyGen photo-avatars, 1891 register codes, book plates, and the Postgres relationship graph.  
**Target:** ~150s (2 min 30 sec) · **Aspect:** 16:9 (`1920×1080`)  
**Catalog:** [`data/lane-chronicle-movie.json`](../data/lane-chronicle-movie.json)  
**Cinema page:** `/family/lane-cinema.html`  
**HyperFrames project:** `video/lane-chronicle/`

Evidence vs Context: every ancestor beat separates **Evidence** (1891 *Lane Genealogies* register code, PDF page, plate) from **Context** (era background).

---

## Beat sheet

| # | Beat | On-camera line (summary) | Visual | ~sec |
|---|------|--------------------------|--------|------|
| 1 | Hook | 1891 volume opens; pages speak | Frontispiece `p4-i0` / title plate + gold title card | 16 |
| 2 | William No. 1 | First-person Boston root | HeyGen MCU + register card No. 1 | 24 |
| 3 | Sarah No. 3 | First-person Hadley / 1704 | HeyGen MCU + Family No. 3 | 24 |
| 4 | Cornet John | First-person Chester militia | HeyGen MCU + 1754 cornet / Bennington | 24 |
| 5 | Mind & Cosmos | Jonathan Homer (George bridge) | Diptych George → Jonathan + Lane–Emden / crater | 28 |
| 6 | Living graph | Narrator: codes → Postgres | Register decode → D3-style graph counters | 20 |
| 7 | Finale / CTA | Walk the graph & plates | Quartet + Time Traveler CTA | 14 |

**Total:** 150s · ~335 spoken words @ ~130 wpm.

---

## Shot list

| Beat | Shot type | Subject | Motion | Audio | Duration |
|------|-----------|---------|--------|-------|----------|
| 1 | WS→MS | Frontispiece / 1891 title plate | Slow push-in | Narrator VO | 16s |
| 2 | MCU + card | William E. Lane Boston HeyGen | Hold / subtle | On-camera HeyGen | 24s |
| 3 | MCU + card | Sarah Dickinson Lane HeyGen | Hold / subtle | On-camera HeyGen | 24s |
| 4 | MCU + badge | Cornet John Lane HeyGen | Hold / subtle | On-camera HeyGen | 24s |
| 5 | Split → MCU | George short → Jonathan Homer | Crossfade | On-camera HeyGen (JHL) | 28s |
| 6 | Screen insert | Register line → graph counters | Data animation | Narrator VO | 20s |
| 7 | WS mosaic | Quartet + emblem + CTA | Hold | Narrator VO | 14s |

---

## Teleprompter script (spoken words only)

```text
[BEAT 1 — NARRATOR VO | 0:00–0:16]
In eighteen ninety-one, Jacob Chapman and James Fitts printed Volume One of Lane Genealogies in Exeter, New Hampshire.
[PAUSE]
Inside its pages, a nineteenth-century register code linked four centuries of New England lives. Today, those pages speak.
[CUT TO: WILLIAM LANE — FAMILY NO. 1]

[BEAT 2 — WILLIAM E. LANE OF BOSTON (ON CAMERA) | 0:16–0:40]
Hello. I am William Lane — the Boston line begins with me.
[PAUSE]
Freeman of Massachusetts Bay in sixteen fifty-seven, cordwainer in the town records, husband of Mary, and father of Samuel, who carried our name toward Hadley and Hampton.
[PAUSE]
You are standing at Family Number One — the root of the Lane family tree.
[CUT TO: SARAH DICKINSON LANE — FAMILY NO. 3]

[BEAT 3 — SARAH DICKINSON LANE (ON CAMERA) | 0:40–1:04]
Hello. I am Sarah Dickinson — wife of Samuel Lane of Hadley on the Connecticut River frontier.
[PAUSE]
Lane Genealogies records our household under Family Number Three. In seventeen oh four, French and Indian raiders took me and my children captive to Canada. Most of us returned; one daughter remained.
[CUT TO: CORNET JOHN LANE — CHESTER MILITIA]

[BEAT 4 — CORNET JOHN LANE (ON CAMERA) | 1:04–1:28]
Hello. I am Cornet John Lane. Born at Hampton on the New Hampshire seacoast, I made my life at Chester — farmer, tavern-keeper, and militia man.
[PAUSE]
In September seventeen fifty-four, the book records me as Cornet in a troop of horse. My sons carried our name into the Revolution, including officers at Bennington.
[CUT TO: GEORGE G. LANE & JONATHAN HOMER LANE — SCIENTIFIC LANE]

[BEAT 5 — JONATHAN HOMER LANE (ON CAMERA) | 1:28–1:56]
Hello. I am Jonathan Homer Lane. Born in eighteen nineteen, I studied at Phillips Exeter and Yale, and spent my career in Washington on the Coast Survey and at the Patent Office.
[PAUSE]
My mathematical law of the gaseous Sun became the Lane–Emden equation — and in nineteen seventy, a crater on the far side of the Moon was named for our family.
[CUT TO: 1891 REGISTER DECODER & POSTGRES GRAPH]

[BEAT 6 — NARRATOR VO | 1:56–2:16]
Every numbered family, carry-forward numeral, and generation superscript in the eighteen ninety-one volume has now been decoded into Postgres.
[PAUSE]
Six hundred and fifty coded people and five hundred and sixty-seven book-verified parent and spouse links connect directly to the printed page.
[CUT TO: QUARTET FINALE & CTA]

[BEAT 7 — NARRATOR VO | 2:16–2:30]
Walk the live relationship graph, inspect the original book plates, or hear every ancestor in full at the Lane Family Hub.
```

---

## HeyGen v3 handoff cues (English, Video Agent)

```
Presenter: MCU, steady, professional studio light, minimal gesture
Pacing: conversational, pause after key terms; warmer heritage tone; slower on names and dates
Background: soft neutral / heritage parchment blur — no busy motion
Aspect: 16:9 landscape
Do not: rapid cuts, exaggerated expressions, stock-photo backgrounds
Ancestor photo-avatars: low expressiveness; use existing lane-heygen-lines photo avatars
Narrator beats (1, 6, 7): Google Cloud TTS or optional studio host clip via video/lane-chronicle/make-heygen-clips.mjs
```

### Local HeyGen ancestor assets

| Person | Video |
|--------|-------|
| William E. Lane of Boston | `/family/assets/video/william-e-lane-boston-heygen-short.mp4` |
| Sarah Dickinson Lane | `/family/assets/video/sarah-dickinson-lane-heygen-short.mp4` |
| Cornet John Lane | `/family/assets/video/cornet-john-lane-heygen.mp4` |
| George G. Lane | `/family/assets/video/george-g-lane-idiot-heygen-short.mp4` |
| Jonathan Homer Lane | `/family/assets/video/jonathan-homer-lane-heygen.mp4` |

---

## Production commands

```bash
# Narration MP3s for HyperFrames beats 1, 6, 7 (server on :3000)
cd video/lane-chronicle && node make-narration.mjs

# Optional HeyGen host narrator stubs
cd video/lane-chronicle && node make-heygen-clips.mjs

# HyperFrames preview / check / render
cd video/lane-chronicle && npm run check && npm run render
# Copy latest render → public/family/assets/video/lane-chronicle-movie.mp4
```

## CTA destinations

- Cinema theater: `/family/lane-cinema.html`
- Live graph: `/family/genealogy.html?familyNo=3&section=boston`
- Book plates: `/family/lane-pdf-gallery.html`
- Hub: `/family/lane-family.html`
