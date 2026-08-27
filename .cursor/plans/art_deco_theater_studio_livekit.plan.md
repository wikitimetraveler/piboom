# Art Deco theater + studio + LiveKit honesty

## Goal

One focused visual language for **Watch Together** (`public/watch-together/`) and **StarBand** (`public/studio/`), plus a hard LiveKit product/UX pass on what is already in the repo. Stay on **LiveKit Cloud**. No Go SFU, no Render deploy, no SIP, no Encompass restyle.

Theater already had an Art Deco pass (gold, Cinzel, palace screen). Studio is still a tape-room: Outfit, orange amber, pill buttons, `encompass-dark-mode` + unused `design-tokens.css`. LiveKit works, but join/error/archive/agent states are half-honest.

**Approval needed before any CSS/HTML/JS work.**

---

## Non-goals

- Self-host LiveKit / Go SFU / Render SFU / SIP
- Deploy Node to Render in this PR (PC is local server; copy must not say “redeploy on Render”)
- Restyle Encompass / Worksheets / zen finance tokens
- Rewrite token mint, Socket.IO clock, or YouTube load
- Start or require the Python LiveKit worker as part of ship
- Restyle Wolfman booth visually (inspect + share LiveKit honesty patterns only)
- Sync volume across couches; egress YouTube / the player iframe

**Control-plane invariants (do not regress):**

- Volume is local only (`#wtVolume` aria-label, `handleWatchIntent` ignores volume)
- YouTube is never in egress or booth-record (`startAudioOnlyRoomEgress` is `audioOnly: true`; `booth-record.js` mixes mics only)
- Watch Together clock can fall back to Socket.IO when LiveKit keys are missing
- Studio local DAW record still works when LiveKit is unset

---

## Current state (inspected)

### Shared LiveKit core

| Piece | Path | What it does |
| --- | --- | --- |
| Mint / egress / occupancy | `services/livekit.service.js` | JWT, `RoomAgentDispatch`, audio-only composite, S3 dest optional |
| Talk-mic defaults | `public/shared/js/livekit-talk-audio.js` | Echo-cancel retries; skip local audio attach |
| Studio rooms | `services/studio.service.js` | `studio-{REEL}`, **always** dispatches agent `StarBand` |
| Theater room | `services/watch-together.service.js` | One room `watch-together-theater`, **no** agent |
| Wolfman room | `services/wolfman-livekit.service.js` | `music-wolfman-lobby`, dispatches `WolfmanDave` |
| Agents worker | `python-service/livekit_agent/worker.py` | Separate process; **one** `LIVEKIT_AGENT_NAME` per process; often not running |
| HeyGen face | `/api/heygen/streaming/*` + desk `toggleReedFace` | **Different** LiveKit Cloud room than StarBand |

### Theater (already Deco, leftover app chrome)

- Tokens: gold `#e8c872` / `#d4a017`, burgundy, cream, Cinzel + Cinzel Decorative (`watch-together.css` `:root`)
- Palace frame: `.wt-proscenium` nested gold borders; **only two** corner chevrons
- Marquee kicker exists; no bulb row
- **Leftover 12–16px / pill radii** on picker chips, pick cards, faces, map, chat input, gate input, story overlay
- LiveKit chrome is a wrap of `.wt-ghost` text buttons (Mic + Talk duplicate, Cam, Blur, Record, Archive)
- `#wtStatus` is dim prose; **no health fetch** before join; 503 copy still says “Set keys on Render, then redeploy”
- `sync.js` has no `Disconnected` / `Reconnecting` handlers
- Identity is `name-timestamp` every mint (`livekitIdentity` duplicated in watch-together.service vs livekit.service)

### Studio (not Deco)

- Outfit + `#ff9d4d` amber, `border-radius: 12–999px`, tape reels (`studio.css`)
- Loads `design-tokens.css` + `encompass-dark-mode` but **does not use** `--zen-*` / `--lf-*` in studio CSS — keep navbar, drop the finance look from the desk itself
- Status is gray text: `LiveKit unset` / `LiveKit ready` / `LiveKit {room}` (`studio-desk.js` boot + `joinLivekit`)
- Stage tiles: rounded 8px, no speaking indicator, Socket.IO names ≠ LiveKit participants
- Cam/share toggles have **no permission catch**
- **Three capture paths** with similar verbs: DAW **Record**, local **Bounce WAV**, LiveKit **Archive mics**
- Health already returns `egressS3Configured` (`getLivekitStatusExtras`) — **UI never reads it**
- Reed text chat is HTTP `/api/studio/assistant/chat`; voice Reed is the worker; face is HeyGen — three “Reeds”

