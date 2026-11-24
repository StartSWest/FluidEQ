/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import { useAccount } from '../account/accountStore';
import { useKnownWithoutClip, useSceneClip } from '../plus/cardClip';
import { ClipSlotsScope, useClipSlot } from '../plus/clipSlots';
import type { ILookThumbnailRef } from './lookThumbnails';

/**
 * The look picker's scene tiles play their published clips while they are
 * in the picker's scroller, in the grid and in the Details list alike (Ivan,
 * 2026-11-24: "about the plus viz showing the videos on elements that are in
 * the view I want that too"), as the standard looks beside them draw live -
 * within the bound and the rules every list of scenes shares
 * (`clipSlots.tsx`). Only ever the clip, never the scene ("we only show
 * videos as thumbnail, not the actual viz").
 */

/**
 * The clip slots one list of scene tiles shares: the picker's grid of
 * scenes, or the scene rows of its Details list. It adds no element.
 */
export const SceneClipScope = ({ children }: { children: ReactNode }) => (
  <ClipSlotsScope scroller="[data-look-picker-scroll]">
    {children}
  </ClipSlotsScope>
);

/**
 * The clip a scene tile plays, as an object URL, while it holds a slot and
 * the scene has a published clip; undefined otherwise, and the tile shows
 * its picture.
 */
const useTileClip = (
  thumbnail: ILookThumbnailRef | undefined,
  element: Element | null,
  pointed: boolean,
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
  // A scene found to have no clip takes no slot from one that has.
  const withoutClip = useKnownWithoutClip(scene, me);
  const playing = useClipSlot(
    element,
    pointed,
    scene !== undefined && !withoutClip,
  );
  return useSceneClip(scene, me, playing);
};

export default useTileClip;
