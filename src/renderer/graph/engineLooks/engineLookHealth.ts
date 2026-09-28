/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { GraphStyle } from 'common/graphStyles';
import { isSceneRenderingAvailable } from '../sceneHealth';

/**
 * Which of the engine's looks cannot be drawn by the engine on this machine
 * this session, and go back to the page's 2D canvas.
 *
 * Every way the engine can fail a look ends here — a shader the driver will
 * not compile, a GPU context lost twice, a machine too slow at the smallest
 * size — as every way it can fail a Plus scene ends in that scene's fallback
 * form. For a look the fallback is the look itself, drawn as it always was,
 * so a failure costs the speed and nothing else. Not written down: the next
 * launch tries the engine again, as a Plus scene's slow session does.
 */

const failed = new Set<GraphStyle>();
const listeners = new Set<() => void>();

export const markEngineLookFailed = (style: GraphStyle): void => {
  if (failed.has(style)) {
    return;
  }
  failed.add(style);
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Whether the engine may draw `style` here: WebGL2, and no failure yet. */
export const useEngineLookUsable = (style: GraphStyle): boolean =>
  useSyncExternalStore(
    subscribe,
    () => !failed.has(style) && isSceneRenderingAvailable(),
    () => false,
  );
