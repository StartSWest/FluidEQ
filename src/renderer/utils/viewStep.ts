/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which way a menu's view was reached: further in, or back. Nothing for the
 * view a menu opens on, which arrives with the menu itself.
 */
export type TViewStep = 'forward' | 'back' | undefined;

/**
 * The classes a swapped-in view wears for `view-swap` (`_motion.scss`): it
 * slides in from the right going forward and from the left going back.
 */
export const viewClass = (step: TViewStep): string =>
  step === undefined ? 'eq-view' : `eq-view is-${step}`;

/** Forward to a tab further along a row of them, back to one before it. */
export const stepBetween = <T>(
  order: readonly T[],
  from: T,
  to: T,
): TViewStep => (order.indexOf(to) > order.indexOf(from) ? 'forward' : 'back');
