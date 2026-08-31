# Bass Forge and Bass Punch — two bass-dedicated DSP stages

Date: 2026-08-30
Status: design approved, not implemented

Two new stages in the DSP rack, both dedicated to low end: one that makes
bass, one that makes it hit. Written in C++ only, following the Dimension
precedent.

## Why two stages and not one

Bass power is two unrelated problems and they want opposite processing.

**Making bass audible** is a tone and generation problem: a laptop speaker
cannot reproduce 45 Hz at any level, so weight has to be implied by harmonics
the speaker _can_ play, and a subwoofer wants the opposite — an actual octave
below what the record carries. That is spectral work, judged on a frequency
plot.

**Making bass hit** is a time problem: the first fifteen milliseconds of a kick
against the two hundred after it. Nothing about it has a frequency axis to have
an opinion about, and it is judged on an envelope.

One stage covering both would need mode flags to behave two ways, which is the
definition of two components. It would also need a graph that could not show
either job properly.

## Placement in the chain

```
input gain → exciter → BASS FORGE → eq → BASS PUNCH → dimension → compressor → maximizer → master
```

Forge sits beside the Exciter because both _generate_, and the EQ should be
able to shape what they made rather than being shaped around it.

Punch sits after the EQ and before the compressor because a transient is
shaped and then controlled. The reverse order hands the compressor's low band
an already-squashed envelope and there is nothing left to shape.

`DSP_SECTIONS` gains the two tabs in the same positions, because the rail's job
is to read as the signal path.

## Engine: native only

Both stages are written in `native/dsp-core` with their own C++ property tests
and no TypeScript worklet twin, matching Dimension.

Consequence to be honest about: when the native host cannot start and the
worklet fallback carries the audio, these two stages are absent while every
other stage keeps working. That has to be visible rather than silent.

It already is. The notice gated on `nativeState === 'failed'` exists and ships
in all ten locales; the `typescript-usage-review` worktree is moving it out of
the Master side-tab and into the DSP panel header as `dsp.engineFallback`, so
it is seen wherever the user happens to be standing rather than only on one
page. Its text is being corrected there too — it claimed the music plays with
no EQ, dynamics or limiter, which stopped being true once the controller was
gated on `'engaged'`: a failed host now leaves the worklet chain audible, and
what is actually lost is exactly the native-only stages.

**Nothing further is built here for this, and nothing is re-added to
`DspMasterCard`.** These two stages inherit that notice. The only thing this
work owes is that the Forge and Punch cards read as unavailable rather than as
broken when the fallback is carrying the audio.

Second consequence: native DSP on macOS and Linux is deferred, so in practice
these stages are Windows-only until that lands.

## Shared architecture

Both stages split with a Linkwitz-Riley 4th-order lowpass at their own corner
and define the remainder by subtraction:

```
low  = LR4_lowpass(input, splitHz)     // two cascaded Butterworth biquads
rest = input − low
```

`feq_biquad_coefficients` and `feq_biquad_process` are already public in
`biquad.h`, so this is a local pair of stages rather than new primitive work.
`feq_crossover_split` is deliberately not reused: it is a three-way split and
these stages need two, so half its filtering would be computed and discarded.

Subtraction is what makes `low + rest === input` an exact equality rather than
a tolerance — the same reasoning already written into `primitives.h`. It is
what lets "disabled is bit-exact passthrough" be a test instead of a hope.

---

## Bass Forge

### Controls

| Field            | Range  | Default | Wire            | What it is                                                          |
| ---------------- | ------ | ------- | --------------- | ------------------------------------------------------------------- |
| `enabled`        | bool   | `false` | yes             |                                                                     |
| `presetId`       | string | `''`    | **no**          | renderer and storage only, as the Maximizer's is                    |
| `splitHz`        | 40–200 | 90      | yes, structural | where bass ends                                                     |
| `driveDb`        | 0–12   | 0       | yes             | drive into the saturator — the "hot" control                        |
| `subAmount`      | 0–1    | 0       | yes             | octave-down synthesis: weight for speakers that can play it         |
| `presenceAmount` | 0–1    | 0       | yes             | upward harmonics — the phantom fundamental for speakers that cannot |
| `texture`        | 0–1    | 0.8     | yes             | even↔odd recipe of the presence harmonics                           |
| `mix`            | 0–1    | 0       | yes             | overall level of the generated content                              |

