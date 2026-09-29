/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PLAYER_DEFAULT_HEIGHT, PLAYER_DEFAULT_WIDTH } from 'common/constants';

/**
 * The compact player's window as it first opens, 480 by 1080: the Stage amp
 * draws the scene as that whole window's background (`PlayerStage`), so
 * this is the shape a scene is most often seen at narrower than the graph.
 */
const PLAYER_SHAPE = PLAYER_DEFAULT_WIDTH / PLAYER_DEFAULT_HEIGHT;
/** Room round the player's window, for its edge and shadow. */
export const PLAYER_INSET = 16;
/** Between the player's window and the plate it stands clear of. */
export const PLATE_GAP = 12;

export interface IStageScreen {
  width: number;
  height: number;
  /** Its top left corner inside the stage; absent, the whole stage. */
  left?: number;
  top?: number;
}

/**
 * Where the scene is drawn inside the Studio's stage (`StudioStage`): all of
 * it, or the compact player's window standing in its middle as tall as the
 * stage leaves room for. Whole pixels, so the canvas is never drawn between
 * two.
 *
 * The window moves left of centre where the plate in the stage's top right
 * corner (`plateLeft`, its left edge in the stage) would stand over it: on
 * the narrowest window the plate covered the top of the player's, which is
 * the part of the scene the preview is there to show.
 */
export const stageScreen = (
  box: { width: number; height: number },
  isPlayer: boolean,
  plateLeft: number | undefined,
): IStageScreen => {
  if (!isPlayer) {
    return box;
  }
  const height = Math.floor(
    Math.max(
      0,
      Math.min(
        box.height - 2 * PLAYER_INSET,
        (box.width - 2 * PLAYER_INSET) / PLAYER_SHAPE,
      ),
    ),
  );
  const width = Math.floor(height * PLAYER_SHAPE);
  const centred = Math.round((box.width - width) / 2);
  const clear =
    plateLeft === undefined ? centred : plateLeft - PLATE_GAP - width;
  return {
    width,
    height,
    left: Math.max(PLAYER_INSET, Math.min(centred, clear)),
    top: Math.round((box.height - height) / 2),
  };
};
