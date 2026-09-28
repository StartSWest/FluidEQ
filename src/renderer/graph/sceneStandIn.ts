/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useSyncExternalStore } from 'react';

/**
 * ONE VISUALIZER AT A TIME (Ivan, 2026-09-27: "we dont want to render 2 viz
 * at the same time").
 *
 * The graph's scene (`GraphScene`) is one canvas for the whole window, moved
 * rather than copied. One player stands in for it while it is up, and it
 * steps aside: the Video page's own scene behind the chat in its full screen
 * (`VideoSceneBackdrop`), where the graph's copy went on drawing under a page
 * that covered it - the same scene twice, one of them seen by nobody.
 *
 * Not the Studio's stage any more. It stood in so the graph's scene would not
 * run behind the Studio under the Backdrop, and with the Backdrop the EQ
 * page's alone (`sceneModeOnPage`) the only copy left for it to stop was the
 * graph open under the Studio, in plain sight, which then sat on "Loading
 * visualizer" for as long as the stage played (Ivan, 2026-09-27: "why the
 * hell doesn't the viz load in the graph below the studio").
 *
 * The window's full screen here is not the document's, which is what
 * `observeShown` can see, so nothing else told the graph's scene it was
 * covered.
 */
const standIns = new Set<symbol>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** While `playing`, this player stands in for the graph's scene. */
export const useStandInForGraphScene = (playing: boolean) => {
  useEffect(() => {
    if (!playing) {
      return undefined;
    }
    const token = Symbol('scene stand-in');
    standIns.add(token);
    notify();
    return () => {
      standIns.delete(token);
      notify();
    };
  }, [playing]);
};

/** Whether some player stands in for the graph's scene now. */
export const useGraphSceneStoodIn = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => standIns.size > 0,
    () => false,
  );
