/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useSyncExternalStore } from 'react';
import { readStored, writeStored } from './graphStorage';

/**
 * How much of the window's floor stands over the Backdrop's scene behind the
 * panes, in percent: the panes' veil and every surface on them
 * (`SceneCover.scss`, `--backdrop-veil`). On a dark theme that is how dark
 * the window sits over the picture (Ivan, 2026-09-25: "add slider for
 * transparent and how dark is the UI").
 *
 * The floor is 20% at the least, where the panes' text still stands on
 * something darker than any scene's bright spots, and 95% at the most, where
 * the picture is still there to be seen. A fresh install starts at half
 * (Ivan, 2026-09-26: "50% default on new app installs"); 58% was where the
 * Backdrop was first tuned, and anybody who moved it keeps their own.
 */
export const BACKDROP_VEIL_MIN = 20;
export const BACKDROP_VEIL_MAX = 95;
export const BACKDROP_VEIL_DEFAULT = 50;

const KEY = 'fluideq.backdropVeil';

const clampVeil = (value: number) =>
  Math.round(Math.min(BACKDROP_VEIL_MAX, Math.max(BACKDROP_VEIL_MIN, value)));

const readVeil = () => {
  const stored = Number(readStored(KEY));
  return readStored(KEY) === null || !Number.isFinite(stored)
    ? BACKDROP_VEIL_DEFAULT
    : clampVeil(stored);
};

let veil = readVeil();
const listeners = new Set<() => void>();

export const setBackdropVeil = (next: number) => {
  const value = clampVeil(next);
  if (value === veil) {
    return;
  }
  veil = value;
  writeStored(KEY, String(value));
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useBackdropVeil = () =>
  useSyncExternalStore(
    subscribe,
    () => veil,
    () => BACKDROP_VEIL_DEFAULT,
  );

/**
 * The value on the document's root, where the stylesheet and the drawings
 * that read their colours from the root (`readSurface`) both find it. Inline
 * beside the scene tint's own tokens, which are set and removed one by one
 * (`sceneTintStore.ts`), so neither disturbs the other.
 */
export const useBackdropVeilOnRoot = () => {
  const value = useBackdropVeil();
  useEffect(() => {
    document.documentElement.style.setProperty('--backdrop-veil', `${value}%`);
  }, [value]);
};
