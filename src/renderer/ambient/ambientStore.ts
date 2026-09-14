/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * Where the Studio's ambient controls stand while a member moves them, for the
 * window's elements (`SceneAmbient.tsx`) to follow before anything is saved —
 * the same way the stage follows the scene's own sliders.
 */

const NONE: Readonly<Record<string, number>> = Object.freeze({});
let values: Readonly<Record<string, number>> = NONE;
const listeners = new Set<() => void>();

export const setStudioAmbientValues = (
  next: Readonly<Record<string, number>> | undefined,
) => {
  const settled = next ?? NONE;
  if (settled === values) {
    return;
  }
  values = settled;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useStudioAmbientValues = () =>
  useSyncExternalStore(
    subscribe,
    () => values,
    () => NONE,
  );
