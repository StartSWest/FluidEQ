# Room — design

Date: 2026-09-16
Status: approved on screens (https://claude.ai/artifact/SDe3UcKvr2v8bHWgJTk6N6);
nothing built. Ivan's four calls taken at the recommendation: the name is
**Room**; the room is for everyone and Fit plus room shaping are Plus; the
Library player gets it; the heads shipped are SADIE II (Apache 2.0) and MIT
KEMAR (free with citation), never HeSuVi's recordings of other companies'
products. Ivan: "try not to copy any of their ideas, we need to be original".

## What it is

A listening room rendered on headphones, as one more stage of the DSP rack.
Every channel of the stream Windows hands the engine — two, six or eight —
is a speaker in a room around the listener's head; each speaker's sound
reaches the two ears through a measured head (an HRIR pair for its
direction) and through a few early reflections off the room's walls, and
the two ear signals leave on the front pair. The channels beyond the pair
leave silent.

Three things make it FluidEQ's rather than a switch over somebody else's
virtualiser:

1. **Nothing to route.** Stereo music becomes two speakers in front; a 5.1
   film uses five and the sub; a 7.1 game the whole ring. Which speakers
   exist comes from the stream's channel mask, the way the LFE is found
   today. The output panel offers to set a headphone output to 7.1 in one
   press where its driver takes eight channels, and says so where it does
   not (most USB headsets take stereo only; the room still does the front
   stage there).
2. **A room you can see and shape.** The card's graph is the room from
   above: the head in the middle, the speakers on a ring, each lit by its
   level. Size, walls, distance, centre and sub are dials; speakers drag.
3. **A head fitted to the listener.** Three shipped heads (small, medium,
   large, by the head width SADIE II publishes per subject) and a
   two-minute listen — five A/B pairs, "which one is more in front of you"
   — that picks the one whose sound leaves the head for this listener.

## Placement in the rack

After the exciter, Bass Forge, the EQ and Bass Punch — everything that is
per channel — and before Dimension, the compressor and the rest, which then
run on the binaural pair like any stereo rack:

```
… → Bass Punch → [Room: N channels → front pair] → Dimension → Compressor → …
```

With the room off, or on a mono stream, the stage passes through and the
rack is bit-for-bit what it is today. On a stereo stream with the room on,
the two channels are the two front speakers.

## The engine stage (`native/dsp-core`, `FeqRoom`)

- **Kernels.** For each input channel with a speaker position (from the
  mask; LFE has none and is routed as bass, below): the direct path is the
  head's HRIR pair for the nearest ring direction, and each of four
  first-order wall reflections (image-source, shoebox room, listener
  centred) is that reflection's direction's HRIR pair, delayed by its
  path length, attenuated by distance and by the walls' absorption. Direct
  plus reflections are summed into one kernel per ear per channel, so the
  stage is 2·N partitioned convolutions of the rack's own convolver
  (`feq_convolver_*`, partition 512 → +512 frames of latency, reported
  through `feq_chain_latency_frames` as the linear-phase EQ's is).
- **The sub.** The LFE channel gets no head: it is low-passed at 120 Hz,
  scaled by the Sub dial and added to both ears in phase. On a layout
  without an LFE the Sub dial is greyed.
- **The centre** carries the Centre dial as gain on its channel before the
  head.
- **Heads.** A head set is a ring of 24 directions (every 15° of azimuth,
  0° elevation), two ears, 256 taps, at 44.1, 48 and 96 kHz; 192 kHz
  streams take the 96 kHz set through `feq_oversample_up`. Three sets
  ship; each is derived from one SADIE II subject (or KEMAR for medium)
  by a build script that trims, windows and normalises, and writes them
  under `assets/room/heads/<size>.txt` with the licence text beside it.
- **Head size** also scales the interaural delay: the same set fits a
  wider head with a proportionally longer cross-head delay, which is a
  measured physical relation and what the Fit test steps through.
- **Changing anything** (dial, drag, head) rebuilds the kernels on the
  control thread and fades in over the convolver's blend, as the EQ kernel
  does; no click.
- **Settings on the wire** (twenty-three scalars appended before the
  surround flag, `LEAD` moves from 115 to 138): `enabled`, `preset`
  (studio / living room / cinema / front stage / custom), `size_m`, `walls`
  (0 hard–1 dead), `distance_m`, `centre_db`, `sub_db`, `head` (0 small /
  1 medium / 2 large), `correct_headphones`, then seven `angle_deg` and
  seven `level_db` for FL FR C SL SR RL RR. The head set itself is not on the
  wire: the app writes `fluideq-room-head.txt` beside the rack file only
  when the head changes, the engine reloads on the folder change it
  already watches, and a missing file is "room off" with a log line and a
  `room-head` problem in the status.

## The app

- **The Room card** — a DSP section between Dimension and Maximizer:
  graph (SVG room, speakers glow with the per-channel levels the engine
  already publishes to the meters), preset segment (Studio / Living room /
  Cinema / Front stage — a preset is a whole room, custom once edited),
  the five dials, the Head segment with Fit…, the Headphones segment
  (correct / leave). The headphone profile the EQ page already applies
  runs after the room; the switch only says whether the room assumes it.
- **The header chip** on the card says what the room does this second:
  "Stereo → front stage", "5.1 → five speakers and the sub", "7.1 → full
  room", or "Room off: headphones set to stereo" — from the engine's
  status, which gains `channels` and `roomLayout` fields (pinned on both
  sides like the rest of the status).
- **One press to 7.1** — on the output panel, for an output whose driver
  takes eight channels (checked with `IsFormatSupported` in exclusive mode
  through the device probe; no prompt) and is set to stereo while the
  room is on: a notice with "Set to 7.1" and "Not now". The press goes
  through the PolicyConfig interface the probe already binds
  (`SetDeviceFormat`), then Windows audio restarts; if Windows refuses,
  the setup helper does it elevated (`set-format <guid> 7.1 <rate>`,
  keeping the previous format for Undo under `<engine root>\formats`).
  The panel's row shows "7.1 · Room on" and Undo. Every step logs and the
  bug report's Outputs section carries the format and the room state.
- **Fit** — a dialog: five pairs, each plays a two-second click train from
  straight ahead through two candidate heads (or the same head at two
  head sizes); the listener presses the one more in front. The answers
  pick head and size; "They sound the same" counts for neither. Plus.
- **Library player** — the same stage runs in the in-app host on Library
  playback, so music on the front stage sounds the same from the Library
  and from Spotify.
- **Plus gate** — the room on/off and its presets are free; the dials,
  dragging speakers and Fit are Plus, locked the way the Studio's extras
  are (`useLockedWithoutPlus`), server-side nothing to check.

## What is logged

Engine: `room on {guid}: 7.1 in → headphones, head medium ×1.04, preset
living-room, 16 kernels × 1024 taps, +10.7 ms` on every chain build, and
`room off: <why>` (no head file, mono, disabled). App: each press on the
output panel, each format change with the previous format, each Fit result.
Report: the Outputs section gains the device format and the room state.

## Tests

- dsp-core `room_test.cpp`: off is bit-for-bit pass-through; a stereo
  stream on the front stage puts more energy in the same-side ear (positive
  control) and an impulse on FL arrives at the left ear first by the head's
  interaural delay; 7.1 fold leaves channels 2–7 silent; the LFE reaches
  both ears equally; latency reported equals the partition; walls at 1
  remove every reflection (energy after the direct path is zero within the
  window); changing a dial mid-stream produces no discontinuity above the
  blend's step.
- system-apo: the wire test's reference line regenerated; status text pinned
  with the new fields; `set-format` planned and refused where the driver
  does not take the format, with the previous format kept.
- App: the card renders every layout chip; the notice offers "Set to 7.1"
  only where allowed; Fit's five answers map to a head; Library placement
  keeps the rack in one place.

## Risks, named

- A headset whose driver takes stereo only never receives 7.1 from Windows;
  the room is the front stage there and the panel says why. No virtual
  cable will be shipped.
- Latency: +512 frames on top of the rack's; games feel it at 10 ms, films
  do not. The card says the added milliseconds.
- Heads: three subjects cannot fit everyone; Fit narrows it, and the
  head-size scaling covers what the three do not.

## Sub-projects, in order

1. **The engine stage and the wire** — `FeqRoom`, the head assets and their
   build script, decode/encode, the settings type, the status fields, the
   tests. Nothing on screen yet beyond the header chip.
2. **The Room card** — graph, presets, dials, head and headphone segments,
   ten locales, the section tab, the Plus locks.
3. **One press to 7.1** — device probe check, PolicyConfig path, helper
   `set-format`, output panel notice and Undo, logging and report.
4. **Fit** — the dialog and its signal generator.
5. **Library host, changelog, guide chapter.**

Each gets its own plan; the first is
`docs/superpowers/plans/2026-09-16-room-engine.md`.
