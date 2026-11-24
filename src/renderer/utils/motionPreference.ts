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

/** Told whenever the choice on the document may have changed. */
const listeners = new Set<() => void>();

export const applyMotionPreference = (motion: TMotionPreference) => {
  document.documentElement.setAttribute(ATTRIBUTE, motion);
  listeners.forEach((listener) => listener());
};

/**
 * Calls `listener` whenever the answer to `prefersReducedMotion` may have
 * changed: the app's own switch written here, or the media query it falls
 * back on. What animates for as long as it is on screen - the look picker's
 * live tiles, a scene's clip on a tile or a gallery card - follows it this
 * way, so Animations off stills them at once rather than at their next
 * render (`useReducedMotion`). Ivan, 2026-11-24: "if user selects animation
 * off in the app we don't show the videos or the standard viz animated
 * either, on those lists or even gallery".
 *
 * The query's listener is optional-called because test doubles of
 * `matchMedia` often answer `matches` alone.
 */
export const subscribeMotionPreference = (listener: () => void) => {
  listeners.add(listener);
  const query =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : undefined;
  query?.addEventListener?.('change', listener);
  return () => {
    listeners.delete(listener);
    query?.removeEventListener?.('change', listener);
  };
};

/** The choice as written on the document, or nothing if none has been. */
export const chosenMotion = (): TMotionPreference | undefined => {
  const value = document.documentElement.getAttribute(ATTRIBUTE);
  return value === 'full' || value === 'reduced' ? value : undefined;
};
