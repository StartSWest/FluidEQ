/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILightingFrame } from 'common/lighting/lightingModel';

/**
 * The last frame sent to the devices, for the page to draw the same desk the
 * member is looking at. Handed to listeners directly rather than through
 * React: it changes thirty times a second, and only a canvas draws it.
 */

type TPreviewListener = (
  frame: ILightingFrame | undefined,
  image: ImageBitmap | undefined,
) => void;

let latest: ILightingFrame | undefined;
let latestImage: ImageBitmap | undefined;
const listeners = new Set<TPreviewListener>();

export const publishLightingPreview = (
  frame: ILightingFrame | undefined,
  image?: ImageBitmap,
) => {
  const previousImage = latestImage;
  latest = frame;
  latestImage = image;
  listeners.forEach((listener) => listener(frame, image));
  if (previousImage !== image) {
    previousImage?.close();
  }
};

/** Called at once with the frame there is, then with every one after it. */
export const subscribeLightingPreview = (listener: TPreviewListener) => {
  listeners.add(listener);
  listener(latest, latestImage);
  return () => {
    listeners.delete(listener);
  };
};
