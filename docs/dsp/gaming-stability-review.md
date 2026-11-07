# Gaming stability candidate — 2026-11-06

Local candidate for a future update. The installed app, audio endpoints and
distributed 2.3 build were not launched, replaced or restarted. No speaker
playback, publication, deployment or push was performed.

## Visible defect and correction

The Game meters initially held empty text spans. A live number consumed width
from its neighbouring translated label, adding a wrapped line and moving the
knobs below it. The pre-change isolated reproduction moved them by 28 px in a
420 px German viewport.

Footsteps, Dialogue and Environment now use the existing `LiveFigure` component
to reserve their widest readings, including the two-number voice/duck reading.
No new visual style was introduced. The isolated harness renders the actual
Game controls and app SCSS, with fake IPC and a separate Chromium profile.

The check cycles empty and maximum readings, tuning values, short/long words,
and asserts stable knob/input geometry, value centres and keyboard focus to
0.1 px. All seven cases pass: 1280/en, 1024/de, 420/de, 1920/es, 320/fr,
240/ru and 1024/de at 150% zoom. Screenshots cover all three panels. This is
browser verification of the real components, not desktop-app or physical-device
verification.

## Audible policy

Fresh Gaming factory picks retain their distinct static tonal curves and cue
strengths. They start with additive Footsteps, with Calm, Environment, Voices
and dialogue ducking at zero/off. The ordinary Gaming chains no longer
automatically stack compression, bass synthesis, widening, moving dynamic EQ
guards or bass mono. Their Maximizer has zero drive and remains a safety ceiling.

Night deliberately retains its whole-mix compression and other low-volume
processing. Room/headphone choices remain listener-owned. Explicit manual
Environment cuts, Calm and dialogue ducking still do their requested job.
Existing saved numeric settings are preserved rather than migrated to the new
factory defaults. Compatibility tests retain the old configured wire values.

This does not perform source separation. A detected band can contain music as
well as a step, and a very weak or spectrally masked cue may receive little or
no lift. The detector thresholds were not relaxed to amplify rain as footsteps.

## Real Windows processing route

`gameSeedFor` resolves the ready Gaming chain and the title's own curve;
`pickGame` supplies the Game parts and respects the listener's Room choice.
`outputDsp` serializes the rack through `encodeChainSettings` and
`appendPresetTone`, and `systemDspChain` sends it to the Windows engine. The
native decoder and Graph resolver build the same processing graph called by
`APOProcess`. The Game stage calls the native Footsteps/Environment/Dialogue
processor.

The new engine fixture generator uses those app recipes, title curves and wire
encoders. Tests render the actual Graph, including the Preset tone layer and
its reported latency. They do not substitute an approximate EQ or a separate
JavaScript implementation of the processor.

## Added-signal headroom

The unbounded overlay took a 0.98 peak input to 1.53 in the reproduction,
forcing downstream whole-mix limiting. Each Game part now keeps its incoming
signal and bounds only its added delta, with one gain linked across the ears;
LFE is excluded. The sample bound creates no peak above the larger of the
original sample and -1 dBFS. A recent-peak budget and smoothed wet recovery
avoid gain returning at a carrier's zero crossings. Reports name the gain
actually applied after that protection.

The budget follows the requested sum's peaks rather than assuming independent
dry and wet maxima coincide. Its peak hold spans carrier troughs: 32 ms for
full-band Environment/Dialogue, 3 ms for Footsteps' 300 Hz-and-up cue bands,
followed by 20 ms peak decay and 40 ms wet-gain recovery. Decay without a hold
produced -53 dBc residual on a partially limited 80 Hz Environment tone; the
expanded intermediate-level checks catch that case. The existing
loud-programme regression still requires at least 3 dB and passes at 3.01 dB.
Its original 50% Calm setting is
now explicit, since fresh defaults are neutral; the assertion was not relaxed.

## Measured checks

