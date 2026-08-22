# DSP Processor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A studio-grade exciter → multiband compressor → maximizer chain that
runs live on FluidEQ's library player and can also render a processed file.

**Architecture:** The DSP maths lives in pure functions over `Float32Array`,
tested without any browser audio API. `AudioWorkletProcessor` classes are thin
wrappers that call them. One graph builder accepts either an `AudioContext`
(live) or an `OfflineAudioContext` (render), so nothing is written twice.

**Tech Stack:** TypeScript (strict), Web Audio API, AudioWorklet, React,
Jest + jsdom, webpack 5, SCSS.

**Spec:** `docs/superpowers/specs/2026-08-21-dsp-processor-design.md`

## Global Constraints

- **Jest will not start without a build.** `setupFiles` runs
  `check-build-exists.ts`, which throws unless `dist` holds both bundles. This
  worktree is fresh — run `pnpm build` once before the first test run.
- Strict TS: no `any` (use `unknown` + guards), no `!` non-null, no
  `@ts-ignore`, no `==`, no `var`, no empty `catch`, no dead code, no
  `console.log`.
- No `eslint-disable` without an inline justification.
- Files stay under 500 lines.
- Comments state what the code cannot: constraints, measured numbers, the
  failure the code prevents — never what the next line does.
- Every user-facing string goes through i18n, **all ten locales in the same
  commit**: `en de es fr hi it ja pt ru zh`.
- Every source file opens with the GPL header block used by its neighbours.
- **No `setTimeout`/`setInterval` to make a race behave.** A debounce the user
  can feel is legitimate; "let state settle" is not.
- Reuse the app's existing classes — `button small` is the filled accent,
  `button small subtle` the quiet outline. Never invent a style.
- Tests live in `src/__tests__/unit_tests/common/` and
  `src/__tests__/unit_tests/renderer/`.
- Run `pnpm typecheck` and `pnpm lint` as you go; they take seconds.

### Deliberate deviation from the spec

The spec describes the multiband crossover as `BiquadFilterNode` pairs feeding
an `AudioWorklet` detector. **Build the whole multiband stage inside one
worklet instead**, with its own biquads. Reasons: one node instead of eleven,
no latency misalignment between bands to reason about, and the crossover
becomes a pure function a test can prove reconstructs flat. Note this in the
commit that introduces it.

The spec also lists an **input trim** `GainNode` as stage 1. It is dropped:
nothing in the chain needs it that the maximizer's ceiling and the bands'
makeup do not already cover, and a control that duplicates two others is a
control the user has to think about for nothing. If a real need for it
appears, it is one field in `IDspSettings` and one node in the graph.

---

### Task 1: Chain description and presets

**Files:**

