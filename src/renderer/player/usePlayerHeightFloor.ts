/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect } from 'react';
import { holdPlayerHeight } from './windowModeStore';
import type { TPlayerSoundFace } from './playerLayout';

/**
 * The least tall the amp's window may be dragged: the picture at its least,
 * the transport, the sound OPEN on the face it shows, the queue's tabs and
 * its least, and the foot (`is-measuring` lays the amp out that way for the
 * one measurement). Open whether it is or not, because nothing in the amp
 * scrolls (Ivan, 2026-10-25: "we need a way to avoid scroll on the full amp
 * ui"): a floor measured with the sound folded let the window be dragged
 * shorter than the amp with it open, and opening it then had nowhere to go.
 * Never a ceiling and never a height to hold: the window's height is the
 * listener's.
 *
 * Measured again when the transport changes height — the Plus visualizer's
 * keys or a long language can wrap a row of it — and when the sound changes
 * face, the faders standing taller than the tone knobs. NEVER ON A RESIZE OF
 * THE WINDOW: the amp's least is in the page's pixels, which no window size
 * or zoom changes, and folding to one line is a resize. The window reached
 * the strip's height while the amp was still drawn, a resize listener
 * measured it and sent its floor, and main stood the window straight back
 * up to it — the fold bounced, and the height it was folded from was lost
 * (Ivan, 2026-10-25: "the fold to 1 line sucks and restore from it also
 * sucks, needs to keep previous amp height").
 */
const usePlayerHeightFloor = (
  rootRef: RefObject<HTMLDivElement | null>,
  isFolded: boolean,
  face: TPlayerSoundFace,
) => {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (isFolded || !root) {
      holdPlayerHeight(null, null);
      return undefined;
    }
    const measure = () => {
      root.classList.add('is-measuring');
      const { height } = root.getBoundingClientRect();
      // Back to the amp as it is with its slides held still for one style
      // pass: the measured layout was a style change of its own, and a slide
      // started from it would play the sound or the queue folding shut in
      // front of the listener.
      root.classList.replace('is-measuring', 'is-quiet');
      root.getBoundingClientRect();
      root.classList.remove('is-quiet');
      holdPlayerHeight(null, Math.ceil(height));
    };
    measure();
    const dock = root.querySelector('.player-dock');
    if (typeof ResizeObserver === 'undefined' || !dock) {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [face, isFolded, rootRef]);
};

export default usePlayerHeightFloor;