`subAmount`, `presenceAmount` and `texture` set the recipe; `mix` sets how much
of it arrives. That separation is what lets a preset be "solid" or "hot"
independently of how strong it is.

### There is no mono control here, deliberately

The first draft of this design gave Forge a `monoHz` dial and proposed
migrating `eq.monoBelowHz` into it. That is wrong and the review caught it:
`eq.monoBelowHz` is referenced by roughly twenty entries in the EQ preset
catalogue, and an EQ preset cannot reach into another stage's settings. The
migration would silently drop the mono-maker out of every one of them.

Two mono-makers in one chain is also a second authority that drifts.

What Forge does instead is a property, not a dial: **the generation source is
`(low[0] + low[1]) / 2`, always.** Harmonics generated separately per channel
are two decorrelated harmonic sets, which is a phase problem sold as width.
The generated content is therefore identical in both channels by construction,
and the test for that is an equality. The dry low band keeps its own stereo
untouched, and the mono-maker stays where it already lives, in the EQ.

The card carries a one-line note saying generated bass is mono. It does not
carry a control for it.

### Signal path, per block

1. Split at `splitHz`. `rest` is left alone.
2. `source = (low[0] + low[1]) / 2`. Drive is deliberately **not** applied
   here — a gain in front of these two generators is inaudible, for the reason
   set out under "`driveDb` needs its own non-linearity" below.
3. **Sub generator** — a zero-crossing flip-flop divider on `source`, LR4
   lowpassed at `splitHz` and highpassed at 25 Hz, its RMS matched to
   `source`'s. This is what a BOSS OC-2 or a dbx 120 does.

   It is monophonic. On a chord it tracks the loudest partial, and that is a
   documented property rather than a defect — it is exactly why `subAmount`
   blends rather than replaces.

   The divider is muted below a level floor, as `harmonics.cpp`'s `QUIET_FLOOR`
   is. A free-running divider between notes produces rumble that is not in the
   record, and it does it in silence, where it is most obvious.

4. **Presence generator** — `feq_harmonic_sample(state, source, presenceAmount,
texture, sampleRate)`, reused from `harmonics.h` unchanged. It is already
   level-normalised with the fundamental projection removed, which is the
   expensive half of a bass harmonic generator and is already written and
   already tested.
5. `forged = subOut * subAmount + presence`, then through
   `feq_saturate_sample` at `driveDb`. This is the only place drive acts, and
   at 0 dB it is a bypass.
6. `wet[ch] = low[ch] + forged * mix`.
7. **Level normalisation**, applied to the whole band rather than to the
   generated content alone:

   ```
   g        = rms(low) / rms(wet)          // over a ~250 ms window
   out[ch]  = rest[ch] + wet[ch] * g
   ```

   The window is slow for the reason `FIT_TRACK_MS` is slow: at 20 Hz one cycle
   is 50 ms, and a faster window starts tracking the note instead of the level.

   Scaling the band and not the addition is what makes this hold at _every_
   `mix`, not just at 1 — and at `mix = 0`, `wet` is `low`, so `g` is exactly 1
   and the stage is a bit-exact bypass rather than a bypass to within a
   measurement.

   Without this the stage is a volume control wearing a costume: every A/B is
   won by whichever side is louder and nobody can hear what it actually does.

### `driveDb` needs its own non-linearity, and this is why

An earlier draft of this section said normalisation is what lets `driveDb`
"change how hard the divider and the shaper are hit without changing how loud
the result is". That is wrong, and it was caught in implementation rather than
on paper: **a gain in front of these two generators is inaudible.**

Both of them are level-invariant on purpose. `feq_harmonic_sample`'s headline
property — the whole reason it replaced a biased tangent — is that the harmonic
ratio does not follow the input level. The divider's output is RMS-matched to
its source. So raising the level going in changes neither one's output, and
measurement bore that out exactly: with drive feeding only the divider's gate,
0 dB and 12 dB were bit-identical on anything above roughly −50 dBFS, which is
all music. The dial did nothing and the code honestly said so.

Drive therefore has to push into something whose shape _does_ depend on level.
It applies `feq_saturate_sample` from `saturate.h` to the forged sum, before
the band normalisation:

- that saturator's asymmetry OPENS with drive, which keeps the added orders
  even rather than odd — warmth rather than grit, and the right colour for a
  band that stops at 200 Hz;
