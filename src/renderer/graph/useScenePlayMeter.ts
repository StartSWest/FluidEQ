/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';

/** Seconds handed to main at a time while a scene keeps playing. */
const FLUSH_AFTER_SECONDS = 60;
/**
 * The most one gap between frames may count. A frame comes every few
 * milliseconds while a scene is drawn; a longer gap is the window stalled or
 * put away, and counting it whole would credit the scene with time nobody
 * saw it.
 */
const MAX_FRAME_GAP_SECONDS = 1;

const send = (lookId: string, seconds: number) => {
  if (seconds > 0) {
    window.electron?.ipcRenderer
      ?.scenePlayAccrue?.(lookId, seconds)
      .catch(() => undefined);
  }
};

/**
 * Counts how long a scene is drawn on the graph, for the admin's reading of
 * which scenes members watch (premium migration 0047). Renders nothing;
 * returns the function the canvas calls with each frame it draws.
 *
 * Counted on the frames themselves, so a scene behind a hidden window, one
 * still compiling and one that failed count nothing. Handed to main a minute
 * at a time, when the look changes, when the window is hidden and when the
 * canvas goes; main decides whether any of it is kept (only for a member who
 * has been shown terms 10), so this counts for everybody and decides nothing.
 */
const useScenePlayMeter = (lookId: string) => {
  const previousAtRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef(0);
  const lookRef = useRef(lookId);

  const flush = useCallback(() => {
    const seconds = pendingRef.current;
    pendingRef.current = 0;
    previousAtRef.current = undefined;
    send(lookRef.current, seconds);
  }, []);

  // A new look starts its own count; the old one's goes out under its name.
  useEffect(() => {
    if (lookRef.current !== lookId) {
      flush();
      lookRef.current = lookId;
    }
  }, [lookId, flush]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        flush();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [flush]);

  return useCallback(() => {
    const now = performance.now();
    const before = previousAtRef.current;
    previousAtRef.current = now;
    if (before === undefined) {
      return;
    }
    pendingRef.current += Math.min(
      MAX_FRAME_GAP_SECONDS,
      Math.max(0, (now - before) / 1000),
    );
    if (pendingRef.current >= FLUSH_AFTER_SECONDS) {
      const seconds = pendingRef.current;
      pendingRef.current = 0;
      send(lookRef.current, seconds);
    }
  }, []);
};

export default useScenePlayMeter;
