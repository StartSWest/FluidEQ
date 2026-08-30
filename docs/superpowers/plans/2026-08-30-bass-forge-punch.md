# Bass Forge and Bass Punch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two native-only DSP stages dedicated to low end — Bass Forge, which generates bass, and Bass Punch, which shapes how it hits — each with presets, a graph, and cards in the DSP rack.

**Architecture:** Both stages live in `native/dsp-core`, written in C++ with no TypeScript worklet twin, following the Dimension precedent. Each splits the signal with a Linkwitz-Riley 4th-order lowpass whose remainder is defined by subtraction, processes the low band only, and sums back — which makes "disabled is bit-exact passthrough" an equality rather than a tolerance. Forge reuses `feq_harmonic_sample` unchanged for its phantom-fundamental generator.

**Tech Stack:** C++20 (`/W4 /WX /permissive-` on MSVC, `-Wall -Wextra -Wpedantic -Werror` elsewhere), CMake 3.21, TypeScript with strict settings, React, Sass, Jest.

**Spec:** `docs/superpowers/specs/2026-08-30-bass-forge-punch-design.md`

## Global Constraints

- **Native only.** No worklet twin. Both stages default `enabled: false`, so the parity corpus's audio is unchanged.
- **Parameter id block: 2000–2199 is reserved for this work.** 2001–2007 Forge, 2101–2107 Punch. Ids are permanent — never reissue one.
- **`claude/noise-reduction-filter-a41ca7` is moving the same constants.** Whoever lands second re-numbers rather than resolves. This applies to `CHAIN_PARAM_LEAD` _and_ `ANALYSIS_HEADER_BYTES`.
- **Files stay under 500 lines** unless there is genuinely no seam.
- **No `any`, no `!` non-null, no `@ts-ignore`, no `==`, no `var`, no empty `catch`, no `console.log`.**
- **No `setTimeout`/`setInterval` to make a race behave.**
- **Every user-facing string goes through i18n, all ten locales in the same commit** (`en`, `es`, `de`, `fr`, `it`, `pt`, `ru`, `ja`, `zh`, `hi`).
- **No raw `font-weight` numbers** — use the `$weight-*` scale. `$weight-bold` is the ceiling at UI sizes. `check-styles.ts` rejects raw values.
- **Reuse existing classes.** `button small` is the filled accent, `button small subtle` the quiet outline. Never invent a style.
- **Jest will not start without a build.** Run `pnpm build` before `pnpm test` in a clean tree.
- **Do not run the app.** Ivan runs it. Task 12 says what he needs to look at.

## A note on test ordering

CLAUDE.md says the change comes first and the suite waits until Ivan is happy with it. That rule is about not stalling him mid-request, and it holds for the UI tasks here — Tasks 10 and 11 put the card on screen first.

It does not hold for Tasks 2 and 3. Those two stages have no TypeScript twin and therefore no corpus proving them; the property tests **are** the specification, and there is nothing else that says whether the DSP is right. They go in together.

Type-check and lint as you go throughout — those are seconds.

---

### Task 1: Retire the second `CHAIN_PARAM_LEAD` — **DONE ELSEWHERE. DO NOT IMPLEMENT.**

This landed on `claude/typescript-usage-review-7794ef` instead. Ivan approved moving it there. Implementing it again here would collide on the same lines for no gain.

The task number is kept rather than renumbering the rest, so that "do Task 7" means the same thing to anyone holding any copy of this plan.

**What is already done on that branch:**

- `src/main/dspHost/wire.ts` imports `CHAIN_PARAM_LEAD` from `common/dsp/chainWire` instead of declaring its own 69. The floor check stays, with a comment recording that it cannot fire on today's only path and survives only because `encodeChainPayload` is exported.
- The stale comment in `dspChainWire.test.ts` no longer carries a copy of the number at all.
- **A new test reads `FEQ_CHAIN_PARAM_LEAD` out of `native/dsp-core/include/fluideq/chain.h` and asserts it equals `CHAIN_PARAM_LEAD`.** That is the check none of the three copies had.

**What that means for Task 5, which is the only reason this section still exists.** When Task 5 moves the lead from 77 to 91, that new test **will fail** until `chain.h` moves in the same commit. That is the test working, not a regression — it is precisely the drift it was written to catch. Do not weaken it, and do not move the TypeScript constant in one commit and the header in another.

Still verify before starting Task 5:

```bash
git log --oneline -5 -- src/main/dspHost/wire.ts
grep -n "CHAIN_PARAM_LEAD" src/main/dspHost/wire.ts
```

If `wire.ts` still declares its own `69`, that branch has not merged yet. Coordinate rather than fixing it here — two branches editing those lines is the collision this section exists to avoid.

<details>
<summary>Original task body, kept for reference only</summary>

**Files:**

- Modify: `src/main/dspHost/wire.ts:204`
- Modify: `src/__tests__/unit_tests/dspChainWire.test.ts:37`
- Modify: `native/dsp-core/src/chain_decode.cpp:11`
- Test: `src/__tests__/unit_tests/dspChainWire.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `CHAIN_PARAM_LEAD` has exactly one definition, in `src/common/dsp/chainWire.ts`. Every later task that moves it moves one number.

**Background the implementer needs.** There are three carriers of this number and two are wrong. `src/common/dsp/chainWire.ts:36` is 77 and checks `!==` (exact). `native/.../chain.h:174` is 77. `src/main/dspHost/wire.ts:204` is **69** and checks `<` (a floor). The main-process copy has been dead rather than merely stale: `src/main/ipc/dspHost.ts:207` already validates with `isChainWirePayload`, which checks the length exactly against the band count, so anything reaching the floor has passed a strictly stronger test and the floor can never fire. That is why eight slots of drift went unnoticed.

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/unit_tests/dspChainWire.test.ts`:

```ts
import { CHAIN_PARAM_LEAD as MAIN_CHAIN_PARAM_LEAD } from '../../main/dspHost/wire';

describe('the lead has one authority', () => {
  /**
   * Two constants with this name drifted eight slots apart and nothing caught
   * it, because the main-process one is a floor sitting downstream of
   * `isChainWirePayload` — which already checks the length exactly. A floor
   * that can never fire cannot report that it has gone stale.
   */
  it('is the same number in main as in common', () => {
    expect(MAIN_CHAIN_PARAM_LEAD).toBe(CHAIN_PARAM_LEAD);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm test:jest -- dspChainWire
```

Expected: FAIL, `Expected: 77, Received: 69`.

- [ ] **Step 3: Make main import the one constant**

In `src/main/dspHost/wire.ts`, delete the local `export const CHAIN_PARAM_LEAD = 69;` and its doc comment, and re-export the common one. Keep the `<` floor check in `encodeChainPayload` — `encodeChainPayload` is exported and could gain a caller that has not been through `isChainWirePayload`, so a floor that is _correct_ costs nothing.

```ts
// The lead has one definition, in `src/common/dsp/chainWire.ts`. It used to
// have a second one here, and the second one sat eight slots behind for long
// enough that nobody noticed — because `src/main/ipc/dspHost.ts` validates
// with `isChainWirePayload` first, which checks the length exactly against the
// band count, so this floor was downstream of a strictly stronger test and
// could never fire. Re-exported rather than re-declared: a floor that is wrong
// is worse than no floor, and this one cannot go wrong any more.
export { CHAIN_PARAM_LEAD } from '../../common/dsp/chainWire';
```

Add the import of `CHAIN_PARAM_LEAD` from `../../common/dsp/chainWire` for the local use inside `encodeChainPayload`.

- [ ] **Step 4: Fix the two stale comments**

`src/__tests__/unit_tests/dspChainWire.test.ts:37` says `FEQ_CHAIN_PARAM_LEAD` in `chain.h` is 69. It is 77. Change the sentence to name the constant without repeating its value — a comment that carries the number is a fourth copy.

