/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IMasterSettings,
  IInputNormalizerSettings,
  MASTER_LOUDNESS_GAIN_MAX_DB,
  MASTER_LOUDNESS_GAIN_MIN_DB,
} from '../../common/dsp/chain';
import { ILibraryNormalizationAnalysis } from '../../common/library/types';
import { FilterTypeEnum } from '../../common/constants';
import {
  IBiquadCoefficients,
  IBiquadState,
  biquadCoefficients,
  createBiquadState,
} from './biquad';
import { oversampleFactorForSampleRate } from './oversample';
import { createTruePeakState, truePeakOfSample } from './truePeak';

const ANALYSIS_VERSION = 1;
const SILENCE_DB = -120;
const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;
const LOUDNESS_OFFSET = -0.691;
const MAX_LOUDNESS_GAIN_DB = 12;
const MIN_NORMALIZER_GAIN_DB = -48;

export interface IInputAnalysisProgress {
  fraction: number;
}

export interface IAnalyzeInputOptions {
  sampleRateHint?: number;
  signal: AbortSignal;
  isCancelled: () => boolean;
  onProgress: (progress: IInputAnalysisProgress) => void;
}

const dbFromMagnitude = (magnitude: number): number =>
  magnitude > 0 ? 20 * Math.log10(magnitude) : SILENCE_DB;

const loudnessFromEnergy = (energy: number): number =>
  energy > 0 ? LOUDNESS_OFFSET + 10 * Math.log10(energy) : SILENCE_DB;

const processOne = (
  state: IBiquadState,
  sample: number,
  { b0, b1, b2, a1, a2 }: IBiquadCoefficients,
): number => {
  const output =
    b0 * sample + b1 * state.x1 + b2 * state.x2 - a1 * state.y1 - a2 * state.y2;
  state.x2 = state.x1;
  state.x1 = sample;
  state.y2 = state.y1;
  state.y1 = output;
  return output;
};

/** The two cascaded filters that BS.1770 calls K-weighting. */
const kWeighting = (sampleRate: number) => ({
  shelf: biquadCoefficients(
    {
      type: FilterTypeEnum.HSC,
      frequency: 1_681.974450955533,
      gainDb: 3.999843853973347,
      quality: Math.SQRT1_2,
    },
    sampleRate,
  ),
  highpass: biquadCoefficients(
    {
      type: FilterTypeEnum.HPQ,
      frequency: 38.13547087602444,
      gainDb: 0,
      quality: 0.5003270373238773,
    },
    sampleRate,
  ),
});

const meanAbove = (energies: readonly number[], threshold: number): number => {
  let total = 0;
  let count = 0;
  energies.forEach((energy) => {
    if (loudnessFromEnergy(energy) > threshold) {
      total += energy;
      count += 1;
    }
  });
  return count > 0 ? total / count : 0;
};

const integratedLoudness = (blockEnergies: readonly number[]): number => {
  const absolute = meanAbove(blockEnergies, ABSOLUTE_GATE_LUFS);
  if (absolute <= 0) {
    return SILENCE_DB;
  }
  const relativeGate = loudnessFromEnergy(absolute) + RELATIVE_GATE_LU;
  return loudnessFromEnergy(meanAbove(blockEnergies, relativeGate));
};

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

/**
 * Decode and measure one complete file before its constant gain is chosen.
 *
 * Four-hundred-millisecond blocks overlap by 75%, then pass the absolute and
 * relative gates from BS.1770. The raw samples are measured for true peak in
 * the same pass. Yielding once per second of programme keeps a large lossless
 * file from turning the analysis into a frozen renderer, and cancellation is
 * checked at that same boundary when the queue moves on.
 */