### Half-wired (real, shippable)

1. **StarBand dispatch with no worker** — every desk token sets `agentName: StarBand`. If `npm run python:livekit-agent` is not running, Cloud queues a job that never joins. Desk never says Reed is missing. Worker can only be **one** agent name at a time (`LIVEKIT_AGENT_NAME`), so StarBand and WolfmanDave cannot both be live unless two processes.
2. **Archive mics without S3** — `startAudioOnlyRoomEgress` still starts a composite when `getS3UploadConfig()` is null; Cloud typically needs a dest. Buttons stay enabled. Copy mentions S3 only after failure.
3. **Render copy on a local PC** — theater error strings.
4. **Refresh = new identity** — occupancy can count ghosts; theater cap is 10 (`MAX_VIEWERS`).
5. **Occupancy fail-open** — `listRoomParticipantCount` returns `0` on API error, so `assertTheaterHasSeat` may mint past 10.
6. **Record vs Archive** — theater `booth-record.js` (tab mix, download) vs egress (server file). Easy to think one captures the movie.

---

## 1. Shared Art Deco language

Do **not** add a third shared CSS file unless duplication hurts. Copy theater hex into studio `:root` (aligned names). Keep `--st-*` prefixes so finance tokens stay untouched.

| Token | Theater today | Studio today | Shared target |
| --- | --- | --- | --- |
| Display | Cinzel | Outfit | Cinzel |
| Ornament titles | Cinzel Decorative | Outfit black | Cinzel Decorative (wordmarks only) |
| Body | Inter | Outfit | Inter (or keep Outfit for meters/timecode only) |
| Accent | `#d4a017` / `#e8c872` | `#ff9d4d` | Theater gold |
| Ink | `#f6eed8` | `#f4f4f2` | Cream |
| Ground | `#07060a` + burgundy wash | `#070707` | Near-black + burgundy underglow |
| Radius | 2–3px (intended) | 12–999px | **2–3px** everywhere except reels/dots |
| Buttons | Square gold `.wt-enter` / ghost | Pills | Square gold primary, square ghost |
| Status | dim text | dim text | **Deco chips** (see LiveKit) |

**Ornaments (CSS only, no 3D):**

- Sunburst: reuse `.wt-glow` repeating-conic at top of studio landing + listen
- Scanlines: optional, low opacity, `prefers-reduced-motion: none`
- Chevron corners: all **four** on theater proscenium; same on studio deck + desk panels
- Marquee: gold kicker + short bulb row (CSS box-shadows, not a JS ticker)
- Chrome: nested gold/black rings like `.wt-player-shell` on studio stage tiles

Studio keeps **tape reels** as the club-stage metaphor (gold rims, not orange). Listening room unlock card should match `.wt-gate-card`, not a rounded zen panel.

---

## 2. Theater polish (tighten, don’t reinvent)

Files: `public/watch-together/theater.html`, `css/watch-together.css`, `js/theater.js`, `js/sync.js`. Landing `index.html` only if radius leftovers show.

- Square the leftover radii (picker chips/cards, faces, map, chat/gate inputs) to 2–3px
- Four-corner chevrons + thin valance on `.wt-proscenium`
- Group LiveKit controls into a **booth strip**: Cam / Blur / Talk / Record couches / Archive mics — Cinzel labels, gold `aria-pressed`, hide the duplicate `#wtMic` when `#wtChatMic` is the Talk control (or label Mic as “Talk” once)
- Face tiles: gold picture-frame + Cinzel nameplate; empty state not dashed iOS card
- Pick/search: square chips, gold artist line; keep MusicBrainz → YouTube behavior
- Volume: keep unsynced; optional tiny “yours” chip next to Vol
- Status: replace prose-only `#wtStatus` with chips + one short line (see LiveKit)
- Soften livekit-missing copy: local `.env` keys, not Render redeploy

