/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

/**
 * Loudness: fuller at the volume you are actually listening at.
 *
 * ## What this is not
 *
 * It is **not a compressor**, and it cannot be. Equalizer APO's entire command
 * set — Preamp, Filter, Delay, Copy, GraphicEQ, Convolution, Include, Device,
 * Channel, Stage and the expression commands — is linear. It changes frequency
 * response and nothing else. There is no dynamics processing anywhere in it, so
 * nothing here can raise a quiet passage without raising a loud one by exactly
 * as much. A control labelled "compressor" driving this engine would be a lie.
 *
 * ## What it is
 *
 * The Fletcher–Munson effect: the ear loses bass and treble far faster than it
 * loses the midrange as level drops, which is why quiet music sounds thin
 * rather than merely quieter. A matched lift at both ends restores what the ear
 * stops hearing, and the result is read as *louder and fuller* while the peak
 * level barely moves — the energy is added where the ear is least sensitive.
 *
 * This is the "loudness" button that was on every amplifier for thirty years,
 * and it is exactly the shape of thing APO is good at.
 *
 * ## Why it stays clean
 *
 * Every filter here is written into the same chain the preamp is computed
 * from, so the headroom calculation already accounts for it. Turning it on
 * cannot clip, because the preamp comes down to meet it — the trade is
 * headroom, made visibly and automatically, rather than a peak nobody checked.
 */

import { FilterTypeEnum, ILoudnessSettings } from './constants';

export type { ILoudnessSettings };

export const DEFAULT_LOUDNESS: ILoudnessSettings = {
  isOn: false,
  intensity: 0.5,
};

export interface ILoudnessFilter {
  type: FilterTypeEnum;
  frequency: number;
  gain: number;
  quality: number;
}

/**
 * The curve, at full intensity.
 *
 * Four filters, and every one of them earns its place:
 *
 * - A low shelf at 105Hz is the bulk of the effect. Low rather than at 60Hz,
 *   because most speakers and the great majority of headphones roll off below
 *   that and gain there is spent on excursion nobody hears.
 * - A gentle dip at 800Hz. Lifting both ends without touching the middle makes
 *   the midrange sound recessed by comparison; taking a little out of it costs
 *   almost no loudness and keeps voices where they were.
 * - A high shelf at 6kHz for air and detail.
 * - A very slight lift at 12kHz, wide, which is what stops the top end
 *   sounding merely brighter rather than more open.
 *
 * Deliberately modest numbers. A loudness curve that doubles as a smiley-face
 * EQ is the reason the feature got a bad name.
 */
const CURVE: ILoudnessFilter[] = [
  { type: FilterTypeEnum.LSC, frequency: 105, gain: 6.0, quality: 0.7 },
  { type: FilterTypeEnum.PK, frequency: 800, gain: -1.6, quality: 0.9 },
  { type: FilterTypeEnum.HSC, frequency: 6000, gain: 3.4, quality: 0.7 },
  { type: FilterTypeEnum.PK, frequency: 12000, gain: 1.8, quality: 0.6 },
];

/** The clamped intensity, so a stored value out of range cannot misbehave. */
export const getLoudnessIntensity = (settings?: ILoudnessSettings): number =>
  Math.max(0, Math.min(1, settings?.intensity ?? DEFAULT_LOUDNESS.intensity));

/**
 * The filters to write, scaled by intensity.
 *
 * Empty when it is off, which is what makes the layer free: `flush` skips it
 * entirely and the preamp is computed as though it had never existed.
 */
export const getLoudnessFilters = (
  settings?: ILoudnessSettings,
): ILoudnessFilter[] => {
  if (!settings?.isOn) {
    return [];
  }
  const intensity = getLoudnessIntensity(settings);
  if (intensity <= 0) {
    return [];
  }
  return CURVE.map((filter) => ({
    ...filter,
    // Scaled rather than switched between presets, so the slider moves the
    // whole curve together and the shape stays the same at every setting.
    gain: Number((filter.gain * intensity).toFixed(2)),
  })).filter((filter) => Math.abs(filter.gain) >= 0.05);
};

/**
 * Roughly how much louder this will sound, in dB, for the UI to say so.
 *
 * Perceptual rather than measured: the shelves add far more to how loud
 * something seems than they add to its peak, and quoting the peak change would
 * understate it to the point of being useless. Deliberately approximate, and
 * described as approximate wherever it is shown.
 */
export const getLoudnessImpression = (settings?: ILoudnessSettings): number => {
  if (!settings?.isOn) {
    return 0;
  }
  return Number((4.5 * getLoudnessIntensity(settings)).toFixed(1));
};