- it is already written, measured and in use by the EQ's analogue models, so
  this is the same reuse the presence generator makes of `harmonics.h`;
- normalisation stays downstream of it, so no-free-loudness survives intact;
- at 0 dB it is a bypass, which keeps `mix = 0` and disabled bit-exact.

This is also what makes the `hot` profile in the catalogue a different sound
from `solid` rather than the same one with different amounts.

### `texture` is 0–1 here, not the Exciter's 0–0.7

The Exciter caps texture at 0.7 because `band_even_weight` in `exciter.cpp`
divides by `FEQ_ANALOG_DIODE_MAX_CHARACTER` — its texture drives a diode
character curve, and the far end of that is symmetric, odd-only, and harsh
across the presence and air bands.

Forge maps texture straight to `feq_harmonic_sample`'s `even_weight`, which is
a plain blend of T2 against T3. At 1 it is pure second order — the octave up,
which is precisely the phantom-fundamental cue this control exists for, and the
_good_ end for bass. At 0 it is pure third: for a band that stops at 200 Hz
that is 600 Hz at the very top, nowhere near the region the Exciter's cap
protects. The full range is usable here, which is the property a control is
supposed to have.

### Properties held by test

- `enabled = false` → bit-exact passthrough.
- `mix = 0` → bit-exact passthrough (the crossover recombines exactly).
- Broadband noise, every combination of `mix` / `subAmount` / `presenceAmount`:
  output RMS within 0.5 dB of input RMS. This is the no-free-loudness rule.
- 60 Hz sine, `subAmount = 1` → measurable energy at 30 Hz.
- 60 Hz sine, `presenceAmount = 1`: `texture = 1` → energy at 120 Hz;
  `texture = 0` → energy at 180 Hz.
- Silence in → silence out, with `subAmount = 1`. This is the divider floor.
- Generated content is sample-identical in both channels.

---

## Bass Punch

### Controls

| Field          | Range  | Default | Wire            | What it is                                                    |
| -------------- | ------ | ------- | --------------- | ------------------------------------------------------------- |
| `enabled`      | bool   | `false` | yes             |                                                               |
| `presetId`     | string | `''`    | **no**          | renderer and storage only                                     |
| `splitHz`      | 40–200 | 110     | yes, structural | its own corner                                                |
| `attack`       | −1…+1  | 0       | yes             | the first fifteen milliseconds                                |
| `sustain`      | −1…+1  | 0       | yes             | the tail: negative is dry and tight, positive is wet and long |
| `bloomAmount`  | 0–1    | 0       | yes             | short mono low ambience                                       |
| `bloomDecayMs` | 40–250 | 120     | yes             | its decay                                                     |
| `duck`         | 0–1    | 0       | yes             | mid and high pulled down by the low band's own envelope       |

### Signal path, per block

1. Split at `splitHz`.
2. Three envelope followers on `|low[0]| + |low[1]|`: fast (0.5 ms attack,
   20 ms release), slow (20 / 150), slower (20 / 400).
3. `transientDb = fast − slow`, in dB. `attackGainDb = attack * transientDb *
kAttackScale`, clamped to ±12 dB.
4. `sustainDb = slow − slower`. `sustainGainDb = sustain * sustainDb *
kSustainScale`, clamped to ±9 dB.
5. Both gains apply equally to both channels, so the low band's stereo
   relationship survives untouched.
6. **Bloom** — fed from the shaped low band summed to mono, into three combs at
   23.7 / 31.1 / 41.3 ms and one Schroeder all-pass at 7.3 ms. Mutually prime
   for the reason `dimension.cpp` gives: one comb is a pitched ring, three
   whose delays share no factor are heard as space.

   Feedback from the standard reverberation relation,
   `g = 10^(−3 · delaySeconds / decaySeconds)`, so `bloomDecayMs` is a real
   measured decay rather than a dial position.

   Output LR4-lowpassed at `splitHz` and highpassed at 30 Hz, summed mono, added
   at `bloomAmount`. It is a decay extension, not a reverb, and it does not get
   to be stereo: stereo bass reverb is the standard way to make a mix muddy and
   mono-incompatible.

   Buffers are allocated once at the longest delay, which is fixed. Only the
   feedback gain moves with the dial. A buffer resized while a dial is dragged
   arrives full of zeros, which is the crackle the Maximizer's look-ahead ring
   already learned about the expensive way.

