/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Mastering-grade reference-curve comparison, diagnostic observations, and
 * before/after measurement deltas built on FluidEQ's own `referenceCurve.ts`.
 */

import {
  REFERENCE_SHAPE,
  REFERENCE_SLOPE_DB_PER_DECADE,
} from '../../common/referenceCurve';

export interface IIsoBandReading {
  frequencyHz: number;
  levelDb: number;
  relativeToMidDb: number;
  deviationFromReferenceDb: number;
}

export interface IRegionBalance {
  id: 'subBass' | 'bass' | 'lowMid' | 'mid' | 'upperMid' | 'presence' | 'air';
  rangeHz: readonly [number, number];
  levelDb: number;
  relativeToMidDb: number;
  deviationFromReferenceDb: number;
}

export interface IMeasurementDelta {
  momentaryLufsDb: number;
  truePeakDb: number;
  spectralTiltDbPerOct: number;
  spectralDeltaDb: Record<string, number>;
}

const SILENCE_FLOOR_DB = -120;
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Log-frequency linear interpolation of FluidEQ's `REFERENCE_SHAPE`. */
const interpolateReferenceShape = (hz: number): number => {
  const points = REFERENCE_SHAPE;
  if (points.length === 0) {
    return 0;
  }
  if (hz <= points[0].frequency) {
    return points[0].level;
  }
  const last = points[points.length - 1];
  if (hz >= last.frequency) {
    return last.level;
  }
  const logHz = Math.log10(hz);
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (hz >= a.frequency && hz <= b.frequency) {
      const span = Math.log10(b.frequency) - Math.log10(a.frequency);
      const t = span > 0 ? (logHz - Math.log10(a.frequency)) / span : 0;
      return a.level + t * (b.level - a.level);
    }
  }
  return 0;
};

/**
 * Expected commercial-master energy (dB relative to 1 kHz) at `hz`, matching
 * FluidEQ's Smart EQ reference slope (`-11 dB/decade`) + `REFERENCE_SHAPE`.
 */
export const referenceRelToMidDb = (hz: number): number => {
  const safeHz = Math.max(20, hz);
  const at1k = interpolateReferenceShape(1000);
  return (
    REFERENCE_SLOPE_DB_PER_DECADE * Math.log10(safeHz / 1000) +
    (interpolateReferenceShape(safeHz) - at1k)
  );
};

/**
 * Weighted slope (dB/octave) of `deviationFromReferenceDb` across 125 Hz..8 kHz.
 * Near 0 = balanced; negative = warm/dark; positive = bright/thin.
 */
export const computeSpectralTiltDbPerOct = (
  isoBands: readonly IIsoBandReading[],
): number => {
  const active = isoBands.filter(
    (b) =>
      b.frequencyHz >= 125 &&
      b.frequencyHz <= 8000 &&
      b.levelDb > SILENCE_FLOOR_DB,
  );
  if (active.length < 3) {
    return 0;
  }
  const xs = active.map((b) => Math.log2(b.frequencyHz / 1000));
  const ys = active.map((b) => b.deviationFromReferenceDb);
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }
  return den > 0 ? round2(num / den) : 0;
};

