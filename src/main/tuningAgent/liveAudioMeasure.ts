/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Turn raw engine analysis frames (`IHostAnalysis`) into a compact,
 * LLM-readable acoustic report: seven-band tonal balance + tilt, LUFS/LRA,
 * true peak & clipping risk, stereo correlation, and active stage telemetry.
 *
 * Pure and transport-free so every calculation is held by unit tests without
 * a running audio service.
 */

import {
  ANALYSIS_BINS,
  ANALYSIS_EQ_DETAIL_WINDOW,
  type IHostAnalysis,
} from '../../common/dsp/analysisWire';
import type { IEngineAnalysis } from '../../common/dsp/engineAnalysis';
import type { IEnginePreamp } from '../../common/enginePreamp';
import {
  IIsoBandReading,
  IMeasurementDelta,
  IRegionBalance,
  buildAcousticObservations,
  computeSpectralTiltDbPerOct,
  referenceRelToMidDb,
} from './acousticDiagnostics';
import type { INowPlayingInfo } from './nowPlaying';

export type ISpectralRegion = IRegionBalance;

export interface ILiveAudioReport {
  source: 'engine' | 'library';
  sampleRate: number;
  framesSampled: number;
  hasSignal: boolean;
  nowPlaying?: INowPlayingInfo;
  loudness: {
    momentaryLufs: number;
    shortTermLufs: number;
    integratedLufs: number;
    rangeLu: number;
  };
  dynamicsSummary: {
    crestFactorDb: number;
    spectralTiltDbPerOct: number;
  };
  headroom: {
    peakLeftDb: number;
    peakRightDb: number;
    maxPeakDb: number;
    truePeakDb: number;
    autoHeadroomReductionDb: number;
    maximizerReductionDb: number;
    normalizerAppliedGainDb: number;
    engineAutoPreampDb?: number;
    engineAutoPreampActive?: boolean;
    clippingRisk: boolean;
  };
  stereo: {
    correlation: number;
    dimensionGuard: number;
  };
  spectralBalance: ISpectralRegion[];
  isoBands: IIsoBandReading[];
  observations: string[];
  deltaFromPrevious?: IMeasurementDelta;
  stages: {
    dynamics?: {
      active: boolean;
      levelDb: readonly [number, number, number];
      gainDb: readonly [number, number, number];
    };
    deEsser?: {
      maxReductionDb: number;
      frequencyHz: number;
      confidence: number;
      sibilanceDb: number;
    };
    denoise: {
      reductionDb: number;
      noiseFloorDb: number;
      clicksRepaired: number;
      voiceModelLoaded: boolean;
    };
    bassPunch: {
      transientGainDb: number;
      sustainGainDb: number;
      duckGainDb: number;
    };
    footsteps?: {
      levelDb: number;
      cueDb: number;
      bedDb: number;
      liftDb: readonly [number, number, number];
      calmDb: number;
    };
    game?: {
      environmentDb: number;
      ambience: number;
      voice: number;
      voiceDb: number;
      duckDb: number;
    };
    room?: {
      active: boolean;
      conventionalFoldDown: boolean;
    };
  };
}

const REGIONS: ReadonlyArray<{
  id: ISpectralRegion['id'];
  rangeHz: readonly [number, number];
}> = [
  { id: 'subBass', rangeHz: [20, 60] },
  { id: 'bass', rangeHz: [60, 250] },
  { id: 'lowMid', rangeHz: [250, 500] },
  { id: 'mid', rangeHz: [500, 2000] },
  { id: 'upperMid', rangeHz: [2000, 4000] },
  { id: 'presence', rangeHz: [4000, 8000] },
  { id: 'air', rangeHz: [8000, 18000] },
];

const SILENCE_FLOOR_DB = -120;
const SIGNAL_THRESHOLD_DB = -75;
/** Below this frequency the long 16384-pt FFT gives finer bass resolution. */
const DETAIL_HANDOVER_HZ = 1200;

const round1 = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 10) / 10 : SILENCE_FLOOR_DB;

const round2 = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

const linearToDb = (linear: number): number => {
  if (!Number.isFinite(linear) || linear <= 1e-6) {
    return SILENCE_FLOOR_DB;
  }
  return 20 * Math.log10(linear);
};