7. **Duck** — `rest` is attenuated by up to 6 dB at `duck = 1`, driven by the
   low band's envelope with a 30 ms release so it does not chatter. Carving the
   space is what actually makes bass read as powerful; raising it further only
   spends headroom.
8. `out[ch] = duckedRest[ch] + shapedLow[ch] + bloom`.

### Properties held by test

- `enabled = false` → bit-exact passthrough.
- `attack = sustain = bloomAmount = duck = 0` → bit-exact passthrough.
- Steady sine: transient gain settles to 0 dB. Shaping is transient-only and
  must never become a tone control.
- Pulse train, `attack = 1`: the first 5 ms of each pulse rises, the tail stays
  within 0.5 dB.
- Impulse, `bloomAmount = 1`: measured time to −60 dB within ±15% of
  `bloomDecayMs`, across the full 40–250 ms range.
- Bloom output is sample-identical in both channels.
- `duck = 1` against a loud low band pulls `rest` down by 6 ± 0.5 dB.

---

## Wire and parameter plumbing

### `chainWire.ts` — the part that is easy to get wrong

`encodeChainSettings` is a **positional** flat array with
`CHAIN_PARAM_LEAD = 77`, and `isChainWirePayload` reads the EQ band count from
the last lead slot at `CHAIN_PARAM_LEAD - 1`.

Therefore:

- Fourteen scalars are added — seven per stage, `presetId` never goes on the
  wire — and `CHAIN_PARAM_LEAD` becomes **91**.
- They are inserted **immediately before the trailing `eq.bands.length` slot**,
  never appended after it. Appending after moves the band count and every
  payload still validates while decoding into nonsense.
- `FEQ_CHAIN_PARAM_LEAD` in `native/dsp-core/include/fluideq/chain.h` moves to
  91 in the same commit, and `chain_decode.cpp` reads the new fields. The
  encoder's own length check is what catches a mismatch, and it must stay.

### Two branches are moving this constant at once

`claude/noise-reduction-filter-a41ca7` is designing Denoise as four native-only
modules and will add scalars to the same lead. Both branches start from 77.

If each picks its own new number independently, the second merge cannot resolve
the conflict by taking either side: the band offsets are computed from the
constant, so keeping one branch's number alongside both branches' scalars
decodes every band one slot along **and still looks plausible**. That is
precisely the failure the comment above `encodeChainSettings` was written
about.

**Whoever lands second re-numbers rather than resolves.** The merge is not
done until `CHAIN_PARAM_LEAD`, `FEQ_CHAIN_PARAM_LEAD` and the actual count of
scalars in `encodeChainSettings` are the same number, and the encoder's own
length check is what proves it.

The native parameter ids are a worse version of the same hazard, because they
are permanent — a collision cannot be renumbered later without burning an id
that a stored automation already follows. **This work reserves 2000–2199 for
the two bass stages.** Denoise should start at 2200.

### There are three copies of the lead, and two are wrong

Found while checking the above, and it is worth fixing in the same commit as
the renumber:

| Where                                       | Value                    | Check                       |
| ------------------------------------------- | ------------------------ | --------------------------- |
| `src/common/dsp/chainWire.ts:36`            | 77                       | `!==`, exact — correct      |
| `native/.../chain.h:174`                    | 77                       | the decoder's own — correct |
| `src/main/dspHost/wire.ts:204`              | **69**                   | `<`, a floor — eight behind |
| `src/__tests__/.../dspChainWire.test.ts:37` | says `chain.h` is **69** | a stale comment             |

The main-process copy cannot catch anything: `src/main/ipc/dspHost.ts:207`
already validates with `isChainWirePayload`, which checks the length exactly
against the band count, and only then does `encodeChainPayload` re-check that
it is at least 69. Anything reaching the floor has already passed a stronger
test, so the floor has been dead since it fell behind — which is why nobody
noticed.

The fix is not to update 69 to 91. It is for `wire.ts` to import the one
constant from `common/dsp/chainWire.ts` and keep its floor check, so a second
authority stops existing and the floor becomes correct by construction rather
than by remembering. The stale test comment goes with it.

Left alone, this work would move the lead a second time and leave the
main-process copy sixteen behind instead of eight.

