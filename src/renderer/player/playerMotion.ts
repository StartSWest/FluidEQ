/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { prefersReducedMotion } from '../utils/bandReveal';

/**
 * THE AMP FOLDS INTO ITS HEADER AND OUT OF IT (Ivan, 2026-10-26: "I do want
 * the amp ui to have that nice animation when showing, whether is from one
 * liner or from full app to this, but not animation like that on full app
 * because pc resources for full app are more expensive to do").
 *
 * The window changes height once — Windows cannot grow one smoothly, and a
 * height stepped from a loop is a timer guessing at frames — so the motion
 * lives in the amp's own sections around that one change, in transform and
 * opacity alone, which the compositor plays without the player drawing a
 * frame. Opening is the stylesheet's (`_playerMotion.scss`), held while the
 * window is out of sight; folding is here, because the window may only
 * shorten once the sections have gone up into the header.
 *
 * Bottom first, each section turning about its top edge as it rises toward
 * the header: what the opening plays, backwards. The lifts are the
 * stylesheet's, so the two directions are one motion.
 */
const FOLD_STEPS: readonly {
  selector: string;
  delay: number;
  duration: number;
  lift: number | undefined;
}[] = [
  { selector: '.player-foot', delay: 0, duration: 60, lift: undefined },
  { selector: '.player-shelf', delay: 0, duration: 105, lift: -150 },
  { selector: '.player-sound', delay: 28, duration: 105, lift: -84 },
  { selector: '.player-top', delay: 82, duration: 105, lift: 0 },
];

/** The folded strip's controls stepping aside before the window grows. */
const STRIP_AWAY_MS = 70;

const turned = (lift: number) =>
  `perspective(1100px) translateY(${lift}px) rotateX(-84deg)`;
const FLAT = 'perspective(1100px) translateY(0px) rotateX(0deg)';
const EASE_IN = 'cubic-bezier(0.45, 0, 0.9, 0.35)';

export interface IPlayerMotion {
  /** Settles when the sections have gone; never rejects. */
  finished: Promise<void>;
  /** Puts every section back as it was, for a fold that did not happen. */
  cancel: () => void;
}

const STILL: IPlayerMotion = { finished: Promise.resolve(), cancel: () => {} };

/**
 * Whether anything may move: never with Animations off in the app's menu
 * (`prefersReducedMotion` reads that first), and not where elements cannot
 * animate at all.
 */
const canMove = (root: Element | null): root is HTMLElement =>
  root instanceof HTMLElement &&
  typeof root.animate === 'function' &&
  !prefersReducedMotion();

const play = (animations: Animation[]): IPlayerMotion => ({
  // A cancelled animation rejects its `finished`; a fold called off is not an
  // error anybody has to hear about.
  finished: Promise.allSettled(animations.map((one) => one.finished)).then(
    () => undefined,
  ),
  cancel: () => animations.forEach((one) => one.cancel()),
});

/** The amp's sections folding up into its header, bottom first. */
export const foldSectionsAway = (root: Element | null): IPlayerMotion => {
  if (!canMove(root)) {
    return STILL;
  }
  const animations = FOLD_STEPS.flatMap(
    ({ selector, delay, duration, lift }) => {
      const section = root.querySelector<HTMLElement>(selector);
      if (!section) {
        return [];
      }
      section.style.transformOrigin = '50% 0';
      // Held where they end until the window is the strip and the column is
      // gone with them: let go at the end, they would show again for the
      // frames before the window shortened.
      return [
        section.animate(
          lift === undefined
            ? [{ opacity: 1 }, { opacity: 0 }]
            : [
                { opacity: 1, transform: FLAT },
                { opacity: 0, transform: turned(lift) },
              ],
          { delay, duration, easing: EASE_IN, fill: 'forwards' },
        ),
      ];
    },
  );
  return play(animations);
};

/** The folded strip's controls stepping aside before the window grows. */
export const stripStepsAside = (root: Element | null): IPlayerMotion => {
  const strip = canMove(root)
    ? root.querySelector<HTMLElement>('.player-fold')
    : null;
  if (!strip) {
    return STILL;
  }
  return play([
    strip.animate(
      [
        { opacity: 1, transform: 'translateY(0px)' },
        { opacity: 0, transform: 'translateY(-6px)' },
      ],
      { duration: STRIP_AWAY_MS, easing: EASE_IN, fill: 'forwards' },
    ),
  ]);
};
