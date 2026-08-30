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
  readDspAnalyser,
  setDspAnalyser,
  setDspBandAmounts,
  setDspBandLevels,
  setDspChannelPeaks,
  setDspCorrelation,
  setDspDenoiseMeter,
  setDspExciterActivity,
  setDspLoudness,
  setDspDimensionGuard,
  setDspMaximizerReduction,
  setDspNormalizerMeter,
  setDspOutputSafetyMeter,
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
  /**
   * Whatever held each slot before, so it can have it back.
   *
   * The slot is BORROWED, not taken. The worklet registers its `AnalyserNode`s
   * once, when the audio graph is built, and never again — so clearing the slot
   * on release does not hand the graphs back to the Web Audio analysers, it
   * leaves them with nothing at all until the engine happens to restart. That
   * shipped for one switch: native worked, and switching back to TypeScript gave
   * sound with dead graphs.
   *
   * Recorded per stage at the moment of replacement rather than read again at
   * release, because by then the slot holds this file's own analyser.
   */
  const displaced: Partial<Record<TAnalysisStage, IDspAnalyser | undefined>> =
    {};

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
      }
      analyser.accept(bins);

      /**
       * Claimed on every frame, not once, because the slot is taken away.
       *
       * `clearDspAnalysers` empties all of them whenever the Web Audio graph is
       * disposed — and that happens every time the DSP is switched off, which
       * is an ordinary thing to do. Registering once meant the meters then held
       * a live analyser nothing was reading: switching the DSP off and back on
       * left every graph blank while the host went on measuring and sending,
       * and it looked from the outside as though the engine had not come back.
       *
       * Comparing rather than assigning unconditionally, so `displaced` records
       * the worklet's own analyser when the TypeScript graph has just rebuilt
       * and put one back — otherwise release would hand the slot to whatever
       * held it several rebuilds ago.
       */
      if (readDspAnalyser(stage) !== analyser) {
        displaced[stage] = readDspAnalyser(stage);
        setDspAnalyser(stage, analyser);
      }
    });

    if (frame.scatter) {
      setDspScatter(frame.scatter);
    }
    /**
     * What each band is doing, which is the one thing the settings cannot say.
     *
     * The curve is drawn at full strength and its at-rest twin at zero, and
     * neither moves when the threshold does — so a dynamic band with nothing
     * reporting its amount is a threshold dial that looks broken while working
     * perfectly. The worklet used to send these and no longer processes
     * anything, so they come from the engine that does.
     *
     * Sent even when empty is avoided: a frame with no bands is a rack with no
     * bands, and overwriting a good reading with an empty array would blank the
     * display between frames.
     */
    if (frame.bandAmounts.length > 0) {
      setDspBandAmounts(frame.bandAmounts);
      setDspBandLevels(frame.bandLevels);
    }
    // The exciter is a nonlinear stage with no transfer curve to draw, so what
    // it contributed can only be measured. Sent every frame because a light at
    // zero is a real reading rather than a missing one.
    setDspExciterActivity(frame.exciterBands, frame.exciterOrganic);
    // Same reason: a limiter that is working looks exactly like one that is
    // not until the reduction is on screen.
    setDspMaximizerReduction(frame.maximizerReductionDb);
    setDspDimensionGuard(frame.dimensionGuard);
    // The one reading the Master page never had. Its target was a number the
    // user set beside a spectrum, with nothing anywhere in the app that could
    // say what the output measured — which is how a makeup applying exactly
    // zero decibels went unseen for the life of the stage.
    setDspLoudness(frame.loudness);
    /**
     * The Master card's five readouts, which had no source at all.
     *
     * Auto headroom, True peak, Safety active, DC correction and faults were
     * fed by the worklet's `outputSafety` message. The worklet is a passthrough
     * now and posts nothing, so every one of them printed its construction
     * default — 0.0 dB of reduction and a -120 dBFS peak — over a chain that
     * was measuring all five and discarding them. Nothing about the card was
     * broken; it was reading an engine that had stopped talking.
     *
     * Shaped here rather than in the store because the wire is flat and the
     * store's type is not: Auto Headroom is a nested stage in the panel's model
     * and two adjacent floats on the pipe.
     */
    setDspOutputSafetyMeter({
      enabled: frame.master.safetyEnabled,
      truePeakFactor: frame.master.truePeakFactor,
      postFilterNormalizer: {
        gainReductionDb: frame.master.autoHeadroomReductionDb,
        inputTruePeakDb: frame.master.autoHeadroomTruePeakDb,
      },
      gainReductionDb: frame.master.safetyReductionDb,
      inputTruePeakDb: frame.master.safetyTruePeakDb,
      dcCorrectionDb: frame.master.dcCorrectionDb,
      repairedSamples: frame.master.repairedSamples,
    });
    // The Normalizer's four bars, dead for the same reason and fixed the same
    // way. The gain beside them is the one the engine is actually applying,
    // not the one the settings ask for: they differ for two seconds after a
    // background analysis lands, and that ramp is the thing worth seeing.
    setDspNormalizerMeter(frame.normalizer);
    setDspDenoiseMeter(frame.denoise);
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
       * Given back to whatever held it, not cleared.
       *
       * Clearing looks equivalent and is not: the worklet registers its
       * `AnalyserNode`s once, when the audio graph is built, so a slot emptied
       * here stays empty until the engine restarts. Switching back to the
       * TypeScript engine gave sound with dead graphs — the same complaint that
       * started this work, caused by the fix for it.
       *
       * A stale native analyser must not be left in place either: it still
       * answers `getFloatFrequencyData` and would freeze every graph on the last
       * frame the host sent. Restoring the previous holder does both jobs.
       */
      (Object.keys(analysers) as TAnalysisStage[]).forEach((stage) => {
        setDspAnalyser(stage, displaced[stage]);
      });
    },
  };
};