- Create: `src/common/dsp/chain.ts`
- Create: `src/common/dsp/presets.ts`
- Test: `src/__tests__/unit_tests/common/dspChain.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `IDspSettings`, `DSP_DEFAULTS`, `clampDspSettings(value: unknown): IDspSettings`, `DSP_PRESETS: IDspPreset[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { DSP_DEFAULTS, clampDspSettings, IDspSettings } from 'common/dsp/chain';
import { DSP_PRESETS } from 'common/dsp/presets';

describe('dsp chain settings', () => {
  it('defaults to every module bypassed', () => {
    expect(DSP_DEFAULTS.exciter.enabled).toBe(false);
    expect(DSP_DEFAULTS.compressor.enabled).toBe(false);
    expect(DSP_DEFAULTS.maximizer.enabled).toBe(false);
  });

  it('clamps out-of-range values rather than rejecting them', () => {
    const clamped = clampDspSettings({
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, drive: 999 },
    });
    expect(clamped.exciter.drive).toBe(10);
  });

  it('replaces an unreadable blob with the defaults', () => {
    expect(clampDspSettings('nonsense')).toEqual(DSP_DEFAULTS);
  });

  it('round-trips through JSON unchanged', () => {
    const parsed: IDspSettings = clampDspSettings(
      JSON.parse(JSON.stringify(DSP_DEFAULTS)),
    );
    expect(parsed).toEqual(DSP_DEFAULTS);
  });

  it('ships presets that all survive clamping unchanged', () => {
    DSP_PRESETS.forEach((preset) => {
      expect(clampDspSettings(preset.settings)).toEqual(preset.settings);
    });
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm test:unit --testPathPattern dspChain`
Expected: FAIL — `Cannot find module 'common/dsp/chain'`.

- [ ] **Step 3: Write `src/common/dsp/chain.ts`**

Open with the GPL header block copied from `src/common/voicing.ts`.

```ts
/**
 * What the DSP chain is, as data.
 *
 * Declarative because two very different things build from it: the live
 * `AudioContext` graph and the `OfflineAudioContext` render. A shape both
 * read is the only way those two cannot drift apart.
 *
 * Everything defaults to bypassed. A DSP tab that colours the sound the
 * moment it is opened is one the user did not ask for.
 */
export interface IExciterSettings {
  enabled: boolean;
  /** Corner above which harmonics are generated, Hz. */
  crossoverHz: number;
  /** Shaper drive. 1 is nearly linear, 10 is obvious. */
  drive: number;
  /** How much of the shaped band is mixed back, 0-1. */
  mix: number;
}

export interface ICompressorSettings {
  enabled: boolean;
  /** The two crossover corners that make three bands, Hz, ascending. */
  crossoverHz: readonly [number, number];
  /** Per band, low to high. */
  bands: readonly IBandSettings[];
}

export interface IBandSettings {
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
}

export interface IMaximizerSettings {
  enabled: boolean;
  /** Output ceiling in dBFS. Never above 0. */
  ceilingDb: number;
  /** Look-ahead in milliseconds. */
  lookAheadMs: number;
  releaseMs: number;
}

export interface IDspSettings {
  exciter: IExciterSettings;
  compressor: ICompressorSettings;
  maximizer: IMaximizerSettings;
}

interface IRange {
  min: number;
  max: number;
}

const RANGES = {
  exciterCrossoverHz: { min: 1_000, max: 12_000 },
  exciterDrive: { min: 1, max: 10 },
  exciterMix: { min: 0, max: 1 },
  compressorLowHz: { min: 60, max: 600 },
  compressorHighHz: { min: 1_000, max: 10_000 },
  thresholdDb: { min: -60, max: 0 },
  ratio: { min: 1, max: 20 },
  attackMs: { min: 0.1, max: 200 },
  releaseMs: { min: 5, max: 2_000 },
  makeupDb: { min: 0, max: 24 },
  ceilingDb: { min: -12, max: 0 },
  lookAheadMs: { min: 0, max: 20 },
  maximizerReleaseMs: { min: 5, max: 1_000 },
} as const satisfies Record<string, IRange>;

const clampNumber = (
  value: unknown,
  range: IRange,
  fallback: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : fallback;

const clampBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const DEFAULT_BAND: IBandSettings = {
  thresholdDb: -18,
  ratio: 2,
  attackMs: 10,
  releaseMs: 120,
  makeupDb: 0,
};

export const DSP_DEFAULTS: IDspSettings = {
  exciter: { enabled: false, crossoverHz: 6_000, drive: 3, mix: 0.3 },
  compressor: {
    enabled: false,
    crossoverHz: [200, 3_000],
    bands: [DEFAULT_BAND, DEFAULT_BAND, DEFAULT_BAND],
  },
  maximizer: {
    enabled: false,
    ceilingDb: -1,
    lookAheadMs: 5,
    releaseMs: 100,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clampBand = (value: unknown, fallback: IBandSettings): IBandSettings => {
  if (!isRecord(value)) {
    return fallback;
  }
  return {
    thresholdDb: clampNumber(
      value.thresholdDb,
      RANGES.thresholdDb,
      fallback.thresholdDb,
    ),
    ratio: clampNumber(value.ratio, RANGES.ratio, fallback.ratio),
    attackMs: clampNumber(value.attackMs, RANGES.attackMs, fallback.attackMs),
    releaseMs: clampNumber(
      value.releaseMs,
      RANGES.releaseMs,
      fallback.releaseMs,
    ),
    makeupDb: clampNumber(value.makeupDb, RANGES.makeupDb, fallback.makeupDb),
  };
};

/**
 * Read a settings blob from anywhere and return something usable.
 *
 * Clamps rather than rejects, and falls back per field rather than wholesale:
 * a stored preset from a future build with one unknown value should not cost
 * the user every other setting in it.
 */
export const clampDspSettings = (value: unknown): IDspSettings => {
  if (!isRecord(value)) {
    return DSP_DEFAULTS;
  }
  const exciter = isRecord(value.exciter) ? value.exciter : {};
  const compressor = isRecord(value.compressor) ? value.compressor : {};
  const maximizer = isRecord(value.maximizer) ? value.maximizer : {};
  const storedBands = Array.isArray(compressor.bands) ? compressor.bands : [];
  const storedCorners = Array.isArray(compressor.crossoverHz)
    ? compressor.crossoverHz
    : [];
  return {
    exciter: {
      enabled: clampBoolean(exciter.enabled, DSP_DEFAULTS.exciter.enabled),
      crossoverHz: clampNumber(
        exciter.crossoverHz,
        RANGES.exciterCrossoverHz,
        DSP_DEFAULTS.exciter.crossoverHz,
      ),
      drive: clampNumber(
        exciter.drive,
        RANGES.exciterDrive,
        DSP_DEFAULTS.exciter.drive,
      ),
      mix: clampNumber(
        exciter.mix,
        RANGES.exciterMix,
        DSP_DEFAULTS.exciter.mix,
      ),
    },
    compressor: {
      enabled: clampBoolean(
        compressor.enabled,
        DSP_DEFAULTS.compressor.enabled,
      ),
      crossoverHz: [
        clampNumber(
          storedCorners[0],
          RANGES.compressorLowHz,
          DSP_DEFAULTS.compressor.crossoverHz[0],
        ),
        clampNumber(
          storedCorners[1],
          RANGES.compressorHighHz,
          DSP_DEFAULTS.compressor.crossoverHz[1],
        ),
      ],
      bands: DSP_DEFAULTS.compressor.bands.map((fallback, index) =>
        clampBand(storedBands[index], fallback),
      ),
    },
    maximizer: {
      enabled: clampBoolean(maximizer.enabled, DSP_DEFAULTS.maximizer.enabled),
      ceilingDb: clampNumber(
        maximizer.ceilingDb,
        RANGES.ceilingDb,
        DSP_DEFAULTS.maximizer.ceilingDb,
      ),
      lookAheadMs: clampNumber(
        maximizer.lookAheadMs,
        RANGES.lookAheadMs,
        DSP_DEFAULTS.maximizer.lookAheadMs,
      ),
      releaseMs: clampNumber(
        maximizer.releaseMs,
        RANGES.maximizerReleaseMs,
        DSP_DEFAULTS.maximizer.releaseMs,
      ),
    },
  };
};
```

- [ ] **Step 4: Write `src/common/dsp/presets.ts`**

GPL header, then:

```ts
import { DSP_DEFAULTS, IDspSettings } from './chain';

export interface IDspPreset {
  id: string;
  /** i18n key for the display name; never a literal. */
  labelKey: string;
  settings: IDspSettings;
}

/**
 * Factory presets, named for what they are for rather than for a sound.
 *
 * `lossy-repair` is the one this feature was asked for: a 96 kbps file is
 * dull above 8 kHz and flat in the middle, so the exciter works high and the
 * compressor lifts the low-mid band only.
 */
export const DSP_PRESETS: IDspPreset[] = [
  {
    id: 'flat',
    labelKey: 'dsp.preset.flat',
    settings: DSP_DEFAULTS,
  },
  {
    id: 'lossy-repair',
    labelKey: 'dsp.preset.lossyRepair',
    settings: {
      exciter: { enabled: true, crossoverHz: 7_000, drive: 4, mix: 0.35 },
      compressor: {
        enabled: true,
        crossoverHz: [200, 3_000],
        bands: [
          {
            thresholdDb: -20,
            ratio: 2,
            attackMs: 20,
            releaseMs: 200,
            makeupDb: 1,
          },
          {
            thresholdDb: -18,
            ratio: 2.5,
            attackMs: 10,
            releaseMs: 120,
            makeupDb: 2,
          },
          {
            thresholdDb: -16,
            ratio: 2,
            attackMs: 5,
            releaseMs: 80,
            makeupDb: 1,
          },
        ],
      },
      maximizer: {
        enabled: true,
        ceilingDb: -1,
        lookAheadMs: 5,
        releaseMs: 100,
      },
    },
  },
  {
    id: 'loud',
    labelKey: 'dsp.preset.loud',
    settings: {
      exciter: { enabled: true, crossoverHz: 5_000, drive: 5, mix: 0.4 },
      compressor: {
        enabled: true,
        crossoverHz: [150, 2_500],
        bands: [
          {
            thresholdDb: -24,
            ratio: 4,
            attackMs: 15,
            releaseMs: 150,
            makeupDb: 3,
          },
          {
            thresholdDb: -22,
            ratio: 4,
            attackMs: 8,
            releaseMs: 100,
            makeupDb: 3,
          },
          {
            thresholdDb: -20,
            ratio: 3,
            attackMs: 3,
            releaseMs: 60,
            makeupDb: 2,
          },
        ],
      },
      maximizer: {
        enabled: true,
        ceilingDb: -0.5,
        lookAheadMs: 8,
        releaseMs: 60,
      },
    },
  },
];
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `pnpm test:unit --testPathPattern dspChain`
Expected: PASS, 5 tests.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/common/dsp src/__tests__/unit_tests/common/dspChain.test.ts
git commit -m "The chain as data, so the live graph and the render cannot drift"
```

---

### Task 2: The exciter curve, with a positive control

**Files:**

- Create: `src/renderer/dsp/exciter.ts`
- Test: `src/__tests__/unit_tests/renderer/dspExciter.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `buildShaperCurve(drive: number, samples?: number): Float32Array`.

The test proves the curve **generates harmonics that were not in the input**.
A null test alone cannot: a curve that outputs silence, and a curve that
outputs its input unchanged, both "find no harmonics". The identity control is
what separates those from a working shaper. This is the failure mode that let
the separation packing bug pass a perfect-looking null test.

`separationFft` from `common/karaoke/separationDsp` is the FFT — reuse it
rather than writing another.

- [ ] **Step 1: Write the failing test**

```ts
import { separationFft } from 'common/karaoke/separationDsp';
import { buildShaperCurve } from '../../../renderer/dsp/exciter';

const SIZE = 2048;
const BIN = 64;

/** One period-locked sine, so its energy lands in exactly one bin. */
const sine = (): Float64Array => {
  const out = new Float64Array(SIZE);
  for (let i = 0; i < SIZE; i += 1) {
    out[i] = Math.sin((2 * Math.PI * BIN * i) / SIZE) * 0.5;
  }
  return out;
};

/** Push a signal through a WaveShaper curve the way Web Audio does. */
const shape = (input: Float64Array, curve: Float32Array): Float64Array => {
  const out = new Float64Array(input.length);
  const last = curve.length - 1;
  for (let i = 0; i < input.length; i += 1) {
    const position = (Math.max(-1, Math.min(1, input[i])) + 1) * 0.5 * last;
    const lower = Math.floor(position);
    const upper = Math.min(last, lower + 1);
    const fraction = position - lower;
    out[i] = curve[lower] * (1 - fraction) + curve[upper] * fraction;
  }
  return out;
};

const magnitudeAt = (signal: Float64Array, bin: number): number => {
  const real = Float64Array.from(signal);
  const imaginary = new Float64Array(signal.length);
  separationFft(real, imaginary);
  return Math.hypot(real[bin], imaginary[bin]) / signal.length;
};

describe('exciter shaper curve', () => {
  it('POSITIVE CONTROL: an identity curve generates no harmonics', () => {
    const identity = new Float32Array(1024);
    for (let i = 0; i < identity.length; i += 1) {
      identity[i] = (i / (identity.length - 1)) * 2 - 1;
    }
    const output = shape(sine(), identity);
    expect(magnitudeAt(output, BIN)).toBeGreaterThan(0.2);
    expect(magnitudeAt(output, BIN * 3)).toBeLessThan(1e-3);
  });

  it('generates a third harmonic that was not in the input', () => {
    const output = shape(sine(), buildShaperCurve(6));
    expect(magnitudeAt(output, BIN * 3)).toBeGreaterThan(1e-2);
  });

  it('generates more harmonic energy as drive rises', () => {
    const gentle = magnitudeAt(shape(sine(), buildShaperCurve(2)), BIN * 3);
    const hard = magnitudeAt(shape(sine(), buildShaperCurve(9)), BIN * 3);
    expect(hard).toBeGreaterThan(gentle);
  });

  it('never leaves the -1..1 range a WaveShaper expects', () => {
    const curve = buildShaperCurve(10);
    curve.forEach((value) => {
      expect(Math.abs(value)).toBeLessThanOrEqual(1);
    });
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm test:unit --testPathPattern dspExciter`
Expected: FAIL — `Cannot find module '../../../renderer/dsp/exciter'`.

- [ ] **Step 3: Write `src/renderer/dsp/exciter.ts`**

GPL header, then:

```ts
/** Samples in the transfer curve. 1024 is inaudibly fine and cheap to build. */
const CURVE_SAMPLES = 1024;

/**
 * The exciter's transfer curve.
 *
 * `tanh` normalised to its own endpoint, so the curve always spans exactly
 * -1..1 whatever the drive — an un-normalised `tanh` compresses the output
 * level as drive rises, and the level drop reads to the ear as the effect
 * doing nothing.
 *
 * Symmetric, so it generates odd harmonics. That is deliberate: odd harmonics
 * on a high band read as air and presence, while the even harmonics an
 * asymmetric curve adds read as warmth lower down, which is not what this
 * stage is for.
 *
 * This is the one module in the chain Equalizer APO could never host. Every
 * APO command is linear, and no linear operation produces a frequency that
 * was not in its input.
 */
export const buildShaperCurve = (
  drive: number,
  samples: number = CURVE_SAMPLES,
): Float32Array => {
  const curve = new Float32Array(samples);
  const last = samples - 1;
  const normalise = Math.tanh(drive);
  for (let i = 0; i < samples; i += 1) {
    const x = (i / last) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / normalise;
  }
  return curve;
};
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm test:unit --testPathPattern dspExciter`
Expected: PASS, 4 tests. If the identity control fails, the test harness is
wrong, not the curve — fix the harness before touching `exciter.ts`.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/renderer/dsp/exciter.ts src/__tests__/unit_tests/renderer/dspExciter.test.ts
git commit -m "A curve that invents a harmonic, and an identity curve proving the test can tell"
```

---

### Task 3: The look-ahead limiter core

**Files:**

- Create: `src/renderer/dsp/limiter.ts`
- Test: `src/__tests__/unit_tests/renderer/dspLimiter.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `createLimiterState(lookAheadSamples: number): ILimiterState`, `processLimiter(state: ILimiterState, input: Float32Array, output: Float32Array, options: ILimiterOptions): void` where `ILimiterOptions` is `{ ceiling: number; releaseCoefficient: number }`.

Pure and stateful-by-argument so a worklet can hold the state across blocks
and a test can drive it block by block.

- [ ] **Step 1: Write the failing test**

```ts
import {
  createLimiterState,
  processLimiter,
} from '../../../renderer/dsp/limiter';

const LOOK_AHEAD = 64;
const CEILING = 0.5;
const OPTIONS = { ceiling: CEILING, releaseCoefficient: 0.999 };

const run = (input: Float32Array): Float32Array => {
  const state = createLimiterState(LOOK_AHEAD);
  const output = new Float32Array(input.length);
  processLimiter(state, input, output, OPTIONS);
  return output;
};

describe('look-ahead limiter', () => {
  it('NULL TEST: a signal already under the ceiling comes back unchanged', () => {
    const input = new Float32Array(1024);
    for (let i = 0; i < input.length; i += 1) {
      input[i] = Math.sin(i / 10) * 0.2;
    }
    const output = run(input);
    for (let i = LOOK_AHEAD; i < input.length; i += 1) {
      expect(output[i]).toBeCloseTo(input[i - LOOK_AHEAD], 5);
    }
  });

  it('POSITIVE CONTROL: a signal over the ceiling is changed', () => {
    const input = new Float32Array(1024).fill(0.9);
    const output = run(input);
    const tail = output.subarray(LOOK_AHEAD + 32);
    expect(Math.max(...tail)).toBeLessThanOrEqual(CEILING + 1e-6);
    expect(Math.max(...tail)).toBeGreaterThan(0);
  });

  it('is already turned down when the transient arrives', () => {
    const input = new Float32Array(1024);
    input[512] = 1;
    const output = run(input);
    expect(Math.max(...output)).toBeLessThanOrEqual(CEILING + 1e-6);
  });

  it('does not clip a negative peak either', () => {
    const input = new Float32Array(1024).fill(-0.9);
    const output = run(input);
    const tail = output.subarray(LOOK_AHEAD + 32);
    expect(Math.min(...tail)).toBeGreaterThanOrEqual(-CEILING - 1e-6);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm test:unit --testPathPattern dspLimiter`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/renderer/dsp/limiter.ts`**

GPL header, then:

```ts
export interface ILimiterState {
  /** Circular delay line holding the look-ahead. */
  delay: Float32Array;
  writeIndex: number;
  /** Current gain reduction, 0-1. Held across blocks. */
  gain: number;
}

export interface ILimiterOptions {
  /** Linear amplitude, not dB. */
  ceiling: number;
  /** Per-sample gain recovery, 0-1. Closer to 1 releases more slowly. */
  releaseCoefficient: number;
}

export const createLimiterState = (
  lookAheadSamples: number,
): ILimiterState => ({
  delay: new Float32Array(Math.max(1, lookAheadSamples)),
  writeIndex: 0,
  gain: 1,
});

/**
 * Limit `input` into `output`, delayed by the look-ahead.
 *
 * The delay is the whole point and it is not an implementation detail: the
 * gain has to be down BEFORE the peak arrives, and the only way to know a
 * peak is coming is to be listening ahead of what you are emitting. A
 * limiter without it either clips the transient or pumps audibly.
 *
 * Attack is therefore instantaneous by construction — the gain is computed
 * from the sample entering the delay line and applied to the sample leaving
 * it, so it is fully applied by the time that sample is heard.
 */
export const processLimiter = (
  state: ILimiterState,
  input: Float32Array,
  output: Float32Array,
  { ceiling, releaseCoefficient }: ILimiterOptions,
): void => {
  const { delay } = state;
  const length = delay.length;
  for (let i = 0; i < input.length; i += 1) {
    const incoming = input[i];
    const delayed = delay[state.writeIndex];
    delay[state.writeIndex] = incoming;
    state.writeIndex = (state.writeIndex + 1) % length;

    const magnitude = Math.abs(incoming);
    const required = magnitude > ceiling ? ceiling / magnitude : 1;
    state.gain =
      required < state.gain
        ? required
        : state.gain + (1 - state.gain) * (1 - releaseCoefficient);

    output[i] = delayed * state.gain;
  }
};
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm test:unit --testPathPattern dspLimiter`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/renderer/dsp/limiter.ts src/__tests__/unit_tests/renderer/dspLimiter.test.ts
git commit -m "The gain is down before the peak arrives, which is the only thing look-ahead is for"
```

---

### Task 4: Crossover and multiband compressor core

**Files:**

- Create: `src/renderer/dsp/crossover.ts`
- Create: `src/renderer/dsp/compressor.ts`
- Test: `src/__tests__/unit_tests/renderer/dspCompressor.test.ts`

**Interfaces:**

- Consumes: `IBandSettings` from `common/dsp/chain`.
- Produces: `createCrossoverState(): ICrossoverState`, `splitBands(state, input, low, mid, high, corners, sampleRate): void`, `createCompressorState(): ICompressorState`, `processBand(state, buffer, settings, sampleRate): void`.

The crossover test is the strong one: **the three bands must sum back to the
input**. A crossover that drops or doubles energy fails it immediately, and no
listening test would have caught a 1 dB dip at the corner.

- [ ] **Step 1: Write the failing test**

```ts
import {
  createCrossoverState,
  splitBands,
} from '../../../renderer/dsp/crossover';
import {
  createCompressorState,
  processBand,
} from '../../../renderer/dsp/compressor';

const RATE = 48_000;
const CORNERS: readonly [number, number] = [200, 3_000];

describe('linkwitz-riley crossover', () => {
  it('sums its three bands back to the input', () => {
    const input = new Float32Array(4_096);
    for (let i = 0; i < input.length; i += 1) {
      input[i] = Math.sin(i / 3) * 0.3 + Math.sin(i / 40) * 0.3;
    }
    const low = new Float32Array(input.length);
    const mid = new Float32Array(input.length);
    const high = new Float32Array(input.length);
    splitBands(createCrossoverState(), input, low, mid, high, CORNERS, RATE);
    // The filters need a few hundred samples to settle; compare the tail.
    for (let i = 1_024; i < input.length; i += 1) {
      expect(low[i] + mid[i] + high[i]).toBeCloseTo(input[i], 2);
    }
  });
});

describe('band compressor', () => {
  const SETTINGS = {
    thresholdDb: -20,
    ratio: 4,
    attackMs: 1,
    releaseMs: 50,
    makeupDb: 0,
  };

  it('NULL TEST: a signal below threshold passes through unchanged', () => {
    const buffer = new Float32Array(2_048).fill(0.01);
    const before = Float32Array.from(buffer);
    processBand(createCompressorState(), buffer, SETTINGS, RATE);
    buffer.forEach((value, index) => {
      expect(value).toBeCloseTo(before[index], 5);
    });
  });

  it('POSITIVE CONTROL: a signal above threshold is turned down', () => {
    const buffer = new Float32Array(2_048).fill(0.5);
    processBand(createCompressorState(), buffer, SETTINGS, RATE);
    // Well past the 1ms attack, so the gain has settled.
    expect(buffer[2_000]).toBeLessThan(0.4);
    expect(buffer[2_000]).toBeGreaterThan(0);
  });

  it('makeup gain lifts the whole band', () => {
    const buffer = new Float32Array(2_048).fill(0.01);
    processBand(
      createCompressorState(),
      buffer,
      { ...SETTINGS, makeupDb: 6 },
      RATE,
    );
    expect(buffer[2_000]).toBeGreaterThan(0.019);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm test:unit --testPathPattern dspCompressor`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/renderer/dsp/crossover.ts`**

GPL header, then a Linkwitz-Riley 4th-order split. Each LR4 is two identical
Butterworth biquads (Q = 1/√2) in series. The high band is derived by
subtraction so the sum reconstructs exactly, which is what the test demands.

```ts
interface IBiquadState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface IBiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export interface ICrossoverState {
  lowStages: IBiquadState[];
  midStages: IBiquadState[];
}

const BUTTERWORTH_Q = Math.SQRT1_2;

const emptyStage = (): IBiquadState => ({ x1: 0, x2: 0, y1: 0, y2: 0 });

export const createCrossoverState = (): ICrossoverState => ({
  lowStages: [emptyStage(), emptyStage()],
  midStages: [emptyStage(), emptyStage()],
});

const lowpassCoefficients = (
  frequency: number,
  sampleRate: number,
): IBiquadCoefficients => {
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * BUTTERWORTH_Q);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cosine) / 2 / a0,
    b1: (1 - cosine) / a0,
    b2: (1 - cosine) / 2 / a0,
    a1: (-2 * cosine) / a0,
    a2: (1 - alpha) / a0,
  };
};

const runBiquad = (
  state: IBiquadState,
  coefficients: IBiquadCoefficients,
  sample: number,
): number => {
  const { b0, b1, b2, a1, a2 } = coefficients;
  const y =
    b0 * sample + b1 * state.x1 + b2 * state.x2 - a1 * state.y1 - a2 * state.y2;
  state.x2 = state.x1;
  state.x1 = sample;
  state.y2 = state.y1;
  state.y1 = y;
  return y;
};

/**
 * Split into three bands that sum back to the input.
 *
 * Only the two lowpasses are filters; the bands above them are subtractions.
 * A pair of independent lowpass/highpass filters would each contribute their
 * own phase shift and the sum would dip at the corner — a 1 dB notch nobody
 * would hear as a bug but everyone would hear as "thin". Subtraction cannot
 * dip, because the parts are defined as the whole minus the rest.
 */
export const splitBands = (
  state: ICrossoverState,
  input: Float32Array,
  low: Float32Array,
  mid: Float32Array,
  high: Float32Array,
  corners: readonly [number, number],
  sampleRate: number,
): void => {
  const lowCoefficients = lowpassCoefficients(corners[0], sampleRate);
  const midCoefficients = lowpassCoefficients(corners[1], sampleRate);
  for (let i = 0; i < input.length; i += 1) {
    const sample = input[i];
    let lowBand = sample;
    state.lowStages.forEach((stage) => {
      lowBand = runBiquad(stage, lowCoefficients, lowBand);
    });
    let belowHigh = sample;
    state.midStages.forEach((stage) => {
      belowHigh = runBiquad(stage, midCoefficients, belowHigh);
    });
    low[i] = lowBand;
    mid[i] = belowHigh - lowBand;
    high[i] = sample - belowHigh;
  }
};
```

- [ ] **Step 4: Write `src/renderer/dsp/compressor.ts`**

```ts
import { IBandSettings } from '../../common/dsp/chain';

export interface ICompressorState {
  /** Smoothed gain reduction, 0-1, held across blocks. */
  gain: number;
}

export const createCompressorState = (): ICompressorState => ({ gain: 1 });

const dbToLinear = (db: number): number => 10 ** (db / 20);

/** Per-sample smoothing coefficient for a time constant in milliseconds. */
const coefficientFor = (milliseconds: number, sampleRate: number): number =>
  Math.exp(-1 / ((milliseconds / 1_000) * sampleRate));

/**
 * Compress one band in place.
 *
 * Feed-forward: the gain is computed from the input level, not from the
 * output, so the ratio means what it says at every level instead of drifting
 * with the reduction already applied.
 */
export const processBand = (
  state: ICompressorState,
  buffer: Float32Array,
  settings: IBandSettings,
  sampleRate: number,
): void => {
  const threshold = dbToLinear(settings.thresholdDb);
  const makeup = dbToLinear(settings.makeupDb);
  const attack = coefficientFor(settings.attackMs, sampleRate);
  const release = coefficientFor(settings.releaseMs, sampleRate);
  for (let i = 0; i < buffer.length; i += 1) {
    const magnitude = Math.abs(buffer[i]);
    let target = 1;
    if (magnitude > threshold && magnitude > 0) {
      const over = magnitude / threshold;
      target = over ** (1 / settings.ratio - 1);
    }
    const coefficient = target < state.gain ? attack : release;
    state.gain = target + (state.gain - target) * coefficient;
    buffer[i] *= state.gain * makeup;
  }
};
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `pnpm test:unit --testPathPattern dspCompressor`
Expected: PASS, 4 tests.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/renderer/dsp/crossover.ts src/renderer/dsp/compressor.ts src/__tests__/unit_tests/renderer/dspCompressor.test.ts
git commit -m "Bands defined as the whole minus the rest, because a subtraction cannot dip at the corner"
```

---

### Task 5: The worklet processors

**Files:**

- Create: `src/renderer/dsp/worklets/dspProcessor.worklet.ts`
- Modify: `.erb/configs/webpack.config.renderer.dev.ts` (entry block, around line 80)
- Modify: `.erb/configs/webpack.config.renderer.prod.ts` (same entry block)

**Interfaces:**

- Consumes: everything from Tasks 2–4.
- Produces: a registered processor named `fluideq-dsp`, accepting
  `{ settings: IDspSettings }` on its `port`.

One worklet holds the whole chain. Two reasons: the exciter's `WaveShaperNode`
is the only native node worth keeping, and splitting the compressor across
eleven nodes would mean reasoning about per-band latency alignment that a
single processor simply does not have.

- [ ] **Step 1: Write the processor**

GPL header, then:

```ts
/// <reference types="@types/audioworklet" />
import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
} from '../../../common/dsp/chain';
import { createCrossoverState, splitBands } from '../crossover';
import { createCompressorState, processBand } from '../compressor';
import { createLimiterState, processLimiter } from '../limiter';

/**
 * The whole chain in one processor.
 *
 * Settings arrive over the port rather than as `AudioParam`s because they are
 * a structured object, and because a change to any of them is a user turning
 * a knob — not something that needs sample-accurate automation.
 */
class DspProcessor extends AudioWorkletProcessor {
  private settings: IDspSettings = DSP_DEFAULTS;

  private readonly crossovers = [
    createCrossoverState(),
    createCrossoverState(),
  ];

  private readonly compressors = [
    [createCompressorState(), createCompressorState(), createCompressorState()],
    [createCompressorState(), createCompressorState(), createCompressorState()],
  ];

  private limiters = [createLimiterState(1), createLimiterState(1)];

  private lookAheadSamples = 1;

  private low = new Float32Array(128);

  private mid = new Float32Array(128);

  private high = new Float32Array(128);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      this.settings = clampDspSettings(event.data);
      const samples = Math.max(
        1,
        Math.round((this.settings.maximizer.lookAheadMs / 1_000) * sampleRate),
      );
      if (samples !== this.lookAheadSamples) {
        this.lookAheadSamples = samples;
        this.limiters = [
          createLimiterState(samples),
          createLimiterState(samples),
        ];
      }
    };
  }

  private ensureScratch(length: number): void {
    if (this.low.length === length) {
      return;
    }
    this.low = new Float32Array(length);
    this.mid = new Float32Array(length);
    this.high = new Float32Array(length);
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    const { compressor, maximizer } = this.settings;
    for (let channel = 0; channel < output.length; channel += 1) {
      const source = input[Math.min(channel, input.length - 1)];
      const target = output[channel];
      if (!source) {
        target.fill(0);
        continue;
      }
      target.set(source);
      this.ensureScratch(target.length);

      if (compressor.enabled) {
        splitBands(
          this.crossovers[Math.min(channel, 1)],
          target,
          this.low,
          this.mid,
          this.high,
          compressor.crossoverHz,
          sampleRate,
        );
        const states = this.compressors[Math.min(channel, 1)];
        const bands = [this.low, this.mid, this.high];
        bands.forEach((band, index) => {
          processBand(states[index], band, compressor.bands[index], sampleRate);
        });
        for (let i = 0; i < target.length; i += 1) {
          target[i] = this.low[i] + this.mid[i] + this.high[i];
        }
      }

      if (maximizer.enabled) {
        const ceiling = 10 ** (maximizer.ceilingDb / 20);
        const releaseCoefficient = Math.exp(
          -1 / ((maximizer.releaseMs / 1_000) * sampleRate),
        );
        processLimiter(this.limiters[Math.min(channel, 1)], target, target, {
          ceiling,
          releaseCoefficient,
        });
      }
    }
    return true;
  }
}

registerProcessor('fluideq-dsp', DspProcessor);
```

- [ ] **Step 2: Add the webpack entry**

In **both** `.erb/configs/webpack.config.renderer.dev.ts` and
`.erb/configs/webpack.config.renderer.prod.ts`, add to the `entry` object
beside `'karaoke-whisper-worker'`:

```ts
    'dsp-worklet': path.join(
      webpackPaths.srcRendererPath,
      'dsp/worklets/dspProcessor.worklet.ts',
    ),
```

- [ ] **Step 3: Install the worklet types**

```bash
pnpm add -w -D @types/audioworklet
```

`-w` is required at the workspace root or pnpm refuses.

- [ ] **Step 4: Verify it builds**

Run: `pnpm typecheck && pnpm build:renderer`
Expected: both succeed, and `dist/renderer/dsp-worklet.js` exists.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/dsp/worklets .erb/configs package.json pnpm-lock.yaml
git commit -m "One processor for the whole chain, so no band can drift out of alignment with another"
```

---

### Task 6: The graph builder

**Files:**

- Create: `src/renderer/dsp/graph.ts`
- Test: `src/__tests__/unit_tests/renderer/dspGraph.test.ts`

**Interfaces:**

- Consumes: `IDspSettings`, `buildShaperCurve`.
- Produces: `buildDspGraph(context: IAudioGraphContext, source: IAudioNodeLike, worklet: IWorkletNodeLike, destination: IAudioNodeLike, settings: IDspSettings): IDspGraph`, plus the structural interfaces in Step 3 which Tasks 7 and 10 import by name.

jsdom has no Web Audio at all, so the builder is typed against a structural
interface and tested with a fake — the same reason and the same shape as
`IMirrorSink` in `src/renderer/audio/outputMirror.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { buildDspGraph } from '../../../renderer/dsp/graph';

const fakeNode = () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
});

const fakeWorklet = () => ({
  ...fakeNode(),
  port: { postMessage: jest.fn() },
});

const fakeContext = () => ({
  sampleRate: 48_000,
  createGain: jest.fn(() => ({ ...fakeNode(), gain: { value: 1 } })),
  createWaveShaper: jest.fn(() => ({ ...fakeNode(), curve: null })),
  createBiquadFilter: jest.fn(() => ({
    ...fakeNode(),
    type: 'highpass',
    frequency: { value: 0 },
  })),
});

describe('dsp graph', () => {
  it('connects source onward even with everything bypassed', () => {
    const context = fakeContext();
    const source = fakeNode();
    buildDspGraph(context, source, fakeWorklet(), fakeNode(), DSP_DEFAULTS);
    expect(source.connect).toHaveBeenCalled();
  });

  it('posts the settings to the worklet', () => {
    const worklet = fakeWorklet();
    buildDspGraph(fakeContext(), fakeNode(), worklet, fakeNode(), DSP_DEFAULTS);
    expect(worklet.port.postMessage).toHaveBeenCalledWith(DSP_DEFAULTS);
  });

  it('builds no shaper while the exciter is off', () => {
    const context = fakeContext();
    buildDspGraph(context, fakeNode(), fakeWorklet(), fakeNode(), DSP_DEFAULTS);
    expect(context.createWaveShaper).not.toHaveBeenCalled();
  });

  it('builds a shaper once the exciter is on', () => {
    const context = fakeContext();
    buildDspGraph(context, fakeNode(), fakeWorklet(), fakeNode(), {
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true },
    });
    expect(context.createWaveShaper).toHaveBeenCalledTimes(1);
  });

  it('disconnects everything it made when disposed', () => {
    const source = fakeNode();
    const graph = buildDspGraph(
      fakeContext(),
      source,
      fakeWorklet(),
      fakeNode(),
      DSP_DEFAULTS,
    );
    graph.dispose();
    expect(source.disconnect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm test:unit --testPathPattern dspGraph`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/renderer/dsp/graph.ts`**

The structural interfaces, verbatim — later tasks import these names:

```ts
export interface IAudioNodeLike {
  connect(destination: IAudioNodeLike): unknown;
  disconnect(): void;
}

export interface IAudioParamLike {
  value: number;
}

export interface IGainNodeLike extends IAudioNodeLike {
  gain: IAudioParamLike;
}

export interface IShaperNodeLike extends IAudioNodeLike {
  curve: Float32Array | null;
}

export interface IFilterNodeLike extends IAudioNodeLike {
  type: string;
  frequency: IAudioParamLike;
}

export interface IAudioGraphContext {
  sampleRate: number;
  createGain(): IGainNodeLike;
  createWaveShaper(): IShaperNodeLike;
  createBiquadFilter(): IFilterNodeLike;
}

export interface IDspGraph {
  update(settings: IDspSettings): void;
  dispose(): void;
}
```

The worklet node is passed in rather than created here, because
`addModule` is asynchronous and a builder that returns a promise cannot be
called from a render. `useDspEngine` awaits the module and hands the node
over. Extend `buildDspGraph`'s signature with a `worklet: IAudioNodeLike &
{ port: { postMessage(value: unknown): void } }` parameter.

Then build:

- exciter, when enabled: a highpass `BiquadFilterNode` at `crossoverHz` into a
  `WaveShaperNode` carrying `buildShaperCurve(drive)`, into a wet `GainNode` at
  `mix`, summed with a dry `GainNode` at `1`
- the `AudioWorkletNode` named `fluideq-dsp`, always present, settings posted
  over its port
- a final output `GainNode`

`update()` re-posts settings to the worklet and rebuilds only the exciter
subgraph when its enabled flag flips. `dispose()` disconnects every node the
builder created, source included.

Keep the file under 500 lines; if it approaches that, split the exciter
subgraph into `src/renderer/dsp/exciterGraph.ts`.

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm test:unit --testPathPattern dspGraph`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/renderer/dsp/graph.ts src/__tests__/unit_tests/renderer/dspGraph.test.ts
git commit -m "A graph typed against what it needs, so jsdom can hold it without Web Audio"
```

---

### Task 7: Player insertion

**Files:**

- Create: `src/renderer/dsp/useDspEngine.ts`
- Modify: `src/renderer/library/player/LibraryPlayerContext.tsx` (the
  `audioElementRef` block, around line 228)
- Test: `src/__tests__/unit_tests/renderer/dspEngine.test.ts`

**Interfaces:**

- Consumes: `buildDspGraph`.
- Produces: `useDspEngine(element: HTMLAudioElement | undefined, settings: IDspSettings): { active: boolean }`.

**This is the task that can break playback.** Two rules the spec names:

1. `createMediaElementSource` may be called **once per element, ever**. A
   second call throws and the player goes silent. Create it in the same ref
   that holds the element and never rebuild it.
2. Routing the element into Web Audio takes it off the speakers. If
   `resume()` rejects, tear the graph down and leave the element unrouted
   rather than leaving a silent player.

- [ ] **Step 1: Write the failing test**

```ts
import { renderHook } from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { useDspEngine } from '../../../renderer/dsp/useDspEngine';

describe('useDspEngine', () => {
  it('reports inactive when there is no element', () => {
    const { result } = renderHook(() => useDspEngine(undefined, DSP_DEFAULTS));
    expect(result.current.active).toBe(false);
  });

  it('reports inactive when the context cannot be constructed', () => {
    const element = {} as HTMLAudioElement;
    const { result } = renderHook(() => useDspEngine(element, DSP_DEFAULTS));
    expect(result.current.active).toBe(false);
  });
});
```

jsdom provides no `AudioContext`, so the second test exercises the fallback
path — which is the one that must never leave the player silent.

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm test:unit --testPathPattern dspEngine`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

It must:

- do nothing at all when `window.AudioContext` is undefined, returning
  `{ active: false }`
- hold the `AudioContext` and the `MediaElementAudioSourceNode` in refs keyed
  to the element identity, creating the source exactly once
- `await context.resume()` before connecting, and on rejection call
  `graph.dispose()` and leave `active` false
- call `graph.update(settings)` when settings change, never rebuild
- dispose on unmount

- [ ] **Step 4: Wire it into the player**

In `LibraryPlayerContext.tsx`, call `useDspEngine(audioElementRef.current, dspSettings)`. Do not change how the element is created; the hook attaches to it.

- [ ] **Step 5: Run the whole player suite**

Run: `pnpm test:unit --testPathPattern "dspEngine|LibraryPlayerContext|NowPlayingBar"`
Expected: PASS. `LibraryPlayerContext.test.tsx` already exists and is the
regression net for playback — if it goes red, the insertion is wrong.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint
git add src/renderer/dsp/useDspEngine.ts src/renderer/library/player/LibraryPlayerContext.tsx src/__tests__/unit_tests/renderer/dspEngine.test.ts
git commit -m "One source node per element for its whole life, and no graph at all rather than a silent player"
```

---

### Task 8: Strings, all ten locales

**Files:**

- Create: `src/common/i18n/en/dsp.ts` and the same file under
  `de es fr hi it ja pt ru zh`
- Modify: `src/common/i18n/<locale>/index.ts` × 10

**Interfaces:**

- Produces: keys `dsp.title`, `dsp.scopeNotice`, `dsp.exciter.*`,
  `dsp.compressor.*`, `dsp.maximizer.*`, `dsp.preset.flat`,
  `dsp.preset.lossyRepair`, `dsp.preset.loud`, `dsp.render.*`, `tabs.dsp`.

- [ ] **Step 1: Write `src/common/i18n/en/dsp.ts`**

GPL header, then the dictionary. `dsp.scopeNotice` is the load-bearing one —
it is what stops a user believing this affects Spotify:

```ts
const dsp = {
  'dsp.title': 'DSP',
  'dsp.scopeNotice':
    'Applies to music played inside FluidEQ. It does not change Spotify, YouTube or other apps.',
  'dsp.preset.flat': 'Off',
  'dsp.preset.lossyRepair': 'Repair compressed',
  'dsp.preset.loud': 'Loud',
  'dsp.exciter.title': 'Exciter',
  'dsp.exciter.crossover': 'Above',
  'dsp.exciter.drive': 'Drive',
  'dsp.exciter.mix': 'Amount',
  'dsp.compressor.title': 'Multiband compressor',
  'dsp.compressor.threshold': 'Threshold',
  'dsp.compressor.ratio': 'Ratio',
  'dsp.compressor.attack': 'Attack',
  'dsp.compressor.release': 'Release',
  'dsp.compressor.makeup': 'Makeup',
  'dsp.maximizer.title': 'Maximizer',
  'dsp.maximizer.ceiling': 'Ceiling',
  'dsp.maximizer.lookAhead': 'Look-ahead',
  'dsp.maximizer.release': 'Release',
  'dsp.render.action': 'Save processed copy',
  'dsp.render.working': 'Rendering {percent}%',
  'dsp.render.cancel': 'Cancel',
  'dsp.render.done': 'Saved {name}',
  'tabs.dsp': 'DSP',
};

export default dsp;
```

- [ ] **Step 2: Translate into the other nine**

Same keys, same placeholders. `{percent}` and `{name}` must survive verbatim.

- [ ] **Step 3: Register in each index**

Add `import dsp from './dsp';` and spread `...dsp` into the exported object,
in all ten `index.ts` files.

- [ ] **Step 4: Verify no key is missing**

Run: `pnpm typecheck`
Expected: PASS. Non-English locales are `Partial<Dictionary>`, so a missing
key is not a type error — check by eye that all ten files have all keys.

- [ ] **Step 5: Commit**

```bash
git add src/common/i18n
git commit -m "The one string that stops this reading as a Spotify feature, in ten languages"
```

---

### Task 9: The panel and the tab

**Files:**

- Create: `src/renderer/dsp/DspPanel.tsx`
- Create: `src/renderer/styles/Dsp.scss`
- Modify: `src/renderer/App.tsx` — `TWorkspaceTab`, `WORKSPACE_TABS`,
  `EQ_GROUP_TABS`, `EQ_GROUP_LABEL_KEYS` (lines 152–226)
- Test: `src/__tests__/unit_tests/DspPanel.test.tsx`

**Interfaces:**

- Consumes: `DSP_PRESETS`, `useDspEngine`, `clampDspSettings`.
- Produces: default-exported `DspPanel`.

Rules from the spec that a test cannot enforce, so hold to them by hand:

- The scope notice is **visible text in the panel header**, not a tooltip.
- Suggested action wears `button small`; the decline wears `button small subtle`.
- Settings persist under `fluideq.dsp.v1`. They are **not** part of `IState` —
  nothing here reaches APO.

- [ ] **Step 1: Write the failing test**

```ts
import { render, screen } from '@testing-library/react';
import DspPanel from '../../renderer/dsp/DspPanel';

describe('DspPanel', () => {
  it('states its scope in visible text', () => {
    render(<DspPanel />);
    expect(screen.getByText(/does not change Spotify/i)).toBeInTheDocument();
  });

  it('offers every factory preset', () => {
    render(<DspPanel />);
    expect(screen.getByRole('button', { name: /Repair compressed/i })).toBeInTheDocument();
  });
});
```

Wrap in whatever provider `ConvolutionPanel.test.tsx` uses; copy that setup.

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm test:unit --testPathPattern DspPanel`

- [ ] **Step 3: Build the panel**

Follow `VoicingPanel.tsx` for structure: `useTranslation()` for every string,
`useFluidEqContext()` if global state is needed, a local SCSS import.

- [ ] **Step 4: Add the tab**

In `App.tsx`: add `'dsp'` to `TWorkspaceTab`, to `WORKSPACE_TABS` after
`'convolution'`, to `EQ_GROUP_TABS` after `'convolution'` and before
`'config'`, and `dsp: 'tabs.dsp'` to `EQ_GROUP_LABEL_KEYS`. The comment above
`EQ_GROUP_TABS` says "five tabs" — update it to six, and say why DSP joins
them despite not writing APO config.

- [ ] **Step 5: Run the tests**

Run: `pnpm test:unit --testPathPattern "DspPanel|App"`
Expected: PASS.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
pnpm typecheck && pnpm lint && pnpm typecheck:styles
git add src/renderer/dsp/DspPanel.tsx src/renderer/styles/Dsp.scss src/renderer/App.tsx src/__tests__/unit_tests/DspPanel.test.tsx
git commit -m "A sixth pill in a group of five, and a header that admits it is not APO"
```

---

### Task 10: Render to file

**Files:**

- Create: `src/renderer/dsp/renderToFile.ts`
- Modify: `src/renderer/dsp/DspPanel.tsx` — the render button
- Test: `src/__tests__/unit_tests/renderer/dspRender.test.ts`

**Interfaces:**

- Consumes: `buildDspGraph`, `IDspSettings`.
- Produces: `renderProcessed(buffer: AudioBuffer, settings: IDspSettings, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<Blob>`.

Reuse `encodeWav` from `src/renderer/karaoke/makerSeparation/separate.ts`
rather than writing a second WAV encoder — check its export signature first
and lift it to a shared module if it is not already exported.

The spec requires: progress from the first second, cancellable, backgroundable.
`OfflineAudioContext` reports no progress of its own, so render in slices and
report per slice. **No `setTimeout` to fake progress.**

- [ ] **Step 1: Write the failing test**

```ts
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { renderProcessed } from '../../../renderer/dsp/renderToFile';

describe('renderProcessed', () => {
  it('rejects when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      renderProcessed(
        { length: 1, numberOfChannels: 2, sampleRate: 48_000 } as AudioBuffer,
        DSP_DEFAULTS,
        () => undefined,
        controller.signal,
      ),
    ).rejects.toThrow(/abort/i);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test:unit --testPathPattern dspRender`

- [ ] **Step 3: Implement, then wire the button**

The button shows progress from its first second, offers cancel, and reuses
`button small` / `button small subtle` per the emphasis rule.

- [ ] **Step 4: Run the tests, typecheck, lint, commit**

```bash
pnpm test:unit --testPathPattern "dspRender|DspPanel"
pnpm typecheck && pnpm lint
git add src/renderer/dsp src/__tests__/unit_tests/renderer/dspRender.test.ts
git commit -m "Rendered in slices because OfflineAudioContext will not say how far it got"
```

---

### Task 11: Headroom against APO

**Files:**

- Create: `src/renderer/dsp/headroom.ts`
- Modify: `src/renderer/dsp/DspPanel.tsx`
- Read first: `src/renderer/SmartHeadroomEngine.tsx`
- Test: `src/__tests__/unit_tests/renderer/dspHeadroom.test.ts`

**Interfaces:**

- Consumes: the profile's maximum boost in dB, from `SmartHeadroomEngine`.
- Produces: `defaultCeilingDb(profileBoostDb: number): number`, clamped to the
  `ceilingDb` range in `common/dsp/chain` (-12 to 0).

The chain runs **before** APO, which then applies the device profile. A
maximizer at 0 dBFS followed by an APO boost clips, and it clips only on loud
passages — silent when wrong, which is why it gets a test rather than an
argument.

- [ ] **Step 1: Read `SmartHeadroomEngine.tsx`**

Find how it computes the active profile's maximum boost. **Do not re-derive
it.** If it is not exported, export the calculation from where it lives.

- [ ] **Step 2: Write the failing test**

```ts
import { defaultCeilingDb } from '../../../renderer/dsp/headroom';

describe('default maximizer ceiling', () => {
  it('leaves room for the profile boost', () => {
    expect(defaultCeilingDb(6)).toBeCloseTo(-6, 5);
  });

  it('still leaves a safety margin with a flat profile', () => {
    expect(defaultCeilingDb(0)).toBeLessThan(0);
  });

  it('never returns a ceiling below the settings range', () => {
    expect(defaultCeilingDb(40)).toBeGreaterThanOrEqual(-12);
  });
});
```

- [ ] **Step 3: Implement `src/renderer/dsp/headroom.ts` and use it as the default**

- [ ] **Step 4: Run tests, typecheck, lint, commit**

```bash
pnpm test:unit --testPathPattern dspHeadroom
pnpm typecheck && pnpm lint
git add src/renderer/dsp/headroom.ts src/renderer/dsp/DspPanel.tsx src/__tests__/unit_tests/renderer/dspHeadroom.test.ts
git commit -m "The ceiling leaves exactly what APO is about to add back"
```

---

### Task 12: Full suite and a real window

- [ ] **Step 1: Run everything**

```bash
pnpm build && pnpm test && pnpm typecheck && pnpm lint && pnpm typecheck:styles
```

Fix what broke. Add the cases that would have caught it.

- [ ] **Step 2: Hand it to Ivan**

**Do not launch the app.** Ivan runs it. Tell him plainly what has and has not
been verified, and name the four things only a real window can answer:

1. Does audio still play at all with the graph inserted? (the
   `createMediaElementSource` hazard)
2. Does the exciter audibly add air on a 96 kbps file, or just hiss?
3. Does the maximizer clip once APO's boost is on top?
4. Does the DSP pill look right as a sixth item in a strip designed for five?
