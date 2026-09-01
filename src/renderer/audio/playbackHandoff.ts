/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long a silent queue transition may retain its engine and transport.
 *
 * This is not a readiness guess: the next player's actual `playing` event
 * ends the lease immediately. The deadline only bounds a handoff whose next
 * item never starts, so a broken queue cannot keep hidden media alive forever.
 */
export const PLAYBACK_HANDOFF_GRACE_MS = 5_000;

export type TSetPlaybackHandoff = (retain: boolean) => void;

/**
 * A queue-handoff lease driven by the frame that keeps its transport painted.
 *
 * No timer owns playback state. A real play/pause/error event clears the lease;
 * requestAnimationFrame only enforces the upper bound while the retained bar is
 * visible somewhere in the app.
 */
export const usePlaybackHandoff = (): readonly [
  boolean,
  TSetPlaybackHandoff,
] => {
  const [isRetained, setIsRetained] = useState(false);
  const deadlineRef = useRef<number | undefined>(undefined);

  const setRetained = useCallback<TSetPlaybackHandoff>((retain) => {
    deadlineRef.current = retain
      ? performance.now() + PLAYBACK_HANDOFF_GRACE_MS
      : undefined;
    setIsRetained(retain);
  }, []);

  useEffect(() => {
    if (!isRetained) {
      return undefined;
    }
    let frame = 0;
    const watch = (now: number) => {
      const deadline = deadlineRef.current;
      if (deadline === undefined) {
        return;
      }
      if (now >= deadline) {
        deadlineRef.current = undefined;
        setIsRetained(false);
        return;
      }
      frame = window.requestAnimationFrame(watch);
    };
    frame = window.requestAnimationFrame(watch);
    return () => window.cancelAnimationFrame(frame);
  }, [isRetained]);

  return [isRetained, setRetained] as const;
};
