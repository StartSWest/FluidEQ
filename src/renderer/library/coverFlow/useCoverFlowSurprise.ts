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
 * For the length of the draw the songs panel folds away, so the row has the
 * whole height (Ivan, 2026-11-14: "hide the album detail so it shows fully,
 * then when it lands it opens the album detail if that was open"); the view
 * only folds it, so what was open opens again as the row is given back. The
 * row's own caption gives way to the pick's once it lands.
 */
import { type MutableRefObject, useEffect, useState } from 'react';
import type { ICoverFlowScene } from './coverFlowScene';
import { DRAW_HOLD_MS, DRAW_SPIN_MS } from '../surpriseDraw/drawTiming';
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

const useCoverFlowSurprise = ({
  stageRef,
  sceneRef,
  borrow,
}: {
  stageRef: TSurpriseStageRef | undefined;
  sceneRef: MutableRefObject<ICoverFlowScene | undefined>;
  borrow: () => (() => void) | undefined;
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
      play: async ({ row, startIndex, pickIndex, caption, signal }) => {
        const scene = sceneRef.current;
        const giveBack = borrow();
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
          scene.setSource({
            count: row.length,
            itemAt: (index) => row[index],
            playingId: undefined,
          });
          scene.jumpTo(startIndex);
          await scene.spin({
            to: pickIndex,
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
  }, [stageRef, sceneRef, borrow]);

  return drawCaption;
};

export default useCoverFlowSurprise;
