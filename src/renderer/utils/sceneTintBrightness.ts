/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from './graphStorage';
import type { TSceneTintMode } from './sceneTintStore';

/**
 * How much lighter or darker the window's surfaces stand while a Plus
 * visualizer lends them its colour, in each mode that lends it — Colours,
 * Ambient and the Backdrop, each its own (Ivan, 2026-09-25: "add another
 * slider too for the brightness so the light theme we can do more light even
 * not just transparent", and each "under that menu").
 *
 * A step from -50 to +50, 0 being the theme's own lightness; the palette
 * turns it into a lift of each surface's lightness (`sceneTintPalette.ts`).
 */
export type TTintBrightnessMode = Exclude<TSceneTintMode, 'off'>;

export const TINT_BRIGHTNESS_MIN = -50;
export const TINT_BRIGHTNESS_MAX = 50;

const KEY = 'fluideq.sceneTintBrightness';
const MODES: readonly TTintBrightnessMode[] = ['tint', 'pulse', 'cover'];

type TBrightness = Record<TTintBrightnessMode, number>;

const clampStep = (value: number) =>
  Math.round(
    Math.min(TINT_BRIGHTNESS_MAX, Math.max(TINT_BRIGHTNESS_MIN, value)),
  );

const readBrightness = (): TBrightness => {
  const none: TBrightness = { tint: 0, pulse: 0, cover: 0 };
  const stored = readStored(KEY);
  if (stored === null) {
    return none;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    // A damaged entry puts every mode back at the theme's own lightness.
    return none;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return none;
  }
  const saved = parsed as Partial<Record<string, unknown>>;
  return Object.fromEntries(
    MODES.map((mode) => {
      const value = saved[mode];
      return [
        mode,
        typeof value === 'number' && Number.isFinite(value)
          ? clampStep(value)
          : 0,
      ];
    }),
  ) as TBrightness;
};

let brightness = readBrightness();
const listeners = new Set<() => void>();

export const getTintBrightness = (mode: TSceneTintMode): number =>
  mode === 'off' ? 0 : brightness[mode];

export const setTintBrightness = (mode: TTintBrightnessMode, next: number) => {
  const value = clampStep(next);
  if (brightness[mode] === value) {
    return;
  }
  brightness = { ...brightness, [mode]: value };
  writeStored(KEY, JSON.stringify(brightness));
  listeners.forEach((listener) => listener());
};

export const subscribeTintBrightness = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useTintBrightness = (mode: TTintBrightnessMode) =>
  useSyncExternalStore(
    subscribeTintBrightness,
    () => brightness[mode],
    () => 0,
  );