### The parity corpus does get regenerated

The first draft claimed it would not. That was wrong.

`generate-parity-fixtures.ts` builds its chain presets by spreading
`DSP_DEFAULTS` and calls `encodeChainSettings`, so every fixture's encoded lead
grows by fourteen even though both stages default to `enabled: false`.

The **audio** in the fixtures is unchanged — disabled means bit-exact bypass,
which is what keeps the worklet and the native engine agreeing. The **encoded
parameter arrays** are not. Regenerating is mandatory, and a diff that shows
audio changes as well means one of the bypasses is not exact.

### `nativeParameters.ts`

A fresh thousand-block, nowhere near a burnt id:

| id   | path                       | kind               |
| ---- | -------------------------- | ------------------ |
| 2001 | `bassForge.enabled`        | boolean            |
| 2002 | `bassForge.splitHz`        | number, structural |
| 2003 | `bassForge.driveDb`        | number             |
| 2004 | `bassForge.subAmount`      | number             |
| 2005 | `bassForge.presenceAmount` | number             |
| 2006 | `bassForge.texture`        | number             |
| 2007 | `bassForge.mix`            | number             |
| 2101 | `bassPunch.enabled`        | boolean            |
| 2102 | `bassPunch.splitHz`        | number, structural |
| 2103 | `bassPunch.attack`         | number             |
| 2104 | `bassPunch.sustain`        | number             |
| 2105 | `bassPunch.bloomAmount`    | number             |
| 2106 | `bassPunch.bloomDecayMs`   | number             |
| 2107 | `bassPunch.duck`           | number             |

`bloomDecayMs` is **not** structural: the comb delays are fixed and only a
feedback gain moves.

`NATIVE_DSP_PARAMETER_SCHEMA_VERSION` goes 1 → 2, so a renderer meeting an
older host fails the handshake loudly instead of quietly losing both stages.

Ranges live in `RANGES` in `chain.ts` and nowhere else. `clampDspSettings`
stays the only authority, as its header says.

## Telemetry and graphs

Neither stage gets the spectrum plot the EQ and Master already draw. Behind
either of them it would be the same picture the pages either side already show,
with nothing of the stage in it — the reasoning `DspMaximizerGraph` already
records.

### The meters travel on `IHostAnalysis`, not on `INativeTelemetryFrame`

An earlier draft of this section named `INativeTelemetryFrame` in
`nativeProtocol.ts`. That is the wrong wire, and writing the plan is what
caught it.

Stage meters go on `IHostAnalysis` in `src/common/dsp/analysisWire.ts` — that
is what `nativeMeters.ts` consumes and what already carries `dimensionGuard`,
`maximizerReductionDb` and `exciterBands`. It is **not** a JSON object with
optional fields: it is a binary frame with a fixed `ANALYSIS_HEADER_BYTES = 120`
header, decoded at hard-coded offsets in `src/main/dspHost/wire.ts`, where
`dimensionGuard` is `view.getFloat32(60, true)`.

So the addition is:

```ts
// on IHostAnalysis
bassForge: {
  inputDb: readonly number[];    // 8 log-spaced bands, 20 Hz–1 kHz
  outputDb: readonly number[];
};
bassPunch: {
  transientGainDb: number;
  sustainGainDb: number;
  duckGainDb: number;
};
```

and the real work is growing the header and the C++ publisher in `meters.cpp`
together. Sixteen float32s for Forge and three for Punch takes
`ANALYSIS_HEADER_BYTES` from 120 to **196**, and the new fields go at the very
end so that every offset already being decoded stays where it is.

**This is the second constant the noise-reduction branch will also move**, and
nothing had noticed it before now. The rule is the chain lead's: whoever lands
second re-numbers rather than resolves, appending after every existing offset
on both sides.

The eight bands are measured with band-pass envelope followers on the audio
thread, not an FFT. Sixteen biquads is nothing; a transform per block is not.

### Forge graph — frequency, zoomed to bass

20 Hz to 1 kHz only, which is the entire point. Dry low band as a dim curve,
forged output as the accent, and the **generated** content as the filled area
between them — one hue below the split for sub, another above it for presence,
so the two generators are told apart at a glance. Split marker drawn as a line.

### Punch graph — time

