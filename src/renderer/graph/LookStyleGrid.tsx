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
import useReducedMotion from '../utils/useReducedMotion';
import { useStillPaintKey } from './lookStillPlate';
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
   * A tile is about to play, or the pointer has come into the grid: the
   * sound is opened from now until the grid closes. Never before - a grid
   * nobody points at holds no capture and runs no demo song - and not closed
   * between two tiles, or a pointer moving across the grid would start the
   * demo song again at every tile.
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
  const paintKey = useStillPaintKey();
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

/**
 * The grid itself. Its sound opens on the first sign that somebody is
 * heading for a tile - the pointer moving anywhere over the grid, or the
 * keyboard's focus coming into it - a gap or a tile's edge ahead of the tile
 * itself: with no music playing the tiles move to the quiet demo song, which
 * takes a few frames to start, and started on the tile the first one hovered
 * stood still that long. A move, not an entry: a grid opened under a
 * resting pointer is entered by nothing.
 *
 * Never with the grid alone. Opened with the picker (Ivan, 2026-11-27:
 * "this needs to feel instant"), the silent demo song and its analysis cost
 * the picker harness's renderer 88-96% of a core with the picker merely
 * open, against 22-25% without - the cost a98b22206 took away at Ivan's
 * word. And never under reduced motion, where no tile moves.
 */
const LookStyleGridArea = ({ children }: { children: ReactNode }) => {
  const { wantSound } = useTileGrid();
  const reduced = useReducedMotion();
  return (
    <div
      className="look-picker__grid look-picker__grid--styles"
      onPointerMove={reduced ? undefined : wantSound}
      onFocus={reduced ? undefined : wantSound}
    >
      {children}
    </div>
  );
};

const LookStyleGrid = ({ children }: { children: ReactNode }) => (
  <LookTileScope>
    <LookStyleGridArea>{children}</LookStyleGridArea>
  </LookTileScope>
);

export default LookStyleGrid;
