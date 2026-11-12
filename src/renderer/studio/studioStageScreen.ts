/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PLAYER_PICTURE_HEIGHT } from 'common/constants';
import {
  ULTRA_WIDE_GRAPH,
  ULTRA_WIDE_SHOWN,
  ULTRA_WIDE_WINDOW,
  ULTRA_WIDE_WINDOW_VIEW,
} from 'common/stageShapes';
import type { TStudioAgentShape } from 'common/studioAgent';
import {
  PICTURE_HEIGHT,
  PICTURE_PANEL_FOOT,
  PICTURE_WIDTH,
} from '../components/featureTour/playerPictureData';
import { sceneViewOf, type TSceneView } from '../graph/sceneView';

/**
 * What the stage shows the scene as: the stage itself, at the shape its
 * divider was dragged to; the EQ graph of an ultra-wide window; or the
 * Compact player, the scene behind the whole of its one column (Ivan,
 * 2026-11-09: "an ultra wide mode on studio to test scenes on the graph",
 * "we don't allow 2 columns anymore", "add graph and amp player").
 */
export type TStagePreview = 'stage' | 'ultraWide' | 'player';

/**
 * Each view as the member's AI names its shape (`STUDIO_AGENT_SHAPES`), so a
 * look that names none is of the view on the stage: the stage itself is the
 * graph's shape until its divider is dragged. The player view is the whole
 * column the stage shows, not the panel alone: the AI looked at the panel
 * while the member saw the scene run on under it (Ivan, 2026-11-12: "if they
 * are on the phone mode, the AMP UI, it takes that one").
 */
export const AGENT_SHAPE_OF_PREVIEW: Record<TStagePreview, TStudioAgentShape> =
  {
    stage: 'graph',
    ultraWide: 'ultra-wide-window',
    player: 'compact-player-column',
  };

/** The ultra-wide graph's shape, width over height (`ULTRA_WIDE_GRAPH`). */
export const ULTRA_WIDE_GRAPH_SHAPE =
  ULTRA_WIDE_GRAPH.width / ULTRA_WIDE_GRAPH.height;

/**
 * The Compact player as its window opens, 480 by 966 (`PlayerPicture`): the
 * scene is drawn behind the whole column, framed to the top panel under the
 * song and the controls and running on under the frosted panes below
 * (`PlayerStage`). It was the picture alone, 480 by 309, which on the stage
 * read as a wide player of the kind the amp stopped being (2026-10-25).
 */
const PLAYER_SHAPE = PICTURE_WIDTH / PICTURE_HEIGHT;

/**
 * Where the scene's own panel stands on the player's column: the top panel,
 * the song's picture and the transport under the title strip, which is what
 * the player frames a scene to (`PlayerStage`, `sceneView.ts`), with the
 * rest of the column more of the same scene. The same with the player's
 * parts laid over the preview or without them (Ivan, 2026-11-09: "don't
 * show the amp", "or allow user to select if just the frame and if with amp
 * ui on top"), so turning the parts on and off never moves the picture.
 */
export const PLAYER_PANEL_VIEW: TSceneView = sceneViewOf(
  {
    left: 0,
    top: PICTURE_PANEL_FOOT - PLAYER_PICTURE_HEIGHT,
    width: PICTURE_WIDTH,
    height: PLAYER_PICTURE_HEIGHT,
  },
  { left: 0, top: 0, width: PICTURE_WIDTH, height: PICTURE_HEIGHT },
);

/**
 * Where the graph's band stands on the part of the ultra-wide window shown
 * (`ULTRA_WIDE_SHOWN`: a band's height round it), as the scene's view: the
 * band is the panel, the window round it more of the same scene. The AI's
 * look at `ultra-wide-window` takes the same view.
 */
export const ULTRA_WIDE_PANEL_VIEW: TSceneView = ULTRA_WIDE_WINDOW_VIEW;

/**
 * The band's rectangle on the part of the window shown, in shares of it,
 * from the top-left, as the page lays the frame over the scene.
 */
