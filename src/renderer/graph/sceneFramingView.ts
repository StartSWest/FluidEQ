/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { framedPanel, framedPoint } from 'common/sceneFraming';
import type { ISceneFrame } from './sceneGl';
import { FULL_VIEW } from './sceneView';

/**
 * A frame as its scene's framing draws it on a canvas `width` by `height`
 * (`common/sceneFraming.ts`): the panel on screen becomes part of a larger
 * picture, slid so the scene's focus is in view, and everything the frame
 * gives in the panel's uv - the wave's band, the pointer, a tap - is given
 * in the picture's instead, so the scene still lines its spectrum up with
 * the wave on screen and still answers the hand where it is.
 *
 * The frame itself where there is no framing, or where the panel's shape
 * needs none. The picture is a `view`, the one the Backdrop widens a scene
 * with, so a flat scene and a 3D world are framed by the same numbers
 * (`sceneView.ts`, `world/worldDraw.ts`).
 */
const frameOf = (
  frame: ISceneFrame,
  width: number,
  height: number,
): ISceneFrame => {
  const { framing } = frame;
  if (!framing) {
    return frame;
  }
  const panel = frame.view ?? FULL_VIEW;
  const picture = framedPanel(panel, width, height, framing);
  if (picture === panel) {
    return frame;
  }
  const at = (u: number, v: number) => framedPoint(panel, picture, u, v);
  const [left, right, floor, ceiling] = frame.spectrumRect ?? [0, 1, 0, 1];
  const [bandLeft, bandFloor] = at(left, floor);
  const [bandRight, bandCeiling] = at(right, ceiling);
  const { pointer, tap } = frame;
  return {
    ...frame,
    view: picture,
    spectrumRect: [bandLeft, bandRight, bandFloor, bandCeiling],
    ...(pointer
      ? { pointer: [...at(pointer[0], pointer[1]), pointer[2], pointer[3]] }
      : {}),
    ...(tap ? { tap: [...at(tap[0], tap[1]), tap[2], tap[3]] } : {}),
  };
};

/**
 * The last frame framed, and at what size: the same frame at the same size
 * is answered with the same object. A world's still is prepared once and
 * then laid down band by band, each band a draw of that very frame
 * (`world/worldDraw.ts` compares them by identity), and a new object for
 * each band rendered the whole world again for every one of them.
 */
const framedAt = new WeakMap<
  ISceneFrame,
  { width: number; height: number; framed: ISceneFrame }
>();

export const framedFrame = (
  frame: ISceneFrame,
  width: number,
  height: number,
): ISceneFrame => {
  if (!frame.framing) {
    return frame;
  }
  const known = framedAt.get(frame);
  if (known && known.width === width && known.height === height) {
    return known.framed;
  }
  const framed = frameOf(frame, width, height);
  framedAt.set(frame, { width, height, framed });
  return framed;
};
