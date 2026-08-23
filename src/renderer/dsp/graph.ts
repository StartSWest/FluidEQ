/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspSettings } from '../../common/dsp/chain';
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
 * Wire source → worklet → destination.
 *
 * The worklet node is passed in rather than created here because
 * `audioWorklet.addModule` is asynchronous and a builder that returned a
 * promise could not be called from a render. `useDspEngine` awaits the module
 * and hands the node over.
 *
 * The exciter used to live here, as a parallel subgraph of native nodes, and
 * it moved into the worklet when it grew from one band of odd harmonics into
 * three bands that each choose their own — plus a stage that waits for a level
 * and a drive that wanders. A `WaveShaperNode` can do none of those, so each
 * would have been another node on another parallel path, and differing latency
 * between parallel native paths is exactly the class of bug the worklet's own
 * header exists to rule out. See `exciterStage.ts`.
 *
 * What is left is a single connection, which is the whole benefit: there is no
 * subgraph to rebuild when a switch flips, so there is nothing to click.
 */
export const buildDspGraph = (
  context: IAudioGraphContext,
  source: IAudioNodeLike,
  worklet: IWorkletNodeLike,
  destination: IAudioNodeLike,
  settings: IDspSettings,
): IDspGraph => {
  let current = settings;
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

  // Tapped off the source rather than off the chain's output: the exciter is
  // parallel and its own gain is already accounted for in the reserve, so
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
  source.connect(worklet);

  return {
    analyser,
    inputAnalyser,
    update(next: IDspSettings) {
      // Every stage the settings touch now lives behind the port, so this is
      // one message rather than a message and a subgraph to keep in step.
      current = next;
      worklet.port.postMessage(next);
      refreshKernel(next);
    },
    dispose() {
      source.disconnect();
      worklet.disconnect();
      analyser.disconnect();
      inputAnalyser.disconnect();
    },
  };
};
