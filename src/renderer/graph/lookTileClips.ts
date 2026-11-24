/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useAccount } from '../account/accountStore';
import { useSceneClip } from '../plus/cardClip';
import type { ILookThumbnailRef } from './lookThumbnails';

/**
 * The look picker's scene tiles play their published clips (Ivan,
 * 2026-11-20: "scenes videos needs to play on the thumbnail too") - the same
 * ten silent seconds a gallery card plays, never the scene itself: a tile
 * starts no scene worker and no GL context.
 *
 * ONLY THE TILE UNDER THE POINTER OR THE FOCUS (Ivan, 2026-11-23: "having
 * all scenes playing preview at the same time is too much resources, only
 * when user hovers we play"). Every tile at least half in view used to
 * play, up to twelve at once - 117% of a core decoded in software, measured
 * on 2026-11-20 - so the picker cost most while it was only being looked
 * over. Now each tile shows its picture, and the one the member points at
 * or reaches with the keyboard plays, as a gallery card does. The picker
 * closed unmounts every tile, and a hidden window pauses what is playing
 * (`SceneClip`). Main keeps each clip on disk by version, so a tile pointed
 * at twice downloads once.
 */
const useTileClip = (
  thumbnail: ILookThumbnailRef | undefined,
  wanted: boolean,
): string | undefined => {
  // A picture handed in as it is (Help's made-up scenes) is never asked about.
  const published =
    thumbnail?.still === undefined ? thumbnail?.published : undefined;
  const me = useAccount().identity?.id;
  return useSceneClip(
    published && {
      authorId: published.authorId,
      sceneId: published.sceneId,
      version: published.version,
      updatedAt: published.revision,
    },
    me,
    wanted,
  );
};

export default useTileClip;
