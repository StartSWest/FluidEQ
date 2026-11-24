/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRainbowStops } from '../utils/rainbowPalette';
import { useLiveSurface, useThemeShade } from '../utils/theme';
import { createLookTileLoop, type ILookTileLoop } from './lookTileLoop';
import { LookTileSoundScope } from './lookTileSound';

/**
 * The look picker's grid of standard looks, every one of them drawn live
 * (Ivan, 2026-11-23: "the animated version of the standard looks like the
 * real ones but very cheap instead of those fixed icons"; and then, "since
 * they are small, I want all of them to animate in this view"). Each tile
 * that is in the picker's scroller draws its look on the music, or on the
 * demo song while nothing plays (`LookTileArt`); a tile scrolled out of it
 * draws nothing and keeps its still. One loop draws them all
 * (`lookTileLoop.ts`) and one sound feeds them all (`lookTileSound.tsx`).
 */

interface ITileGrid {
  loop: ILookTileLoop | undefined;
  /** Tells `onChange` whether `element` is in the picker's scroller. */
  watch: (element: Element, onChange: (inView: boolean) => void) => () => void;
  /** The window's colours, as part of what names a still. */
  paintKey: string;
}

/**
 * Whether each tile is in the scroller it sits in (`[data-look-picker-
 * scroll]`), on one observer for the grid. Made on the first tile watched,
 * whose own place says which scroller that is: the tiles watch before the
 * grid's effects run. Where there is no observer at all, a tile is in view.
 */
const createWatcher = () => {
  let observer: IntersectionObserver | undefined;
  const listeners = new Map<Element, (inView: boolean) => void>();
  const watch = (element: Element, onChange: (inView: boolean) => void) => {
    if (typeof IntersectionObserver === 'undefined') {
      onChange(true);
      return () => undefined;
    }
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) =>
            listeners.get(entry.target)?.(entry.isIntersecting),
          ),
        { root: element.closest('[data-look-picker-scroll]') },
      );
    }
    listeners.set(element, onChange);
    observer.observe(element);
    return () => {
      listeners.delete(element);
      observer?.unobserve(element);
    };
  };
  return {
    watch,
    dispose: () => {
      observer?.disconnect();
      observer = undefined;
      listeners.clear();
    },
  };
};

const TileGridContext = createContext<ITileGrid | undefined>(undefined);

/** A tile drawn alone, outside a grid, keeps its picture. */
const RESTING: ITileGrid = {
  loop: undefined,
  watch: () => () => undefined,
  paintKey: '',
};

export const useTileGrid = (): ITileGrid =>
  useContext(TileGridContext) ?? RESTING;

/**
 * The colours a still is drawn in: the window's rainbow, its accent, its
 * ink and its shade. A still kept from other colours is another picture.
 */
const usePaintKey = () => {
  const stops = useRainbowStops();
  const accent = useLiveSurface('--accent', '');
  const ink = useLiveSurface('--text-primary', '');
  const shade = useThemeShade();
  return `${stops.join(',')}|${accent}|${ink}|${shade}`;
};

/**
 * Everything the live tiles share - the loop, the scroller's observer, the
 * sound - for whatever lays them out: the grid below, and the Details
 * list's small pictures (`LookPickerDetails`). It adds no element.
 */
export const LookTileScope = ({ children }: { children: ReactNode }) => {
  const [loop] = useState(createLookTileLoop);
  const [watcher] = useState(createWatcher);
  useEffect(
    () => () => {
      loop.dispose();
      watcher.dispose();
    },
    [loop, watcher],
  );
  const paintKey = usePaintKey();
  const value = useMemo<ITileGrid>(
    () => ({ loop, watch: watcher.watch, paintKey }),
    [loop, watcher, paintKey],
  );
  return (
    <TileGridContext.Provider value={value}>
      <LookTileSoundScope>{children}</LookTileSoundScope>
    </TileGridContext.Provider>
  );
};

const LookStyleGrid = ({ children }: { children: ReactNode }) => (
  <div className="look-picker__grid look-picker__grid--styles">
    <LookTileScope>{children}</LookTileScope>
  </div>
);

export default LookStyleGrid;