`native/dsp-core/src/chain_decode.cpp:11` says `encodeChainSettings` lives in `src/main/dspHost/wire.ts`. It lives in `src/common/dsp/chainWire.ts`. Fix the path.

- [ ] **Step 5: Run the tests**

```bash
pnpm test:jest -- dspChainWire dspChainWire.test
```

Expected: PASS, including the new case.

- [ ] **Step 6: Commit**

```bash
git add src/main/dspHost/wire.ts src/__tests__/unit_tests/dspChainWire.test.ts native/dsp-core/src/chain_decode.cpp
git commit -m "The chain lead had two authorities and the second one was dead"
```

</details>

---

### Task 2: Bass Forge, the C++ stage

**Files:**

- Create: `native/dsp-core/include/fluideq/bass_forge.h`
- Create: `native/dsp-core/src/bass_forge.cpp`
- Create: `native/dsp-core/tests/bass_forge_test.cpp`
- Modify: `native/CMakeLists.txt`

**Interfaces:**

- Consumes: `feq_biquad_coefficients`, `feq_biquad_process`, `FeqBiquadState` from `fluideq/biquad.h`; `feq_harmonic_init`, `feq_harmonic_reset`, `feq_harmonic_sample`, `FeqHarmonicState` from `fluideq/harmonics.h`.
- Produces:

  ```c
  typedef struct FeqBassForgeSettings {
    int enabled;
    double split_hz;
    double drive_db;
    double sub_amount;
    double presence_amount;
    double texture;
    double mix;
  } FeqBassForgeSettings;

  typedef struct FeqBassForge { /* see Step 3 */ } FeqBassForge;

  void feq_bass_forge_init(FeqBassForge* state, float* low, float* scratch);
  void feq_bass_forge_reset(FeqBassForge* state);
  void feq_bass_forge_process(FeqBassForge* state,
                              float* const* channels,
                              uint32_t channel_count,
                              uint32_t frames,
                              const FeqBassForgeSettings* settings,
                              double sample_rate);
  /** The eight band levels in dBFS, 20 Hz to 1 kHz. **Control thread.** */
  void feq_bass_forge_bands(const FeqBassForge* state,
                            double* input_db,
                            double* output_db);
  ```

  `low` and `scratch` are caller-owned and each at least `frames * 2` long (two channels of low band, then scratch).

- [ ] **Step 1: Write the header**

Create `native/dsp-core/include/fluideq/bass_forge.h`. Open with the GPL block every file in this tree carries, then the design comment. Comments state what the code cannot — constraints, measured numbers, the failure prevented — never what the next line does.

```c
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Bass that a speaker can actually play, made two different ways.
 *
 * The two generators here exist because "more bass" is two problems with
 * opposite answers, and a stage offering only one of them is wrong on half
 * the hardware people listen on.
 *
 * A laptop speaker, a phone and most Bluetooth boxes have a hard acoustic
 * floor somewhere between 150 and 400 Hz. Below it they radiate nothing at
 * any drive level, so a control that adds energy at 45 Hz on those devices
 * spends headroom on something no listener will ever hear. What works there
 * is the missing fundamental: supply the HARMONICS of the bass note and the
 * ear reconstructs a pitch that was never radiated. That is `presence_amount`,
 * and it is the same trick every commercial bass enhancer is selling.
 *
 * A subwoofer wants the exact opposite — a real octave below what the record
 * carries, because it can play it and the harmonics are already there. That
 * is `sub_amount`.
 *
 * Neither is a volume control, and that is enforced rather than tuned. The
 * whole band is scaled so its level after generation matches its level before,
 * measured over a window slow enough not to track a note. Without that, every
 * A/B of this stage is won by whichever side is louder and nobody can hear
 * what the controls actually do — which is how a bass enhancer ends up
 * shipping as a hidden gain stage.
 *
 * The generation source is always `(low[0] + low[1]) / 2`. Harmonics generated
 * per channel are two decorrelated sets, which is a phase problem sold as
 * width; the mono listener pays for it and the stereo listener gets a thinner
 * picture. The dry low band keeps its own stereo untouched, and the app's
 * mono-maker stays where it already lives, in the EQ.
 */
```

Then the include guard `FLUIDEQ_BASS_FORGE_H`, `#include <stdint.h>`, `#include "fluideq/biquad.h"`, `#include "fluideq/harmonics.h"`, the `extern "C"` wrapper, `#define FEQ_BASS_FORGE_BANDS 8`, and the structs and functions from the Interfaces block above.

- [ ] **Step 2: Write the property tests, before the implementation**

Create `native/dsp-core/tests/bass_forge_test.cpp`. Follow `dimension_test.cpp` exactly: a file-local `int g_failures = 0;`, a `check(bool, const char*)` that prints `ok`/`FAIL`, `constexpr double kRate = 48000.0;`, and a `main` returning `g_failures == 0 ? 0 : 1`. There is no gtest in this tree.

Open with the comment explaining why these are properties and not a corpus — `dimension_test.cpp`'s header is the model. Then these cases:

```cpp
/** Disabled must be bit-exact, not close. The crossover recombines by
 *  subtraction precisely so this can be an equality. */
void test_disabled_is_bit_exact() {
  Run run = process(noise_stereo(kFrames * kBlocks), disabled());
  bool identical = true;
  for (size_t i = 0; i < run.left.size(); ++i) {
    identical = identical && run.left[i] == run.input_left[i]
                          && run.right[i] == run.input_right[i];
  }
  check(identical, "disabled is bit-exact");
}

/** mix = 0 is the same claim through the live path: every filter runs, the
 *  generators run, and the result is still the input. A stage that is only
 *  approximately transparent at zero is a stage nobody can leave switched on. */
void test_zero_mix_is_bit_exact() { /* settings.mix = 0, same assertion */ }

/** The no-free-loudness rule, which is the property that makes this stage
 *  judgeable by ear. Swept across the whole control surface rather than
 *  spot-checked, because it is the combinations that break it. */
void test_level_is_preserved() {
  for (double mix : {0.25, 0.5, 0.75, 1.0}) {
    for (double sub : {0.0, 0.5, 1.0}) {
      for (double presence : {0.0, 0.5, 1.0}) {
        // Settle first: the level follower is deliberately slow, so a
        // measurement taken from the first block measures the follower
        // warming up rather than the stage working.
        double in = rms(input), out = rms(output);
        check(std::fabs(20.0 * std::log10(out / in)) < 0.5,
              "output RMS within 0.5 dB of input");
      }
    }
  }
}

/** Sub really is an octave down, and presence really is where texture says. */
void test_sub_generates_an_octave_below() {
  // 60 Hz in, sub_amount 1: energy at 30 Hz at least 20 dB above the same
  // bin with sub_amount 0.
}
void test_presence_follows_texture() {
  // 60 Hz in, presence_amount 1.
  // texture 1 -> 120 Hz dominates 180 Hz.  texture 0 -> 180 Hz dominates 120.
}

/** A divider that free-runs on the noise floor produces rumble that is not in
 *  the record, and it does it in the silence between notes where it is most
 *  audible. The floor is what stops that, so silence is a test. */
void test_silence_stays_silent() {
  // 4 seconds of zeros, sub_amount 1, presence_amount 1.
  // check every output sample == 0.0f
}

/** Generated content is mono by construction. An equality, not a tolerance. */
void test_generated_content_is_mono() {
  // Feed IDENTICAL noise to both channels so the dry band is already mono;
  // any difference at the output is the generators disagreeing.
  check(left == right sample-by-sample, "generated content is mono");
}
```

Write a real Goertzel or a small DFT bin helper in the file for the frequency checks — the tree has an FFT in TypeScript only, and a single-bin measurement is eight lines.

- [ ] **Step 3: Register the test target and watch it fail to build**

