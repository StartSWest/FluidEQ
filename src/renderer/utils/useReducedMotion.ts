/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { prefersReducedMotion } from './bandReveal';
import { subscribeMotionPreference } from './motionPreference';

/**
 * `prefersReducedMotion`, as a value a component re-renders on: the app's
 * Animations switch pressed, or the system's setting changed, and every
 * reader moves in the same commit. For what keeps moving while it is on
 * screen; a one-off animation can keep asking `prefersReducedMotion` as it
 * starts.
 */
const useReducedMotion = (): boolean =>
  useSyncExternalStore(subscribeMotionPreference, prefersReducedMotion);

export default useReducedMotion;
