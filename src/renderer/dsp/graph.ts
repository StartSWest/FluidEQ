/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspSettings } from '../../common/dsp/chain';
import { buildShaperCurve } from './exciter';

/**
 * The graph, typed against what it needs rather than against Web Audio.
 *
 * jsdom has no Web Audio at all — no AudioContext, no nodes, nothing — so a
 * builder typed as `AudioNode` could not be tested outside a real browser.
 * The same reason and the same shape as `IMirrorSink` in
 * `src/renderer/audio/outputMirror.ts`: declare the handful of members
 * actually used, and a fake satisfies it.
 */
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
  /**
   * `'none' | '2x' | '4x'`, and the default is `'none'`, which is a bug.
   *
   * Typed as a plain string so a fake in a test does not have to import Web
   * Audio's union — jsdom has none of it. `graph.ts` only ever writes `'4x'`.
   */
  oversample: string;
}

export interface IFilterNodeLike extends IAudioNodeLike {
  type: string;
  frequency: IAudioParamLike;
}

export interface IWorkletNodeLike extends IAudioNodeLike {
  port: { postMessage(value: unknown): void };
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

/**
 * Wire source → [exciter] → worklet → destination.
 *
 * The worklet node is passed in rather than created here because
 * `audioWorklet.addModule` is asynchronous and a builder that returned a
 * promise could not be called from a render. `useDspEngine` awaits the module
 * and hands the node over.
 *
 * The exciter is the only stage built from native nodes. It is parallel, not
 * serial: the dry path carries the whole signal at unity and the wet path
 * carries only the band above the corner, shaped and scaled by `mix`. Putting
 * the shaper in series instead would distort the bass — which is where a
 * non-linearity is most audible and least wanted — and the highpass in front
 * of it exists precisely so the shaper never sees a low frequency.
 *
 * Rebuilding the exciter subgraph on every settings change would click, so
 * `update` only rebuilds when its enabled flag flips; drive, corner and mix
 * are written straight onto the existing nodes.
 */
export const buildDspGraph = (
  context: IAudioGraphContext,
  source: IAudioNodeLike,
  worklet: IWorkletNodeLike,
  destination: IAudioNodeLike,
  settings: IDspSettings,
): IDspGraph => {
  let current = settings;
  /** Every node this builder made, so `dispose` can unpick exactly its own. */
  let exciterNodes: IAudioNodeLike[] = [];
  let highpass: IFilterNodeLike | undefined;
  let shaper: IShaperNodeLike | undefined;
  let wetGain: IGainNodeLike | undefined;

  const buildExciter = () => {
    const dry = context.createGain();
    dry.gain.value = 1;
    highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = current.exciter.crossoverHz;
    shaper = context.createWaveShaper();
    shaper.curve = buildShaperCurve(current.exciter.drive);
    /**
     * Without this the exciter aliases, audibly and by design.
     *
     * A shaper is a non-linearity, so it manufactures harmonics above its
     * input: a 7kHz tone fed through this curve produces 21kHz, 35kHz and
     * 49kHz. At a 48kHz session everything past 24kHz has nowhere to go and
     * folds back down as inharmonic content — tones that were never in the
     * music and do not move with it, sitting exactly where this stage is
     * supposed to be adding air.
     *
     * Chromium resamples to 4×, applies the curve, and filters on the way back
     * down, all in C++. That is the same thing every commercial saturator does
     * and there is no reason to hand-roll it. The default is `'none'`.
     */
    shaper.oversample = '4x';
    wetGain = context.createGain();
    wetGain.gain.value = current.exciter.mix;

    source.connect(dry);
    dry.connect(worklet);
    source.connect(highpass);
    highpass.connect(shaper);
    shaper.connect(wetGain);
    wetGain.connect(worklet);
    exciterNodes = [dry, highpass, shaper, wetGain];
  };

  const teardownExciter = () => {
    exciterNodes.forEach((node) => node.disconnect());
    exciterNodes = [];
    highpass = undefined;
    shaper = undefined;
    wetGain = undefined;
  };

  const connectSource = () => {
    if (current.exciter.enabled) {
      buildExciter();
    } else {
      source.connect(worklet);
    }
  };

  worklet.connect(destination);
  worklet.port.postMessage(current);
  connectSource();

  return {
    update(next: IDspSettings) {
      const wasEnabled = current.exciter.enabled;
      current = next;
      worklet.port.postMessage(next);
      if (wasEnabled !== next.exciter.enabled) {
        source.disconnect();
        teardownExciter();
        connectSource();
        return;
      }
      if (highpass && shaper && wetGain) {
        highpass.frequency.value = next.exciter.crossoverHz;
        shaper.curve = buildShaperCurve(next.exciter.drive);
        wetGain.gain.value = next.exciter.mix;
      }
    },
    dispose() {
      source.disconnect();
      teardownExciter();
      worklet.disconnect();
    },
  };
};