In `native/CMakeLists.txt`, add `dsp-core/src/bass_forge.cpp` to the `fluideq-dsp-core` source list, immediately after `dsp-core/src/dimension.cpp`. Then after the dimension test block:

```cmake
add_executable(fluideq-bass-forge-test dsp-core/tests/bass_forge_test.cpp)
target_link_libraries(fluideq-bass-forge-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME bass-forge COMMAND fluideq-bass-forge-test)
```

```bash
pnpm build:native-dsp
```

Expected: a link error for the `feq_bass_forge_*` symbols, or a compile error that `bass_forge.cpp` does not exist. Either is the failure you want.

- [ ] **Step 4: Implement the stage**

Create `native/dsp-core/src/bass_forge.cpp`. Anonymous-namespace constants first, each carrying the reason for its value:

```cpp
namespace {

/** Two cascaded Butterworth stages make one Linkwitz-Riley 4th order. */
constexpr double kButterworthQ = 0.70710678118654752440;

/**
 * The level window, and it has to be this slow.
 *
 * At 20 Hz one cycle is 50 ms, so a window of a few tens of milliseconds
 * measures the waveform rather than the level, and the normalisation starts
 * tracking each note's own envelope — which removes the effect it is there to
 * make honest. `FIT_TRACK_MS` in `harmonics.cpp` is slow for the same reason.
 */
constexpr double kLevelWindowMs = 250.0;

/** Below this the divider is muted. See the header on rumble in silence. */
constexpr double kDividerFloor = 0.0015;

/** Nothing below this is radiated by any speaker; generated sub stops here. */
constexpr double kSubHighPassHz = 25.0;

/** Parameter smoothing, matching `dimension.cpp`'s. */
constexpr double kParameterSmoothingMs = 18.0;

}  // namespace
```

The divider: track sign changes of the driven mono band, flip a `bool` on each upward zero crossing, and multiply the rectified envelope by that square. Then lowpass it at `split_hz` and highpass at `kSubHighPassHz` so what comes out is a band-limited octave rather than a square wave's whole harmonic series. Mute the output — not the state — when the tracked level is under `kDividerFloor`, so it fades rather than switching.

The presence generator is one call per sample: `feq_harmonic_sample(&state->harmonic, source, presence_amount, texture, sample_rate)`. Do not reimplement it and do not add a foundation — it returns harmonics only, which is what is wanted.

The normalisation is two running mean-squares, `low` and `wet`, both at `kLevelWindowMs`, with `g = sqrt(ms_low / ms_wet)` guarded against a zero denominator, smoothed at `kParameterSmoothingMs`.

The eight meter bands are eight band-pass followers on a log grid from 20 Hz to 1 kHz, measured on `low` before and on the band after. Cheap enough to run always; sixteen biquads is nothing and a transform per block is not.

- [ ] **Step 5: Build and run until every property passes**

```bash
pnpm build:native-dsp && ctest --test-dir native/build -R bass-forge --output-on-failure
```

Expected: every line `ok`. If `test_level_is_preserved` fails only at the extremes, the follower is too fast — do not widen the tolerance, which is the property.

- [ ] **Step 6: Commit**

```bash
git add native/dsp-core/include/fluideq/bass_forge.h native/dsp-core/src/bass_forge.cpp native/dsp-core/tests/bass_forge_test.cpp native/CMakeLists.txt
git commit -m "Bass Forge: the missing fundamental, and a real one, from one band

Two generators because more bass is two problems with opposite answers. A
laptop speaker radiates nothing below roughly 150-400 Hz at any drive level,
so energy at 45 Hz there is headroom spent on something nobody hears; what
works is supplying the harmonics and letting the ear reconstruct the pitch.
A subwoofer wants the opposite and gets the octave divider.

Neither is a volume control, and that is a test rather than a tuning: the
band is scaled so its level after generation matches its level before. Without
it every A/B of a bass enhancer is won by whichever side is louder.

Held to properties, not a corpus -- there is no TypeScript twin. Disabled and
mix=0 are both bit-exact, silence stays silent with both generators at full,
and the generated content is sample-identical in the two channels."
```

---

### Task 3: Bass Punch, the C++ stage

**Files:**

- Create: `native/dsp-core/include/fluideq/bass_punch.h`
- Create: `native/dsp-core/src/bass_punch.cpp`
- Create: `native/dsp-core/tests/bass_punch_test.cpp`
- Modify: `native/CMakeLists.txt`

**Interfaces:**

- Consumes: `feq_biquad_coefficients`, `feq_biquad_process`, `FeqBiquadState` from `fluideq/biquad.h`.
- Produces:

  ```c
  typedef struct FeqBassPunchSettings {
    int enabled;
    double split_hz;
    double attack;      /* -1 .. +1 */
    double sustain;     /* -1 .. +1 */
    double bloom_amount;
    double bloom_decay_ms;
    double duck;
  } FeqBassPunchSettings;

  typedef struct FeqBassPunch { /* see Step 3 */ } FeqBassPunch;

  uint32_t feq_bass_punch_bloom_capacity(double sample_rate);
  void feq_bass_punch_init(FeqBassPunch* state, float* low,
                           float* const* bloom_buffers, uint32_t bloom_capacity);
  void feq_bass_punch_reset(FeqBassPunch* state);
  void feq_bass_punch_process(FeqBassPunch* state, float* const* channels,
                              uint32_t channel_count, uint32_t frames,
                              const FeqBassPunchSettings* settings,
                              double sample_rate);
  double feq_bass_punch_transient_db(const FeqBassPunch* state);
  double feq_bass_punch_sustain_db(const FeqBassPunch* state);
  double feq_bass_punch_duck_db(const FeqBassPunch* state);
  ```

- [ ] **Step 1: Write the header**

Same GPL block, then:

```c
/**
 * How bass hits, which is a question about time and not about frequency.
 *
 * Everything else in this rack that touches low end asks where the energy is.
 * This asks when: the first fifteen milliseconds of a kick against the two
 * hundred after it. That is the whole difference between a mix that thumps and
 * one that rumbles, and no filter can move it, because the two live at the
 * same frequency.
 *
 * The shaper is a difference of envelopes rather than a threshold. A fast
 * follower minus a slow one IS the transient, at any level — so a quiet kick
 * gets the same treatment as a loud one and there is no dial to set, no
 * material that slips under it, and no pumping when the level drifts across
 * it. Over any complete note the two followers converge, so the gain averages
 * to unity and this cannot become a tone control. That is asserted.
 *
 * The bloom is a decay extension and deliberately not a reverb. It is fed from
 * the low band summed to mono and it comes back mono, because stereo bass
 * reverb is the standard way to make a mix muddy and mono-incompatible — the
 * width is inaudible where it is applied and the cancellation is not.
 *
 * Duck exists because bass reading as powerful is mostly about what is NOT
 * competing with it. Pulling the upper band down under the low band's own
 * envelope buys more apparent weight than raising the bass does, and it costs
 * headroom instead of spending it.
 */
```

Include guard `FLUIDEQ_BASS_PUNCH_H`, `#define FEQ_BASS_PUNCH_COMBS 3`.

- [ ] **Step 2: Write the property tests, before the implementation**

Create `native/dsp-core/tests/bass_punch_test.cpp` in the same hand-rolled style:

