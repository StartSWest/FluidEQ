/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Cover Flow's half of Surprise me's draw: while the view is on screen it
 * lends its own scene (`surpriseStage.ts`), so a press spins the row the
 * listener is looking at instead of laying a second scene over it.
 *
 * THE SHELF'S OWN ROW, WHEREVER IT CAN BE. The spin runs along the row as it
 * is, from a few covers before the pick to the pick's own cover, so the
 * covers either side of it when it lands are the ones that stay there.
 * Spinning a deck of covers from anywhere in the library and then giving the
 * row back swapped every neighbour at the end (Ivan, 2026-11-15: "the items
 * to the side of the picked one ... change to new different ones"). Only a
 * pick this row does not hold (a Playlists shelf, a search that left it out)
 * spins the draw's own deck.
 *
 * For the length of the draw the songs panel folds away, so the row has the
 * whole height (Ivan, 2026-11-14: "hide the album detail so it shows fully,
 * then when it lands it opens the album detail if that was open"); the view
 * only folds it, so what was open opens again as the row is given back. The
 * row's own caption gives way to the pick's once it lands.
 */
import { type MutableRefObject, useEffect, useState } from 'react';
import type { TLibraryBrowseMode } from '../../../common/library/types';
import type { ICoverFlowScene } from './coverFlowScene';
import shelfItemOf from '../shelfItem';
import {
  DRAW_HOLD_MS,
  DRAW_SPIN_MS,
  DRAW_TRAVEL,
} from '../surpriseDraw/drawTiming';
import type {
  ISurpriseCaption,
  ISurpriseStage,
  TSurpriseStageRef,
} from '../surpriseDraw/surpriseStage';

/**
 * Undefined while no draw is on; null while the row spins (no caption);
 * the pick's caption once it has landed.
 */
export type TDrawCaption = (ISurpriseCaption & { key: string }) | null;

/** Where the pick's cover stands in this row, or -1 for not in it. */
const shelfIndexOf = async (
  browseMode: TLibraryBrowseMode,
  itemId: string,
  positionOf: (id: string) => Promise<number>,
): Promise<number> => {
  // A playlist cover is the playlist, never a song's; a video shelf has no
  // Cover Flow. Neither row can hold the pick.
  if (browseMode === 'playlist' || browseMode === 'video') {
    return -1;
  }
  try {
    return await positionOf(itemId);
  } catch {
    // A row that cannot say where the pick is spins the draw's own deck.
    return -1;
  }
};

const useCoverFlowSurprise = ({
  stageRef,
  sceneRef,
  borrow,
  browseMode,
  positionOfRef,
}: {
  stageRef: TSurpriseStageRef | undefined;
  sceneRef: MutableRefObject<ICoverFlowScene | undefined>;
  borrow: (options?: { keepRow?: boolean }) => (() => void) | undefined;
  browseMode: TLibraryBrowseMode;
  /** The row's own lookup of a cover's place, read at the press. */
  positionOfRef: MutableRefObject<(id: string) => Promise<number>>;
}): TDrawCaption | undefined => {
  const [drawCaption, setDrawCaption] = useState<TDrawCaption | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!stageRef) {
      return undefined;
    }
    let serial = 0;
    const stage: ISurpriseStage = {
      play: async ({ pick, row, startIndex, pickIndex, caption, signal }) => {
        const shelfIndex = await shelfIndexOf(
          browseMode,
          shelfItemOf(browseMode, pick),
          positionOfRef.current,
        );
        if (signal.aborted) {
          return true;
        }
        const isOwnRow = shelfIndex >= 0;
        const scene = sceneRef.current;
        const giveBack = borrow({ keepRow: isOwnRow });
        if (!scene || !giveBack) {
          giveBack?.();
          return false;
        }
        serial += 1;
        const key = `surprise-${serial}`;
        setDrawCaption(null);
        try {
          // The reflections come back with the panel folded away.
          scene.setExpanded(false);
          if (isOwnRow) {
            scene.jumpTo(Math.max(0, shelfIndex - DRAW_TRAVEL));
          } else {
            scene.setSource({
              count: row.length,
              itemAt: (index) => row[index],
              playingId: undefined,
            });
            scene.jumpTo(startIndex);
          }
          await scene.spin({
            to: isOwnRow ? shelfIndex : pickIndex,
            spinMs: DRAW_SPIN_MS,
            holdMs: DRAW_HOLD_MS,
            onLanded: () => setDrawCaption({ key, ...caption }),
            signal,
          });
        } finally {
          giveBack();
          setDrawCaption(undefined);
        }
        return true;
      },
    };
    stageRef.current = stage;
    return () => {
      if (stageRef.current === stage) {
        stageRef.current = undefined;
      }
    };
  }, [stageRef, sceneRef, borrow, browseMode, positionOfRef]);

  return drawCaption;
};

export default useCoverFlowSurprise;
