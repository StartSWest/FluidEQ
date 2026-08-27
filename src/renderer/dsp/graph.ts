/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspSettings } from '../../common/dsp/chain';
import { prepareKernel } from './convolver';
import { buildLinearPhaseKernel } from './linearPhase';
import { DSP_OUTPUT_INDEX, TDspAnalyserStage } from './monitorOutputs';

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
  connect(
    destination: IAudioNodeLike,
    output?: number,
    input?: number,
  ): unknown;
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
  /** Real output boundaries, ordered down the chain rather than compensated. */
  analysers: Record<TDspAnalyserStage, IAnalyserNodeLike>;
  /**
   * The pre-chain tap used by the Normalizer display.
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
 * three bands that each choose their own — plus per-band thresholds and a
 * focused body stage. A `WaveShaperNode` can do none of those, so each
 * would have been another node on another parallel path, and differing
 * latency between native paths is exactly the class of bug the worklet's own
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
   * What the worklet actually holds, as opposed to what has been asked for.
   *
   * The same idea as only rebuilding the exciter when its switch flips, and for
   * a sharper reason: a kernel costs about two milliseconds, settings arrive on
   * every pixel of a drag, and rebuilding one per pixel would spend a sixth of
   * every frame on a filter that had not changed. Empty means none has been
   * sent, which is also what the worklet has to be told when the mode leaves
   * linear so it can drop the convolvers.
   *
   * Distinct from `pendingKernel` below because a build is now deferred by a
   * frame: between the ask and the build the two genuinely differ, and a drag
   * that returns to where it started inside one frame must send nothing at all.
   */
  let sentKernelKey = '';

  /**
   * The newest settings a coalesced build is waiting on, and their key.
   *
   * MEASURED, and the reason this exists: one kernel is 32 partitions of two
   * `Float64Array(1024)` — 512KB to prepare, 512KB again as the structured
   * clone crosses into the worklet, and about 1.1MB more once `createConvolver`
   * gives each of the two channels its own history rings. Roughly 2.1MB per
   * change. `useDspEngine` calls `update` from an effect on `settings`, so a
   * knob drag on a 1000Hz mouse produced up to a thousand of those a second,
   * and the worklet-side share of them accumulates in the AudioWorklet's own
   * V8 isolate — a real-time thread that collects almost nothing. A renderer
   * observed going from 677MB to 8.4GB in six and a half minutes of this was
   * 10.4GB of `partition_alloc/partitions/buffer` in a memory-infra dump,
   * while the window's own heap and DOM sat flat and a critical memory-pressure
   * purge gave back 112MB of it.
   *
   * One frame is the right grain because that is how often the result can be
   * seen or heard; everything in between is a kernel nobody ever listened to.
   */
  let pendingKernel: { settings: IDspSettings; key: string } | undefined;

  /** The scheduled build, so it can be replaced and so `dispose` can drop it. */
  let kernelFrame: number | undefined;

  /**
   * Everything the kernel depends on, and nothing else.
   *
   * Deliberately not the whole EQ: the engine, stereo mode and
   * the fuzz all change the sound without changing the filter the kernel IS,
   * and including them would rebuild it for a knob it does not use.
   */
  const kernelKeyOf = (eq: IDspSettings['eq']): string =>
    !eq.enabled || (eq.phase !== 'linear' && !eq.isolate)
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

  /**
   * Build whatever is waiting, and hand it over.
   *
   * The equality check is against what the worklet HOLDS, not against what was
   * last asked for: a band nudged and put back inside one frame ends here with
   * a key the worklet already has, and the right answer then is to build
   * nothing rather than to spend 2.1MB arriving where we already were.
   */
  const flushKernel = (): void => {
    if (kernelFrame !== undefined) {
      cancelAnimationFrame(kernelFrame);
      kernelFrame = undefined;
    }
    const pending = pendingKernel;
    pendingKernel = undefined;
    if (!pending || pending.key === sentKernelKey) {
      return;
    }
    sentKernelKey = pending.key;
    worklet.port.postMessage({
      eqKernel:
        pending.key === ''
          ? undefined
          : prepareKernel(
              buildLinearPhaseKernel(pending.settings.eq, context.sampleRate),
            ),
    });
  };

  /** Note what the kernel should become; build it at most once a frame. */
  const refreshKernel = (next: IDspSettings): void => {
    const key = kernelKeyOf(next.eq);
    if (key === sentKernelKey && pendingKernel === undefined) {
      return;
    }
    pendingKernel = { settings: next, key };
    // A hidden window is handed no animation frames at all, and settings still
    // arrive there — a preset loaded from the tray, a device profile switched,
    // auto-EQ answering. Deferred, those would wait for a frame that comes
    // when the window is looked at again, and until then the EQ would go on
    // applying the curve before them: wrong, silently, which is the one
    // failure a coalescer must not introduce.
    if (
      typeof requestAnimationFrame !== 'function' ||
      document.visibilityState === 'hidden'
    ) {
      flushKernel();
      return;
    }
    if (kernelFrame === undefined) {
      kernelFrame = requestAnimationFrame(flushKernel);
    }
  };

  /**
   * A real spectrum tap after each stage. None is derived by subtracting a
   * later gain value: doing that would fail as soon as a nonlinear filter or
   * true-peak controller changed the waveform rather than only its level.
   */
  const analysers = Object.fromEntries(
    (Object.keys(DSP_OUTPUT_INDEX) as TDspAnalyserStage[]).map((stage) => {
      const analyser = context.createAnalyser();
      // 2048 bins across 20Hz-20kHz is about a fifth of an octave at the bottom
      // and far finer at the top, which is plenty for a backdrop and cheap.
      analyser.fftSize = 2_048;
      // Fast enough to feel live, slow enough that the display is not a strobe.
      analyser.smoothingTimeConstant = 0.8;
      return [stage, analyser];
    }),
  ) as Record<TDspAnalyserStage, IAnalyserNodeLike>;

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

  worklet.connect(destination, DSP_OUTPUT_INDEX.master, 0);
  (Object.keys(analysers) as TDspAnalyserStage[]).forEach((stage) => {
    worklet.connect(analysers[stage], DSP_OUTPUT_INDEX[stage], 0);
  });
  worklet.port.postMessage(current);
  refreshKernel(current);
  // Built now rather than next frame: there is no drag to coalesce at
  // construction, and a frame spent without the kernel is a frame of the wrong
  // curve on the first sound the user hears.
  flushKernel();
  source.connect(worklet);

  return {
    analysers,
    inputAnalyser,
    update(next: IDspSettings) {
      // Every stage the settings touch now lives behind the port, so this is
      // one message rather than a message and a subgraph to keep in step.
      current = next;
      worklet.port.postMessage(next);
      refreshKernel(next);
    },
    dispose() {
      // A build scheduled for a frame that will arrive after this one would
      // post a kernel into a worklet that has been taken out of the graph.
      if (kernelFrame !== undefined) {
        cancelAnimationFrame(kernelFrame);
        kernelFrame = undefined;
      }
      pendingKernel = undefined;
      source.disconnect();
      worklet.disconnect();
      (Object.keys(analysers) as TDspAnalyserStage[]).forEach((stage) => {
        analysers[stage].disconnect();
      });
      inputAnalyser.disconnect();
    },
  };
};