```cpp
void test_disabled_is_bit_exact() { /* as Forge's */ }

/** All four controls at rest is the same claim through the live path. */
void test_neutral_settings_are_bit_exact() {
  // attack = sustain = bloom_amount = duck = 0
}

/** The one that stops this becoming an EQ. A steady tone has no transient, so
 *  the shaper must settle to doing nothing to it however hard it is driven. */
void test_steady_tone_settles_to_unity() {
  // 60 Hz sine, attack = 1, sustain = 1, four seconds.
  // Measure the LAST second only: the followers have to converge first.
  check(std::fabs(20.0 * std::log10(out_rms / in_rms)) < 0.3,
        "steady tone is unchanged by the shaper");
}

/** And the one that proves it does something. */
void test_attack_lifts_the_front_of_a_pulse() {
  // 4 Hz pulse train of 60 Hz bursts, attack = 1.
  // First 5 ms of each burst rises by more than 2 dB; the tail after 50 ms
  // stays within 0.5 dB.
}

/** bloom_decay_ms is a measured decay, not a dial position. The feedback comes
 *  from the RT60 relation precisely so this can be asserted across the range. */
void test_bloom_decay_matches_the_dial() {
  for (double decay : {40.0, 120.0, 250.0}) {
    // Impulse in, bloom_amount = 1. Find the time the envelope falls 60 dB.
    check(std::fabs(measured - decay) / decay < 0.15,
          "measured decay within 15% of the dial");
  }
}

void test_bloom_is_mono() { /* identical input both channels, equality out */ }

void test_duck_pulls_the_upper_band_down() {
  // Loud 60 Hz under a quiet 2 kHz, duck = 1.
  // The 2 kHz component falls 6 dB +/- 0.5.
}
```

- [ ] **Step 3: Register the target and watch it fail**

Add `dsp-core/src/bass_punch.cpp` to the library sources after `bass_forge.cpp`, and:

```cmake
add_executable(fluideq-bass-punch-test dsp-core/tests/bass_punch_test.cpp)
target_link_libraries(fluideq-bass-punch-test PRIVATE fluideq-dsp-core feq_strict)
add_test(NAME bass-punch COMMAND fluideq-bass-punch-test)
```

```bash
pnpm build:native-dsp
```

Expected: unresolved `feq_bass_punch_*`.

- [ ] **Step 4: Implement the stage**

```cpp
namespace {

/** Fast enough to catch a kick's leading edge, slow enough to be its envelope
 *  and not its waveform. Their DIFFERENCE is the transient. */
constexpr double kFastAttackMs = 0.5;
constexpr double kFastReleaseMs = 20.0;
constexpr double kSlowAttackMs = 20.0;
constexpr double kSlowReleaseMs = 150.0;
constexpr double kSlowerReleaseMs = 400.0;

/** Ceilings, not tuning: past these the shaper stops sounding like the note
 *  getting harder and starts sounding like a gate opening. */
constexpr double kAttackCeilingDb = 12.0;
constexpr double kSustainCeilingDb = 9.0;

/**
 * Mutually prime in samples at every rate that matters.
 *
 * One comb is a pitched ring rather than a space, and three that share a factor
 * are one comb with extra steps. `dimension.cpp` picked its all-pass delays on
 * the same reasoning.
 */
constexpr double kCombMs[FEQ_BASS_PUNCH_COMBS] = {23.7, 31.1, 41.3};
constexpr double kAllPassMs = 7.3;
constexpr double kAllPassGain = 0.62;
constexpr double kLongestDelayMs = 41.3;

/** Deep enough to be felt, shallow enough that it is never heard as the mix
 *  breathing. Past about 6 dB the upper band audibly leaves and comes back. */
constexpr double kDuckMaxDb = 6.0;
constexpr double kDuckReleaseMs = 30.0;

/** The reverberation relation, so the dial is a real decay time. */
double comb_feedback(double delay_seconds, double decay_seconds) {
  return std::pow(10.0, -3.0 * delay_seconds / decay_seconds);
}

}  // namespace
```

Buffers are sized once from `kLongestDelayMs` and never resized — only the feedback gain moves with the dial. The Maximizer's look-ahead ring learned this the expensive way: a buffer replaced while a dial is dragged arrives full of zeros, which is the crackle.

- [ ] **Step 5: Build and run until every property passes**

```bash
pnpm build:native-dsp && ctest --test-dir native/build -R bass-punch --output-on-failure
```

- [ ] **Step 6: Commit**

```bash
git add native/dsp-core/include/fluideq/bass_punch.h native/dsp-core/src/bass_punch.cpp native/dsp-core/tests/bass_punch_test.cpp native/CMakeLists.txt
git commit -m "Bass Punch: the fifteen milliseconds no filter can reach

Everything else in this rack that touches low end asks where the energy is.
This asks when, and the two live at the same frequency, which is why a filter
cannot move it.

The shaper is a difference of envelopes rather than a threshold, so a quiet
kick gets the same treatment as a loud one, no material slips under a setting,
and there is no pumping as the level drifts across it. Over a complete note
the two followers converge and the gain averages to unity -- so this cannot
become a tone control, and the steady-tone test says so.

Bloom is a decay extension and comes back mono: stereo bass reverb is the
standard way to make a mix mono-incompatible, and the width is inaudible where
it is applied while the cancellation is not. Its feedback comes from the RT60
relation, so the dial is a measured decay and the test asserts it across the
range."
```

---

### Task 4: Settings, defaults, ranges and clamping

**Files:**

- Modify: `src/common/dsp/chain.ts`
- Test: `src/__tests__/unit_tests/common/dspChain.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:

  ```ts
  export interface IBassForgeSettings {
    enabled: boolean;
    presetId: string;
    splitHz: number;
    driveDb: number;
    subAmount: number;
    presenceAmount: number;
    texture: number;
    mix: number;
  }
  export interface IBassPunchSettings {
    enabled: boolean;
    presetId: string;
    splitHz: number;
    attack: number;
    sustain: number;
    bloomAmount: number;
    bloomDecayMs: number;
    duck: number;
  }
  ```

  Both added to `IDspSettings` as `bassForge` and `bassPunch`, between `exciter` and `dimension` in declaration order so the type reads as the signal path.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/unit_tests/common/dspChain.test.ts`:

```ts
describe('bass stages clamp', () => {
  it('defaults both stages off', () => {
    expect(DSP_DEFAULTS.bassForge.enabled).toBe(false);
    expect(DSP_DEFAULTS.bassPunch.enabled).toBe(false);
  });

  it('pulls out-of-range values back to the dial', () => {
    const clamped = clampDspSettings({
      bassForge: { splitHz: 5_000, texture: 4, mix: -2, driveDb: 99 },
      bassPunch: { attack: 9, sustain: -9, bloomDecayMs: 5, duck: 3 },
    });
    expect(clamped.bassForge.splitHz).toBe(200);
    expect(clamped.bassForge.texture).toBe(1);
    expect(clamped.bassForge.mix).toBe(0);
    expect(clamped.bassForge.driveDb).toBe(12);
    expect(clamped.bassPunch.attack).toBe(1);
    expect(clamped.bassPunch.sustain).toBe(-1);
    expect(clamped.bassPunch.bloomDecayMs).toBe(40);
    expect(clamped.bassPunch.duck).toBe(1);
  });

  /**
   * Settings stored before these stages existed must load, and must load with
   * both stages off. A stage that arrives switched on after an update is a
   * user's sound changing while they were not looking.
   */
  it('loads settings saved before the stages existed', () => {
    const { bassForge, bassPunch } = clampDspSettings({ eq: DSP_DEFAULTS.eq });
    expect(bassForge).toEqual(DSP_DEFAULTS.bassForge);
    expect(bassPunch).toEqual(DSP_DEFAULTS.bassPunch);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm test:jest -- dspChain
```

Expected: FAIL, `bassForge` undefined.

- [ ] **Step 3: Add the interfaces, defaults, ranges and clamp**

Add both interfaces near `IDimensionSettings`, each carrying the design comment from the spec's control tables — why `texture` is 0–1 here rather than the Exciter's 0–0.7, and why there is no mono control.

Add to `RANGES`:

