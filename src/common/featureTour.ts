/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * When the feature tour — the big "meet the new things" panel — opens itself.
 *
 * A dismissal belongs to a feature release's content, not its patch number.
 * A fix that leaves the tour unchanged must not reopen it; a new feature
 * release has its own tour and can introduce that content once again.
 *
 * Without the tick, the tour comes back on every launch. That is deliberate:
 * a tour dismissed without the tick was read as "not now", not "never".
 */

/**
 * Tours are written per feature release, so the lookup key is `major.minor`.
 * A patch release ships the same tour as the release it patches and keeps
 * its dismissal. Legacy full-version values are normalized on read too.
 */
export const featureTourKey = (version: string): string =>
  version.split('.').slice(0, 2).join('.');

export const shouldShowFeatureTour = (
  version: string,
  dismissedVersion: string | null,
): boolean =>
  version !== '' &&
  (dismissedVersion === null ||
    featureTourKey(dismissedVersion) !== featureTourKey(version));

/**
 * What to remember on close: the content key, when the tick was on, otherwise
 * nothing — an earlier tick from an earlier version is cleared too, since
 * unticking it on this one is the user changing their mind.
 */
export const featureTourDismissal = (
  version: string,
  dontShowAgain: boolean,
): string | null => (dontShowAgain ? featureTourKey(version) : null);
