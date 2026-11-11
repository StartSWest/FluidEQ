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

/**
 * What's New has two halves that never meet. The sound's (the EQ, the DSP
 * rack, the engine, the outputs, the player and the Library) is what opens
 * after an update. The visualizers' (scenes, the Gallery, the Studio, desktop
 * backgrounds and lighting) opens only from the Visualizers tab: someone who
 * uses FluidEQ as an equaliser is never shown it (Ivan, 2026-11-11: "anything
 * related to visualizers and studio and keyboard lighting should be a
 * completely separate what's new").
 */
export type TTourPart = 'sound' | 'visuals';

/**
 * Whether the Visualizers tab marks its What's New as new: once per feature
 * release that brought the visualizers something, until it is opened. Its
 * own memory, apart from the tour's tick, which says nothing about it.
 */
export const isVisualsNewsUnseen = (
  version: string,
  hasVisualsNews: boolean,
  seenVersion: string | null,
): boolean =>
  version !== '' &&
  hasVisualsNews &&
  (seenVersion === null ||
    featureTourKey(seenVersion) !== featureTourKey(version));
