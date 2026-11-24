/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DYNAMICS_RANGES,
  type IDynamicsBand,
} from '../../common/dsp/dynamicsStage';
import dynamicsGainDb, { bandLifts, liftTopDb } from './dynamicsCurve';

/**
 * The points on a band's curve that set it, by where they sit:
 *
 * - `liftStart`, hollow, where the lift begins: sideways is Below.
 * - `lift`, filled, the top of the lift: up and down is Up to, sideways the
 *   ratio. On a band that lifts nothing it is the dashed point at Below,
 *   pulled out of the line to start a lift.
 * - `holdStart`, hollow, where the hold begins: sideways is Above.
 * - `holdEnd`, filled, the curve at 0 dBFS: up and down is the hold's ratio.
 *
 * A slot, not a shape: the lift's point is one slot whether it is the top or
 * the pull, so a drag that takes a lift down to nothing keeps hold of the
 * same element and goes on.
 */
export type TDynamicsPoint = 'liftStart' | 'lift' | 'holdStart' | 'holdEnd';

/** How a press on a point moves the band, fixed for the length of a drag. */
export type TDynamicsDrag =
  'liftStart' | 'liftTop' | 'liftPull' | 'holdStart' | 'holdEnd';

export interface IDynamicsPointAt {
  inDb: number;
  outDb: number;
}

/** The points a band shows: its lift's start only while it lifts. */
export const pointsOf = (band: IDynamicsBand): readonly TDynamicsPoint[] =>
  bandLifts(band)
    ? ['liftStart', 'lift', 'holdStart', 'holdEnd']
    : ['lift', 'holdStart', 'holdEnd'];

export const dragOf = (
  point: TDynamicsPoint,
  band: IDynamicsBand,
): TDynamicsDrag => {
  if (point === 'lift') {
    return bandLifts(band) ? 'liftTop' : 'liftPull';
  }
  return point;
};

/** Where a point stands, on the curve the settings draw (mix aside). */
export const pointAt = (
  point: TDynamicsPoint,
  band: IDynamicsBand,
): IDynamicsPointAt => {
  switch (point) {
    case 'liftStart':
      return { inDb: band.upThresholdDb, outDb: band.upThresholdDb };
    case 'lift': {
      const top = liftTopDb(band);
      return top === undefined
        ? { inDb: band.upThresholdDb, outDb: band.upThresholdDb }
        : { inDb: top, outDb: top + band.upMaxDb };
    }
    case 'holdStart':
      return { inDb: band.downThresholdDb, outDb: band.downThresholdDb };
    default:
      return { inDb: 0, outDb: dynamicsGainDb(band, 0) };
  }
};

/** Each value on the steps its dial always had. */
const STEP = {
  threshold: 1,
  upMax: 0.5,
  ratio: 0.1,
} as const;

const onStep = (
  value: number,
  range: { min: number; max: number },
  step: number,
) => {
  const held = Math.min(Math.max(value, range.min), range.max);
  return Math.round(Math.round(held / step) * step * 1000) / 1000;
};

/**
 * Pulled this far off the line, the dashed point starts a lift; nearer, it
 * slides along the line and moves where the lift would start. Without the
 * margin a press that wavered by a pixel would start a 0.5 dB lift.
 */
const PULL_DB = 1.5;

/**
 * The lift whose top stands at (`inDb`, `outDb`): Up to is the height over
 * the line, the ratio the slope back to Below — so the point stays under
 * the hand.
 */
const liftThrough = (
  band: IDynamicsBand,
  inDb: number,
  outDb: number,
): IDynamicsBand => {
  const r = DYNAMICS_RANGES;
  const upMaxDb = onStep(outDb - inDb, r.upMaxDb, STEP.upMax);
  const distance = band.upThresholdDb - inDb;
  const upRatio =
    distance - upMaxDb <= 0.01
      ? r.upRatio.max
      : onStep(distance / (distance - upMaxDb), r.upRatio, STEP.ratio);
  return { ...band, upMaxDb, upRatio };
};

/** The hold whose curve passes through `outDb` at 0 dBFS. */
const holdThrough = (band: IDynamicsBand, outDb: number): IDynamicsBand => {
  const r = DYNAMICS_RANGES;
  const above = band.downThresholdDb;
  // A hold over 0 dBFS has nothing to act on, and no ratio moves its end.
  if (above > -0.5) {
    return band;
  }
  if (outDb >= -0.05) {
    return { ...band, downRatio: r.downRatio.min };
  }
  const rise = outDb - above;
  const downRatio =
    rise <= 0.05
      ? r.downRatio.max
      : onStep(-above / rise, r.downRatio, STEP.ratio);
  return { ...band, downRatio };
};

