/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState, type RefObject } from 'react';
import observeShown from '../utils/observeShown';
import {
  holdSoundPaneForStudio,
  releaseSoundPaneFromStudio,
} from '../utils/soundPane';

/**
 * The bench width under which the chat leaves its pane for a tab: the stage
 * and the tabs need about 540px to be worth having, and the pane is at least
 * 320px of conversation, with the gap between them. A 1366px laptop leaves
 * the bench about 940px, and keeps the pane.
 */
export const STUDIO_SIDE_COLUMN_MIN = 880;

/**
 * Two things the bench decides from where it is on screen.
 *
 * Whether it is wide enough for the column beside the stage. Measured, not a
 * container query, because it decides which parts are rendered, not only how
 * they are placed: the meters are one live component and belong in one place
 * at a time. Without a ResizeObserver (tests) the bench keeps its column.
 *
 * And the sound panel on the right: folded while the bench is on screen and
 * given back as it was when it goes (Ivan, 2026-09-27: "when studio opens it
 * auto collapses and when studio closes it restores back"). A window put in
 * the background is not the Studio closing — the bench is still what is
 * open — so a hidden document is not a reason to give the panel back, or it
 * would unfold behind the window and fold again, visibly, on return.
 */
export default function useStudioBenchLayout(
  bench: RefObject<HTMLElement | null>,
): { isWide: boolean } {
  const [isWide, setIsWide] = useState(true);

  useEffect(() => {
    const element = bench.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      setIsWide(entry.contentRect.width >= STUDIO_SIDE_COLUMN_MIN);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [bench]);

  useEffect(() => {
    const element = bench.current;
    if (!element) {
      return undefined;
    }
    const stop = observeShown(element, (shown) => {
      if (shown) {
        holdSoundPaneForStudio();
      } else if (!document.hidden) {
        releaseSoundPaneFromStudio();
      }
    });
    return () => {
      stop();
      releaseSoundPaneFromStudio();
    };
  }, [bench]);

  return { isWide };
}
