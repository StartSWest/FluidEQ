/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How Surprise me's draw reaches Cover Flow when Cover Flow is on screen.
 *
 * The draw is Cover Flow's own scene in every view (Ivan, 2026-11-14: "same
 * component, not loading two"). Over Cover Flow, the row already on screen
 * spins, so the view lends its scene through this; anywhere else, the draw
 * builds the same scene over the shelf for the length of the spin. Either
 * way one scene, one WebGL context, one copy of three.js.
 */
import type { MutableRefObject } from 'react';
import type { ILibraryTrack } from '../../../common/library/types';
import type { ICoverFlowSlot } from '../coverFlow/coverFlowScene';

export interface ISurpriseCaption {
  title: string;
  detail: string;
}

export interface ISurpriseDraw {
  /** The song picked: Cover Flow spins along its own row to this song's
   * cover when the row holds it, and only otherwise along `row`. */
  pick: ILibraryTrack;
  /** The covers the row runs past, the pick among them. */
  row: readonly ICoverFlowSlot[];
  /** Where the row stands when the spin starts. */
  startIndex: number;
  pickIndex: number;
  caption: ISurpriseCaption;
  signal: AbortSignal;
}

export interface ISurpriseStage {
  /**
   * Spins the view's own row to the pick, shows the caption under it, holds,
   * and gives the row back. Answers false when the view has no scene to lend
   * (still loading, or no WebGL), and the draw then shows nothing rather
   * than a second scene beside it.
   */
  play: (draw: ISurpriseDraw) => Promise<boolean>;
}

/** Held by the Library's workspace: Cover Flow fills it while mounted. */
export type TSurpriseStageRef = MutableRefObject<ISurpriseStage | undefined>;
