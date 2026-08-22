/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { DSP_DEFAULTS, IDspSettings } from '../../../common/dsp/chain';
import { DSP_PRESETS } from '../../../common/dsp/presets';

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

const send = (processor: IProcessorLike, settings: IDspSettings): void => {
  if (!processor.port.onmessage) {
    throw new Error('The processor installed no port listener.');
  }
  processor.port.onmessage({ data: settings });
};

/** Push a signal through the processor a render quantum at a time. */
const run = (processor: IProcessorLike, input: Float32Array): Float32Array => {
  const output = new Float32Array(input.length);
  for (let offset = 0; offset + QUANTUM <= input.length; offset += QUANTUM) {
    const block = input.subarray(offset, offset + QUANTUM);
    const target = new Float32Array(QUANTUM);
    processor.process([[block]], [[target]]);
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

  it('NULL TEST: passes audio through untouched with everything bypassed', () => {
    const processor = new (loadProcessor())();
    send(processor, DSP_DEFAULTS);
    const input = new Float32Array(QUANTUM * 8);
    for (let i = 0; i < input.length; i += 1) {
      input[i] = Math.sin(i / 8) * 0.4;
    }
    const output = run(processor, input);
    output.forEach((value, index) => {
      expect(value).toBeCloseTo(input[index], 6);
    });
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
      ...DSP_DEFAULTS,
      maximizer: {
        enabled: true,
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
    expect(peak(output, QUANTUM * 4)).toBeGreaterThan(ceiling * 0.9);
  });

  it('the compressor reduces a loud signal and leaves a quiet one alone', () => {
    const settings: IDspSettings = {
      ...DSP_DEFAULTS,
      compressor: { ...DSP_DEFAULTS.compressor, enabled: true },
    };
    const levelAfter = (level: number): number => {
      const processor = new (loadProcessor())();
      send(processor, settings);
      return peak(
        run(processor, new Float32Array(QUANTUM * 16).fill(level)),
        QUANTUM * 8,
      );
    };
    // -18dBFS threshold: 0.02 is far below it, 0.9 far above.
    expect(levelAfter(0.02)).toBeCloseTo(0.02, 3);
    expect(levelAfter(0.9)).toBeLessThan(0.9);
  });

  it('emits silence rather than a stutter when the input is disconnected', () => {
    const processor = new (loadProcessor())();
    send(processor, DSP_DEFAULTS);
    const target = new Float32Array(QUANTUM).fill(0.5);
    processor.process([[]], [[target]]);
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
    send(processor, DSP_DEFAULTS);
    const left = new Float32Array(QUANTUM).fill(0.3);
    const right = new Float32Array(QUANTUM).fill(-0.7);
    const outLeft = new Float32Array(QUANTUM);
    const outRight = new Float32Array(QUANTUM);
    processor.process([[left, right]], [[outLeft, outRight]]);
    expect(outLeft[64]).toBeCloseTo(0.3, 6);
    expect(outRight[64]).toBeCloseTo(-0.7, 6);
  });
});
