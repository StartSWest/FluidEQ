/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useAccount } from '../account/accountStore';
import { useKnownWithoutClip, useSceneClip } from '../plus/cardClip';
import { useOnePlaying } from '../utils/onePlaying';
import type { ILookThumbnailRef } from './lookThumbnails';

/**
 * The clip a look picker scene tile plays, as an object URL, while it is the
 * one tile in the window that plays - the pointer or the keyboard is on it
 * (`onePlaying.ts`) - and the scene has a published clip; undefined
 * otherwise, and the tile shows its picture. Only ever the clip, never the
 * scene ("we only show videos as thumbnail, not the actual viz"): a tile
 * starts no scene worker and no GL context.
 */
const useTileClip = (
  thumbnail: ILookThumbnailRef | undefined,
  attention: boolean,
): string | undefined => {
  // A picture handed in as it is (Help's made-up scenes) is never asked about.
  const published =
    thumbnail?.still === undefined ? thumbnail?.published : undefined;
  const me = useAccount().identity?.id;
  const scene = published && {
    authorId: published.authorId,
    sceneId: published.sceneId,
    version: published.version,
    updatedAt: published.revision,
  };
  // A scene found to have no clip does not take the turn from one that has:
  // the keyboard's tile keeps playing under a pointer resting on it.
  const withoutClip = useKnownWithoutClip(scene, me);
  const playing = useOnePlaying(
    attention && scene !== undefined && !withoutClip,
  );
  return useSceneClip(scene, me, playing);
};

export default useTileClip;
