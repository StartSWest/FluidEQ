/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  IFilter,
  IGraphicEqPoint,
  IHeadphoneSettings,
  NO_GAIN_FILTER_TYPES,
  clampGain,
} from './constants';

/**
 * The strength this correction is applied at, as a fraction.
 *
 * Shared by both readings of the settings so a half-strength graphic curve and a
 * half-strength filter set mean the same thing, and so a corrupt value falls
 * back to full in one place rather than two.
 */
const layerIntensity = (settings: IHeadphoneSettings | undefined): number => {
  if (!settings) {
    return 0;
  }
  return Number.isFinite(settings.intensity)
    ? Math.max(0, Math.min(1, settings.intensity))
    : 1;
};

/**
 * The published correction as a graphic curve, scaled by its strength.
 *
 * Preferred over the filters when it is there, because it is what the profile
 * actually said. AutoEQ publishes some corrections as points and Equalizer APO
 * renders them natively; the filter projection alongside them exists so the
 * editor has bands to draw, and applying that projection instead was a quiet
 * downgrade — a smoothed approximation standing in for the measurement.
 *
 * A curve that is flat everywhere is no curve at all, and is dropped like an
 * inert filter would be. Unlike a filter set, it is NOT sorted or deduplicated
 * here: APO reads the points in the order they are written and interpolates
 * between neighbours, so reordering them would redraw the curve.
 */
export const getHeadphoneGraphicEq = (
  settings: IHeadphoneSettings | undefined,
): IGraphicEqPoint[] => {
  const points = settings?.apoOverride
    ? settings.apoOverride.graphicEq
    : settings?.graphicEq;
  if (!points?.length) {
    return [];
  }
  const intensity = layerIntensity(settings);
  if (intensity === 0) {
    return [];
  }
  const gainPrecision = settings?.apoOverride ? 100 : 10;

  const scaled = points
    .filter(
      ({ frequency, gain }) =>
        Number.isFinite(frequency) && Number.isFinite(gain),
    )
    .map(({ frequency, gain }) => ({
      frequency,
      // Rounded like the filters are, and for the same reason: a tenth is what
      // APO reads and what anybody hears, and a halved curve otherwise writes
      // out a file full of 2.8499999.
      gain: clampGain(
        Math.round(gain * intensity * gainPrecision) / gainPrecision,
      ),
    }));

  return scaled.some(({ gain }) => gain !== 0) ? scaled : [];
};

/**
 * The published headphone correction as filters, scaled by its strength.
 *
 * Written the same way the voicing and the driver are, and deliberately so:
 * three layers that correct three different things should be three blocks of
 * anonymous `Filter N:` lines after the user's own bands, not one of them
 * hiding inside those bands.
 *
 * A peak or shelf at 0 dB is inert, so it is dropped rather than written as a
 * command that does nothing — the same rule every other layer follows. A
 * gainless type is kept, because it shapes the signal at 0 dB.
 *
 * These are the fallback, not the first choice, when a profile also carries a
 * graphic curve: see `getHeadphoneGraphicEq`. They stay the editor's reading of
 * the layer either way, since bands are what a graph and a slider are made of.
 */
export const getHeadphoneFilters = (
  settings: IHeadphoneSettings | undefined,
): Array<Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>> => {
  const filters = settings?.apoOverride
    ? settings.apoOverride.filters
    : settings?.filters;
  if (!filters || settings?.apoOverride?.graphicEq?.length) {
    return [];
  }
  const intensity = layerIntensity(settings);
  if (intensity === 0) {
    return [];
  }
  const gainPrecision = settings?.apoOverride ? 100 : 10;

  return Object.values(filters)
    .filter(
      (filter) =>
        Number.isFinite(filter.frequency) &&
        Number.isFinite(filter.gain) &&
        Number.isFinite(filter.quality),
    )
    .map(({ type, frequency, gain, quality }) => ({
      type,
      frequency,
      // Rounded to a tenth, which is all Equalizer APO reads and all anybody
      // can hear. Without it, halving a correction writes gains like 2.8499999
      // into a file somebody may well open and read.
      gain: clampGain(
        Math.round(gain * intensity * gainPrecision) / gainPrecision,
      ),
      quality,
    }))
    .filter(
      (filter) =>
        NO_GAIN_FILTER_TYPES.includes(filter.type) || filter.gain !== 0,
    )
    .sort((left, right) => left.frequency - right.frequency);
};

/** Whether anything of this layer would actually reach Equalizer APO. */
export const hasHeadphoneLayer = (
  settings: IHeadphoneSettings | undefined,
): boolean =>
  getHeadphoneGraphicEq(settings).length > 0 ||
  getHeadphoneFilters(settings).length > 0;

/**
 * Whether a correction is HELD, whether or not any of it is being applied.
 *
 * A different question from `hasHeadphoneLayer`, and the difference is the
 * whole reason this exists: at zero strength nothing is written, so that one
 * answers no — correctly, for anything asking what Equalizer APO will see or
 * what to draw on the graph.
 *
 * It is the wrong question for a control. Dragging the strength to zero made
 * the chip that owns the slider vanish, taking the slider with it, so the
 * correction could be turned off and then never turned back on. The settings
 * were still there; the only way back to them was gone. The chip already had an
 * inactive state ready for exactly this, and never reached it.
 *
 * The driver and the voicing chips have always been drawn on whether their
 * layer is chosen and dimmed on whether it is audible. This is that same rule,
 * for the one layer that did not have it.
 */
export const hasHeadphoneCorrection = (
  settings: IHeadphoneSettings | undefined,
): boolean =>
  Boolean(settings) &&
  (Object.keys(settings?.apoOverride?.filters ?? settings?.filters ?? {})
    .length > 0 ||
    (settings?.apoOverride?.graphicEq?.length ??
      settings?.graphicEq?.length ??
      0) > 0);
