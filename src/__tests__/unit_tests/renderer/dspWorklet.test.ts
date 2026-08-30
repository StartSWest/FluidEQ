/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import Server from 'webpack-dev-server';
import { DSP_DEFAULTS, IDspSettings } from '../../../common/dsp/chain';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import {
  DSP_OUTPUT_COUNT,
  DSP_OUTPUT_INDEX,
} from '../../../renderer/dsp/monitorOutputs';
import { OUTPUT_SAFETY_LOOK_AHEAD_MS } from '../../../renderer/dsp/outputSafety';
import { POST_FILTER_NORMALIZER_LOOK_AHEAD_MS } from '../../../renderer/dsp/postFilterNormalizer';

/**
 * The worklet's own webpack config, asserted as configuration rather than run.
 *
 * This file can only ever EXECUTE the production bundle: the development one
 * is served from webpack-dev-server's memory and never reaches disk. And
 * development is exactly where both packaging defects lived — production
 * worked and this file was green while a real window threw
 * `ReferenceError: self is not defined`, first from webpack's jsonp chunk
 * runtime and then from the dev server's own injected client.
 *
 * So the settings that make a worklet loadable are checked as values, and the
 * one that cannot be checked that way — whether the dev server would inject
 * into this compiler at all — is asked of the server's own function.
 */
import { dspWorkletConfig } from '../../../../.erb/configs/webpack.dspWorklet';

/**
 * Runs the BUILT worklet bundle, not the TypeScript source.
 *
 * That distinction is the whole reason this file exists. The renderer bundles
 * as `umd`, whose preamble probes for `exports`, `define` and a global object;
 * an AudioWorkletGlobalScope has none of those, not even `self`, so a worklet
 * wrapped in UMD throws before `registerProcessor` runs and `addModule`
 * rejects with nothing useful in it. Importing the source would typecheck,
 * pass, and tell us nothing about that — only executing the emitted file in a
 * scope with exactly the three globals a worklet gets can.
 */
const BUNDLE = path.join(
  __dirname,
  '../../../../release/app/dist/renderer/dsp-worklet.js',
);
const SOURCE = path.join(
  __dirname,
  '../../../renderer/dsp/worklets/dspProcessor.worklet.ts',
);

const SAMPLE_RATE = 48_000;
const QUANTUM = 128;
const PROCESSING_LATENCY =
  Math.max(
    1,
    Math.round((DSP_DEFAULTS.maximizer.lookAheadMs / 1_000) * SAMPLE_RATE),
  ) +
  Math.max(
    1,
    Math.round((POST_FILTER_NORMALIZER_LOOK_AHEAD_MS / 1_000) * SAMPLE_RATE),
  ) +
  Math.max(1, Math.round((OUTPUT_SAFETY_LOOK_AHEAD_MS / 1_000) * SAMPLE_RATE));