/**
 * The band a drag leaves, the point having been taken to (`inDb`, `outDb`):
 * each point moves only the values it is named for, held to the engine's
 * ranges and to the steps the dials had.
 */
export const dragPoint = (
  drag: TDynamicsDrag,
  band: IDynamicsBand,
  inDb: number,
  outDb: number,
): IDynamicsBand => {
  const r = DYNAMICS_RANGES;
  switch (drag) {
    case 'liftStart':
      return {
        ...band,
        upThresholdDb: onStep(inDb, r.upThresholdDb, STEP.threshold),
      };
    case 'holdStart':
      return {
        ...band,
        downThresholdDb: onStep(inDb, r.downThresholdDb, STEP.threshold),
      };
    case 'holdEnd':
      return holdThrough(band, outDb);
    case 'liftPull':
      return outDb - inDb < PULL_DB
        ? {
            ...band,
            upThresholdDb: onStep(inDb, r.upThresholdDb, STEP.threshold),
          }
        : liftThrough(band, inDb, outDb);
    default:
      return liftThrough(band, inDb, outDb);
  }
};

const KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
] as const;
type TPointKey = (typeof KEYS)[number];

export const isPointKey = (key: string): key is TPointKey =>
  (KEYS as readonly string[]).includes(key);

/** +1 for a key that moves a point up or right, -1 down or left. */
const towards = (key: TPointKey) =>
  key === 'ArrowUp' || key === 'ArrowRight' || key === 'PageUp' ? 1 : -1;

/**
 * The band an arrow key leaves: the value the point's drag moves, a step at
 * a time (PageUp, PageDown and Shift for a larger one), in the direction the
 * point moves on screen. Undefined for a key the point does not answer, so
 * the page keeps it.
 */
export const stepPoint = (
  drag: TDynamicsDrag,
  band: IDynamicsBand,
  key: TPointKey,
  coarse: boolean,
): IDynamicsBand | undefined => {
  const r = DYNAMICS_RANGES;
  const large = coarse || key === 'PageUp' || key === 'PageDown';
  const sign = towards(key);
  const ends = key === 'Home' || key === 'End';
  switch (drag) {
    case 'liftStart':
    case 'holdStart': {
      const field = drag === 'liftStart' ? 'upThresholdDb' : 'downThresholdDb';
      const range = r[field];
      if (ends) {
        return { ...band, [field]: key === 'Home' ? range.min : range.max };
      }
      const delta = sign * (large ? 6 : STEP.threshold);
      return {
        ...band,
        [field]: onStep(band[field] + delta, range, STEP.threshold),
      };
    }
    case 'holdEnd': {
      if (ends) {
        return {
          ...band,
          downRatio: key === 'Home' ? r.downRatio.min : r.downRatio.max,
        };
      }
      // Up raises the end: less hold, a smaller ratio.
      const delta = -sign * (large ? 1 : STEP.ratio);
      return {
        ...band,
        downRatio: onStep(band.downRatio + delta, r.downRatio, STEP.ratio),
      };
    }
    case 'liftPull': {
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const delta = sign * (large ? 6 : STEP.threshold);
        return {
          ...band,
          upThresholdDb: onStep(
            band.upThresholdDb + delta,
            r.upThresholdDb,
            STEP.threshold,
          ),
        };
      }
      if (key !== 'ArrowUp' && key !== 'PageUp') {
        return undefined;
      }
      // Pulled out to a gentle lift, whatever half of it was missing.
      const pulledDb = large ? 6 : 1;
      return {
        ...band,
        upRatio: band.upRatio > 1 ? band.upRatio : 2,
        upMaxDb: band.upMaxDb > 0 ? band.upMaxDb : pulledDb,
      };
    }
    default: {
      if (ends) {
        return undefined;
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        // Never down to one from here: a lift is taken away by lowering it.
        const ratioFloor = { min: 1.1, max: r.upRatio.max };
        const delta = sign * (large ? 0.5 : STEP.ratio);
        return {
          ...band,
          upRatio: onStep(band.upRatio + delta, ratioFloor, STEP.ratio),
        };
      }
      // Up to, with the top kept where it stands across: the point goes
      // straight up or down and the slope back to Below follows it.
      const top = pointAt('lift', band).inDb;
      const upMaxDb = onStep(
        band.upMaxDb + sign * (large ? 3 : STEP.upMax),
        r.upMaxDb,
        STEP.upMax,
      );
      return liftThrough(band, top, top + upMaxDb);
    }
  }
};
