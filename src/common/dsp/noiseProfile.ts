/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a measured noise floor is, as data both halves of the app agree about.
 *
 * The scan in `noiseAnalysis.ts` writes it, the library index stores it, the
 * wire carries it and `denoise_spectral.cpp` reads it back into per-bin
 * magnitudes. Four places, one shape — the band edges in particular have to be
 * identical everywhere, because a profile interpolated onto the wrong centres
 * subtracts the wrong amount at every frequency and still looks like a plot of
 * a noise floor.
 */

/**
 * Quarter-octave bands, which is as coarse as this can be and still describe
 * what it has to describe.
 *
 * NOT the raw transform bins. A 1024-bin profile is roughly 8 KB per track once
 * serialized, and the library index is a single JSON file read at startup — ten
 * thousand tracks would put 80 MB of noise floors in front of the first window.
 * A noise floor is smooth by nature: hiss, hum and room tone are broadband or
 * narrow-and-known, and neither needs 23 Hz resolution to be described. What
 * does need it is the hum fundamental, which is measured separately and stored
 * as a frequency rather than as a bump in this curve.
 */
export const NOISE_PROFILE_BANDS = 40;

/** The span the bands cover. Below 20 Hz is subsonic, above 20 kHz inaudible. */
export const NOISE_PROFILE_LOW_HZ = 20;
export const NOISE_PROFILE_HIGH_HZ = 20_000;

/**
 * Octaves per band, derived rather than written down.
 *
 * 20 Hz to 20 kHz is log2(1000) = 9.966 octaves, so forty bands land at 0.249
 * octaves each. Writing `0.25` instead would put the top band's edge at
 * 20.6 kHz and leave the two sides of the wire disagreeing about where the last
 * band ends.
 */
export const NOISE_PROFILE_OCTAVES_PER_BAND =
  Math.log2(NOISE_PROFILE_HIGH_HZ / NOISE_PROFILE_LOW_HZ) / NOISE_PROFILE_BANDS;

/** The geometric centre of one band, in Hz. */
export const noiseProfileBandHz = (index: number): number =>
  NOISE_PROFILE_LOW_HZ * 2 ** ((index + 0.5) * NOISE_PROFILE_OCTAVES_PER_BAND);

/** Which band a frequency falls in, or -1 when it falls outside the span. */
export const noiseProfileBandOf = (hz: number): number => {
  if (!(hz >= NOISE_PROFILE_LOW_HZ) || hz >= NOISE_PROFILE_HIGH_HZ) {
    return -1;
  }
  return Math.min(
    NOISE_PROFILE_BANDS - 1,
    Math.floor(
      Math.log2(hz / NOISE_PROFILE_LOW_HZ) / NOISE_PROFILE_OCTAVES_PER_BAND,
    ),
  );
};

/**
 * The deepest level this stores, and the value that means "silent here".
 *
 * Shared with `SILENCE_DB` in `loudnessAnalysis.ts` deliberately: a band that
 * never rose above the noise of the converter reads the same floor as a track
 * that is digital silence, and both mean the same thing to the subtractor.
 */
export const NOISE_PROFILE_SILENCE_DB = -120;

/** How many hum partials the scan reports, fundamental included. */
export const NOISE_HUM_MAX_HARMONICS = 10;

/**
 * A hum partial, as measured rather than as assumed.
 *
 * `excessDb` is the level ABOVE the surrounding floor, not the absolute level.
 * That is the number that decides whether a notch is worth placing: a partial
 * sitting at the floor is not hum, it is the floor, and notching it removes
 * music while removing no buzz.
 */
export interface INoiseHumPartial {
  hz: number;
  excessDb: number;
}

export interface INoiseProfile {
  /**
   * Per-band floor in dBFS, `NOISE_PROFILE_BANDS` long, quietest-percentile
   * rather than mean — see `noiseAnalysis.ts` for why a mean measures the
   * music instead.
   */
  bandsDb: readonly number[];
  /** Broadband floor in dBFS. The headline number the card prints. */
  floorDbfs: number;
  /**
   * The measured mains fundamental, or 0 when none stood above the floor.
   *
   * A frequency and not a choice between 50 and 60: a notch nailed to 50.0
   * misses hum sitting at 50.2, and widening it until it does not is how a hum
   * filter starts eating bass.
   */
  humHz: number;
  humPartials: readonly INoiseHumPartial[];
  /** Detected impulsive events per minute, for the card to report before use. */
  clicksPerMinute: number;
}

/**
 * Whether a stored value is one, checked where it re-enters from disk.
 *
 * The library index is JSON on the user's machine and survives across versions,
 * so a profile arriving here may predate any field below or have been truncated
 * by a partial write. Rejecting the whole profile re-measures one track;
 * trusting a short `bandsDb` array would read `undefined` as a level.
 */
