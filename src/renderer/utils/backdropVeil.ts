/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useSyncExternalStore } from 'react';
import { readStored, writeStored } from './graphStorage';
import { SCENE_TINT_LEGACY_KEY, SCENE_TINT_MODE_KEY } from './sceneTintStore';

/**
 * How much of the window's floor stands over the amp's scene behind its
 * panes, in percent (`--backdrop-veil`, `_miniPlayerShell.scss`). The full
 * app's own was its Backdrop's, taken out on 2026-11-16; its stored value is
 * still what the mini player inside the app's window reads. On a dark theme that is how dark
 * the window sits over the picture (Ivan, 2026-09-25: "add slider for
 * transparent and how dark is the UI").
 *
 * The floor is 20% at the least, where the panes' text still stands on
 * something darker than any scene's bright spots; at the most it is the
 * whole floor in the full app, the Backdrop off (`BACKDROP_VEIL_OFF`), and
 * 95% in the amp, where the picture is still there to be seen. A fresh
 * install starts half way,
 * which the slider shows as 50% transparent, in the app and the amp alike
 * (Ivan, 2026-09-28: "transparent default to 50 when app install"); it was
 * 5% in the app ("transparent 5%", 2026-09-26) and 45% in the amp, whose
 * glass at the app's 5% hid the picture it stands on. Anybody who moved it
 * keeps their own.
 */
export const BACKDROP_VEIL_MIN = 20;
export const BACKDROP_VEIL_DEFAULT = 50;

/**
 * THE FULL APP'S TRANSPARENCY IS THE BACKDROP'S SWITCH (Ivan, 2026-11-16:
 * "if transparency is 0 the scene doesn't play it gets unloaded from memory
 * if they turn transparency then it load the scene"). Its veil reaches the
 * whole floor, Transparency 0, where the panes hide everything behind them
 * and there is no scene to draw: the scene is let go, worker, context and
 * all (`GraphScene`). The amp's stops at 95, as it always has: the amp is
 * always the Backdrop, and solid glass would hide a scene it still draws.
 */
export const BACKDROP_VEIL_OFF = 100;

/**
 * Which window the choice belongs to: the full app, or the amp. THE AMP
 * KEEPS ITS OWN, as it keeps its own Brightness (`utils/theme.ts`).
 */
export type TBackdropVeilScope = 'app' | 'player';

const MAX: Record<TBackdropVeilScope, number> = {
  app: BACKDROP_VEIL_OFF,
  player: 95,
};

/** The heaviest veil a window's slider reaches. */
export const backdropVeilMax = (of: TBackdropVeilScope) => MAX[of];

const KEYS: Record<TBackdropVeilScope, string> = {
  app: 'fluideq.backdropVeil',
  player: 'fluideq.backdropVeil.player',
};

const clampVeil = (value: number, of: TBackdropVeilScope) =>
  Math.round(Math.min(MAX[of], Math.max(BACKDROP_VEIL_MIN, value)));

/**
 * From the Backdrop as a mode to the Backdrop as the app's Transparency,
 * once. Somebody whose window had the Backdrop — chosen, or never having
 * chosen a mode, when the Backdrop was where a profile started — keeps the
 * Transparency they had and so the scene behind the window. Everybody else
 * had panes with nothing behind them, and keeps that: Transparency 0.
 */
const MIGRATED_KEY = 'fluideq.backdropVeil.fromMode';

const migrateAppVeil = () => {
  if (readStored(MIGRATED_KEY) !== null) {
    return;
  }
  const mode = readStored(SCENE_TINT_MODE_KEY);
  const hadBackdrop =
    mode === 'cover' ||
    (mode === null && readStored(SCENE_TINT_LEGACY_KEY) === null);
  if (!hadBackdrop) {
    writeStored(KEYS.app, String(BACKDROP_VEIL_OFF));
  }
  writeStored(MIGRATED_KEY, '1');
};

const readVeil = (of: TBackdropVeilScope) => {
  const raw = readStored(KEYS[of]);
  const stored = Number(raw);
  return raw === null || !Number.isFinite(stored)
    ? BACKDROP_VEIL_DEFAULT
    : clampVeil(stored, of);
};

migrateAppVeil();

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
  const value = clampVeil(next, scope);
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

/** Which window's choice the slider stands for now. */
export const useBackdropVeilScope = () =>
  useSyncExternalStore(
    subscribe,
    () => scope,
    () => 'app' as const,
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
