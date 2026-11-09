/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import PlayerPicture from '../components/featureTour/PlayerPicture';
import { PICTURE_HEIGHT } from '../components/featureTour/playerPictureData';

interface IStudioStagePlayerProps {
  /** The player's size on the stage, a closer look's scale included. */
  width: number;
  height: number;
  /** Where a closer look has moved it, as it moves the scene under it. */
  style?: CSSProperties;
}

/**
 * THE COMPACT PLAYER'S PARTS OVER THE SCENE BEING MADE, when the author asks
 * for them (Ivan, 2026-11-09: "allow user to select if just the frame and if
 * with amp ui on top"): the player Help and What's New draw by its own parts
 * (`PlayerPicture`), its whole column, laid over the stage's scene with
 * nothing of its own behind it, so the song, its keys and the transport
 * stand over the scene and the panes below frost it, exactly as the
 * player's window does. The scene under it is framed the same with the
 * parts or without them (`PLAYER_PANEL_VIEW`).
 *
 * Only a picture: nothing on it can be pressed, focused or read out, and the
 * scene's own hands under it hear every press, as they do on the graph.
 */
export default function StudioStagePlayer({
  width,
  height,
  style,
}: IStudioStagePlayerProps) {
  return (
    <div
      className="studio-stage__player"
      inert
      aria-hidden="true"
      style={{ width, height, ...style }}
    >
      <PlayerPicture
        picture="scene"
        zoom={height / PICTURE_HEIGHT}
        still={null}
      />
    </div>
  );
}
