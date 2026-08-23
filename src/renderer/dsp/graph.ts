/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspSettings } from '../../common/dsp/chain';
import { buildShaperCurve } from './exciter';
import { prepareKernel } from './convolver';
import { buildLinearPhaseKernel } from './linearPhase';

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

export interface IAnalyserNodeLike extends IAudioNodeLike {
  fftSize: number;
  smoothingTimeConstant: number;
  frequencyBinCount: number;
  getFloatFrequencyData(target: Float32Array): void;
}

export interface IAudioGraphContext {
  sampleRate: number;
  createGain(): IGainNodeLike;
  createWaveShaper(): IShaperNodeLike;
  createBiquadFilter(): IFilterNodeLike;
  createAnalyser(): IAnalyserNodeLike;
}

export interface IDspGraph {
  /** The post-chain tap the EQ page draws its spectrum from. */
  analyser: IAnalyserNodeLike;
  /**
   * The PRE-chain tap, which exists for a different question entirely.
   *
   * The adaptive trim needs the programme as it arrives, not as it leaves:
   * what it computes is the difference the chain makes to this material, and
   * measuring after the chain would be measuring the answer.
   */
  inputAnalyser: IAnalyserNodeLike;
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
  /**
   * What the last posted linear-phase kernel was built from.
   *
   * The same idea as only rebuilding the exciter when its switch flips, and for
   * a sharper reason: a kernel costs about two milliseconds, settings arrive on
   * every pixel of a drag, and rebuilding one per pixel would spend a sixth of
   * every frame on a filter that had not changed. Empty means none has been
   * sent, which is also what the worklet has to be told when the mode leaves
   * linear so it can drop the convolvers.
   */
  let kernelKey = '';

  /**
   * Everything the kernel depends on, and nothing else.
   *
   * Deliberately not the whole EQ: the preamp, the engine, the stereo mode and
   * the fuzz all change the sound without changing the filter the kernel IS,
   * and including them would rebuild it for a knob it does not use.
   */
  const kernelKeyOf = (eq: IDspSettings['eq']): string =>
    eq.phase !== 'linear' || !eq.enabled
      ? ''
      : [
          eq.model,
          eq.modelAmount,
          eq.engine,
          eq.subsonicHz,
          eq.bands
            .map((band) =>
              [
                band.enabled ? 1 : 0,
                // The kernel now carries the STATIC bands only, so whether a band
                // reacts decides whether it is in the kernel at all. Left out of
                // this key, toggling one would leave it baked in and running
                // again afterwards: the band applied twice, once for good.
                band.dynamic ? 1 : 0,
                band.type,
                band.frequency,
                band.gainDb,
                band.quality,
              ].join(','),
            )
            .join('|'),
        ].join('/');

  /** Build and send only when what it is made of actually moved. */
  const refreshKernel = (next: IDspSettings): void => {
    const key = kernelKeyOf(next.eq);
    if (key === kernelKey) {
      return;
    }
    kernelKey = key;
    worklet.port.postMessage({
      eqKernel:
        key === ''
          ? undefined
          : prepareKernel(buildLinearPhaseKernel(next.eq, context.sampleRate)),
    });
  };
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

  /**
   * The spectrum the EQ page draws behind its curve.
   *
   * Tapped AFTER the chain, so what is shown is what is heard — move a band
   * and the spectrum moves with it. Tapping before would show the source and
   * leave the user guessing whether their cut did anything.
   *
   * It is a tap, not a stage: the analyser is connected from the worklet and
   * goes nowhere, so it observes without being in the path to the speakers.
   */
  const analyser = context.createAnalyser();
  // 2048 bins across 20Hz-20kHz is about a fifth of an octave at the bottom
  // and far finer at the top, which is plenty for a backdrop and cheap.
  analyser.fftSize = 2_048;
  // Fast enough to feel live, slow enough that the display is not a strobe.
  analyser.smoothingTimeConstant = 0.8;

  // Tapped off the source rather than off the exciter's output: the exciter
  // is parallel and its own gain is already accounted for in the reserve, so
  // measuring after it would count that boost twice.
  const inputAnalyser = context.createAnalyser();
  inputAnalyser.fftSize = 2_048;
  // Barely smoothed, unlike the display's. This feeds a decision about level,
  // and a reading averaged over half a second arrives after the chorus it was
  // meant to make room for.
  inputAnalyser.smoothingTimeConstant = 0.3;
  source.connect(inputAnalyser);

  worklet.connect(destination);
  worklet.connect(analyser);
  worklet.port.postMessage(current);
  refreshKernel(current);
  connectSource();

  return {
    analyser,
    inputAnalyser,
    update(next: IDspSettings) {
      const wasEnabled = current.exciter.enabled;
      current = next;
      worklet.port.postMessage(next);
      refreshKernel(next);
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
      analyser.disconnect();
      inputAnalyser.disconnect();
    },
  };
};
