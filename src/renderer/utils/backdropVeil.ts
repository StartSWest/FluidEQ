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
 * the picture is still there to be seen. A fresh install starts at the most,
 * which the slider shows as 5% transparent (Ivan, 2026-09-26: "transparent
 * 5%" as the default, after trying half); 58% was where the Backdrop was
 * first tuned, and anybody who moved it keeps their own.
 */
export const BACKDROP_VEIL_MIN = 20;
export const BACKDROP_VEIL_MAX = 95;
export const BACKDROP_VEIL_DEFAULT = BACKDROP_VEIL_MAX;

/**
 * THE AMP KEEPS ITS OWN, as it keeps its own Brightness (`utils/theme.ts`).
 * The amp stands on its picture in glass (the Stage, Ivan 2026-09-27), and
 * this is how much of that glass is floor: the same slider, over the same
 * range, but not the full app's panes — at the app's own 5% the glass hid
 * the picture it is there to stand on. It opens at 45% transparent, where
 * the dock and the sheet read as glass and every word on them still reads.
 */
const PLAYER_VEIL_DEFAULT = 55;

/** Which window the choice belongs to: the full app, or the amp. */
export type TBackdropVeilScope = 'app' | 'player';

const KEYS: Record<TBackdropVeilScope, string> = {
  app: 'fluideq.backdropVeil',
  player: 'fluideq.backdropVeil.player',
};
const DEFAULTS: Record<TBackdropVeilScope, number> = {
  app: BACKDROP_VEIL_DEFAULT,
  player: PLAYER_VEIL_DEFAULT,
};

const clampVeil = (value: number) =>
  Math.round(Math.min(BACKDROP_VEIL_MAX, Math.max(BACKDROP_VEIL_MIN, value)));

const readVeil = (scope: TBackdropVeilScope) => {
  const raw = readStored(KEYS[scope]);
  const stored = Number(raw);
  return raw === null || !Number.isFinite(stored)
    ? DEFAULTS[scope]
    : clampVeil(stored);
};

const chosen: Record<TBackdropVeilScope, number> = {
  app: readVeil('app'),
  player: readVeil('player'),
};
let scope: TBackdropVeilScope = 'app';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * The window has become the app or the amp: wear that one's choice. Called
 * with the theme's own scope (`App.tsx`); nothing is written down here.
 */
export const applyBackdropVeilScope = (next: TBackdropVeilScope) => {
  if (next === scope) {
    return;
  }
  scope = next;
  notify();
};

export const setBackdropVeil = (next: number) => {
  const value = clampVeil(next);
  if (value === chosen[scope]) {
    return;
  }
  chosen[scope] = value;
  writeStored(KEYS[scope], String(value));
  notify();
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
    () => chosen[scope],
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