```ts
bassSplitHz: { min: 40, max: 200 },
bassForgeDriveDb: { min: 0, max: 12 },
bassAmount: { min: 0, max: 1 },
/**
 * The full even-to-odd span, unlike the Exciter's 0.7 ceiling.
 *
 * That ceiling is about `band_even_weight`, which drives a diode character
 * curve whose far end is symmetric and harsh across presence and air. This
 * maps straight to `feq_harmonic_sample`'s `even_weight`, where 1 is pure
 * second order -- the octave up, which IS the phantom fundamental this control
 * exists for and the good end for bass. The odd end tops out at the third of a
 * 200 Hz band, which is 600 Hz, nowhere near what that ceiling protects.
 */
bassForgeTexture: { min: 0, max: 1 },
bassPunchShape: { min: -1, max: 1 },
bassPunchBloomDecayMs: { min: 40, max: 250 },
```

Add both blocks to `DSP_DEFAULTS` (everything zero, `splitHz` 90 and 110, `texture` 0.8, `bloomDecayMs` 120, `presetId: ''`, `enabled: false`) and to `clampDspSettings`, following the `dimension` block's shape exactly: `const bassForge = isRecord(value.bassForge) ? value.bassForge : {};` at the top with the others, and a `clampNumber(...)` per field against its `RANGES` entry and its default.

`presetId` clamps to `''` unless it is a string, matching how the Maximizer's is handled.

- [ ] **Step 4: Run and watch it pass**

```bash
pnpm test:jest -- dspChain
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: errors ONLY where `IDspSettings` is constructed exhaustively — `presets.ts` and the fixture generator. Leave them; Tasks 5 and 7 fix them.

- [ ] **Step 6: Commit**

```bash
git add src/common/dsp/chain.ts src/__tests__/unit_tests/common/dspChain.test.ts
git commit -m "The two bass stages get their settings, and both start off

Defaults are off for both, and a settings file written before they existed
loads with them off -- a stage that arrives switched on after an update is
somebody's sound changing while they were not looking.

