/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * When the feature tour — the big "meet the new things" panel — opens itself.
 *
 * Two facts decide it: the version running now, and the version the user was
 * running when they last ticked "don't show this again". The tick is not a
 * permanent opt-out. It silences the tour for the version it was ticked on,
 * and the next version with a tour of its own gets one showing regardless,
 * because a tour exists to announce what a new version brought and a tick
 * from the old version knows nothing about it.
 *
 * Without the tick, the tour comes back on every launch. That is deliberate:
 * a tour dismissed without the tick was read as "not now", not "never".
 */

/**
 * Tours are written per feature release, so the lookup key is `major.minor`.
 * A patch release ships the same tour as the release it patches; whether it
 * opens again is decided by the full version, below.
 */
export const featureTourKey = (version: string): string =>
  version.split('.').slice(0, 2).join('.');

export const shouldShowFeatureTour = (
  version: string,
  dismissedVersion: string | null,
): boolean => version !== '' && dismissedVersion !== version;

/**
 * What to remember on close: the version, when the tick was on, otherwise
 * nothing — an earlier tick from an earlier version is cleared too, since
 * unticking it on this one is the user changing their mind.
 */
export const featureTourDismissal = (
  version: string,
  dontShowAgain: boolean,
): string | null => (dontShowAgain ? version : null);
