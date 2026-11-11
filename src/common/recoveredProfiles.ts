/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An output that had lost its profile, and what it plays now
 * (`recoverMissingProfiles`). Said once in the window, and then forgotten.
 */
export interface IRecoveredProfile {
  /** The output, as Windows named it when its profile was attached. */
  deviceName: string;
  /** The profile its folder did not hold. */
  missing: string;
  /** What it is attached to now. */
  now: string;
  /**
   * `copied`: the same profile, copied in from another output's folder.
   * `own`: another of the output's own profiles. `new`: a new empty one.
   */
  how: 'copied' | 'own' | 'new';
}

/** What the window reads once, and what it says when the notice is put away. */
export const RECOVERED_PROFILES_CHANNEL = 'recovered-profiles';
export const RECOVERED_PROFILES_SEEN_CHANNEL = 'recovered-profiles-seen';
