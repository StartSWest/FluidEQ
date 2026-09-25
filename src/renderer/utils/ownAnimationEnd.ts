/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { AnimationEvent } from 'react';

/**
 * Whether an `animationend` is the named animation of the element listening.
 *
 * How the notices that show "for a moment" end: the moment is a CSS animation
 * on the element that shows it, and its own end is what takes it away. They
 * used to be a timer beside the element, which is two clocks that agree only
 * while nothing stalls the window — and in a minimised one, where the timer
 * fired on schedule and the notice was taken down unseen, only one of them
 * knew nobody had looked.
 *
 * Both halves of the test are needed. The event bubbles, so an element hears
 * every child's animation ending as its own; and an element with an entrance
 * and a hold hears both of them end, the entrance first.
 */
const isOwnAnimationEnd = (
  event: AnimationEvent<Element>,
  animationName: string,
): boolean =>
  event.target === event.currentTarget && event.animationName === animationName;

export default isOwnAnimationEnd;
