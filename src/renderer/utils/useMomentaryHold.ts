/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  AnimationEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import isOwnAnimationEnd from './ownAnimationEnd';

/**
 * Something on screen for a moment, for exactly as long as its own hold
 * animation plays.
 *
 * A name that says what a click just did, a remark that lingers long enough
 * to be read: each used to be put up and then taken down by a timer, which
 * guessed at a length the stylesheet also had to know, kept counting behind a
 * window nobody could see, and took the text down whether or not it had ever
 * been on screen. Now the element carries a hold animation while it is shown
 * — keyframes that hold it visible and change nothing it draws — and its own
 * `animationend` for that animation takes it down. The stylesheet is the one
 * place its length is written.
 *
 * `show()` puts it up, and starts the hold over if it is already up, so the
 * moment is measured from the last thing it said. `animationcancel` takes it
 * down too: an element hidden mid-hold — `display: none` in Clean — loses its
 * animation without ending it, and would otherwise come back later still
 * holding up whatever it said then. And when nothing plays at all — the
 * element is not rendered, or a test environment has no animations — it is
 * taken down at once rather than left up with no end coming.
 *
 * `holdName` is the keyframes the hold plays, so an animation finishing on
 * something inside the element is not taken for the moment ending. Under the
 * app's reduced-motion stand-down every animation lasts a millisecond, so the
 * rule that plays the hold needs a more specific `!important` of its own: it
 * moves nothing, and it has to stay up long enough to be read.
 */
const useMomentaryHold = <Target extends HTMLElement>(holdName: string) => {
  const ref = useRef<Target>(null);
  const [isShown, setIsShown] = useState(false);
  // Bumped by every `show()`, so a second one while shown restarts the hold.
  const [shownAt, setShownAt] = useState(0);

  const show = useCallback(() => {
    setIsShown(true);
    setShownAt((count) => count + 1);
  }, []);

  useLayoutEffect(() => {
    if (!isShown) {
      return;
    }
    // `getAnimations` brings style up to date first, so the hold the class
    // just started is already among these.
    const hold = ref.current
      ?.getAnimations?.()
      .find(
        (animation) =>
          'animationName' in animation &&
          (animation as CSSAnimation).animationName === holdName,
      );
    if (!hold) {
      setIsShown(false);
      return;
    }
    // From the start again: a new thing said is a new moment to read it in.
    hold.currentTime = 0;
  }, [holdName, isShown, shownAt]);

  const onAnimationEnd = useCallback(
    (event: AnimationEvent<Target>) => {
      if (isOwnAnimationEnd(event, holdName)) {
        setIsShown(false);
      }
    },
    [holdName],
  );

  // React has no `onAnimationCancel`, so this one is the element's own.
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    const onCancel = (event: globalThis.AnimationEvent) => {
      if (event.target === element && event.animationName === holdName) {
        setIsShown(false);
      }
    };
    element.addEventListener('animationcancel', onCancel);
    return () => element.removeEventListener('animationcancel', onCancel);
  }, [holdName]);

  return { ref, isShown, show, onAnimationEnd };
};

export default useMomentaryHold;
