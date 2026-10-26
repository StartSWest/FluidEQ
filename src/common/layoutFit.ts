/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IFiltersMap,
  NO_GAIN_FILTER_TYPES,
  clampGain,
  isBandEnabled,
} from './constants';
import { SAMPLE_FREQUENCIES, getResponseGainAtFrequencies } from './response';

/** How close the fitted bands come to the curve before the fit stops, dB. */
const CLOSE_ENOUGH_DB = 0.05;
/** The most passes the fit makes; it settles in a dozen or so. */
const MOST_PASSES = 60;
/**
 * How much of what is still missing each pass puts on: neighbouring bells
 * overlap, so a pass that put on all of it would overshoot where two lift the
 * same spot and swing from there.
 */
const STEP = 0.6;
/** A band's gain is set to a tenth of a decibel, as the sliders show it. */
const toTenth = (gain: number) => Math.round(gain * 10) / 10;

/**
 * A built-in layout's bands, carrying the sound the EQ had (Ivan,
 * 2026-10-25: "each time I change band size it resets the EQ, can't happen
 * … copy the settings from the current to the new one and adapt, fill the
 * holes smoothly from less bands to more and from more to less, trying not
 * to lose the sense").
 *
 * The layout keeps its own frequencies and Q (Ivan, 2026-10-13: a built-in
 * layout's own frequencies and its own Q, never another layout's), and only
 * its gains are chosen: so that its bands, together, play the curve the
 * current bands played. Going to more bands, the new ones between the old
 * fill the space between them with the curve's own slope; going to fewer,
 * each band takes the curve's average over the stretch it now covers, so a
 * narrow lift between two of the new centres is kept as a smaller, wider one
 * rather than dropped.
 *
 * The curve is the bands that play: an off band, and the pass, notch and
 * all-pass filters that carry no gain, shape nothing a bell could take over
 * and are left out.
 */
const fitLayoutToCurve = (
  current: IFiltersMap,
  layout: IFiltersMap,
): IFiltersMap => {
  const playing = Object.values(current).filter(
    (band) => isBandEnabled(band) && !NO_GAIN_FILTER_TYPES.includes(band.type),
  );
  const bands = Object.values(layout).sort(
    (left, right) => left.frequency - right.frequency,
  );
  if (playing.length === 0 || bands.length === 0) {
    return layout;
  }
  const curve = getResponseGainAtFrequencies(
    { filters: playing },
    SAMPLE_FREQUENCIES,
  );
  // Each new band's target: the curve averaged over the stretch the band
  // stands for, from half way to the band below to half way to the one above
  // (in octaves), and the band's own centre for the two at the ends.
  const targets = bands.map((band, at) => {
    const below = bands[at - 1]?.frequency ?? band.frequency;
    const above = bands[at + 1]?.frequency ?? band.frequency;
    const low = Math.sqrt(below * band.frequency);
    const high = Math.sqrt(above * band.frequency);
    const inside = curve.filter((_gain, index) => {
      const frequency = SAMPLE_FREQUENCIES[index];
      return frequency >= low && frequency <= high;
    });
    if (inside.length === 0) {
      return getResponseGainAtFrequencies({ filters: playing }, [
        band.frequency,
      ])[0];
    }
    return inside.reduce((sum, gain) => sum + gain, 0) / inside.length;
  });
  const centres = bands.map((band) => band.frequency);
  const fitted = bands.map((band) => ({ ...band, gain: 0 }));
  for (let pass = 0; pass < MOST_PASSES; pass += 1) {
    const played = getResponseGainAtFrequencies({ filters: fitted }, centres);
    let furthest = 0;
    fitted.forEach((band, at) => {
      const missing = targets[at] - played[at];
      furthest = Math.max(furthest, Math.abs(missing));
      band.gain = clampGain(band.gain + missing * STEP);
    });
    if (furthest < CLOSE_ENOUGH_DB) {
      break;
    }
  }
  const next: IFiltersMap = {};
  fitted.forEach((band) => {
    next[band.id] = { ...band, gain: toTenth(band.gain) };
  });
  return next;
};

export default fitLayoutToCurve;