const mean = (values: readonly number[]): number => {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0) {
    return 0;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const regionEnergyDb = (
  bins: Float32Array,
  fftSize: number,
  sampleRate: number,
  lowHz: number,
  highHz: number,
): number => {
  if (bins.length === 0 || sampleRate <= 0 || fftSize <= 0) {
    return SILENCE_FLOOR_DB;
  }
  const binHz = sampleRate / fftSize;
  const start = Math.max(1, Math.floor(lowHz / binHz));
  const end = Math.min(bins.length - 1, Math.ceil(highHz / binHz));
  if (end < start) {
    return SILENCE_FLOOR_DB;
  }
  let powerSum = 0;
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    const db = bins[i];
    if (Number.isFinite(db) && db > SILENCE_FLOOR_DB) {
      powerSum += 10 ** (db / 10);
      count += 1;
    }
  }
  if (count === 0 || powerSum <= 0) {
    return SILENCE_FLOOR_DB;
  }
  return Math.max(SILENCE_FLOOR_DB, 10 * Math.log10(powerSum / count));
};

const ISO_CENTERS_HZ = [
  31.5, 63, 125, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 8000, 10000,
  12500, 16000,
] as const;

const pickCoarseSpectrum = (frame: IHostAnalysis): Float32Array | undefined =>
  frame.spectra.eq ??
  frame.spectra.master ??
  frame.spectra.dynamicsOut ??
  frame.spectra.dynamicsIn ??
  frame.spectra.exciter ??
  frame.spectra.denoise;

const summarizeSpectrum = (
  frames: readonly IHostAnalysis[],
  sampleRate: number,
): { spectralBalance: ISpectralRegion[]; isoBands: IIsoBandReading[] } => {
  const fftSize = ANALYSIS_BINS * 2;
  const regionTotals = new Map<ISpectralRegion['id'], number[]>();
  REGIONS.forEach((region) => regionTotals.set(region.id, []));
  const isoTotals = new Map<number, number[]>();
  ISO_CENTERS_HZ.forEach((hz) => isoTotals.set(hz, []));

  frames.forEach((frame) => {
    const coarse = pickCoarseSpectrum(frame);
    const detail = frame.eqLive?.detail;
    const detailWindow =
      frame.eqLive?.detailWindow ?? ANALYSIS_EQ_DETAIL_WINDOW;

    REGIONS.forEach((region) => {
      const [lowHz, highHz] = region.rangeHz;
      let db = SILENCE_FLOOR_DB;
      if (detail && highHz <= DETAIL_HANDOVER_HZ) {
        db = regionEnergyDb(detail, detailWindow, sampleRate, lowHz, highHz);
      } else if (coarse) {
        db = regionEnergyDb(coarse, fftSize, sampleRate, lowHz, highHz);
      }
      if (db > SILENCE_FLOOR_DB) {
        regionTotals.get(region.id)?.push(db);
      }
    });

    ISO_CENTERS_HZ.forEach((hz) => {
      // ±1/6 octave window around each ISO center frequency.
      const lowHz = hz / 1.1225;
      const highHz = hz * 1.1225;
      let db = SILENCE_FLOOR_DB;
      if (detail && highHz <= DETAIL_HANDOVER_HZ) {
        db = regionEnergyDb(detail, detailWindow, sampleRate, lowHz, highHz);
      } else if (coarse) {
        db = regionEnergyDb(coarse, fftSize, sampleRate, lowHz, highHz);
      }
      if (db > SILENCE_FLOOR_DB) {
        isoTotals.get(hz)?.push(db);
      }
    });
  });

  const rawLevels = REGIONS.map((region) => {
    const samples = regionTotals.get(region.id) ?? [];
    const levelDb = samples.length > 0 ? mean(samples) : SILENCE_FLOOR_DB;
    return { ...region, levelDb };
  });

  const midEntry = rawLevels.find((entry) => entry.id === 'mid');
  const midRef =
    midEntry && midEntry.levelDb > SILENCE_FLOOR_DB ? midEntry.levelDb : 0;

  const spectralBalance: ISpectralRegion[] = rawLevels.map((entry) => {
    const rel =
      entry.levelDb > SILENCE_FLOOR_DB && midRef !== 0
        ? entry.levelDb - midRef
        : 0;
    const centerHz = Math.sqrt(entry.rangeHz[0] * entry.rangeHz[1]);
    const dev =
      entry.levelDb > SILENCE_FLOOR_DB && midRef !== 0
        ? rel - referenceRelToMidDb(centerHz)
        : 0;
    return {
      id: entry.id,
      rangeHz: entry.rangeHz,
      levelDb: round1(entry.levelDb),
      relativeToMidDb: round1(rel),
      deviationFromReferenceDb: round1(dev),
    };
  });

  const isoBands: IIsoBandReading[] = ISO_CENTERS_HZ.map((hz) => {
    const samples = isoTotals.get(hz) ?? [];
    const levelDb = samples.length > 0 ? mean(samples) : SILENCE_FLOOR_DB;
    const rel =
      levelDb > SILENCE_FLOOR_DB && midRef !== 0 ? levelDb - midRef : 0;
    const dev =
      levelDb > SILENCE_FLOOR_DB && midRef !== 0
        ? rel - referenceRelToMidDb(hz)
        : 0;
    return {
      frequencyHz: hz,
      levelDb: round1(levelDb),
      relativeToMidDb: round1(rel),
      deviationFromReferenceDb: round1(dev),
    };
  });

  return { spectralBalance, isoBands };
};