| Check                                                         | Candidate result                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Hot Footsteps original peak 0.98                              | No new sample over at 44.1–384 kHz, eight rates                                                                        |
| Hot Environment +/−, Voices, duck and Calm                    | No new over; moderate-level positive controls prove each selected part remains active                                  |
| Zero / off / silence                                          | Bit-exact original for zero/off; no generated signal from silence                                                      |
| Stereo exchange                                               | Swapping ears swaps the exact processed outputs                                                                        |
| Steady Environment tones, 20/80/300/1000/6000 Hz, four levels | Residual below -96 dBc with room and below -119 dBc when limited or hot; all exceed the unchanged -70 dBc requirement  |
| Known stems, 27 level/Lift/music combinations                 | Actual music-stem change below 0.5 dB; step pan shift below 0.25 dB; reconstructed render null below 1e-6              |
| Detectable steps, 75–100% Lift                                | Positive controls exceed 2 dB of actual step-stem gain                                                                 |
| Full Windows graph, 16 factory/title fixtures, 96 scenes      | Non-Night background drift at most 0.142 dB, step-associated tagged-bed change -0.098 to +0.140 dB, peak at most 0.880 |

The stem check runs one detector on the mixture, then applies its actual band
and wet-headroom gains to separately known input stems. Their sum reconstructs
the processed mixture. Subtracting two independently detected renders would
misattribute boosted music to footsteps and overstate gain or pan movement.
The graph's separate incremental-window energy check is only a detection
positive control, not a claim of isolated step gain.

Thirteen relevant native tests pass, covering the parts above, chain
transparency/switching, engine graph/wire handling, Dynamics and rate sweep.
The existing native regression executables were relinked to the final core
before the final run. Seven focused Jest suites pass, 59 tests, covering Game
defaults, saved settings, old wire compatibility, Game profile/layout output,
engine output and `LiveFigure`.

## Level-matched listening material

Six existing game recordings were rendered offline: CS2, Valorant, Rainbow Six,
Tarkov, PUBG and Warzone. Each pair compares the previous and candidate factory
recipe through the same candidate Windows graph, with its reported latency
aligned. This isolates recipe changes; it is not an exact old-installed-engine
versus new-engine comparison. The old unbounded-engine defect is measured
separately above.

Pairs use a constant gain for matching, not normalization that rides dynamics.
Integrated loudness differs by at most 0.10 LU. Candidate true peaks range from
-3.70 to -0.99 dBTP (meter rounding); none clips. Stereo measurements and all
12 PCM listening files are kept in the local
`outputs/gaming-stability/listening-pairs` directory. No real-game audition has
been performed or claimed.

## Verification limits

The full Jest run was examined: 1217 suites passed and 11 failed before the
focused corrections. All eleven formerly failing suites now pass on targeted
recheck. Three Gaming contract failures were corrected. Two music-evidence
contracts pass (10 tests) after a fresh offline audit of all 83 genres and
166 recordings through the final native host/meter. Its source, manifest and
binary fingerprints were held fixed throughout; the approved Pop/K-Pop audio
comparisons were retained only after freshly rendered WAV hashes matched
their original candidate hashes exactly. Six other failures concerned
concurrent Studio/Gallery work; all six now pass on recheck (42 tests), without
editing that work.

The root type check reports 32 implicit-any errors in 25 unrelated test files.
The scripts type check and focused app/harness lint pass. The full Jest suite
was not repeated after those targeted rechecks.

To repeat the isolated UI check, run `node scripts/gaming-stability-ui/build.cjs`
then `node scripts/gaming-stability-ui/check.cjs`. `CHROME_PATH` can name an
installed Chromium browser. Native fixtures are generated by the existing
`build:native-dsp --test` path, including the new Gaming graph cases.

Physical Windows listening with actual weak/strong footsteps, music, voices,
weather and explosions remains required. Also pending are desktop integration
at normal/minimum window sizes and macOS/Linux execution. No claim of perfect
cue isolation or universal background transparency is made for manual cuts,
ducking, Room, Night, clipping already present in an input, or unrelated active
processing.
