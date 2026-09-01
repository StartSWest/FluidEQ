/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import Server from 'webpack-dev-server';
import {
  DSP_OUTPUT_COUNT,
  DSP_OUTPUT_INDEX,
} from '../../../renderer/dsp/monitorOutputs';

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
 *
 * WHAT THIS FILE NO LONGER TESTS, so that nobody goes looking. The node used to
 * hold the entire rack and most of the cases here drove it: the maximizer's
 * ceiling, the compressor's reduction, Drive on quiet material, the background
 * normalization hand-off, every factory preset for non-finite samples. All of
 * that arithmetic is now C++ and is covered by native unit tests, the frozen
 * migration parity corpus, and host playback smokes. The worklet is a wire, and
 * a wire has exactly the three behaviours below it can get wrong.
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
   * assertions below.
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
    expect(/(^|[^.\w$])self\s*[.[,)=;]/.test(bundle)).toBe(false);
    expect(/(^|[^.\w$])document\s*\./.test(bundle)).toBe(false);
  });

  /**
   * The whole of what the node now does, stated as an identity.
   *
   * `toBeCloseTo(6)` rather than `toBe`: the input is `Float64` arithmetic
   * narrowed to `Float32` on the way in, so the comparison is against the
   * rounding the format imposes and not against the node.
   */
  it('copies its input to the master output, sample for sample', () => {
    const processor = new (loadProcessor())();
    const input = Float32Array.from(
      { length: QUANTUM * 4 },
      (_value, index) => Math.sin(index / 7) * 0.8,
    );
    const output = run(processor, input);
    output.forEach((value, index) => {
      expect(value).toBeCloseTo(input[index], 6);
    });
  });

  /**
   * POSITIVE CONTROL for the identity above.
   *
   * Without it, a node that wrote nothing at all would satisfy it perfectly on
   * an input of zeros — and a passthrough test is exactly the shape that can
   * pass by doing nothing. This asserts there was a signal to copy.
   */
  it('POSITIVE CONTROL: what it copies is not silence', () => {
    const processor = new (loadProcessor())();
    const input = Float32Array.from(
      { length: QUANTUM * 4 },
      (_value, index) => Math.sin(index / 7) * 0.8,
    );
    expect(peak(run(processor, input))).toBeGreaterThan(0.7);
  });

  it('emits silence rather than a stutter when the input is disconnected', () => {
    const processor = new (loadProcessor())();
    const outputs = monoOutputs();
    outputs[DSP_OUTPUT_INDEX.master][0].fill(0.5);
    processor.process([[]], outputs);
    const target = outputs[DSP_OUTPUT_INDEX.master][0];
    expect(peak(target)).toBe(0);
  });

  it('handles stereo without crossing the two channels', () => {
    const processor = new (loadProcessor())();
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
