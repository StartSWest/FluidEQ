# FluidEQ Room upgrade — design for approval

**Current handoff instruction (2026-09-19): implementation is approved. Continue in `D:/DEV/_PERSONAL/FluidEQ` on `main`. The prior worktree isolation and no-commit instructions are superseded by the user's request to commit, push and merge everything into main. Preserve concurrent edits and follow the repository checks and normal commit/push workflow. Newer main commit eeea63a3a retired Ocean and renamed Black to Dark; use current main theme tokens and do not restore retired themes from these historical mockup examples.**

Date: 2026-09-19
Status: approved for implementation on 2026-09-19, with the speaker-pane clarification below. Listening validation remains separate from design approval.

## Product direction

Make Room a convincing, easy-to-use headphone listening space, with FluidEQ's own sound and names. Build on the existing native renderer and the KEMAR measurements already shipped. Do not add a proprietary SDK, dependency, external head dataset, account requirement, driver, or subscription. Retain the project's GPL-3.0-or-later distribution requirements and existing measurement attribution; this avoids additional third-party license obligations, not all obligations.

This is an architectural DSP and interface change. The interactive mockup is a design proposal with simulated source information; it does not process audio or demonstrate sound quality. Approval covers the scope and interaction design below. The sound itself must pass measurement and listening gates.

## What changes for the listener

1. Six featured profiles provide useful starting points without opening advanced controls.
2. A room view shows which speakers are actually fed, and whether their signal came from discrete channels or stereo expansion.
3. Space, Ambience, and Distance provide clear, separate controls. Speakers move by hand on the first Room screen, with a selected-speaker pane showing angle, distance, level, mute and solo immediately. Tune provides the more complex room, centre/sub, bass routing and stereo expansion controls.
4. Head size and headphone correction stay personal preferences. The Fit view keeps the existing comparison workflow and explains what the three head sizes actually represent.
5. A position-preserving option protects the rendered ear cues from downstream Dimension widening, with a visible indication and no destructive change to the stored Dimension setting.
6. A Room-only comparison makes before/after listening convenient. It preserves the rest of the rack and accounts for Room's delay and gain before allowing claims from a comparison.

## Featured profiles

These are starting intents, not final measured tunings. Final gains and decay are selected by listening and safety measurements. Names below are FluidEQ names, with no THX certification or compatibility claim.

| Profile     | Intended sound                                                    | Stereo behavior                                   | Ambience intent               |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------- | ----------------------------- |
| Reference   | A close, restrained front stage; stable tone and centre           | Front stage                                       | Off                           |
| Music Space | A wider listening space with vocals anchored in front             | Gentle, explicitly labelled stereo expansion      | Very short, quiet             |
| Cinema      | A broad screen, supported centre, controlled bass and envelopment | Expanded stereo, clearly labelled                 | Moderate, damped              |
| Game World  | A surrounding environment without burying short cues              | Front stage unless the user chooses expansion     | Short, quiet                  |
| Competitive | Precise direction with minimal room smear                         | Front stage; do not invent positional information | Off                           |
| Live Venue  | An enveloping performance space                                   | Expanded stereo, clearly labelled                 | Longer but bounded and damped |

Real 5.1/7.1 channels always take priority over the stereo-expansion path. A stereo-only driver remains stereo: this work cannot recover game objects or create a multichannel endpoint. Already-spatial/binaural source audio gets an explicit manual bypass option; do not pretend to detect it automatically. No elevation or head tracking claim is included.

## Interface proposal

Retain FluidEQ's DSP header and processor rail, Ocean/Black themes, system font, cyan selection, compact controls, and room/speaker visual vocabulary. The mockup includes a full DSP page to show the Room panel in context; other processors are contextual, not redesigned.

The Room panel has a profile summary, source/output status, Room/Tune/Fit views, Room power, and an Original/Room comparison. Browse opens the profile library within the panel. Featured profiles are prominent; Classic rooms and Saved rooms remain one step away. Applying a profile is one action and closes the library. Save records a new room without overwriting an existing one silently.