---

## 3. Studio polish (biggest visual delta)

Files: `public/studio/index.html`, `desk.html`, `listen.html`, `css/studio.css`, light class hooks in `studio-desk.js` / `studio-reel.js`.

- Swap fonts to Cinzel + Inter; gold/cream/burgundy tokens
- Square CTAs; landing title as ornament wordmark (“StarBand”)
- Desk header as marquee: reel code + **chips** (Socket / LiveKit / mic / archive)
- Panels: 3px gold hairline, chevron corners, no 12px cards
- Stage + HeyGen tile: palace frames; HeyGen caption **“Face tile · HeyGen room (not StarBand)”**
- Listen: deco gate card, gold Unlock
- Keep `modern-navbar`; stop relying on `encompass-dark-mode` for the desk surface (body class can remain if navbar needs it)
- Do not restyle Reed **behavior**; restyle the chat chrome to match theater `.wt-chat`

Landing capability chips already toggle `is-on` from `/api/studio/health` (`studio-reel.js`). Restyle those chips deco; add **egress S3** and **voice agent** only if health tells the truth (below).

---

## 4. LiveKit UX + small engineering (not infra)

Stay on Cloud. No new SFU. Changes are status, copy, guards, and a few event handlers.

### 4a. Status chips (theater + desk; Wolfman copy-only)

States, same vocabulary:

| Chip | Meaning |
| --- | --- |
| **Unset** | `LIVEKIT_NOT_CONFIGURED` (health or 503) |
| **Ready** | Keys present, not in room |
| **Joining** | `room.connect` in flight |
| **Live** | Connected; show room name (`watch-together-theater` / `studio-REEL`) |
| **Reconnecting** | `RoomEvent.Reconnecting` |
| **Down** | `Disconnected` after live |
| **Mic live** | Talk mic on + optional RMS gold glow (theater already glows `#wtChatMic`) |

Theater: fetch existing `GET` watch-together health on boot (controller already has `getWatchTogetherHealth`) so Unset/Ready appears **before** join, matching studio.

### 4b. Join / reconnect / permissions

- `sync.js` + `studio-desk.js` + optionally `wolfman-booth.js`: listen `Reconnecting`, `Reconnected`, `Disconnected` → chip + one line
- Studio `toggleCam` / `toggleShare`: catch `NotAllowedError` / no device → chip, don’t flip `camOn` blindly
- Theater: keep auto-cam attempt but don’t leave Cam pressed if it failed
- After disconnect, hide or disable booth buttons that need a room

### 4c. Presence tiles / agent visibility

- Studio: LiveKit `ParticipantConnected` / `Disconnected` should drive stage tiles **and** a “On stage” list (Socket.IO names can stay as “On the reel”)
- If `participant.kind === 'agent'` (LiveKit client 2.x) or identity looks like the dispatched agent: show **Reed** / **Wolfman Dave** tile or chip
- If studio joined and no agent after ~8s: **“Voice Reed offline — text Reed still works”** (worker not running). Do not imply the agent is in the room.
- Wolfman: same timeout → “DJ not in the booth yet. Classic Voice DJ still works.” (`public/ai/wolfman-booth.html` already says the worker may be off)

**Dispatch policy (small service change, tests exist):**

- Default **stop auto-dispatching** `StarBand` on every desk token (`studio.service.js` `mintLivekitToken`). Text Reed does not need it. Optional later: “Invite Reed (voice)” checkbox that passes `agentName`.
- **Keep** `WolfmanDave` dispatch — joining the booth *is* inviting the DJ.
- Watch Together stays `agentName: null`.
- Update `tests/unit/studio.service.test.js` if dispatch becomes opt-in.

One worker process cannot be both agents; do not “fix” that with a second product surface in this PR — document two processes in desk/Wolfman copy only.

### 4d. Egress vs local record (honesty)

Health already has `egressS3Configured`. Surface it.

