/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from './graphStorage';

/**
 * What the EQ page's band sliders are held by: a round handle or a
 * rectangular fader cap (Ivan, 2026-09-26: "rec and circles for the
 * sliders", "user can change rec or circle there in menu settings"). A look,
 * not a setting of the sound, so it is kept in the window's own storage and
 * chosen in the titlebar menu's settings (`SliderHandlePicker`).
 */
export type TSliderHandle = 'round' | 'rect';

export const SLIDER_HANDLES: readonly TSliderHandle[] = ['round', 'rect'];

/**
 * THE AMP KEEPS ITS OWN, as it keeps its own Brightness and Transparency
 * (Ivan, 2026-09-28: "the EQ knobs circle or rect setting need to be
 * different on amp and full app, each can have their own"): one picker,
 * remembered once for each mode, and the mode the window is in says which
 * one the root wears (`applySliderHandleScope`, from `App.tsx`).
 */
export type TSliderHandleScope = 'app' | 'player';

const KEYS: Record<TSliderHandleScope, string> = {
  app: 'fluideq.sliderHandle',
  player: 'fluideq.sliderHandle.player',
};

/**
 * What a new install starts on: the fader cap (Ivan, 2026-09-26: "rect
 * slider are the default when new app"). Anybody who has picked either keeps
 * their pick.
 */
const DEFAULT_HANDLE: TSliderHandle = 'rect';

const isSliderHandle = (value: string | null): value is TSliderHandle =>
  SLIDER_HANDLES.some((handle) => handle === value);

const readHandle = (scope: TSliderHandleScope): TSliderHandle => {
  const stored = readStored(KEYS[scope]);
  return isSliderHandle(stored) ? stored : DEFAULT_HANDLE;
};

/**
 * The amp starts on whatever the app had when it had only one choice, so
 * nobody's amp changes shape on the update that split them.
 */
const readPlayerHandle = (app: TSliderHandle): TSliderHandle => {
  const stored = readStored(KEYS.player);
  return isSliderHandle(stored) ? stored : app;
};

/**
 * On the document's root as well, `data-slider-handle`, which is where the
 * stylesheets read it: the band sliders and the graph's handles take their
 * shape from it (`FrequencyBand.scss`, `App.scss`), and the two stand in
 * trees that share no nearer ancestor. It changes when somebody picks the
 * other look, which is rarely, so its restyle of the page is not a cost.
 */
const publish = (value: TSliderHandle) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.sliderHandle = value;
  }
};

const appHandle = readHandle('app');
const chosen: Record<TSliderHandleScope, TSliderHandle> = {
  app: appHandle,
  player: readPlayerHandle(appHandle),
};
let scope: TSliderHandleScope = 'app';
publish(chosen[scope]);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * The window has become the app or the amp: wear that one's choice. Called
 * with the theme's own scope (`App.tsx`); nothing is written down here.
 */
export const applySliderHandleScope = (next: TSliderHandleScope) => {
  if (next === scope) {
    return;
  }
  scope = next;
  publish(chosen[scope]);
  notify();
};

export const setSliderHandle = (next: TSliderHandle) => {
  if (next === chosen[scope]) {
    return;
  }
  chosen[scope] = next;
  writeStored(KEYS[scope], next);
  publish(next);
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSliderHandle = () =>
  useSyncExternalStore(
    subscribe,
    () => chosen[scope],
    () => DEFAULT_HANDLE,
  );
