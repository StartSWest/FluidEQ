/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useSyncExternalStore } from 'react';
import { readStored, writeStored } from './graphStorage';

/**
 * How soft the Backdrop's scene is behind the panes, in percent of the
 * strongest blur (Ivan, 2026-11-16: "we want the backdrop transparent and
 * blur settings on the main app hamburger button"). It moves the blur under
 * every see-through page and the EQ page's floating glass alike
 * (`SceneCover.scss`, `--backdrop-blur`).
 *
 * Half way is the glass's own 26px, what the Backdrop wore before there was
 * a choice, so nobody's window changes until they move it. 100 is twice the
 * glass, where a scene is no more than its colours. 0 is no blur at all, for
 * somebody who wants the panes see-through and nothing more (Ivan: "in case
 * users just wants transparency no blur"): the scene sharp and in its own
 * colours, without the glass's saturation either, which on a scene seen
 * sharp is not glass but a recoloured picture.
 */
export const BACKDROP_BLUR_MIN = 0;
export const BACKDROP_BLUR_MAX = 100;
export const BACKDROP_BLUR_DEFAULT = 50;

/** The blur radius at 100%: twice the glass's 26px. */
const MAX_RADIUS_PX = 52;

const KEY = 'fluideq.backdropBlur';

const clampBlur = (value: number) =>
  Math.round(Math.min(BACKDROP_BLUR_MAX, Math.max(BACKDROP_BLUR_MIN, value)));

const readBlur = () => {
  const raw = readStored(KEY);
  const stored = Number(raw);
  return raw === null || !Number.isFinite(stored)
    ? BACKDROP_BLUR_DEFAULT
    : clampBlur(stored);
};

let chosen = readBlur();
const listeners = new Set<() => void>();

export const setBackdropBlur = (next: number) => {
  const value = clampBlur(next);
  if (value === chosen) {
    return;
  }
  chosen = value;
  writeStored(KEY, String(value));
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useBackdropBlur = () =>
  useSyncExternalStore(
    subscribe,
    () => chosen,
    () => BACKDROP_BLUR_DEFAULT,
  );

/** The radius the stylesheet blurs by, for a choice in percent. */
export const backdropBlurRadius = (percent: number) =>
  `${(clampBlur(percent) / BACKDROP_BLUR_MAX) * MAX_RADIUS_PX}px`;

/**
 * The radius on the document's root, beside `--backdrop-veil`, where the
 * Backdrop's filters read it; and at 0 the saturation taken back to none.
 * Otherwise the saturation is left to the stylesheet's default, the glass's
 * own (`SceneCover.scss`), so its number lives in one place.
 */
export const useBackdropBlurOnRoot = () => {
  const value = useBackdropBlur();
  useEffect(() => {
    const { style } = document.documentElement;
    style.setProperty('--backdrop-blur', backdropBlurRadius(value));
    if (value === BACKDROP_BLUR_MIN) {
      style.setProperty('--backdrop-saturate', '100%');
    } else {
      style.removeProperty('--backdrop-saturate');
    }
  }, [value]);
};