export const summarizeLiveAudio = (
  samples: readonly IEngineAnalysis[],
  source: 'engine' | 'library',
  preamp?: IEnginePreamp,
): ILiveAudioReport => {
  const frames = samples.map((entry) => entry.frame);
  const sampleRate = samples[samples.length - 1]?.sampleRate ?? 48_000;
  const last = frames[frames.length - 1];

  const peakLeftDb = Math.max(
    SILENCE_FLOOR_DB,
    ...frames.map((frame) => linearToDb(frame.peaks[0])),
  );
  const peakRightDb = Math.max(
    SILENCE_FLOOR_DB,
    ...frames.map((frame) => linearToDb(frame.peaks[1])),
  );
  const maxPeakDb = Math.max(peakLeftDb, peakRightDb);

  const truePeakDb = Math.max(
    SILENCE_FLOOR_DB,
    ...frames.map((frame) => frame.master.autoHeadroomTruePeakDb),
  );
  const autoHeadroomReductionDb = Math.min(
    0,
    ...frames.map((frame) => frame.master.autoHeadroomReductionDb),
  );
  const maximizerReductionDb = Math.min(
    0,
    ...frames.map((frame) => frame.maximizerReductionDb),
  );

  const { spectralBalance, isoBands } = summarizeSpectrum(frames, sampleRate);

  const hasSignal =
    maxPeakDb > SIGNAL_THRESHOLD_DB ||
    (last !== undefined && last.loudness.momentaryLufs > SIGNAL_THRESHOLD_DB) ||
    spectralBalance.some((region) => region.levelDb > SIGNAL_THRESHOLD_DB);

  const clippingRisk =
    maxPeakDb > -0.3 ||
    truePeakDb > -0.2 ||
    maximizerReductionDb < -6 ||
    autoHeadroomReductionDb < -6;

  const deEsserFrames = frames
    .map((frame) => frame.deEsser)
    .filter((entry): entry is NonNullable<IHostAnalysis['deEsser']> =>
      Boolean(entry),
    );
  const deepestDeEss = deEsserFrames.reduce<
    NonNullable<IHostAnalysis['deEsser']> | undefined
  >(
    (worst, entry) =>
      !worst || entry.reductionDb < worst.reductionDb ? entry : worst,
    undefined,
  );

  const dynamicsFrames = frames
    .map((frame) => frame.dynamics)
    .filter((entry): entry is NonNullable<IHostAnalysis['dynamics']> =>
      Boolean(entry),
    );

  const footstepsFrames = frames
    .map((frame) => frame.footsteps)
    .filter((entry): entry is NonNullable<IHostAnalysis['footsteps']> =>
      Boolean(entry),
    );

  const gameFrames = frames
    .map((frame) => frame.game)
    .filter((entry): entry is NonNullable<IHostAnalysis['game']> =>
      Boolean(entry),
    );

  const momentaryLufs = round1(
    mean(frames.map((f) => f.loudness.momentaryLufs)),
  );
  const crestFactorDb =
    maxPeakDb > SIGNAL_THRESHOLD_DB && momentaryLufs > SIGNAL_THRESHOLD_DB
      ? round1(Math.max(0, maxPeakDb - momentaryLufs))
      : 0;
  const spectralTiltDbPerOct = computeSpectralTiltDbPerOct(isoBands);
  const correlation = round2(mean(frames.map((f) => f.correlation)));
  const observations = hasSignal
    ? buildAcousticObservations({
        spectralBalance,
        crestFactorDb,
        spectralTiltDbPerOct,
        clippingRisk,
        correlation,
        ...(deepestDeEss
          ? {
              deEsser: {
                frequencyHz: deepestDeEss.frequencyHz,
                sibilanceDb: deepestDeEss.sibilanceDb,
                confidence: deepestDeEss.confidence,
              },
            }
          : {}),
      })
    : ['No active audio signal detected.'];

  return {
    source,
    sampleRate,
    framesSampled: frames.length,
    hasSignal,
    loudness: {
      momentaryLufs,
      shortTermLufs: round1(mean(frames.map((f) => f.loudness.shortTermLufs))),
      integratedLufs: round1(last?.loudness.integratedLufs ?? SILENCE_FLOOR_DB),
      rangeLu: round1(last?.loudness.rangeLu ?? 0),
    },
    dynamicsSummary: {
      crestFactorDb,
      spectralTiltDbPerOct,
    },
    headroom: {
      peakLeftDb: round1(peakLeftDb),
      peakRightDb: round1(peakRightDb),
      maxPeakDb: round1(maxPeakDb),
      truePeakDb: round1(truePeakDb),
      autoHeadroomReductionDb: round1(autoHeadroomReductionDb),
      maximizerReductionDb: round1(maximizerReductionDb),
      normalizerAppliedGainDb: round1(
        mean(frames.map((f) => f.normalizer.appliedGainDb)),
      ),
      ...(preamp
        ? {
            engineAutoPreampDb: round2(preamp.gainDb),
            engineAutoPreampActive: preamp.active,
          }
        : {}),
      clippingRisk,
    },
    stereo: {
      correlation,
      dimensionGuard: round2(mean(frames.map((f) => f.dimensionGuard))),
    },
    spectralBalance,
    isoBands,
    observations,
    stages: {
      ...(dynamicsFrames.length > 0
        ? {
            dynamics: {
              active: dynamicsFrames.some((d) => d.active),
              levelDb: [
                round1(mean(dynamicsFrames.map((d) => d.levelDb[0]))),
                round1(mean(dynamicsFrames.map((d) => d.levelDb[1]))),
                round1(mean(dynamicsFrames.map((d) => d.levelDb[2]))),
              ],
              gainDb: [
                round1(mean(dynamicsFrames.map((d) => d.gainDb[0]))),
                round1(mean(dynamicsFrames.map((d) => d.gainDb[1]))),
                round1(mean(dynamicsFrames.map((d) => d.gainDb[2]))),
              ],
            },
          }
        : {}),
      ...(deepestDeEss
        ? {
            deEsser: {
              maxReductionDb: round1(deepestDeEss.reductionDb),
              frequencyHz: Math.round(deepestDeEss.frequencyHz),
              confidence: round2(deepestDeEss.confidence),
              sibilanceDb: round1(deepestDeEss.sibilanceDb),
            },
          }
        : {}),
      denoise: {
        reductionDb: round1(mean(frames.map((f) => f.denoise.reductionDb))),
        noiseFloorDb: round1(mean(frames.map((f) => f.denoise.noiseFloorDb))),
        clicksRepaired: frames.reduce(
          (total, f) => total + f.denoise.clicksRepaired,
          0,
        ),
        voiceModelLoaded: Boolean(last?.denoise.voiceModelLoaded),
      },
      bassPunch: {
        transientGainDb: round1(
          mean(frames.map((f) => f.bassPunch.transientGainDb)),
        ),
        sustainGainDb: round1(
          mean(frames.map((f) => f.bassPunch.sustainGainDb)),
        ),
        duckGainDb: round1(mean(frames.map((f) => f.bassPunch.duckGainDb))),
      },
      ...(footstepsFrames.length > 0
        ? {
            footsteps: {
              levelDb: round1(mean(footstepsFrames.map((f) => f.levelDb))),
              cueDb: round1(mean(footstepsFrames.map((f) => f.cueDb))),
              bedDb: round1(mean(footstepsFrames.map((f) => f.bedDb))),
              liftDb: [
                round1(Math.max(...footstepsFrames.map((f) => f.liftDb[0]))),
                round1(Math.max(...footstepsFrames.map((f) => f.liftDb[1]))),
                round1(Math.max(...footstepsFrames.map((f) => f.liftDb[2]))),
              ],
              calmDb: round1(Math.min(...footstepsFrames.map((f) => f.calmDb))),
            },
          }
        : {}),
      ...(gameFrames.length > 0
        ? {
            game: {
              environmentDb: round1(
                mean(gameFrames.map((g) => g.environmentDb)),
              ),
              ambience: round2(mean(gameFrames.map((g) => g.ambience))),
              voice: round2(mean(gameFrames.map((g) => g.voice))),
              voiceDb: round1(Math.max(...gameFrames.map((g) => g.voiceDb))),
              duckDb: round1(Math.min(...gameFrames.map((g) => g.duckDb))),
            },
          }
        : {}),
      ...(last?.room
        ? {
            room: {
              active: last.room.active,
              conventionalFoldDown: last.room.conventionalFoldDown,
            },
          }
        : {}),
    },
  };
};
