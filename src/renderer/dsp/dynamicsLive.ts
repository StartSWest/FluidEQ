/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IHostAnalysisDynamics } from '../../common/dsp/analysisWire';
import {
  DYNAMICS_BANDS,
  type IDynamicsSettings,
} from '../../common/dsp/dynamicsStage';
import { reportedToHeardDb } from './dynamicsCurve';
import { PLOT_LOW_DB } from './dynamicsPlot';

/**
 * What a band's readout says beside its number:
 *
 * - `silent`: nothing is playing, so no level is known.
 * - `unknown`: sound is playing through an engine that does not report the
 *   stage (the card says to update it).
 * - `off`: the stage is switched off.
 * - `untouched`, `lifting`, `holding`: what the band is doing now.
 */
export type TDynamicsState =
  'silent' | 'unknown' | 'off' | 'untouched' | 'lifting' | 'holding';

export const DYNAMICS_STATES: readonly TDynamicsState[] = [
  'silent',
  'unknown',
  'off',
  'untouched',
  'lifting',
  'holding',
];

/** A band's place on its curve at one frame. */
export interface IDynamicsMark {
  levelDb: number;
  /** As heard, the make-up taken out: the height over the line of unity. */
  gainDb: number;
}

export interface IDynamicsBandLive {
  state: TDynamicsState;
  /** Where the dot stands, or undefined while the band has no level. */
  now?: IDynamicsMark;
  /** The marks before it, oldest first, for the trail. */
  trail: readonly IDynamicsMark[];
  /** The deepest hold and the largest lift of the last moments. */
  lowestDb: number;
  highestDb: number;
}

/** How many frames the trail keeps behind the dot. */
export const TRAIL_LENGTH = 22;
/** How long the meter's marks keep the deepest hold and the largest lift. */
const PEAK_MS = 1500;
/** Under this a gain reads as nothing done, as the engine's own 0.0 dB. */
const UNTOUCHED_DB = 0.05;
/**
 * Display-only easing between the engine's reports (25 ms to half way), the
 * same as the stage's other readings: the engine already applied attack and
 * release, this only keeps a report arriving every few frames from stepping.
 * A gap longer than a quarter second is a new start, not a glide.
 */
const HALF_MS = 25;
const GAP_MS = 250;

interface IPeak {
  at: number;
  gainDb: number;
}

const stateOf = (gainDb: number): TDynamicsState => {
  if (gainDb > UNTOUCHED_DB) {
    return 'lifting';
  }
  return gainDb < -UNTOUCHED_DB ? 'holding' : 'untouched';
};

/**
 * The stage's live readings turned into what the curves draw: each band's
 * dot, its trail and the meter's marks, eased between reports.
 */
export const createDynamicsLive = () => {
  const marks: (IDynamicsMark | undefined)[] = [];
  const trails: IDynamicsMark[][] = [[], [], []];
  const peaks: IPeak[][] = [[], [], []];
  let at = Number.NEGATIVE_INFINITY;

  const reset = () => {
    marks.length = 0;
    trails.forEach((trail) => {
      trail.length = 0;
    });
    peaks.forEach((list) => {
      list.length = 0;
    });
    at = Number.NEGATIVE_INFINITY;
  };

  const resting = (state: TDynamicsState): IDynamicsBandLive[] =>
    Array.from({ length: DYNAMICS_BANDS }, () => ({
      state,
      trail: [],
      lowestDb: 0,
      highestDb: 0,
    }));

  const read = (
    report: Readonly<IHostAnalysisDynamics> | undefined,
    isLive: boolean,
    settings: IDynamicsSettings,
    now: number,
  ): IDynamicsBandLive[] => {
    if (!isLive || !report) {
      reset();
      return resting(isLive ? 'unknown' : 'silent');
    }
    if (!report.active) {
      reset();
      return resting(settings.enabled ? 'untouched' : 'off');
    }
    const elapsed = now - at;
    const amount =
      elapsed > GAP_MS ? 1 : 1 - 2 ** (-Math.max(0, elapsed) / HALF_MS);
    at = now;
    return report.levelDb.map((levelDb, band) => {
      const gainDb = reportedToHeardDb(
        report.gainDb[band],
        settings.makeupDb,
        settings.mix,
      );
      const trail = trails[band];
      const list = peaks[band];
      list.push({ at: now, gainDb });
      while (list.length > 0 && now - list[0].at > PEAK_MS) {
        list.shift();
      }
      const lowestDb = Math.min(0, ...list.map((peak) => peak.gainDb));
      const highestDb = Math.max(0, ...list.map((peak) => peak.gainDb));
      // A band under the plot's floor hears nothing worth placing a dot on.
      if (levelDb < PLOT_LOW_DB) {
        marks[band] = undefined;
        trail.length = 0;
        return { state: stateOf(gainDb), trail: [], lowestDb, highestDb };
      }
      const before = marks[band];
      const mark: IDynamicsMark = before
        ? {
            levelDb: before.levelDb + (levelDb - before.levelDb) * amount,
            gainDb: before.gainDb + (gainDb - before.gainDb) * amount,
          }
        : { levelDb, gainDb };
      marks[band] = mark;
      trail.push(mark);
      if (trail.length > TRAIL_LENGTH + 1) {
        trail.shift();
      }
      return {
        state: stateOf(mark.gainDb),
        now: mark,
        trail: trail.slice(0, -1),
        lowestDb,
        highestDb,
      };
    });
  };

  return { read, reset };
};

/** A gain as the readouts print it: a sign, one decimal, and 0.0 at rest. */
export const formatGainDb = (gainDb: number): string => {
  if (Math.abs(gainDb) < UNTOUCHED_DB) {
    return '0.0';
  }
  return `${gainDb > 0 ? '+' : ''}${gainDb.toFixed(1)}`;
};
