/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { TMotionPreference } from 'main/motionPreference';

/**
 * Whether the window is animating right now.
 *
 * The choice itself is a Chromium launch switch (`main/motionPreference.ts`),
 * which is how `prefers-reduced-motion` comes to say what the app wants
 * rather than what Windows' "Animation effects" says. A launch switch cannot
 * change under a running window, so turning Animations off used to do nothing
 * at all until the next start - the switch was there and the app carried on
 * animating, which is no switch.
 *
 * The choice is therefore also written on the document element, where one
 * rule in App.scss stands every animation and transition down, and where
 * `prefersReducedMotion` reads it before asking the media query. Off is felt
 * at once; the launch switch still carries the choice into the next start so
 * the two never disagree.
 */
const ATTRIBUTE = 'data-motion';

export const applyMotionPreference = (motion: TMotionPreference) => {
  document.documentElement.setAttribute(ATTRIBUTE, motion);
};

/** The choice as written on the document, or nothing if none has been. */
export const chosenMotion = (): TMotionPreference | undefined => {
  const value = document.documentElement.getAttribute(ATTRIBUTE);
  return value === 'full' || value === 'reduced' ? value : undefined;
};