- **Room:** a legible top-down room, individually selectable speakers, clearly marked derived/unused channels, three quick controls, and a concise head/correction summary. Clicking or beginning to drag a speaker opens its angle, distance, level, mute and solo controls in a pane beside or below the diagram on this first screen. The pane stays visible during movement. Keep paired dragging, the unpaired modifier, and keyboard selection/editing. These controls never require switching to Tune.
- **Tune:** room geometry, early reflections, late ambience, direct/surround balance where supported, per-speaker angle/distance/level, centre/sub level, bass management/crossover, stereo expansion amount, and position preservation. A centre level only appears available when a centre signal exists; do not label it as vocal isolation.
- **Fit:** three head sizes plus the existing guided listening comparison; headphone correction remains explicit. The three current head sizes are time-scaled variants of one measurement head, not three measured people and not an anatomical ear scan.
- **Comparison:** selecting Original temporarily bypasses only Room with matched delay; the UI makes comparison state clear. Level matching is a comparison aid, not an extra permanent normalizer. Restore normal gain when comparison ends. For multichannel, compare against an explicit conventional stereo fold-down and label it; do not compare binaural output to unrendered channels silently.
- **Restore profile:** resets the selected profile's sound controls, preserving head/correction. Keep the existing full Room reset as a separate action that restores all Room settings except power. Do not change the meaning of the existing reset covertly.

Preserve current access: profiles and manual listener/headphone choices remain free; room shaping, speaker edits, saved-room editing, and guided Fit retain the current entitlement checks. New manual shaping controls follow the existing Plus boundary. Do not expand locks to previously free controls. The prototype's Free/Plus design option is for checking these states, not a proposed pricing change.

## DSP design

### Smoother positioning and consistent tone

Use the existing horizontal KEMAR ring. Estimate and separate onset/interaural delay, interpolate aligned impulse-response content between adjacent directions, then restore a smoothly interpolated delay. Directly blending unaligned responses can create comb filtering, so a naive crossfade is not the intended interpolation algorithm. Preserve lateral timing/level cues and the shipped diffuse-field correction. Build kernels on the control thread; continuously moving a speaker must not allocate, lock, or rebuild inside the audio callback.

Check existing generated heads before any asset change. The current code already normalizes/equalizes the measurements and implements a low-latency convolution path; neither should be duplicated or advertised as a new invention. Existing neutral response is a baseline, not a reason to equalize each direction flat.

### Early reflections and late ambience

Keep the current direct speaker path and image-source early reflections. Separate reflection level from wall absorption: **Space** controls early-reflection energy, **Distance** controls geometry, and wall damping controls the reflection spectrum. Keep direct localization intact at low Space values rather than crossfading dry stereo into the binaural signal.

Add a small, original, bounded stereo feedback-delay network for **Ambience**, fed from the reflected field, with damping and a capped decay. Preallocate delay storage in prepare/control operations, use a stable normalized feedback matrix, smooth coefficient/gain changes, prevent denormals, and retire old state off the audio thread. Ambience is exactly off for Reference/Competitive. It is an implementation stage with its own stability, CPU, coloration, and listening gate; do not ship a long tail merely because the control exists.

Proposed bounded control contract: `earlyReflectionDb` in [-60, 0] with an explicit zero-energy endpoint; `ambienceMix` in [0, 1]; `ambienceDecayS` in [0.1, 1.8]; `ambienceDampingHz` in [1000, 12000], further capped below Nyquist; `preservePosition` boolean. Display Space/Ambience as percentages mapped monotonically to these parameters. Persist physical fields, not UI percentages. Existing size, wall absorption, distance, bass, and speaker fields retain their meanings.

### Cue preservation, switching, and latency

When Room is active and Preserve position is on, skip the downstream Dimension widening operation on the binaural pair. Leave Dimension's saved configuration intact and show why it is temporarily inactive. When Room is off, restore ordinary rack behavior. Validate the actual chain before implementing, including other post-Room stereo transforms; do not silently bypass unrelated EQ or dynamics.

Respect the engine's current low-latency mode and latency accounting. A gaming profile does not secretly change global engine settings. Existing low-latency Room can avoid its partition-buffer delay; it does not make device/Windows/rack latency zero. Keep low-frequency bypass/sub paths aligned with the ear paths, preserve tails across compatible transfers, crossfade incompatible changes, and report the true active latency.

## Compatibility and saved sound

The shared checkout already has concurrent Room/latency/preset work. Re-establish the current baseline at implementation time; do not transplant stale values from the older Room design document.