- If S3 unset: **disable** Archive mics; tooltip/status “Archive needs S3 dest (`LIVEKIT_EGRESS_S3_*`). Use Record for a local couch mix.”
- If S3 set: keep Archive; on start show `s3Configured` + “mics only, not YouTube / not the timeline”
- Theater: rename/clarify **Record** = this-tab download (`booth-record.js`); **Archive mics** = server egress
- Studio: **Record** = timeline; **Bounce** = WAV in tab; **Archive mics** = LiveKit room composite
- Optional: refuse `startAudioOnlyRoomEgress` when S3 missing (`LIVEKIT_EGRESS_DEST_REQUIRED`) so Cloud doesn’t get a dest-less job — small, testable in `tests/unit/livekit.service.test.js`

### 4e. Audio quality (don’t mix the two mics)

Already correct in code; make it visible:

- LiveKit talk mic: always echo-cancel (`livekit-talk-audio.js`)
- Studio **Music input** checkbox: local `openMicStream` only (hi-fi, EC off) — never the room
- Desk chip: **Talk mic · echo cancel** vs **Music input · local takes**
- Headphones hint stays

### 4f. Identity + occupancy (small, high leverage)

- Client sends a **stable** `identity` from `sessionStorage` (theater + desk) so refresh doesn’t mint `name-{timestamp}` again
- Occupancy: on `listParticipants` failure, **fail closed** (treat as full or skip mint) instead of `return 0`
- Deduplicate `livekitIdentity` in `watch-together.service.js` to use `services/livekit.service.js`

### 4g. HeyGen

Keep the separate room. Label the tile. On stop, disconnect as today. No merge into StarBand room (different Cloud project/token).

---

## Ranked highest-impact changes (ship these)

1. **Studio Deco restyle** — palette, Cinzel, square gold, marquee desk, listen gate. Biggest “same cinema” win.
2. **Deco LiveKit chips** — Unset / Ready / Live / Reconnecting / Down on theater + desk (and honest Wolfman status text).
3. **Theater leftover rounding + booth strip** — picker/faces/map/controls match the palace frame; Talk once, gold pressed, mic glow.
4. **Presence frames + speaking** — gold nameplates; studio LiveKit participants on stage; agent chip if present.
5. **Archive vs Record honesty + S3 gate** — stop the half-wired egress button; never imply YouTube/timeline is in the file.
6. **Voice Reed / worker honesty** — stop silent StarBand dispatch (or opt-in); 8s “voice offline” if no agent.
7. **Reconnect + permission failures** — chips, don’t lie about Cam/Mic/Share.
8. **Stable identity + occupancy fail-closed** — fewer ghost seats in the 10-person theater.

---

## Passes (one PR or two)

### Pass 1 — Theater tighten + LiveKit honesty

`watch-together.css` / `theater.html` / `theater.js` / `sync.js`  
`services/livekit.service.js` (S3 refuse + occupancy fail-closed)  
`services/watch-together.service.js` (identity helper, health extras)  
`tests/unit/livekit.service.test.js`, `tests/unit/watch-together.service.test.js`

Visual + chips + archive gate + reconnect. No studio look change yet.

### Pass 2 — Studio Deco + same LiveKit chips

`studio.css` / `index.html` / `desk.html` / `listen.html` / `studio-desk.js` / `studio-reel.js`  
`services/studio.service.js` (dispatch opt-in / off by default)  
`tests/unit/studio.service.test.js`

If one PR: Pass 1 then Pass 2 in the same branch, still two reviewable commits.

Wolfman: copy/chip honesty only if it stays a few lines in `wolfman-booth.js`; no Deco restyle.

---

## Test / verify (manual)

- Theater with keys: chip Ready → join Live → Talk glow; volume still local; Archive disabled without S3; Record still downloads mics
- Theater without keys: Unset chip; Socket clock; no Cam/Talk; no Render copy
- Kill network mid-room: Reconnecting / Down
- Deny camera: Cam not stuck on
- Studio: desk looks Deco, navbar intact; local Record with Music input still works when LiveKit unset
- Join room: Live chip + room name; no Reed voice unless worker running
- HeyGen tile labeled as separate room
- Listen unlock still password-gated
- `npm test` for livekit / studio / watch-together unit files touched

---

## Out of scope reminders

Go server, Render deploy, SIP, Encompass, merging HeyGen into the StarBand room, running the Python worker in CI, dual-agent single process.
