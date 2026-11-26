/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRainbowStops } from '../utils/rainbowPalette';
import { useLiveSurface, useThemeShade } from '../utils/theme';
import { createLookTileLoop, type ILookTileLoop } from './lookTileLoop';
import { createTileWatcher, type TWatchTile } from './lookTileWatcher';
import { LookTileSoundScope } from './lookTileSound';

/**
 * The look picker's grid of standard looks, each one its still picture
 * until the pointer or the keyboard is on it, and then the look itself,
 * live, at the display's full rate (Ivan, 2026-11-26: "only play the one
 * hovering, and play it full, no fps drop"; `onePlaying.ts`). One loop draws
 * it (`lookTileLoop.ts`) and one sound feeds it (`lookTileSound.tsx`), on
 * the music or on the demo song while nothing plays (`LookTileArt`).
 */

interface ITileGrid {
  loop: ILookTileLoop | undefined;
  /** Tells `onChange` whether `element` is in the picker's scroller. */
  watch: TWatchTile;
  /** The window's colours, as part of what names a still. */
  paintKey: string;
  /**
   * A tile is about to play: the sound is opened from now until the grid
   * closes. Never before - a grid nobody points at holds no capture and runs
   * no demo song - and not closed between two tiles, or a pointer moving
   * across the grid would start the demo song again at every tile.
   */
  wantSound: () => void;
}

const TileGridContext = createContext<ITileGrid | undefined>(undefined);

/** A tile drawn alone, outside a grid, keeps its picture. */
const RESTING: ITileGrid = {
  loop: undefined,
  watch: () => () => undefined,
  paintKey: '',
  wantSound: () => undefined,
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
  const [watcher] = useState(() => createTileWatcher());
  const [listening, setListening] = useState(false);
  const wantSound = useCallback(() => setListening(true), []);
  useEffect(
    () => () => {
      loop.dispose();
      watcher.dispose();
    },
    [loop, watcher],
  );
  const paintKey = usePaintKey();
  const value = useMemo<ITileGrid>(
    () => ({ loop, watch: watcher.watch, paintKey, wantSound }),
    [loop, watcher, paintKey, wantSound],
  );
  return (
    <TileGridContext.Provider value={value}>
      <LookTileSoundScope listening={listening}>{children}</LookTileSoundScope>
    </TileGridContext.Provider>
  );
};

const LookStyleGrid = ({ children }: { children: ReactNode }) => (
  <div className="look-picker__grid look-picker__grid--styles">
    <LookTileScope>{children}</LookTileScope>
  </div>
);

export default LookStyleGrid;
