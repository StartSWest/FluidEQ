/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useLayoutEffect, useState } from 'react';
import { holdPlayerHeight } from './windowModeStore';
import type { IPlayerSheet } from './playerLayout';

/**
 * How much of the song the amp shows for the height it has: everything
 * (`roomy`), the cover smaller (`snug`), or the song's words alone, with no
 * cover and no chips (`compact`).
 */
export type TPlayerFit = 'roomy' | 'snug' | 'compact';

/** The class each fit puts on the amp; roomy is the amp as designed. */
const FIT_CLASS: Record<Exclude<TPlayerFit, 'roomy'>, string> = {
  snug: 'is-snug',
  compact: 'is-compact',
};

/**
 * How short the amp's window may be, and how much it shows at the height it
 * has.
 *
 * The amp draws no scrollbar — the window is its layout — so it is never let
 * shorter than it needs at its tightest: the song without its cover or its
 * chips, the dock, the open space at the least that holds the visualizer's
 * bar, and the sheet as it stands (a lowered sheet asks for its tabs alone).
 * Main holds the window to that (`holdPlayerHeight`); there is no ceiling,
 * because a taller window gives the picture the room.
 *
 * Between that floor and the height everything needs at its roomiest the
 * song gives its room up in two steps, the smaller first: the cover shrinks,
 * and only then do the cover and the chips go. A single step lost the whole
 * cover for the want of 24 pixels at the default 1080 — and gave those
 * 130 pixels to the open space, which never needed them. Each height is
 * measured on the page as it stands, the layout switched to its natural
 * sizes for the measurement (`is-measuring`, with each fit's class) and back
 * before anything is painted, and measured again whenever the window or
 * anything in it changes size — a Tone page is shorter than the faders, a
 * lowered sheet shorter still.
 */
const usePlayerHeightLimit = (
  rootRef: RefObject<HTMLDivElement | null>,
  sheet: IPlayerSheet,
  isFolded: boolean,
): TPlayerFit => {
  const [fit, setFit] = useState<TPlayerFit>('roomy');
  useLayoutEffect(() => {
    const root = rootRef.current;
    const main = root?.querySelector<HTMLElement>('.player-main');
    if (isFolded || !root || !main) {
      holdPlayerHeight(null, null);
      setFit('roomy');
      return undefined;
    }
    const classes = Object.values(FIT_CLASS);
    const naturalHeight = (at: TPlayerFit) => {
      const was = classes.filter((name) => root.classList.contains(name));
      root.classList.remove(...classes);
      root.classList.add('is-measuring');
      if (at !== 'roomy') {
        root.classList.add(FIT_CLASS[at]);
      }
      const { height } = root.getBoundingClientRect();
      root.classList.remove('is-measuring', ...classes);
      root.classList.add(...was);
      return height;
    };
    const measure = () => {
      const roomy = naturalHeight('roomy');
      const snug = naturalHeight('snug');
      const tight = naturalHeight('compact');
      holdPlayerHeight(null, Math.ceil(tight));
      const room = window.innerHeight;
      if (room >= roomy) {
        setFit('roomy');
      } else {
        setFit(room >= snug ? 'snug' : 'compact');
      }
    };
    measure();
    window.addEventListener('resize', measure);
    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', measure);
    }
    // The sheet and the song are the parts whose own height changes: a page
    // turned, a band layout changed, a title that wraps.
    const observer = new ResizeObserver(measure);
    main
      .querySelectorAll<HTMLElement>('.player-sheet, .player-now')
      .forEach((part) => observer.observe(part));
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [isFolded, rootRef, sheet.isOpen, sheet.tab]);
  return fit;
};

export default usePlayerHeightLimit;
