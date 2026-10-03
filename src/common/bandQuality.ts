/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const WIDEST = 0.25;
const NARROWEST = 12;
export const DEFAULT_BAND_QUALITY = 2;

/** Q for a bandwidth in octaves, to two decimal places. */
export const qualityForSpacing = (octaves: number): number => {
  if (!Number.isFinite(octaves) || octaves <= 0) {
    return DEFAULT_BAND_QUALITY;
  }
  const spacing = 2 ** (octaves / 2) - 2 ** (-octaves / 2);
  const quality = Math.min(NARROWEST, Math.max(WIDEST, 1 / spacing));
  return Math.round(quality * 100) / 100;
};

/** The DSP/preset rack's existing bandwidth convention. */
export const qualityForRack = (frequencies: readonly number[]): number => {
  const usable = frequencies.filter(
    (frequency) => Number.isFinite(frequency) && frequency > 0,
  );
  if (usable.length < 2) {
    return DEFAULT_BAND_QUALITY;
  }
  const lowest = Math.min(...usable);
  const highest = Math.max(...usable);
  if (highest <= lowest) {
    return DEFAULT_BAND_QUALITY;
  }
  return qualityForSpacing(Math.log2(highest / lowest) / (usable.length - 1));
};

/**
 * One starting Q throughout the main EQ layout, including its end bands.
 * Preserve the main EQ's broader, twice-spacing bandwidth convention. Only
 * the whole layout's span and count determine it; local gaps never do.
 * This creates defaults, not a rule that overwrites an edited or saved Q.
 */
export const qualityForMainRack = (frequencies: readonly number[]): number => {
  const usable = frequencies.filter(
    (frequency) => Number.isFinite(frequency) && frequency > 0,
  );
  if (usable.length < 2) {
    return DEFAULT_BAND_QUALITY;
  }
  return qualityForSpacing(
    (2 * Math.log2(Math.max(...usable) / Math.min(...usable))) /
      (usable.length - 1),
  );
};

export const qualitiesForRack = (frequencies: readonly number[]): number[] => {
  const quality = qualityForMainRack(frequencies);
  return frequencies.map(() => quality);
};

/** Added main bands inherit the rack's median bell Q, wherever they land. */
export const qualityForAddedBand = (qualities: readonly number[]): number => {
  const sorted = qualities
    .filter((quality) => Number.isFinite(quality) && quality > 0)
    .sort((one, other) => one - other);
  if (sorted.length === 0) {
    return DEFAULT_BAND_QUALITY;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
};
