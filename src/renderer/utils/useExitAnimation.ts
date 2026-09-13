/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  AnimationEvent,
  RefObject,
  useCallback,
  useLayoutEffect,
  useState,
} from 'react';

/**
 * Keeps something mounted for as long as its way out takes, and not a frame
 * longer.
 *
 * React removes an element the moment the condition that shows it turns
 * false, so a menu that arrived with an animation used to leave by blinking
 * out. While `closing`, the element is still rendered — marked, so its
 * stylesheet can play the exit — and it is unmounted by the exit's own
 * `animationend`. No duration is written down here: the stylesheet decides
 * how long leaving takes, and the element says when it has finished.
 *
 * When nothing plays — reduced motion switched the animation off, or a test
 * environment has no animations at all — there is no `animationend` to wait
 * for, so it is unmounted at once rather than left behind.
 *
 * `exitName` is the keyframes the exit plays, so an animation finishing on
 * something inside the element — a row arriving, a spinner — is not taken
 * for the element leaving. `target` is the rendered element, or the ref that
 * already holds it; the exit may play on it or on anything inside it.
 */
const useExitAnimation = (
  isOpen: boolean,
  exitName: string,
  target: HTMLElement | null | RefObject<HTMLElement | null>,
) => {
  const [present, setPresent] = useState(isOpen);

  // Opening again mid-exit, or opening at all, shows it straight away. Set
  // during render so the first frame of an opened menu is already there.
  if (isOpen && !present) {
    setPresent(true);
  }

  const closing = present && !isOpen;

  useLayoutEffect(() => {
    if (!closing) {
      return;
    }
    const element = target && 'current' in target ? target.current : target;
    // `getAnimations` brings style up to date first, so the exit just
    // marked on the element is already among these when it plays.
    const exiting = element
      ?.getAnimations?.({ subtree: true })
      .some(
        (animation) =>
          'animationName' in animation &&
          (animation as CSSAnimation).animationName === exitName &&
          animation.playState !== 'finished',
      );
    if (!exiting) {
      setPresent(false);
    }
  }, [closing, target, exitName]);

  const onAnimationEnd = useCallback(
    (event: AnimationEvent) => {
      if (!isOpen && event.animationName === exitName) {
        setPresent(false);
      }
    },
    [exitName, isOpen],
  );

  return { present, closing, onAnimationEnd };
};

export default useExitAnimation;
