/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';

/**
 * How long the Media tab's page outlives its own sound while out of sight.
 *
 * Ivan's number (2026-10-13: "lets have 5 min wait time when nothing from the
 * online media tab is playing before clearing up"). Between two videos the
 * page is silent for as long as the site decides: the ad blocker takes about
 * five seconds to jump an ad, and an ad it does not catch plays for a minute
 * or so before the next video. The old bound was the five-second handover
 * lease, so anything longer threw the page away mid-queue and the next video
 * never came. Five minutes covers every gap a site puts between two items.
 */
export const MEDIA_SILENCE_HOLD_MS = 5 * 60_000;

/**
 * True from the moment `isSounding` falls until `holdMs` later, or until it
 * sounds again.
 *
 * The fall is noticed in the render that sees it, not in an effect after it:
 * an effect would commit one render with the hold still off, and that one
 * render is enough for the caller to unmount what it was meant to keep.
 *
 * Paced by `requestAnimationFrame`, like the handover lease beside it, so with
 * the window minimised to the tray the hold simply lasts until it is shown
 * again — longer, never shorter, which is the safe side for a queue.
 */
const useSilenceHold = (isSounding: boolean, holdMs: number): boolean => {
  const [wasSounding, setWasSounding] = useState(isSounding);
  const [isHeld, setIsHeld] = useState(false);
  if (wasSounding !== isSounding) {
    setWasSounding(isSounding);
    setIsHeld(!isSounding);
  }

  useEffect(() => {
    if (!isHeld) {
      return undefined;
    }
    const deadline = performance.now() + holdMs;
    let frame = 0;
    const watch = (now: number) => {
      if (now >= deadline) {
        setIsHeld(false);
        return;
      }
      frame = window.requestAnimationFrame(watch);
    };
    frame = window.requestAnimationFrame(watch);
    return () => window.cancelAnimationFrame(frame);
  }, [isHeld, holdMs]);

  return isHeld;
};

export default useSilenceHold;