export const ULTRA_WIDE_BAND = {
  left:
    (ULTRA_WIDE_WINDOW.graphLeft - ULTRA_WIDE_SHOWN.left) /
    ULTRA_WIDE_SHOWN.width,
  top:
    (ULTRA_WIDE_WINDOW.graphTop - ULTRA_WIDE_SHOWN.top) /
    ULTRA_WIDE_SHOWN.height,
  width: ULTRA_WIDE_GRAPH.width / ULTRA_WIDE_SHOWN.width,
  height: ULTRA_WIDE_GRAPH.height / ULTRA_WIDE_SHOWN.height,
} as const;

/** Room round a preview's window, for its edge and shadow. */
export const PREVIEW_INSET = 16;
/** Between a preview's window and the plate it stands clear of. */
export const PLATE_GAP = 12;

export interface IStageScreen {
  width: number;
  height: number;
  /** Its top left corner inside the stage; absent, the whole stage. */
  left?: number;
  top?: number;
}

/** The plate in the stage's top right corner: its left and bottom edges. */
export interface IStagePlate {
  left: number;
  bottom: number;
}

/**
 * The Compact player standing on the stage, as tall as the stage leaves
 * room for and never taller than its own window, so a full-screen stage
 * shows it at the size it really is.
 *
 * It moves left of centre where the plate would stand over it: on the
 * narrowest window the plate covered the top of the player's, which is the
 * part of the scene the preview is there to show.
 */
const playerScreen = (
  box: { width: number; height: number },
  plate: IStagePlate | undefined,
): IStageScreen => {
  const height = Math.floor(
    Math.max(
      0,
      Math.min(
        PICTURE_HEIGHT,
        box.height - 2 * PREVIEW_INSET,
        (box.width - 2 * PREVIEW_INSET) / PLAYER_SHAPE,
      ),
    ),
  );
  const width = Math.floor(height * PLAYER_SHAPE);
  const centred = Math.round((box.width - width) / 2);
  const clear = plate === undefined ? centred : plate.left - PLATE_GAP - width;
  return {
    width,
    height,
    left: Math.max(PREVIEW_INSET, Math.min(centred, clear)),
    top: Math.round((box.height - height) / 2),
  };
};

/**
 * The ultra-wide window's shape as the stage shows it: the window the scene
 * covers behind the app, a band's height round the graph
 * (`ULTRA_WIDE_SHOWN`), the graph framed in it where it really stands (Ivan,
 * 2026-11-12: "the scene must be seen complete"). It showed the graph's
 * band alone, black above and below, and a picture that stopped short of
 * the window's foot looked whole there.
 */
export const ULTRA_WIDE_WINDOW_SHAPE =
  ULTRA_WIDE_SHOWN.width / ULTRA_WIDE_SHOWN.height;

/**
 * The ultra-wide window across the stage, as large as it allows, in its
 * middle — or below the plate, where the plate would cover the window's top
 * and the stage has the room under it.
 */
const ultraWideScreen = (
  box: { width: number; height: number },
  plate: IStagePlate | undefined,
): IStageScreen => {
  const width = Math.floor(
    Math.max(
      0,
      Math.min(
        box.width - 2 * PREVIEW_INSET,
        (box.height - 2 * PREVIEW_INSET) * ULTRA_WIDE_WINDOW_SHAPE,
      ),
    ),
  );
  const height = Math.floor(width / ULTRA_WIDE_WINDOW_SHAPE);
  const centred = Math.round((box.height - height) / 2);
  const lowest = Math.max(PREVIEW_INSET, box.height - PREVIEW_INSET - height);
  const top =
    plate === undefined ? centred : Math.max(centred, plate.bottom + PLATE_GAP);
  return {
    width,
    height,
    left: Math.round((box.width - width) / 2),
    top: Math.min(top, lowest),
  };
};

/**
 * Where the scene is drawn inside the Studio's stage (`StudioStage`): all of
 * it, or a preview's window standing in it. Whole pixels, so the canvas is
 * never drawn between two.
 */
export const stageScreen = (
  box: { width: number; height: number },
  preview: TStagePreview,
  plate: IStagePlate | undefined,
): IStageScreen => {
  if (preview === 'player') {
    return playerScreen(box, plate);
  }
  if (preview === 'ultraWide') {
    return ultraWideScreen(box, plate);
  }
  return box;
};
