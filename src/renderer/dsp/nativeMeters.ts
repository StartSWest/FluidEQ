/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The panel's displays, fed by the engine that is actually making the sound.
 *
 * Every graph in the DSP tab reads its data from an `AnalyserNode` hanging off
 * the Web Audio chain. That was correct for as long as the Web Audio chain was
 * audible. Once the native engine took over, the elements are muted, no signal
 * reaches those nodes, and the spectrum behind the EQ curve, the exciter's
 * band, the master graph, the goniometer and the phase needle all sit still
 * while the music plays — reported from a listening session as "I hear it but
 * the graph is not moving", which is exactly what it was.
 *
 * The fix that is NOT this: keeping the TypeScript chain running so the meters
 * have something to look at. That is the double CPU cost `standDown` exists to
 * prevent, and it would draw a picture of a chain nobody is listening to —
 * accurate only for as long as the two engines agree, and silently wrong the
 * moment they do not.
 *
 * So the C++ engine measures its own output and sends it. The transforms happen
 * on the host's control thread, never in its audio callback.
 *
 * ## Why nothing in the graphs had to change
 *
 * `IDspAnalyser` is two members wide — `frequencyBinCount` and
 * `getFloatFrequencyData` — because it was written as the narrowest thing the
 * graphs actually use rather than as "an AnalyserNode". So a plain object
 * holding the last bins the host sent satisfies it completely, and
 * `DspEqGraph`, `DspExciterGraph`, `DspMasterGraph` and `DspPhaseMeter` cannot
 * tell the difference. Not one of them is touched by this file.
 */
import { IHostAnalysis, TAnalysisStage } from '../../common/dsp/analysisWire';
import {
  IDspAnalyser,
  setDspAnalyser,
  setDspChannelPeaks,
  setDspCorrelation,
  setDspPeak,
  setDspScatter,
} from './store';

/** What this needs from the preload, and nothing more. */
export interface INativeMetersBridge {
  setDspHostAnalysis: (enabled: boolean) => Promise<boolean>;
  onDspHostAnalysis: (listener: (frame: IHostAnalysis) => void) => () => void;
}

/**
 * One analyser per stage, holding whatever arrived last.
 *
 * `getFloatFrequencyData` copies rather than hands the array over, because that
 * is the contract the graphs were written against: they own the buffer they
 * pass in and reuse it every frame. Handing back a reference would have two
 * graphs sharing one array and the second overwriting the first.
 */
class HostAnalyser implements IDspAnalyser {
  readonly frequencyBinCount: number;

  private bins: Float32Array;

  constructor(binCount: number) {
    this.frequencyBinCount = binCount;
    // Starts at the display floor rather than at zero. Zero dB is full scale,
    // so an unfed analyser would paint a solid block across the graph for the
    // moment before the first frame lands.
    this.bins = new Float32Array(binCount).fill(-120);
  }

  accept(bins: Float32Array): void {
    if (bins.length === this.frequencyBinCount) {
      this.bins = bins;
    }
  }

  getFloatFrequencyData(target: Float32Array): void {
    target.set(
      this.bins.length === target.length
        ? this.bins
        : this.bins.subarray(0, target.length),
    );
  }
}

export interface INativeMeters {
  /** Stop listening and put the Web Audio analysers back. */
  release: () => void;
}

/**
 * Point the panel's displays at the native engine for as long as it is audible.
 *
 * Registering into the same slots the Web Audio analysers use means the
 * handover is total: while this is active every graph reads the C++ engine, and
 * on `release` they read whatever the worklet registers, with no third state
 * where half the panel is showing one engine and half the other.
 */
export const createNativeMeters = (
  bridge: INativeMetersBridge,
  binCount: number,
): INativeMeters => {
  const analysers: Partial<Record<TAnalysisStage, HostAnalyser>> = {};

  const unsubscribe = bridge.onDspHostAnalysis((frame) => {
    (Object.keys(frame.spectra) as TAnalysisStage[]).forEach((stage) => {
      const bins = frame.spectra[stage];
      if (!bins) {
        return;
      }
      let analyser = analysers[stage];
      if (!analyser) {
        analyser = new HostAnalyser(binCount);
        analysers[stage] = analyser;
        setDspAnalyser(stage, analyser);
      }
      analyser.accept(bins);
    });

    if (frame.scatter) {
      setDspScatter(frame.scatter);
    }
    setDspCorrelation(frame.correlation);
    setDspChannelPeaks(frame.peaks);
    setDspPeak(Math.max(frame.peaks[0], frame.peaks[1]));
  });

  bridge.setDspHostAnalysis(true).catch(() => undefined);

  return {
    release: () => {
      unsubscribe();
      bridge.setDspHostAnalysis(false).catch(() => undefined);
      /**
       * Cleared, not left holding the last frame.
       *
       * A stale analyser still answers `getFloatFrequencyData`, so leaving one
       * registered would freeze every graph on the final native frame — which
       * is the same symptom this file exists to fix, arrived at from the other
       * direction. Clearing them lets the worklet's own analysers register on
       * the next engine start, and until then the graphs draw nothing, which
       * is honest.
       */
      (Object.keys(analysers) as TAnalysisStage[]).forEach((stage) => {
        setDspAnalyser(stage, undefined);
      });
    },
  };
};
