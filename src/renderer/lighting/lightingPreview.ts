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

type TPreviewListener = (frame: ILightingFrame | undefined) => void;

let latest: ILightingFrame | undefined;
const listeners = new Set<TPreviewListener>();

export const publishLightingPreview = (frame: ILightingFrame | undefined) => {
  latest = frame;
  listeners.forEach((listener) => listener(frame));
};

/** Called at once with the frame there is, then with every one after it. */
export const subscribeLightingPreview = (listener: TPreviewListener) => {
  listeners.add(listener);
  listener(latest);
  return () => {
    listeners.delete(listener);
  };
};