A three-second scrolling strip on `DspMaximizerGraph`'s pattern: the dry
low-band envelope as a line, the shaped envelope over it, added attack as a
bright spike, bloom as a shaded tail behind the decay, duck as a live readout.

Both graphs read module values from `store.ts` inside the frame loop, through
`readDsp*` accessors written beside the existing ones. Never React state per
audio block — that is a repaint at a rate no display can show.

## Presets

Groups mirror the Maximizer's catalogue (`basic` / `genre` / `character` /
`scene`). Chain presets reference processor presets **by id**, as
`presets.ts` already does for the Exciter and Maximizer, so the two lists
cannot drift.

**Forge** — `subtle`, `default`, `deep` · `solid`, `hot`, `round`, `dry`,
`wet`, `phantom` · `hiphop`, `electronic`, `rock`, `dub`, `pop` · `laptop`,
`headphones`, `car`, `club`

`laptop` is presence-only with `subAmount` at zero, because the speaker cannot
play the octave below at any level and spending headroom on it is spending it
on nothing.

**Punch** — `default`, `tight`, `open` · `punch`, `slam`, `dry`, `wet`, `soft`
· `hiphop`, `rock`, `electronic`, `dnb` · `lateNight`, `club`

One new chain preset, `bass-power`, turns both on together. Every existing
chain preset carries both stages present and disabled.

A test asserts every shipped preset survives `clampDspSettings` unchanged — a
preset that gets clamped on load does not sound like its own name.

## Files

**New C++** — `bass_forge.h` / `bass_forge.cpp`, `bass_punch.h` /
`bass_punch.cpp`, and `tests/bass_forge_test.cpp` / `tests/bass_punch_test.cpp`.

**Modified C++** — `chain_internal.h` (state and scratch buffers),
`chain_stages.cpp` (two process functions), `chain.cpp` (call order),
`chain.h` (`FEQ_CHAIN_PARAM_LEAD`), `chain_decode.cpp`, and the CMake source
list.

**Common TS** — `chain.ts` (two interfaces, `IDspSettings`, `DSP_DEFAULTS`,
`RANGES`, `clampDspSettings`), `chainWire.ts`, `nativeParameters.ts`,
`nativeProtocol.ts`, `presets.ts`, new `bassForgePresets.ts` and
`bassPunchPresets.ts`, and `i18n/*/dsp.ts` across all ten locales in the same
commit.

**Main TS** — `dspHost/wire.ts`, which stops owning a second
`CHAIN_PARAM_LEAD` and imports the common one.

**Renderer TS** — `sections.ts`, `DspPanel.tsx`, `DspSectionIcon.tsx`,
`store.ts`, `nativeMeters.ts`, `nativeMirror.ts`, and new
`DspBassForgeCard.tsx` / `DspBassForgeGraph.tsx` / `DspBassForgeBar.tsx` and
`DspBassPunchCard.tsx` / `DspBassPunchGraph.tsx`.

Each card stays under 500 lines. Styles reuse the app's existing classes —
`button small` for the filled accent, `button small subtle` for the quiet
outline — and `check-styles.ts` must pass. No invented styles, no raw
`font-weight` numbers.

## Verification

- C++ property tests as listed under each stage.
- TypeScript: clamp round-trips, every preset unchanged through
  `clampDspSettings`, the parameter table's count-against-map assertion,
  `chainWire` lead length, i18n completeness across ten locales, and
  `DspPanel` rendering both new sections.
- A test asserting the main-process and common leads are the same number. It
  would have caught the eight-slot drift years before this design did, and
  once `wire.ts` imports the constant it is a test that cannot be made to fail
  by editing one file — which is the point.
- Regenerated parity fixtures, with the audio unchanged.
- **A live window pass over CDP on `127.0.0.1:9222`** for both cards and both
  graphs: sizes, colours, placement, and the graphs actually moving with audio.
  Every UI defect that shipped this project passed the whole suite. Compiles
  and tests pass is not a UI verdict.
- Ivan runs the app. This work does not launch it.

## Open questions

None blocking. Two things to confirm once it is audible rather than on paper:

- Whether `duck` at its 6 dB ceiling is enough to be worth a dial, or whether
  it wants more range. It is deliberately conservative to start.
- Whether the sub divider's monophonic tracking is acceptable on real dense
  material, or whether `subAmount` needs a lower default ceiling in the genre
  presets that face it.