export const analyzeInputTrack = async (
  bytes: ArrayBuffer,
  options: IAnalyzeInputOptions,
): Promise<ILibraryNormalizationAnalysis | undefined> => {
  const hinted = options.sampleRateHint;
  const analysisRate =
    typeof hinted === 'number' && Number.isFinite(hinted) && hinted >= 8_000
      ? Math.min(192_000, hinted)
      : 48_000;
  const context = new AudioContext({ sampleRate: analysisRate });
  let decoded: AudioBuffer | undefined;
  let resolveAbort: (() => void) | undefined;
  const aborted = new Promise<undefined>((resolve) => {
    if (options.signal.aborted) {
      resolve(undefined);
      return;
    }
    resolveAbort = () => resolve(undefined);
    options.signal.addEventListener('abort', resolveAbort, { once: true });
  });
  try {
    // Chromium may detach the buffer it decodes. The caller retains the
    // original for the player's blob, so analysis gets its own copy.
    decoded = await Promise.race([
      context.decodeAudioData(bytes.slice(0)).catch(() => undefined),
      aborted,
    ]);
  } catch {
    return undefined;
  } finally {
    if (resolveAbort) {
      options.signal.removeEventListener('abort', resolveAbort);
    }
    await context.close().catch(() => undefined);
  }
  if (!decoded || options.signal.aborted || options.isCancelled()) {
    return undefined;
  }

  const channelCount = Math.min(2, decoded.numberOfChannels);
  if (channelCount === 0 || decoded.length === 0) {
    return undefined;
  }
  const channels = Array.from({ length: channelCount }, (_, channel) =>
    decoded.getChannelData(channel),
  );
  const truePeakStates = Array.from({ length: channelCount }, () =>
    createTruePeakState(oversampleFactorForSampleRate(decoded.sampleRate)),
  );
  const shelfStates = Array.from({ length: channelCount }, () =>
    createBiquadState(),
  );
  const highpassStates = Array.from({ length: channelCount }, () =>
    createBiquadState(),
  );
  const filters = kWeighting(decoded.sampleRate);
  const blockFrames = Math.max(1, Math.round(decoded.sampleRate * 0.4));
  const hopFrames = Math.max(1, Math.round(decoded.sampleRate * 0.1));
  const yieldFrames = Math.max(1, Math.round(decoded.sampleRate));
  const energyWindow = new Float64Array(blockFrames);
  const blockEnergies: number[] = [];
  let energySum = 0;
  let truePeakMagnitude = 0;

  for (let frame = 0; frame < decoded.length; frame += 1) {
    let combinedEnergy = 0;
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = channels[channel][frame];
      truePeakMagnitude = Math.max(
        truePeakMagnitude,
        truePeakOfSample(truePeakStates[channel], sample),
      );
      const shelf = processOne(shelfStates[channel], sample, filters.shelf);
      const weighted = processOne(
        highpassStates[channel],
        shelf,
        filters.highpass,
      );
      combinedEnergy += weighted * weighted;
    }

    const windowAt = frame % blockFrames;
    energySum += combinedEnergy - energyWindow[windowAt];
    energyWindow[windowAt] = combinedEnergy;
    const completed = frame + 1;
    if (
      completed >= blockFrames &&
      (completed - blockFrames) % hopFrames === 0
    ) {
      blockEnergies.push(energySum / blockFrames);
    }
    if (completed % yieldFrames === 0) {
      options.onProgress({ fraction: completed / decoded.length });
      // eslint-disable-next-line no-await-in-loop -- deliberate renderer yield; see function comment.
      await nextFrame();
      if (options.signal.aborted || options.isCancelled()) {
        return undefined;
      }
    }
  }

  // Complete the interpolation window at EOF; otherwise a last-sample peak
  // can sit in the half-window the true-peak FIR has not observed yet.
  for (let flush = 0; flush < 12; flush += 1) {
    for (let channel = 0; channel < truePeakStates.length; channel += 1) {
      truePeakMagnitude = Math.max(
        truePeakMagnitude,
        truePeakOfSample(truePeakStates[channel], 0),
      );
    }
  }
  options.onProgress({ fraction: 1 });
  return {
    version: ANALYSIS_VERSION,
    truePeakDbtp: Math.max(SILENCE_DB, dbFromMagnitude(truePeakMagnitude)),
    integratedLufs: Math.max(SILENCE_DB, integratedLoudness(blockEnergies)),
  };
};

/**
 * Which term produced the gain, when it was not the one the user set.
 *
 * `ceiling` is the common and the confusing one: a loudness target asks for a
 * boost, the track already peaks near or above full scale, and the true-peak
 * ceiling spends that room first. Reported so the panel can say which control
 * won instead of showing a number that contradicts the dial beside it.
 */
export type TNormalizerLimit =
  'none' | 'ceiling' | 'maxGain' | 'minGain' | 'gate';

export interface INormalizerGainBreakdown {
  /** What the selected mode asked for, before any limit was applied. */
  requestedDb: number;
  /** Ceiling minus measured true peak: what is left before clipping. */
  peakRoomDb: number;
  appliedDb: number;
  limitedBy: TNormalizerLimit;
}