interface IProcessorLike {
  port: { onmessage: ((event: { data: unknown }) => void) | null };
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

type TProcessorConstructor = new () => IProcessorLike;

/**
 * Load the bundle into a scope holding only what a worklet actually has.
 *
 * No `window`, no `self`, no `document`, no `require` — deliberately. Anything
 * the bundle reaches for that is not here is a runtime failure in the real
 * audio thread, and it should be a failure here too.
 */
const loadProcessor = (): TProcessorConstructor => {
  const registered = new Map<string, TProcessorConstructor>();
  const scope = vm.createContext({
    sampleRate: SAMPLE_RATE,
    currentTime: 0,
    class_AudioWorkletProcessor: undefined,
    registerProcessor: (name: string, ctor: TProcessorConstructor) => {
      registered.set(name, ctor);
    },
    AudioWorkletProcessor: class {
      port = {
        onmessage: null as ((event: { data: unknown }) => void) | null,
        postMessage: () => undefined,
      };
    },
  });
  vm.runInContext(fs.readFileSync(BUNDLE, 'utf8'), scope);
  const ctor = registered.get('fluideq-dsp');
  if (!ctor) {
    throw new Error('The worklet bundle registered no fluideq-dsp processor.');
  }
  return ctor;
};

const post = (processor: IProcessorLike, data: unknown): void => {
  if (!processor.port.onmessage) {
    throw new Error('The processor installed no port listener.');
  }
  processor.port.onmessage({ data });
};

const send = (processor: IProcessorLike, settings: IDspSettings): void =>
  post(processor, settings);

/** Explicit literal bypass for tests that exercise one later stage in isolation. */
const bypassed = (settings: IDspSettings = DSP_DEFAULTS): IDspSettings => ({
  ...settings,
  normalizer: { ...settings.normalizer, mode: 'off' },
  eq: { ...settings.eq, enabled: false, isolate: false },
  exciter: { ...settings.exciter, enabled: false, isolate: false },
  compressor: { ...settings.compressor, enabled: false },
  maximizer: { ...settings.maximizer, enabled: false },
  master: { ...settings.master, enabled: false },
});

const monoOutputs = (): Float32Array[][] =>
  Array.from({ length: DSP_OUTPUT_COUNT }, () => [new Float32Array(QUANTUM)]);

/** Push a signal through the processor a render quantum at a time. */
const run = (processor: IProcessorLike, input: Float32Array): Float32Array => {
  const output = new Float32Array(input.length);
  for (let offset = 0; offset + QUANTUM <= input.length; offset += QUANTUM) {
    const block = input.subarray(offset, offset + QUANTUM);
    const outputs = monoOutputs();
    processor.process([[block]], outputs);
    const target = outputs[DSP_OUTPUT_INDEX.master][0];
    output.set(target, offset);
  }
  return output;
};

const peak = (signal: Float32Array, from = 0): number =>
  signal
    .subarray(from)
    .reduce((highest, value) => Math.max(highest, Math.abs(value)), 0);

describe('dsp worklet bundle', () => {
  beforeAll(() => {
    if (!fs.existsSync(BUNDLE)) {
      throw new Error(
        `No worklet bundle at ${BUNDLE}. Run \`pnpm build:renderer\` first.`,
      );
    }
    if (!fs.existsSync(SOURCE)) {
      throw new Error(`The worklet source moved; ${SOURCE} does not exist.`);
    }
  });

  /**
   * There is deliberately no "is the bundle newer than its source" check here.
   *
   * There was one, and it was wrong: webpack does not rewrite an output whose
   * content did not change, so any git operation that touches source mtimes
   * without changing them — a rebase, a checkout, a stash pop — left the
   * bundle legitimately older than its source and turned this file red. The
   * remedy it printed did not help either, because `build:renderer` had
   * nothing to do. A test that fails after an ordinary rebase teaches people
   * to ignore it, which costs more than the staleness it was guarding against.
   *
   * What keeps this honest instead is `check-build-exists.ts` in `setupFiles`,
   * which refuses to start Jest without a build at all, and the behavioural
   * assertions below: a bundle stale enough to matter is one whose behaviour
   * changed, and behaviour is what every test here measures.
   */

  it('loads and registers in a scope with no window, self or document', () => {
    expect(loadProcessor()).toBeInstanceOf(Function);
  });

  /**
   * Every one of these is a default webpack would otherwise apply, and each
   * one broke a real window when it was missing.
   *
   * `chunkLoading` is the one that only failed in development: the jsonp
   * runtime added for HMR touches `self` at module scope, so the script threw
   * before `registerProcessor` ran. `addModule` still resolved — it does not
   * report a throw inside the module — and the failure surfaced two steps
   * later as "the node name 'fluideq-dsp' is not defined".
   */
  it('is built with the three output settings a worklet scope needs', () => {
    [true, false].forEach((isDevelopment) => {
      const { output } = dspWorkletConfig(isDevelopment);
      expect(output?.library).toEqual({
        type: 'var',
        name: 'fluidEqDspWorklet',
      });
      expect(output?.chunkLoading).toBe(false);
      expect(output?.wasmLoading).toBe(false);
    });
  });

  /**
   * Asked of `webpack-dev-server` itself, not of a copy of its rules.
   *
   * `Server.addAdditionalEntries` injects the dev client and react-refresh
   * into every entry of a compiler this returns `true` for, and there is no
   * per-entry opt-out — which is why the worklet has its own compiler at all.
   * An injected client reads `self` at module scope, throws before
   * `registerProcessor`, and surfaces as "the node name 'fluideq-dsp' is not
   * defined" two steps later.
   *
   * Checking the real function means a change to its target list in a future
   * webpack-dev-server fails here rather than in a user's audio thread.
   */
  it('is not a target the dev server would inject its client into', () => {
    const { target, resolve } = dspWorkletConfig(true);
    const fakeCompiler = {
      options: { target, resolve: resolve ?? {}, externalsPresets: {} },
    };
    expect(
      (
        Server as unknown as { isWebTarget(compiler: unknown): boolean }
      ).isWebTarget(fakeCompiler),
    ).toBe(false);
  });

  /**
   * POSITIVE CONTROL for the check above.
   *
   * Without it, an `isWebTarget` that had been renamed or that returned
   * `undefined` for everything would satisfy the test while proving nothing.
   */
  it('POSITIVE CONTROL: the renderer’s own target IS one it injects into', () => {
    const rendererLike = {
      options: {
        target: ['web', 'electron-renderer'],
        resolve: {},
        externalsPresets: {},
      },
    };
    expect(
      (
        Server as unknown as { isWebTarget(compiler: unknown): boolean }
      ).isWebTarget(rendererLike),
    ).toBe(true);
  });

  it('emits no top-level reference to a global a worklet does not have', () => {
    const bundle = fs.readFileSync(BUNDLE, 'utf8');
    // `self` as a bare identifier. The limiter has a `window` PROPERTY, so
    // that name is checked as a global read rather than by bare occurrence.
    expect(/(^|[^.\w$])self\s*[.[,)=;]/.test(bundle)).toBe(false);
    expect(/(^|[^.\w$])document\s*\./.test(bundle)).toBe(false);
  });

  it('NULL TEST: bypasses every user processor except fixed output safety', () => {
    const processor = new (loadProcessor())();
    send(processor, bypassed());
    const input = new Float32Array(QUANTUM * 8);
    for (let i = 0; i < input.length; i += 1) {
      input[i] = Math.sin(i / 8) * 0.4;
    }
    const output = run(processor, input);
    expect(peak(output.subarray(0, PROCESSING_LATENCY))).toBe(0);
    output.subarray(PROCESSING_LATENCY).forEach((value, index) => {
      // The remaining sub-millidecibel difference is the always-on 3 Hz DC
      // blocker, not a user processor or hidden gain stage.
      expect(Math.abs(value - input[index])).toBeLessThan(0.003);
    });
  });

  it('root bypass ignores active nested processors and copies input exactly', () => {
    const processor = new (loadProcessor())();
    send(processor, {
      ...DSP_DEFAULTS,
      enabled: false,
      eq: {
        ...DSP_DEFAULTS.eq,
        enabled: true,
        bands: DSP_DEFAULTS.eq.bands.map((band) => ({
          ...band,
          gainDb: 12,
        })),
      },
      maximizer: {
        ...DSP_DEFAULTS.maximizer,
        enabled: true,
        ceilingDb: -12,
      },
      master: {
        ...DSP_DEFAULTS.master,
        enabled: true,
        outputTrimDb: 6,
      },
    });
    const input = Float32Array.from(
      { length: QUANTUM * 4 },
      (_, index) => Math.sin(index / 7) * 0.8,
    );
    const output = run(processor, input);
    output.forEach((value, index) => {
      expect(value).toBeCloseTo(input[index], 6);
    });
  });

  it('lands a background normalization update during silence', () => {
    const processor = new (loadProcessor())();
    send(processor, bypassed());
    post(processor, { masterPeakHoldTrackId: 'track-a' });
    post(processor, {
      trackLevelGains: { inputGainDb: 0, masterLoudnessGainDb: 0 },
    });
    run(processor, new Float32Array(QUANTUM).fill(0.5));

    post(processor, {
      trackLevelGains: { inputGainDb: -6, masterLoudnessGainDb: 0 },
    });
    // Flush the complete fixed-latency path so this is silence at the audible
    // output too, not merely a source gap with earlier programme still queued.
    // Let the fixed 3 Hz DC guard settle too. A constant 0.5 probe resumed
    // after only the delay latency is intentionally corrected by that guard,
    // so it cannot be used as a transparent-gain assertion at that instant.
    run(processor, new Float32Array(QUANTUM * 96));
    const levelState = processor as unknown as {
      inputGainNow: number;
      inputGainTargetDb: number;
    };
    expect(levelState.inputGainTargetDb).toBe(-6);
    expect(levelState.inputGainNow).toBeCloseTo(10 ** (-6 / 20), 6);
    const resumedInput = Float32Array.from(
      { length: QUANTUM * 4 },
      (_, index) => 0.5 * Math.cos((2 * Math.PI * 1_000 * index) / SAMPLE_RATE),
    );
    const resumed = run(processor, resumedInput);
    expect(resumed[PROCESSING_LATENCY]).toBeCloseTo(
      resumedInput[0] * 10 ** (-6 / 20),
      3,
    );
  });

  it('phase-locks background Normalizer and Master LUFS gain for two seconds', () => {
    const processor = new (loadProcessor())();
    send(processor, bypassed());
    post(processor, { masterPeakHoldTrackId: 'track-ramp' });
    post(processor, {
      trackLevelGains: { inputGainDb: 0, masterLoudnessGainDb: 0 },
    });
    run(processor, new Float32Array(QUANTUM).fill(0.25));

    post(processor, {
      trackLevelGains: { inputGainDb: -6, masterLoudnessGainDb: 4 },
    });
    const before = processor as unknown as {
      trackLevelTransitionFrames: number;
      trackLevelTransitionElapsedFrames: number;
      inputGainNow: number;
      masterLoudnessGainNowDb: number;
    };
    expect(before.trackLevelTransitionFrames).toBe(SAMPLE_RATE * 2);
    expect(before.trackLevelTransitionElapsedFrames).toBe(0);

    run(processor, new Float32Array(SAMPLE_RATE).fill(0.25));
    expect(20 * Math.log10(before.inputGainNow)).toBeCloseTo(-3, 2);
    expect(before.masterLoudnessGainNowDb).toBeCloseTo(2, 2);
    expect(before.trackLevelTransitionElapsedFrames).toBe(SAMPLE_RATE);
  });

  /**
   * The control that makes the null test above mean something.
   *
   * A `process` that copied its input and ignored every setting would pass the
   * bypass test perfectly while doing nothing at all.
   */
  it('POSITIVE CONTROL: the maximizer holds its ceiling on loud audio', () => {
    const processor = new (loadProcessor())();
    send(processor, {
      ...bypassed(),
      maximizer: {
        enabled: true,
        presetId: '',
        driveDb: 0,
        ceilingDb: -6,
        lookAheadMs: 2,
        releaseMs: 50,
      },
    });
    const input = new Float32Array(QUANTUM * 16).fill(0.95);
    const output = run(processor, input);
    const ceiling = 10 ** (-6 / 20);
    // Skip the first blocks: the delay line starts empty and emits silence.
    expect(peak(output, QUANTUM * 4)).toBeLessThanOrEqual(ceiling + 1e-4);
    expect(peak(output, QUANTUM * 4)).toBeGreaterThan(ceiling * 0.75);
  });

  /**
   * Drive is what makes this a maximizer rather than a limiter.
   *
   * There was no gain term anywhere in the stage or in the limiter it drives,
   * so switching it on could only ever turn peaks DOWN — and the always-on
   * output safety already guaranteed nothing clipped, which left it doing
   * nothing that was not already done. Louder comes out of the gap between the
   * gain going in and the ceiling holding the top: quiet material rises to meet
   * the ceiling, and the ceiling does not move.
   */
  it('Drive raises quiet material without moving the ceiling', () => {
    const ceilingDb = -6;
    const ceiling = 10 ** (ceilingDb / 20);
    const settings = (driveDb: number): IDspSettings => ({
      ...bypassed(),
      maximizer: {
        enabled: true,
        presetId: '',
        driveDb,
        ceilingDb,
        lookAheadMs: 2,
        releaseMs: 50,
      },
    });
    /**
     * A tone rather than a constant fill, which matters here.
     *
     * The always-on output safety blocks DC at 3 Hz, so a buffer filled with
     * one value arrives about a decibel down and the reading is the DC blocker
     * rather than the stage under test. Well under the ceiling either way, so
     * at Drive 0 the limiter has nothing to do and the level can only come
     * from the gain.
     */
    const tone = (amplitude: number): Float32Array => {
      const out = new Float32Array(QUANTUM * 16);
      for (let at = 0; at < out.length; at += 1) {
        out[at] =
          amplitude * Math.sin((2 * Math.PI * 1_000 * at) / SAMPLE_RATE);
      }
      return out;
    };
    const quiet = tone(0.05);

    const flat = new (loadProcessor())();
    send(flat, settings(0));
    const atRest = peak(run(flat, quiet), QUANTUM * 4);

    const driven = new (loadProcessor())();
    send(driven, settings(12));
    const atDrive = peak(run(driven, quiet), QUANTUM * 4);

    // Twelve decibels is four times the amplitude, and nothing is limiting.
    expect(atDrive / atRest).toBeGreaterThan(3.5);
    expect(atRest).toBeCloseTo(0.05, 3);

    /**
     * And the ceiling still holds when the drive pushes well past it.
     *
     * Compared with a quarter-decibel of room rather than exactly, because the
     * ceiling is a TRUE-peak figure and `peak` reads sample peaks. The limiter
     * is controlling the reconstructed waveform between the samples, so on a
     * tone the two readings differ by a hundredth of a decibel or so in either
     * direction. What this catches is the ceiling not holding at all, which is
     * what a drive applied after the limiter instead of before it would do —
     * that would come out four times over.
     */
    const loud = tone(0.5);
    const pushed = new (loadProcessor())();
    send(pushed, settings(12));
    expect(peak(run(pushed, loud), QUANTUM * 4)).toBeLessThanOrEqual(
      ceiling * 1.03,
    );
  });

  it('the compressor reduces a loud signal and leaves a quiet one alone', () => {
    const settings: IDspSettings = {
      ...bypassed(),
      compressor: { ...DSP_DEFAULTS.compressor, enabled: true },
    };
    const levelAfter = (level: number): number => {
      const processor = new (loadProcessor())();
      send(processor, settings);
      const signal = Float32Array.from(
        { length: QUANTUM * 16 },
        (_, index) =>
          Math.sin((2 * Math.PI * 997 * index) / SAMPLE_RATE) * level,
      );
      return peak(run(processor, signal), QUANTUM * 8);
    };
    // -18dBFS threshold: 0.02 is far below it, 0.9 far above.
    expect(levelAfter(0.02)).toBeCloseTo(0.02, 3);
    expect(levelAfter(0.9)).toBeLessThan(0.9);
  });

  it('emits silence rather than a stutter when the input is disconnected', () => {
    const processor = new (loadProcessor())();
    send(processor, { ...bypassed(), enabled: false });
    const outputs = monoOutputs();
    outputs[DSP_OUTPUT_INDEX.master][0].fill(0.5);
    processor.process([[]], outputs);
    const target = outputs[DSP_OUTPUT_INDEX.master][0];
    expect(peak(target)).toBe(0);
  });

  it('survives every factory preset without producing a non-finite sample', () => {
    const input = new Float32Array(QUANTUM * 8);
    for (let i = 0; i < input.length; i += 1) {
      input[i] = Math.sin(i / 5) * 0.7 + Math.sin(i / 50) * 0.25;
    }
    DSP_PRESETS.forEach((preset) => {
      const processor = new (loadProcessor())();
      send(processor, preset.settings);
      run(processor, input).forEach((value) => {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThanOrEqual(1.5);
      });
    });
  });

  it('handles stereo without crossing the two channels', () => {
    const processor = new (loadProcessor())();
    send(processor, { ...bypassed(), enabled: false });
    const left = new Float32Array(QUANTUM).fill(0.3);
    const right = new Float32Array(QUANTUM).fill(-0.7);
    const outputs = Array.from({ length: DSP_OUTPUT_COUNT }, () => [
      new Float32Array(QUANTUM),
      new Float32Array(QUANTUM),
    ]);
    processor.process([[left, right]], outputs);
    const [outLeft, outRight] = outputs[DSP_OUTPUT_INDEX.master];
    expect(outLeft[64]).toBeCloseTo(0.3, 6);
    expect(outRight[64]).toBeCloseTo(-0.7, 6);
  });
});
