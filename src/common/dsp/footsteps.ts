/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps' settings as the app keeps them: what each dial is, what it may
 * reach, and what the stage is at rest.
 *
 * Its own module, as the De-esser's is, so the rack's defaults can take it
 * in without importing anything back. The two dials are fractions of what
 * the engine may do at most (`footsteps.cpp`): Lift of each band's largest
 * lift, Calm of the rumble's largest cut. Reading a stored value back is
 * `footstepsClamp.ts`.
 */
export interface IFootstepsSettings {
  enabled: boolean;
  /** Hear only what is added. Not a sound: never part of a profile. */
  isolate: boolean;
  /** Stable profile id, or empty after a hand edit. */
  presetId: string;
  /** 0 to 1: how much of each band's largest lift may be taken. */
  lift: number;
  /** 0 to 1: how much of the rumble's largest cut may be taken. */
  calm: number;
}

export const FOOTSTEPS_RANGES = {
  lift: { min: 0, max: 1 },
  calm: { min: 0, max: 1 },
} as const;

/**
 * What the engine does at a dial of one (`kBands` and `kCalmMaxDb` in
 * `footsteps.cpp`): the steps band's lift, the one a listener hears as "the
 * steps came up", and the rumble's cut. The page prints them scaled by the
 * dial; they are a limit the stage reaches, not a gain it always applies.
 */
export const FOOTSTEPS_MAX_LIFT_DB = 10;
export const FOOTSTEPS_MAX_CALM_DB = 9;

/**
 * Off, and the Competitive profile underneath, so switching it on does the
 * everyday thing. `footstepsPresets.ts` holds the same numbers as that
 * profile and `dspFootsteps.test.ts` keeps the two equal.
 */
export const FOOTSTEPS_DEFAULTS: IFootstepsSettings = {
  enabled: false,
  isolate: false,
  presetId: 'competitive',
  lift: 0.85,
  calm: 0.5,
};