/**
 * The gain and the reason for it, derived together.
 *
 * One function rather than a readout that recomputes the explanation beside an
 * engine that computes the value. Two derivations of the same number drift,
 * and a meter that disagrees with what is being applied is worse than no meter
 * at all — it is the audio lying with a straight face.
 */
export const normalizerGainBreakdown = (
  settings: IInputNormalizerSettings,
  analysis: ILibraryNormalizationAnalysis | undefined,
): INormalizerGainBreakdown => {
  if (settings.mode === 'off' || !analysis) {
    return {
      requestedDb: 0,
      peakRoomDb: 0,
      appliedDb: 0,
      limitedBy: 'none',
    };
  }
  const peakRoomDb = settings.truePeakDbtp - analysis.truePeakDbtp;

  if (settings.mode === 'truePeak') {
    // The ceiling IS the target here, and the mode only ever comes down: a
    // track already under it is left alone rather than lifted to meet it.
    const requestedDb = Math.min(0, peakRoomDb);
    const appliedDb = Math.max(MIN_NORMALIZER_GAIN_DB, requestedDb);
    return {
      requestedDb,
      peakRoomDb,
      appliedDb,
      limitedBy: appliedDb > requestedDb ? 'minGain' : 'none',
    };
  }

  if (analysis.integratedLufs <= ABSOLUTE_GATE_LUFS) {
    return {
      requestedDb: 0,
      peakRoomDb,
      appliedDb: 0,
      limitedBy: 'gate',
    };
  }

  const requestedDb = settings.targetLufs - analysis.integratedLufs;
  const bounded = Math.min(MAX_LOUDNESS_GAIN_DB, requestedDb, peakRoomDb);
  const appliedDb = Math.max(MIN_NORMALIZER_GAIN_DB, bounded);

  let limitedBy: TNormalizerLimit = 'none';
  if (appliedDb > bounded) {
    limitedBy = 'minGain';
  } else if (peakRoomDb < requestedDb && peakRoomDb <= MAX_LOUDNESS_GAIN_DB) {
    limitedBy = 'ceiling';
  } else if (MAX_LOUDNESS_GAIN_DB < requestedDb) {
    limitedBy = 'maxGain';
  }

  return { requestedDb, peakRoomDb, appliedDb, limitedBy };
};

/** The one linked gain used from the first sample to the last. */
export const normalizerGainDb = (
  settings: IInputNormalizerSettings,
  analysis: ILibraryNormalizationAnalysis | undefined,
): number => normalizerGainBreakdown(settings, analysis).appliedDb;

/**
 * Constant LUFS-referenced makeup for Master.
 *
 * This deliberately never turns quiet passages into a moving target. It uses
 * the whole-track source measurement after input normalization, applies the
 * signed correction needed to reach the chosen programme target, and leaves
 * the final linked true-peak limiter to catch peaks introduced by creative
 * processors.
 */
export const masterLoudnessGainDb = (
  master: IMasterSettings,
  normalizer: IInputNormalizerSettings,
  analysis: ILibraryNormalizationAnalysis | undefined,
): number => {
  if (!master.enabled || !master.loudnessMaximize || !analysis) {
    return 0;
  }
  const normalizedLufs =
    analysis.integratedLufs + normalizerGainDb(normalizer, analysis);
  const normalizedPeak =
    analysis.truePeakDbtp + normalizerGainDb(normalizer, analysis);
  if (normalizedLufs <= ABSOLUTE_GATE_LUFS) {
    return 0;
  }
  const loudnessGain = master.loudnessTargetLufs - normalizedLufs;
  if (loudnessGain <= 0) {
    // A target is not merely a boost cap. A track louder than the selected
    // programme level must receive constant attenuation for the dial to mean
    // LUFS target rather than "maximum boost target".
    return Math.max(MASTER_LOUDNESS_GAIN_MIN_DB, loudnessGain);
  }
  // The cached whole-file true peak is known before playback. Spend only its
  // real remaining room instead of asking a live envelope to discover the
  // answer during a chorus and then undo it during a quiet passage.
  const peakRoom =
    master.ceilingDb - normalizedPeak - Math.max(0, master.outputTrimDb);
  return Math.max(
    0,
    Math.min(MASTER_LOUDNESS_GAIN_MAX_DB, loudnessGain, peakRoom),
  );
};