- Keep existing preset identifiers/order and serialized meanings stable. Add new featured identifiers; do not repurpose the current `cinema`, `gaming`, or `studio` IDs to sound different without migration.
- Missing renderer-version fields deserialize to the legacy path, with no new late ambience and existing reflection behavior. Featured profiles explicitly select the new renderer version. Existing saved rooms retain their version and audible behavior until the user chooses a new profile or an explicit upgrade.
- New profiles own room sound settings, including bass/upmix, speaker positions/levels/mutes and new reflection/ambience fields. They preserve head size, headphone-correction preference, device configuration, and other rack processors. Choosing a profile turns Room on, matching current behavior.
- Update the settings model, normalization, native struct, wire layout, parsers, host, APO and fixture boundaries together. Do not append fields to a fixed-size wire payload without updating its version/count agreement. Older installed engines must get the existing update-needed path; never interpret shifted scalars.
- Missing head data, unsupported layouts, no signal and inactive Room remain honest status states. The Library player currently supplies a front stereo pair; do not label it 7.1 simply because the system engine supports that input format.

## Evidence required before release

Measure impulse response, ear timing/level behavior, neutral coloration, speaker-transition continuity, bass alignment, finite output/feedback stability, tail decay, and true peak on stereo/5.1/7.1 at 44.1/48/96/192 kHz. Check both standard and low-latency operation and reported delay. Bound callback work and memory, and prove no allocations/locks/file I/O enter the processing path.

Capture a baseline on the same machine and driver, then compare callback duration distributions and dropouts over a sustained session. Acceptance: no underruns; p99 callback work remains below half its buffer duration under the agreed worst-case rack on the test machine, with baseline and hardware recorded. This is a test target, not a current performance claim.

Listen with equalized comparison level, randomized presentation, familiar music, dialogue, transient-rich games, and positional test scenes on more than one headphone. Include different listeners because one KEMAR head will not suit everyone. Compare direction accuracy, front/back confusion, centre stability, timbre, fatigue and preference separately. Only report “better than THX” for a described test that actually supports it; the feature name and launch copy do not make that blanket claim.

Verify UI at normal and narrow widths, keyboard-only operation, reduced motion, long translations, Free/Plus boundaries, every source state, save/restore, bypass, and repeated profile switching. Native audio and renderer visuals must agree for both system playback and Library playback.

## Out of scope

THX branding/SDKs or captured THX responses, Steam Audio/BRT integration, new HRTF datasets, elevation/object rendering, head tracking, a virtual audio driver, AI “footstep extraction,” automatic binaural detection, a pricing change, and a wholesale DSP page redesign.

## Research basis

- [MIT KEMAR measurements and usage terms](https://sound.media.mit.edu/resources/KEMAR.html) — retain the already-shipped data and attribution.
- [Time-aligned HRTF interpolation research](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0211899) — independent implementation of the signal-processing approach, not copied toolkit code.
- [Microsoft spatial sound architecture](https://learn.microsoft.com/en-us/windows/win32/coreaudio/spatial-sound) — channel/object availability is a routing constraint, not a profile setting.

Current repository evidence: `src/common/dsp/roomPresets.ts`, `src/common/dsp/chainWire.ts`, `src/renderer/dsp/DspRoomCard.tsx`, `native/dsp-core/src/room.cpp`, `room_kernels.cpp`, `chain.cpp`, `native/dsp-host/src/main.cpp`, and `assets/room/heads/LICENSES.md`.

## Mockup verification

The interactive design was inspected in the browser at desktop size and at 736, 360 and 320 pixels of content width. Room, Tune, Fit and the profile browser reflow without horizontal overflow; a long unbroken saved-room name was also checked at 320 pixels. Profile selection, keyboard slider changes, comparison state, local save/reselect, manual head choice and the guided-fit step transition were exercised. Stereo expansion, front-stage stereo, 5.1, 7.1 and Free/Plus preview states were checked; unavailable centre controls and locked shaping controls were verified. The fragment passed JavaScript syntax and duplicate-ID checks, and browser error logs were empty after the final update.

These are prototype checks only. No native DSP build, app regression suite, installed-engine test, audio processing or listening comparison was run for this planning deliverable. Mockup settings, saved rooms and fit results are examples isolated from the real app.
