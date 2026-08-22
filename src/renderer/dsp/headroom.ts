/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** The `ceilingDb` range enforced by `clampDspSettings`. */
const CEILING_MIN_DB = -12;
const CEILING_MAX_DB = 0;

/**
 * Margin for inter-sample peaks.
 *
 * A signal limited to exactly 0 dBFS in the samples can still reconstruct
 * above full scale between them, and everything downstream — the resampler,
 * the DAC — sees that reconstruction rather than the samples. 1 dB is the
 * broadcast convention for the same reason.
 */
const TRUE_PEAK_MARGIN_DB = 1;

/**
 * Where the maximizer's ceiling should sit, given what APO adds afterwards.
 *
 * FluidEQ's player leaves by the endpoint that Equalizer APO is already
 * filtering, so this chain runs BEFORE the device profile. A maximizer pushing
 * to 0 dBFS followed by an APO boost clips — and clips only on loud passages,
 * which is the kind of defect that gets reported as "it distorts sometimes"
 * months later rather than as a bug in this feature.
 *
 * A profile that only cuts needs no room made for it, hence the `max(0, …)`:
 * lowering the ceiling for a boost that does not exist would just make
 * everything quieter for nothing.
 */
export const defaultCeilingDb = (profileBoostDb: number): number => {
  const boost = Number.isFinite(profileBoostDb)
    ? Math.max(0, profileBoostDb)
    : 0;
  const ideal = -(boost + TRUE_PEAK_MARGIN_DB);
  return Math.min(CEILING_MAX_DB, Math.max(CEILING_MIN_DB, ideal));
};

/**
 * Whether the ceiling range can actually absorb this profile's boost.
 *
 * It cannot, past about 11 dB. Rather than silently return a ceiling that will
 * clip anyway, this says so, and the panel warns instead of pretending. The
 * honest answer at that point is to lower the profile, not the ceiling.
 */
export const isHeadroomSufficient = (profileBoostDb: number): boolean => {
  const boost = Number.isFinite(profileBoostDb)
    ? Math.max(0, profileBoostDb)
    : 0;
  return -(boost + TRUE_PEAK_MARGIN_DB) >= CEILING_MIN_DB;
};