Forge's texture spans the full 0-1 rather than the Exciter's 0-0.7. That
ceiling belongs to band_even_weight, which drives a diode curve whose far end
is harsh across presence and air; this maps straight to even_weight, where 1
is pure second order -- the octave up, which is the phantom fundamental the
control exists for. The odd end is the third of a 200 Hz band, so 600 Hz."
```

---

### Task 5: The wire, the chain, and the regenerated corpus

The task with the most ways to be subtly wrong. Read the whole task before starting.

**Files:**

- Modify: `src/common/dsp/chainWire.ts`
- Modify: `native/dsp-core/include/fluideq/chain.h:174`
- Modify: `native/dsp-core/src/chain_decode.cpp`
- Modify: `native/dsp-core/src/chain_internal.h`
- Modify: `native/dsp-core/src/chain_stages.cpp`
- Modify: `native/dsp-core/src/chain.cpp:448-509`
- Test: `src/__tests__/unit_tests/dspChainWire.test.ts`

**Interfaces:**

- Consumes: `IBassForgeSettings` / `IBassPunchSettings` from Task 4; `feq_bass_forge_process` / `feq_bass_punch_process` from Tasks 2 and 3.
- Produces: `CHAIN_PARAM_LEAD === 91`. `chain_process_bass_forge` and `chain_process_bass_punch`, declared in `chain_internal.h` beside the other stage functions.

**Where the scalars go, and why it is not the end.** `encodeChainSettings` writes a positional array, and `isChainWirePayload` reads the EQ band count from `values[CHAIN_PARAM_LEAD - 1]` — the last lead slot. The fourteen new scalars go **immediately before** `eq.bands.length`, never after it. Appended after, the band count moves, every payload still validates, and every band decodes one slot along into something plausible.

**Two tests will fail during this task, and both failing is correct.** The encoder's own `chain wire: lead is 91, expected 77` throw is the first. The second is the test that `claude/typescript-usage-review-7794ef` added, which reads `FEQ_CHAIN_PARAM_LEAD` straight out of `chain.h` and asserts it matches the TypeScript constant — see Task 1. Both go green only when the TypeScript constant, the C header and the decoder move together, which is the whole point of them. **Move all three in one commit.** Neither test is to be weakened, and a green suite with the header still at 77 means one of them was.

- [ ] **Step 1: Write the failing test**

```ts
it('carries both bass stages in the lead', () => {
  const encoded = encodeChainSettings({
    ...DSP_DEFAULTS,
    bassForge: { ...DSP_DEFAULTS.bassForge, enabled: true, mix: 0.7 },
    bassPunch: { ...DSP_DEFAULTS.bassPunch, enabled: true, duck: 0.4 },
  });
  expect(encoded).toHaveLength(
    CHAIN_PARAM_LEAD + DSP_DEFAULTS.eq.bands.length * CHAIN_BAND_PARAMS,
  );
  // The band count stays in the last lead slot. If the new scalars were
  // appended after it instead of before, this reads 0.7 and every band that
  // follows is one slot out.
  expect(encoded[CHAIN_PARAM_LEAD - 1]).toBe(DSP_DEFAULTS.eq.bands.length);
  expect(isChainWirePayload(encoded)).toBe(true);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm test:jest -- dspChainWire
```

Expected: FAIL — the encoder throws `chain wire: lead is 91, expected 77`. That throw is the guard working.

- [ ] **Step 3: Move the lead on both sides**

In `chainWire.ts`: destructure `bassForge` and `bassPunch`, push their seven values each in the order of the parameter table, positioned after the `maximizer`/`master` block and **before** `eq.bands.length`, then set `CHAIN_PARAM_LEAD = 91`.

In `native/dsp-core/include/fluideq/chain.h`: `#define FEQ_CHAIN_PARAM_LEAD 91`, and add the two settings structs to `FeqChainSettings` between `dimension` and `maximizer`.

In `chain_decode.cpp`: read the fourteen fields in the identical order, immediately before `out->eq.band_count = ...`. The existing `if (at != FEQ_CHAIN_PARAM_LEAD) return 0;` is what catches a mismatch — do not remove it.

- [ ] **Step 4: Wire the stages into the chain**

In `chain_internal.h`, add state and scratch beside `dimension`'s, and declare both process functions.

In `chain_stages.cpp`, write both, modelled exactly on `chain_process_dimension`: return early when `chain->channels < 2`, and on disabled call the stage's `reset` and return — settled rather than reset every block, so switching back on does not replay a minute-old bloom tail.

In `chain.cpp`, insert the calls:

```cpp
chain_process_exciter(chain, channels, frames);
chain_process_bass_forge(chain, channels, frames);   // generate, then shape
...
chain_process_eq(chain, channels, frames);
...
chain_process_bass_punch(chain, channels, frames);   // shape, then control
chain_process_dimension(chain, channels, frames);
```

- [ ] **Step 5: Regenerate the parity corpus**

```bash
pnpm build && npx ts-node .erb/scripts/generate-parity-fixtures.ts
git diff --stat
```

Expected: every fixture's parameter array grows by fourteen. **The audio must not change.** If the diff shows sample data moving, one of the two bypasses is not exact — go back to Task 2 or 3 rather than accepting it.

- [ ] **Step 6: Run everything**

```bash
pnpm test:jest -- dspChainWire && pnpm test:native-dsp
```

- [ ] **Step 7: Commit**

```bash
git add src/common/dsp/chainWire.ts native/ src/__tests__/unit_tests/dspChainWire.test.ts
git commit -m "The bass stages join the chain, and the lead moves 77 to 91

Fourteen scalars, inserted before the trailing band count and not after it:
isChainWirePayload reads that slot to size the band array, so appending would
have moved it, kept every payload valid, and decoded every band one slot along
into something plausible.

Forge goes after the Exciter because both generate and the EQ should shape
what they made. Punch goes after the EQ and before the compressor because a
transient is shaped and then controlled -- the other order hands the
compressor's low band an envelope that is already squashed.

The corpus is regenerated: the encoded lead grows in every fixture, and the
audio in them does not, because both stages default off and bypass exactly."
```

---

### Task 6: Native parameter ids

**Files:**

- Modify: `src/common/dsp/nativeParameters.ts`
- Test: `src/__tests__/unit_tests/common/` (the existing native parameter test)

**Interfaces:**

- Consumes: the paths from Task 4.
- Produces: ids 2001–2007 and 2101–2107, and `NATIVE_DSP_PARAMETER_SCHEMA_VERSION === 2`.

- [ ] **Step 1: Write the failing test**

```ts
it('reserves 2000-2199 for the bass stages and burns nothing', () => {
  const bass = NATIVE_DSP_PARAMETERS.filter((p) => p.id >= 2000 && p.id < 2200);
  expect(bass).toHaveLength(14);
  expect(new Set(bass.map((p) => p.id)).size).toBe(14);
  expect(NATIVE_DSP_PARAMETER_COUNT).toBe(NATIVE_DSP_PARAMETERS.length);
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm test:jest -- nativeParameters
```

- [ ] **Step 3: Add the block**

Append after the `dimension` block, with the comment explaining the reservation:

```ts
/**
 * A fresh thousand-block, and 2000-2199 belongs to the two bass stages.
 *
 * Reserved rather than merely used: `claude/noise-reduction-filter-a41ca7` is
 * designing four more native-only modules against the same table, and two
 * branches both reaching for the next free id is the one collision this scheme
 * cannot recover from. A wire lead can be renumbered on merge; an id cannot,
 * because a stored automation follows the number rather than the path. Denoise
 * starts at 2200.
 */
{ id: 2001, path: 'bassForge.enabled', kind: 'boolean' },
{ id: 2002, path: 'bassForge.splitHz', kind: 'number', structural: true },
{ id: 2003, path: 'bassForge.driveDb', kind: 'number' },
{ id: 2004, path: 'bassForge.subAmount', kind: 'number' },
{ id: 2005, path: 'bassForge.presenceAmount', kind: 'number' },
{ id: 2006, path: 'bassForge.texture', kind: 'number' },
{ id: 2007, path: 'bassForge.mix', kind: 'number' },

{ id: 2101, path: 'bassPunch.enabled', kind: 'boolean' },
{ id: 2102, path: 'bassPunch.splitHz', kind: 'number', structural: true },
{ id: 2103, path: 'bassPunch.attack', kind: 'number' },
{ id: 2104, path: 'bassPunch.sustain', kind: 'number' },
{ id: 2105, path: 'bassPunch.bloomAmount', kind: 'number' },
// Not structural: the comb delays are fixed at the longest and only the
// feedback gain moves, so the dial never reallocates a buffer.
{ id: 2106, path: 'bassPunch.bloomDecayMs', kind: 'number' },
{ id: 2107, path: 'bassPunch.duck', kind: 'number' },
```

Bump `NATIVE_DSP_PARAMETER_SCHEMA_VERSION` to `2`, with a comment saying why: a renderer meeting an older host must fail the handshake loudly rather than quietly losing both stages.

- [ ] **Step 4: Run, then regenerate the C header**

```bash
pnpm test:jest -- nativeParameters && pnpm build:native-dsp
```

The generator writes the header from this table, so the build is what proves the two agree.

- [ ] **Step 5: Commit**

```bash
git add src/common/dsp/nativeParameters.ts src/__tests__/
git commit -m "Bass parameter ids, and 2000-2199 is reserved rather than used

Two branches are adding native-only stages against one append-only table.
A wire lead can be renumbered when the second one merges; an id cannot,
because a stored automation follows the number and not the path. So this
claims a block instead of taking the next free id, and says in the table
where Denoise starts.

The schema version goes to 2 so a renderer meeting an older host fails the
handshake loudly rather than quietly losing both stages."
```

---

### Task 7: Preset catalogues

**Files:**

- Create: `src/common/dsp/bassForgePresets.ts`
- Create: `src/common/dsp/bassPunchPresets.ts`
- Modify: `src/common/dsp/presets.ts`
- Test: `src/__tests__/unit_tests/common/dspBassPresets.test.ts`

**Interfaces:**

- Consumes: `IBassForgeSettings`, `IBassPunchSettings`, `clampDspSettings` from Task 4.
- Produces:
  ```ts
  export const BASS_FORGE_PRESET_BY_ID: Record<string, IBassForgePreset>;
  export const bassForgePresetSettings: (
    id: TBassForgePresetId,
    enabled: boolean,
  ) => IBassForgeSettings;
  export const isBassForgePresetId: (id: string) => id is TBassForgePresetId;
  // and the same three for Punch
  ```

Model both files on `maximizerPresets.ts` exactly: the `MAXIMIZER_PRESET_GROUPS` const tuple, the `profile(...)` helper so the catalogue reads as a table, `satisfies Record<string, IPreset>`, and `presetId` absent from the preset's own settings type because a chain preset decides whether the stage runs.

Groups: `'basic' | 'genre' | 'character' | 'scene'`.

**Forge** — `subtle`, `default`, `deep` · `solid`, `hot`, `round`, `dry`, `wet`, `phantom` · `hiphop`, `electronic`, `rock`, `dub`, `pop` · `laptop`, `headphones`, `car`, `club`

`laptop` sets `subAmount: 0` and leans entirely on presence — the speaker radiates nothing at the octave below and spending headroom there buys nothing. Put that sentence in the entry as a comment.

**Punch** — `default`, `tight`, `open` · `punch`, `slam`, `dry`, `wet`, `soft` · `hiphop`, `rock`, `electronic`, `dnb` · `lateNight`, `club`

`dry` is negative `sustain` with `bloomAmount: 0`; `wet` is positive `sustain` with real bloom. `lateNight` has no bloom at all — a long decay is what wakes the room next door.

- [ ] **Step 1: Write the failing test**

```ts
describe('bass presets', () => {
  it('every profile survives clamping unchanged', () => {
    // A shipped preset that gets clamped on load does not sound like its name.
    BASS_FORGE_PRESETS.forEach((preset) => {
      const live = bassForgePresetSettings(
        preset.id as TBassForgePresetId,
        true,
      );
      expect(clampDspSettings({ bassForge: live }).bassForge).toEqual(live);
    });
    BASS_PUNCH_PRESETS.forEach((preset) => {
      /* the same */
    });
  });

  it('laptop leans on presence rather than a sub it cannot play', () => {
    expect(BASS_FORGE_PRESET_BY_ID.laptop.settings.subAmount).toBe(0);
    expect(
      BASS_FORGE_PRESET_BY_ID.laptop.settings.presenceAmount,
    ).toBeGreaterThan(0.5);
  });

  it('lateNight has no bloom', () => {
    expect(BASS_PUNCH_PRESET_BY_ID.lateNight.settings.bloomAmount).toBe(0);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm test:jest -- dspBassPresets
```

- [ ] **Step 3: Write both catalogues, and the chain preset**

In `presets.ts`, add `bassForge` and `bassPunch` to every existing chain preset — `DSP_DEFAULTS.bassForge` and `DSP_DEFAULTS.bassPunch`, both off — and add one new chain preset `bass-power` (labelKey `dsp.preset.bassPower`) that references `bassForgePresetSettings('solid', true)` and `bassPunchPresetSettings('punch', true)` **by id**, as the Exciter and Maximizer are referenced, so the chain and the pickers cannot drift.

- [ ] **Step 4: Run**

```bash
pnpm test:jest -- dspBassPresets dspChain
```

- [ ] **Step 5: Commit**

```bash
git add src/common/dsp/bassForgePresets.ts src/common/dsp/bassPunchPresets.ts src/common/dsp/presets.ts src/__tests__/unit_tests/common/dspBassPresets.test.ts
git commit -m "Bass profiles, referenced by id so the pickers cannot drift

Two catalogues on the Maximizer's shape: a table rather than prose, because
every profile is a point on the same few trade-offs. The chain preset that
turns both stages on names its profiles by id instead of copying their
numbers, which is what stops a chain and a picker disagreeing later.

laptop sets subAmount to zero and leans entirely on presence -- that speaker
radiates nothing at the octave below, so headroom spent there buys nothing.
lateNight has no bloom, because a long decay is what wakes the room next door."
```

---

### Task 8: Ten locales

**Files:**

- Modify: `src/common/i18n/{en,es,de,fr,it,pt,ru,ja,zh,hi}/dsp.ts`

All ten in one commit. English first, then translate — do not ship English strings in the other nine as placeholders.

Keys needed: `dsp.bassForge.title`, `.description`, `.splitHz`, `.driveDb`, `.subAmount`, `.presenceAmount`, `.texture`, `.mix`, `.monoNote`, `.unavailable`; the same shape for `dsp.bassPunch.*` with `.attack`, `.sustain`, `.bloomAmount`, `.bloomDecayMs`, `.duck`; one `dsp.bassForgePreset.<id>` per profile that has no existing label to reuse; the same for `dsp.bassPunchPreset.*`; and `dsp.preset.bassPower`.

Reuse existing genre keys (`dsp.eqPreset.rock`, `.hiphop`, `.electronic`, `.pop`, `.jazz`) rather than adding duplicates, exactly as `maximizerPresets.ts` does.

- [ ] **Step 1: Write English**

`dsp.bassForge.description` — say what the stage does in terms a listener can check: it adds an octave below for speakers that can play one, and the harmonics of the bass for speakers that cannot, without changing how loud the low end is.

`dsp.bassForge.monoNote` — "Generated bass is summed to mono. The original low end keeps its stereo."

`dsp.bassPunch.description` — the attack and the decay of the low end, not its tone.

- [ ] **Step 2: Translate the other nine**

- [ ] **Step 3: Run the completeness test**

```bash
pnpm test:jest -- i18n
```

Expected: PASS. That test is what catches a locale missing a key.

- [ ] **Step 4: Commit**

```bash
git add src/common/i18n
git commit -m "The bass stages speak all ten languages"
```

---

### Task 9: Meters

**Files:**

- Modify: `native/dsp-core/include/fluideq/meters.h`, `native/dsp-core/src/meters.cpp`
- Modify: `src/common/dsp/analysisWire.ts`
- Modify: `src/main/dspHost/wire.ts`
- Modify: `src/renderer/dsp/store.ts`, `src/renderer/dsp/nativeMeters.ts`
- Test: `src/__tests__/unit_tests/main/dspHostAnalysisWire.test.ts`

**Interfaces:**

- Consumes: `feq_bass_forge_bands`, `feq_bass_punch_transient_db` / `_sustain_db` / `_duck_db` from Tasks 2 and 3.
- Produces:
  ```ts
  // analysisWire.ts, on IHostAnalysis
  bassForge: { inputDb: readonly number[]; outputDb: readonly number[] };
  bassPunch: { transientGainDb: number; sustainGainDb: number; duckGainDb: number };
  // store.ts
  export const setDspBassForgeBands: (inputDb: readonly number[], outputDb: readonly number[]) => void;
  export const readDspBassForgeBands: () => { inputDb: readonly number[]; outputDb: readonly number[] };
  export const setDspBassPunchActivity: (transientDb: number, sustainDb: number, duckDb: number) => void;
  export const readDspBassPunchActivity: () => { transientDb: number; sustainDb: number; duckDb: number };
  ```

**The correction that matters.** The design document first named `INativeTelemetryFrame` in `nativeProtocol.ts`. That is the wrong wire. Stage meters travel on `IHostAnalysis` in `src/common/dsp/analysisWire.ts`, which is a **binary frame with a fixed 120-byte header** decoded at fixed offsets in `src/main/dspHost/wire.ts` — `dimensionGuard` is `view.getFloat32(60, true)`. Adding meters means growing `ANALYSIS_HEADER_BYTES` and the matching C++ publisher together.

Forge needs sixteen float32s (eight in, eight out) and Punch three, so the header grows by 76 bytes to **196**.

**`ANALYSIS_HEADER_BYTES` is the second cross-branch collision.** `claude/noise-reduction-filter-a41ca7` will grow the same header for its own meters. Same rule as the chain lead: whoever lands second re-numbers rather than resolves, and the new fields go at the END of the header, after every existing offset, so nothing already decoded moves.

- [ ] **Step 1: Write the failing test**

In `src/__tests__/unit_tests/main/dspHostAnalysisWire.test.ts`:

```ts
it('decodes the bass meters without moving any existing offset', () => {
  const frame = buildAnalysisFrame({
    bassForgeInputDb: [-20, -21, -22, -23, -24, -25, -26, -27],
    bassForgeOutputDb: [-18, -19, -20, -21, -22, -23, -24, -25],
    bassPunchTransientDb: 3.5,
    bassPunchSustainDb: -1.25,
    bassPunchDuckDb: -4,
    dimensionGuard: 0.5,
  });
  const decoded = decodeAnalysisFrame(frame);
  expect(decoded.bassForge.inputDb).toHaveLength(8);
  expect(decoded.bassForge.outputDb[0]).toBeCloseTo(-18, 3);
  expect(decoded.bassPunch.transientGainDb).toBeCloseTo(3.5, 3);
  // The new fields are appended, so nothing that already had an offset moved.
  expect(decoded.dimensionGuard).toBeCloseTo(0.5, 3);
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
pnpm test:jest -- dspHostAnalysisWire
```

- [ ] **Step 3: Grow the header on both sides**

C++ first: publish the values in `meters.cpp` at the end of the header, then `ANALYSIS_HEADER_BYTES = 196` in `analysisWire.ts` with a comment naming the two branches and the rule, then the decode in `src/main/dspHost/wire.ts` reading the new offsets, then the `IHostAnalysis` fields.

- [ ] **Step 4: Add the store values and wire them**

Add both pairs to `store.ts` beside `setDspDimensionGuard`, following that pattern exactly: a module-level value, a setter, a reader. The comment on each says why it is not React state — it changes every audio block and a render per block is a repaint the display cannot use.

Call both setters in `nativeMeters.ts` beside `setDspDimensionGuard(frame.dimensionGuard)`.

- [ ] **Step 5: Run**

```bash
pnpm build && pnpm test:jest -- dspHostAnalysisWire && pnpm test:native-dsp
```

- [ ] **Step 6: Commit**

```bash
git add native/ src/common/dsp/analysisWire.ts src/main/dspHost/wire.ts src/renderer/dsp/store.ts src/renderer/dsp/nativeMeters.ts src/__tests__/
git commit -m "Bass meters travel on the analysis frame, not the telemetry one

The design named INativeTelemetryFrame. Wrong wire: stage meters go on
IHostAnalysis, which is a binary frame decoded at fixed byte offsets, and
dimensionGuard sits at offset 60 of a 120-byte header. So this grows the
header rather than adding a field to an interface.

Sixteen floats for Forge's eight bands in and out, three for Punch, appended
after every existing offset so nothing already decoded moves. That constant is
the second one the noise-reduction branch will also move: same rule as the
chain lead, whoever lands second re-numbers rather than resolves."
```

---

### Task 10: The Bass Forge card and graph

**Files:**

- Create: `src/renderer/dsp/DspBassForgeCard.tsx`, `src/renderer/dsp/DspBassForgeGraph.tsx`
- Modify: `src/renderer/dsp/sections.ts`, `src/renderer/dsp/DspPanel.tsx`, `src/renderer/dsp/DspSectionIcon.tsx`, `src/renderer/styles/Dsp.scss`

**Interfaces:**

- Consumes: `IBassForgeSettings` (Task 4), `BASS_FORGE_PRESETS` (Task 7), `readDspBassForgeBands` (Task 9), `Dial` and `ProcessorCard` from `./DspControls`.
- Produces: `TDspSection` gains `'bassForge'`.

Card first, on screen, then the tests — Ivan looks at it before the suite runs.

- [ ] **Step 1: Add the section**

In `sections.ts`, add `'bassForge'` to `TDspSection` and an entry to `DSP_SECTIONS` **after** `exciter`, matching its place in the signal path.

- [ ] **Step 2: Write the card**

Model on `DspDimensionCard.tsx`: a `ProcessorCard` with `titleKey`/`descriptionKey`/`isEnabled`/`onToggle`, then one `Dial` per control with `min`/`max`/`step`/`unit`/`defaultValue` from `DSP_DEFAULTS`, `isDisabled={!bassForge.enabled}`, `onCommit`, and `onChange`. Then the preset picker as the Maximizer card does it, and the mono note as `<p className="dsp-dimension-note">`-equivalent — reuse the existing note class rather than inventing one.

Reuse existing classes throughout. `button small` is the filled accent, `button small subtle` the quiet outline.

- [ ] **Step 3: Write the graph**

Model on `DspExciterGraph.tsx` for the canvas and theme handling and on `DspMaximizerGraph.tsx` for the frame loop. Log frequency axis from **20 Hz to 1 kHz only**. Dry band as a dim curve from `inputDb`, forged output as the accent from `outputDb`, the area between them filled — one hue below `splitHz` for sub, another above for presence. Draw the split as a vertical marker.

Read `readDspBassForgeBands()` inside `requestAnimationFrame`, never in React state.

- [ ] **Step 4: Route it**

In `DspPanel.tsx`, add the `{section === 'bassForge' && (...)}` branch beside the others. Add an icon case in `DspSectionIcon.tsx`.

- [ ] **Step 5: Check it compiles and the styles pass**

```bash
npx tsc --noEmit -p tsconfig.json && npx ts-node .erb/scripts/check-styles.ts && pnpm lint
```

- [ ] **Step 6: Commit, then write the tests**

Add a `DspPanel` case asserting the section renders and the dials are present. Then:

```bash
git add src/renderer/dsp/ src/renderer/styles/Dsp.scss src/__tests__/
git commit -m "The Bass Forge page: dials, profiles, and a graph zoomed to bass

The plot stops at 1 kHz. A full-range spectrum behind this stage would be the
same picture the pages either side already draw, with nothing of this stage
in it -- what this one has to show is the difference between the band going in
and the band coming out, and that difference lives in two octaves.

The generated content is drawn as the filled area between the two curves, in
two hues split at the corner, so the octave-down generator and the harmonic
one can be told apart without reading the dials."
```

---

### Task 11: The Bass Punch card and graph

**Files:**

- Create: `src/renderer/dsp/DspBassPunchCard.tsx`, `src/renderer/dsp/DspBassPunchGraph.tsx`
- Modify: `src/renderer/dsp/sections.ts`, `src/renderer/dsp/DspPanel.tsx`, `src/renderer/dsp/DspSectionIcon.tsx`, `src/renderer/styles/Dsp.scss`

**Interfaces:**

- Consumes: `IBassPunchSettings` (Task 4), `BASS_PUNCH_PRESETS` (Task 7), `readDspBassPunchActivity` (Task 9).
- Produces: `TDspSection` gains `'bassPunch'`.

- [ ] **Step 1: Add the section**

`'bassPunch'` in `TDspSection`, and an entry in `DSP_SECTIONS` **after** `eq`.

- [ ] **Step 2: Write the card**

Same shape as Task 10's. `attack` and `sustain` are bipolar dials — `min={-1} max={1}` with `defaultValue={0}`, so the dial's centre reads as "doing nothing", which is what zero means here.

- [ ] **Step 3: Write the graph**

A three-second scrolling strip on `DspMaximizerGraph.tsx`'s pattern: fixed `SAMPLE_MS` so it scrolls at the same speed on a 60 Hz and a 144 Hz panel, keeping the **peak** between columns rather than the mean. Dry low-band envelope as a line, shaped envelope over it, added attack as a bright spike, bloom as a shaded tail, duck as a live readout beside it.

- [ ] **Step 4: Route it**

- [ ] **Step 5: Check**

```bash
npx tsc --noEmit -p tsconfig.json && npx ts-node .erb/scripts/check-styles.ts && pnpm lint
```

- [ ] **Step 6: Commit, then write the tests**

```bash
git add src/renderer/dsp/ src/renderer/styles/Dsp.scss src/__tests__/
git commit -m "The Bass Punch page, drawn on time rather than frequency

A limiter's picture, borrowed: this stage has no opinion about frequency
either, and the axis that means something is the envelope. The dry low band
runs under the shaped one so the attack that was added is the gap between
them, and the bloom is the shaded tail behind the decay.

Attack and sustain are bipolar with zero at the centre, because zero here is
not off -- it is the stage running and choosing to change nothing."
```

---

### Task 12: The suite, then the window

**Files:** none created. This is the gate.

- [ ] **Step 1: Run everything from a clean build**

```bash
pnpm build && pnpm test
```

`setupFiles` runs `check-build-exists.ts`, which throws unless `dist` holds both bundles — the build is not optional.

- [ ] **Step 2: Fix what broke, and add the cases that would have caught it**

- [ ] **Step 3: Confirm the corpus still shows no audio movement**

```bash
git diff --stat -- src/__tests__/fixtures
```

- [ ] **Step 4: Hand it to Ivan with a list**

Do not run the app. Tell him what needs a real launch, and be specific about what has and has not been verified — passing tests are not a working window. He should look at:

1. Both new tabs in the rail, in signal-path order, with icons that read at their actual size.
2. The Forge graph moving with music, and the filled area visibly changing when `subAmount` and `presenceAmount` are moved independently.
3. The Punch strip scrolling, and the attack spike appearing on a kick.
4. Every dial at both ends, listening for the stage becoming a volume control — the property tests assert it, but only the ear catches a follower that is subtly too fast.
5. `laptop` and `club` on the same track through the same speakers, which is the A/B the two generators exist for.
6. The fallback notice: with the native host failed, both cards should read as unavailable rather than broken.

- [ ] **Step 5: After he is happy, verify the UI over CDP**

Dev exposes DevTools on `127.0.0.1:9222`. Probe computed styles and canvas pixels of the running window — sizes, colours, placement. Every UI defect that shipped this project passed the whole suite; tests query by role and cannot see any of that.

---

## Plan self-review

**Spec coverage.** Every section of the design maps to a task: shared architecture and both stages → 2 and 3; controls, ranges, clamping → 4; chain order, wire, parity corpus → 5; parameter ids and schema version → 6; presets and the chain preset → 7; i18n → 8; telemetry and graphs → 9, 10, 11; the branch-collision constraints → global constraints plus Tasks 5, 6 and 9; verification → 12. The duplicate-lead finding became Task 1 rather than a footnote, because the rest of the plan moves that constant.

**One thing the spec had wrong, corrected here.** The spec put the meters on `INativeTelemetryFrame`. They belong on `IHostAnalysis`, whose frame is binary with a fixed 120-byte header. Task 9 carries the correction and the second collision it exposes — `ANALYSIS_HEADER_BYTES` is a constant the noise-reduction branch will also move, which nothing had noticed. **The spec should be updated to match before implementation starts.**

**Type consistency.** `bassForge`/`bassPunch` name the fields in every task. `splitHz`, `driveDb`, `subAmount`, `presenceAmount`, `texture`, `mix` and `splitHz`, `attack`, `sustain`, `bloomAmount`, `bloomDecayMs`, `duck` are spelled the same in Tasks 4, 5, 6, 7, 10 and 11 and match the C++ snake_case fields one for one. `bassForgePresetSettings` / `bassPunchPresetSettings` are named identically in Task 7 and consumed by that name in Tasks 10 and 11.