export const isNoiseProfile = (value: unknown): value is INoiseProfile => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<INoiseProfile>;
  if (
    !Array.isArray(candidate.bandsDb) ||
    candidate.bandsDb.length !== NOISE_PROFILE_BANDS ||
    !candidate.bandsDb.every(
      (entry) => typeof entry === 'number' && Number.isFinite(entry),
    )
  ) {
    return false;
  }
  if (
    typeof candidate.floorDbfs !== 'number' ||
    !Number.isFinite(candidate.floorDbfs) ||
    typeof candidate.humHz !== 'number' ||
    !Number.isFinite(candidate.humHz) ||
    typeof candidate.clicksPerMinute !== 'number' ||
    !Number.isFinite(candidate.clicksPerMinute)
  ) {
    return false;
  }
  return (
    Array.isArray(candidate.humPartials) &&
    candidate.humPartials.length <= NOISE_HUM_MAX_HARMONICS &&
    candidate.humPartials.every(
      (partial) =>
        typeof partial === 'object' &&
        partial !== null &&
        typeof (partial as INoiseHumPartial).hz === 'number' &&
        Number.isFinite((partial as INoiseHumPartial).hz) &&
        typeof (partial as INoiseHumPartial).excessDb === 'number' &&
        Number.isFinite((partial as INoiseHumPartial).excessDb),
    )
  );
};

/**
 * The profile at one frequency, interpolated between band centres in dB.
 *
 * Interpolating the dB values rather than the magnitudes is deliberate: a noise
 * floor plotted against log frequency is close to piecewise linear in dB, and
 * interpolating magnitudes instead pulls the curve toward whichever neighbour
 * is louder, which reads as a tilt that was never measured.
 *
 * Below the first centre and above the last the nearest band is held flat.
 * Extrapolating a slope past the measured span invents a floor at frequencies
 * the scan deliberately did not look at.
 */
export const noiseProfileLevelAt = (
  bandsDb: readonly number[],
  hz: number,
): number => {
  if (bandsDb.length === 0) {
    return NOISE_PROFILE_SILENCE_DB;
  }
  const position =
    Math.log2(Math.max(1e-6, hz) / NOISE_PROFILE_LOW_HZ) /
      NOISE_PROFILE_OCTAVES_PER_BAND -
    0.5;
  if (position <= 0) {
    return bandsDb[0];
  }
  const last = bandsDb.length - 1;
  if (position >= last) {
    return bandsDb[last];
  }
  const lower = Math.floor(position);
  const fraction = position - lower;
  return bandsDb[lower] * (1 - fraction) + bandsDb[lower + 1] * fraction;
};

/**
 * The profile as the flat array of doubles the host decodes.
 *
 * Fixed length, unlike the chain snapshot: there is exactly one array in here
 * and its size is a compile-time constant on both sides, so the layout cannot
 * be re-pointed by adding a scalar. `FEQ_DENOISE_PROFILE_WIRE` in `wire.h` is
 * the same number and `feq_wire_decode_noise_profile` reads it.
 */
export const NOISE_PROFILE_WIRE_LENGTH =
  NOISE_PROFILE_BANDS + 3 + NOISE_HUM_MAX_HARMONICS * 2;

export const encodeNoiseProfile = (profile: INoiseProfile): number[] => {
  const values: number[] = [];
  for (let band = 0; band < NOISE_PROFILE_BANDS; band += 1) {
    values.push(profile.bandsDb[band]);
  }
  const partials = profile.humPartials.slice(0, NOISE_HUM_MAX_HARMONICS);
  values.push(profile.floorDbfs, profile.humHz, partials.length);
  for (let i = 0; i < NOISE_HUM_MAX_HARMONICS; i += 1) {
    values.push(partials[i]?.hz ?? 0);
  }
  for (let i = 0; i < NOISE_HUM_MAX_HARMONICS; i += 1) {
    values.push(partials[i]?.excessDb ?? 0);
  }
  if (values.length !== NOISE_PROFILE_WIRE_LENGTH) {
    // The length is a constant on both sides. A field added above and not
    // accounted for here would shift the hum partials into the band array and
    // still decode into something that looks like a noise floor.
    throw new Error(
      `noise profile wire: ${values.length}, expected ${NOISE_PROFILE_WIRE_LENGTH}`,
    );
  }
  return values;
};

/** A profile that asks for no processing, for the "never scanned" case. */
export const silentNoiseProfile = (): INoiseProfile => ({
  bandsDb: new Array<number>(NOISE_PROFILE_BANDS).fill(
    NOISE_PROFILE_SILENCE_DB,
  ),
  floorDbfs: NOISE_PROFILE_SILENCE_DB,
  humHz: 0,
  humPartials: [],
  clicksPerMinute: 0,
});
