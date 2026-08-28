/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Run the real DSP worklet in plain Node.
 *
 * The whole-chain parity fixtures have to come from the thing being replaced,
 * not from a second implementation of it assembled out of the same parts. The
 * parts already have their own fixtures; what those cannot catch is an
 * orchestration bug — a stage in the wrong order, a mid/side encode that wraps
 * the wrong span, a smoothing ramp that starts a block late. Only the actual
 * `process()` can answer that, and it needs three globals that exist solely
 * inside an `AudioWorkletGlobalScope`.
 *
 * So they are provided here. Nothing is stubbed out inside the processor
 * itself — `AudioWorkletProcessor` is an empty base class with a port, and
 * `registerProcessor` captures the constructor. Every sample the worklet
 * produces under this harness travels the same code the browser runs.
 */

import type { IDspSettings } from '../../../src/common/dsp/chain';

/** The browser's own render quantum, which the worklet is written around. */
export const RENDER_QUANTUM = 128;

interface IWorkletPort {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage: (data: unknown) => void;
}

interface IWorkletProcessor {
  port: IWorkletPort;
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
}

type TProcessorConstructor = new () => IWorkletProcessor;

export interface IWorkletHarness {
  /** Deliver a settings snapshot or any other message the worklet accepts. */
  send: (message: unknown) => void;
  /** Everything the worklet has posted back, in order. */
  readonly posted: unknown[];
  /**
   * Run one track through the chain, in render quanta.
   *
   * Returns the master output only. The monitor outputs are fed but discarded:
   * they are copies of the master at a stage boundary, and comparing one would
   * be comparing the same samples twice under a different name.
   */
  render: (channels: readonly Float32Array[]) => Float32Array[];
}

/**
 * Load the worklet with its globals in place and return a live instance.
 *
 * `require` rather than `import` on purpose: the class extends
 * `AudioWorkletProcessor` at module evaluation time, so the global has to exist
 * before the module is loaded, and a static import is hoisted above any code
 * that could define it.
 */
export const createWorkletHarness = (
  sampleRate: number,
  settings: IDspSettings,
): IWorkletHarness => {
  const posted: unknown[] = [];
  let captured: TProcessorConstructor | undefined;

  const scope = globalThis as unknown as Record<string, unknown>;
  scope.sampleRate = sampleRate;
  scope.currentTime = 0;
  scope.currentFrame = 0;
  scope.AudioWorkletProcessor = class {
    public port: IWorkletPort = {
      onmessage: null,
      postMessage: (data: unknown) => {
        posted.push(data);
      },
    };
  };
  scope.registerProcessor = (_name: string, processor: unknown) => {
    captured = processor as TProcessorConstructor;
  };

  /**
   * Reloaded per harness, because a worklet is a fresh object per context.
   *
   * `sampleRate` is captured by several modules at first evaluation, so a
   * cached module from a 48 kHz harness would quietly design its filters at the
   * wrong rate inside a 44.1 kHz one — silently, and only in the fixtures.
   */
  const path =
    require.resolve('../../../src/renderer/dsp/worklets/dspProcessor.worklet');
  Object.keys(require.cache)
    .filter((key) => key.includes(`${'src'}${require('path').sep}renderer`))
    .forEach((key) => {
      delete require.cache[key];
    });
  // eslint-disable-next-line global-require, import/no-dynamic-require -- see the comment above; the path is resolved, not user input.
  require(path);

  if (!captured) {
    throw new Error('worklet harness: the processor never registered itself');
  }
  const processor = new captured();
  const send = (message: unknown) => {
    if (!processor.port.onmessage) {
      throw new Error('worklet harness: the processor installed no handler');
    }
    processor.port.onmessage({ data: message });
  };
  send(settings);

  return {
    send,
    posted,
    render: (channels) => {
      const frames = channels[0]?.length ?? 0;
      const output = channels.map(() => new Float32Array(frames));
      const quantumIn = channels.map(() => new Float32Array(RENDER_QUANTUM));
      // Six outputs: master plus one per monitored stage boundary. They have to
      // be present because the worklet writes into them unconditionally.
      const quantumOut = Array.from({ length: 6 }, () =>
        channels.map(() => new Float32Array(RENDER_QUANTUM)),
      );

      for (let at = 0; at < frames; at += RENDER_QUANTUM) {
        const span = Math.min(RENDER_QUANTUM, frames - at);
        channels.forEach((channel, index) => {
          quantumIn[index].fill(0);
          quantumIn[index].set(channel.subarray(at, at + span));
        });
        processor.process([quantumIn], quantumOut);
        output.forEach((channel, index) => {
          channel.set(quantumOut[0][index].subarray(0, span), at);
        });
      }
      return output;
    },
  };
};
