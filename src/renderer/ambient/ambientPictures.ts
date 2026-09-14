/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_AMBIENT_SIZE,
  type IAmbientElement,
  type TAmbientFrame,
} from 'common/sceneAmbient';
import type { ISceneArtwork } from 'common/sceneArtwork';
import { sceneArtworkBytes } from '../graph/sceneArtwork';

/**
 * The poses of a scene's `picture` elements, cut once from its own artwork —
 * the signed picture its shader already samples, never a file, a path or an
 * address — and kept small: no pose is held larger than the engine can draw
 * it, so a scene's whole flock of poses is a few hundred kilobytes however
 * large its artwork is.
 *
 * Every pose is feathered at its edges on the way in. A sprite on a clear
 * ground loses nothing to that; a pose cut from an opaque photograph fades
 * into the window instead of crossing it as a pale square.
 */

/** Each picture element's poses, in the order of its frames, by element id. */
export type TAmbientPictures = ReadonlyMap<string, readonly OffscreenCanvas[]>;

/**
 * Device pixels on a pose's longer side: the largest element the engine draws,
 * at the canvas's highest ratio (1.5), with room for the music's swell.
 */
const MAX_POSE_PIXELS = Math.ceil(MAX_AMBIENT_SIZE * 1.5 * 1.15);
/** The share of a pose's side that fades out at each edge. */
const FEATHER = 0.08;

const feather = (
  context: OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
) => {
  const edge = (from: number, to: number, horizontal: boolean) => {
    const gradient = horizontal
      ? context.createLinearGradient(from, 0, to, 0)
      : context.createLinearGradient(0, from, 0, to);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(FEATHER, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1 - FEATHER, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    return gradient;
  };
  context.globalCompositeOperation = 'destination-in';
  context.fillStyle = edge(0, w, true);
  context.fillRect(0, 0, w, h);
  context.fillStyle = edge(0, h, false);
  context.fillRect(0, 0, w, h);
  context.globalCompositeOperation = 'source-over';
};

const cutPose = async (
  artwork: ImageBitmap,
  [x, y, width, height]: TAmbientFrame,
): Promise<OffscreenCanvas | undefined> => {
  const scale = Math.min(1, MAX_POSE_PIXELS / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const pose = await createImageBitmap(artwork, x, y, width, height, {
    resizeWidth: w,
    resizeHeight: h,
    resizeQuality: 'high',
  });
  const canvas = new OffscreenCanvas(w, h);
  const context = canvas.getContext('2d');
  if (!context) {
    pose.close();
    return undefined;
  }
  context.drawImage(pose, 0, 0);
  pose.close();
  feather(context, w, h);
  return canvas;
};

/**
 * The poses of every picture in `elements`, cut from `artwork`. Resolves
 * empty when there is none to cut, and without decoding anything; rejects
 * with the signal's reason once `signal` is aborted, having let go of the
 * decoded artwork either way.
 */
export const cutAmbientPictures = async (
  artwork: ISceneArtwork | undefined,
  elements: readonly IAmbientElement[],
  signal: AbortSignal,
): Promise<TAmbientPictures> => {
  const pictures = elements.filter(
    (element) => element.shape === 'picture' && element.frames?.length,
  );
  const cut = new Map<string, OffscreenCanvas[]>();
  if (
    !artwork ||
    pictures.length === 0 ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return cut;
  }
  const decoded = await createImageBitmap(
    new Blob([sceneArtworkBytes(artwork)], { type: artwork.mime }),
  );
  try {
    signal.throwIfAborted();
    // The same checked header the scene's own decode holds the picture to.
    if (decoded.width !== artwork.width || decoded.height !== artwork.height) {
      return cut;
    }
    await Promise.all(
      pictures.map(async (element) => {
        const poses = await Promise.all(
          (element.frames ?? []).map((frame) => cutPose(decoded, frame)),
        );
        if (
          poses.every((pose): pose is OffscreenCanvas => pose !== undefined)
        ) {
          cut.set(element.id, poses);
        }
      }),
    );
    signal.throwIfAborted();
    return cut;
  } finally {
    decoded.close();
  }
};