export const buildAcousticObservations = (input: {
  spectralBalance: readonly IRegionBalance[];
  crestFactorDb: number;
  spectralTiltDbPerOct: number;
  clippingRisk: boolean;
  correlation: number;
  deEsser?: { frequencyHz: number; sibilanceDb: number; confidence: number };
}): string[] => {
  const notes: string[] = [];
  const byId = new Map(input.spectralBalance.map((r) => [r.id, r]));
  const sub = byId.get('subBass');
  const bass = byId.get('bass');
  const lowMid = byId.get('lowMid');
  const upperMid = byId.get('upperMid');
  const presence = byId.get('presence');
  const air = byId.get('air');

  if (input.clippingRisk) {
    notes.push(
      'Headroom warning: peaks or limiting are close to 0 dBFS; keep Auto Normalize on or reduce boosts.',
    );
  }
  if (lowMid && lowMid.levelDb > SILENCE_FLOOR_DB) {
    if (lowMid.deviationFromReferenceDb >= 3.5) {
      notes.push(
        `Low-mid buildup (+${lowMid.deviationFromReferenceDb} dB vs reference at 250-500 Hz) may sound muddy or boxy.`,
      );
    } else if (lowMid.deviationFromReferenceDb <= -4.5) {
      notes.push(
        `Lean low-mids (${lowMid.deviationFromReferenceDb} dB vs reference at 250-500 Hz); sound may feel thin.`,
      );
    }
  }
  if (bass && bass.levelDb > SILENCE_FLOOR_DB) {
    if (bass.deviationFromReferenceDb >= 4.5) {
      notes.push(
        `Heavy bass energy (+${bass.deviationFromReferenceDb} dB vs reference at 60-250 Hz).`,
      );
    } else if (bass.deviationFromReferenceDb <= -5) {
      notes.push(
        `Light bass weight (${bass.deviationFromReferenceDb} dB vs reference at 60-250 Hz).`,
      );
    }
  }
  if (
    sub &&
    bass &&
    sub.levelDb > SILENCE_FLOOR_DB &&
    bass.levelDb > SILENCE_FLOOR_DB &&
    sub.deviationFromReferenceDb <= -8
  ) {
    notes.push(
      `Sub-bass (20-60 Hz) is strongly rolled off (${sub.deviationFromReferenceDb} dB vs reference).`,
    );
  }
  if (upperMid && upperMid.levelDb > SILENCE_FLOOR_DB) {
    if (upperMid.deviationFromReferenceDb >= 3.5) {
      notes.push(
        `Forward upper-mids (+${upperMid.deviationFromReferenceDb} dB at 2-4 kHz) may feel shouty or fatiguing.`,
      );
    } else if (upperMid.deviationFromReferenceDb <= -3.5) {
      notes.push(
        `Recessed upper-mids (${upperMid.deviationFromReferenceDb} dB at 2-4 kHz); vocals/lead instruments may sit back.`,
      );
    }
  }
  if (presence && presence.levelDb > SILENCE_FLOOR_DB) {
    if (presence.deviationFromReferenceDb <= -5) {
      notes.push(
        `Dark/veiled treble (${presence.deviationFromReferenceDb} dB vs reference at 4-8 kHz).`,
      );
    } else if (presence.deviationFromReferenceDb >= 4) {
      notes.push(
        `Bright presence (+${presence.deviationFromReferenceDb} dB at 4-8 kHz); watch for listening fatigue.`,
      );
    }
  }
  if (
    air &&
    air.levelDb > SILENCE_FLOOR_DB &&
    air.deviationFromReferenceDb <= -6
  ) {
    notes.push(
      `Rolled-off top air (${air.deviationFromReferenceDb} dB vs reference at 8-18 kHz).`,
    );
  }
  if (
    input.deEsser &&
    input.deEsser.frequencyHz >= 4000 &&
    input.deEsser.confidence >= 0.6 &&
    input.deEsser.sibilanceDb > -18
  ) {
    notes.push(
      `Sibilance energy centered near ${Math.round(input.deEsser.frequencyHz)} Hz.`,
    );
  }
  if (input.crestFactorDb > 0 && input.crestFactorDb < 8) {
    notes.push(
      `Dense/heavily mastered track (crest factor ${input.crestFactorDb} dB); avoid heavy compression or limiting.`,
    );
  } else if (input.crestFactorDb >= 14) {
    notes.push(
      `Dynamic recording (crest factor ${input.crestFactorDb} dB); preserve headroom and avoid aggressive limiting.`,
    );
  }
  if (input.correlation < 0.25) {
    notes.push(
      `Very wide or phase-diffuse stereo image (correlation ${input.correlation}); avoid extra stereo widening.`,
    );
  }
  if (notes.length === 0) {
    notes.push(
      `Spectral balance is close to FluidEQ reference (tilt ${input.spectralTiltDbPerOct} dB/oct).`,
    );
  }
  return notes;
};

export const computeMeasurementDelta = (
  previous: {
    loudness: { momentaryLufs: number };
    headroom: { truePeakDb: number };
    dynamicsSummary: { spectralTiltDbPerOct: number };
    spectralBalance: readonly IRegionBalance[];
  },
  current: {
    loudness: { momentaryLufs: number };
    headroom: { truePeakDb: number };
    dynamicsSummary: { spectralTiltDbPerOct: number };
    spectralBalance: readonly IRegionBalance[];
  },
): IMeasurementDelta => {
  const prevById = new Map(previous.spectralBalance.map((r) => [r.id, r]));
  const spectralDeltaDb: Record<string, number> = {};
  current.spectralBalance.forEach((region) => {
    const before = prevById.get(region.id);
    if (
      before &&
      before.levelDb > SILENCE_FLOOR_DB &&
      region.levelDb > SILENCE_FLOOR_DB
    ) {
      spectralDeltaDb[region.id] = round1(
        region.relativeToMidDb - before.relativeToMidDb,
      );
    }
  });
  return {
    momentaryLufsDb: round1(
      current.loudness.momentaryLufs - previous.loudness.momentaryLufs,
    ),
    truePeakDb: round1(
      current.headroom.truePeakDb - previous.headroom.truePeakDb,
    ),
    spectralTiltDbPerOct: round2(
      current.dynamicsSummary.spectralTiltDbPerOct -
        previous.dynamicsSummary.spectralTiltDbPerOct,
    ),
    spectralDeltaDb,
  };
};
