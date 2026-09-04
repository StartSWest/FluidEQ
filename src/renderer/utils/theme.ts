/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from './graphStorage';

/**
 * The two themes, and what a theme IS here: a set of surface colours.
 *
 * Every pane, block, field, menu and well in the window reads its colour
 * from a custom property on `:root` (see the `:root` blocks at the head of
 * App.scss). A theme is that list declared again under `data-theme`, and
 * switching is one attribute on the document element. Text, the accent and
 * the semantic colours are shared — a theme changes what things stand on,
 * not what they say.
 *
 * `ocean` is the slate-navy the app was designed on and needs no attribute:
 * it is what `:root` declares. Anything else is named.
 */
export const THEMES = ['ocean', 'black'] as const;
export type TTheme = (typeof THEMES)[number];

const STORAGE_KEY = 'fluideq.theme';
const DEFAULT_THEME: TTheme = 'ocean';

const isTheme = (value: string | null): value is TTheme =>
  value !== null && (THEMES as readonly string[]).includes(value);

const listeners = new Set<() => void>();

let current: TTheme = (() => {
  const stored = readStored(STORAGE_KEY);
  return isTheme(stored) ? stored : DEFAULT_THEME;
})();

/**
 * Written to the root element rather than to a wrapper, so the menus and
 * bars portalled to `document.body` — which live outside every React tree —
 * take the theme too. A wrapper would have themed the workspace and left
 * every dropdown in the old colours.
 */
const applyTheme = (theme: TTheme) => {
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
};

applyTheme(current);

export const getTheme = (): TTheme => current;

export const setTheme = (next: TTheme) => {
  if (next === current) {
    return;
  }
  current = next;
  applyTheme(next);
  writeStored(STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useTheme = (): TTheme =>
  useSyncExternalStore(subscribe, getTheme, () => DEFAULT_THEME);

/**
 * A surface colour as the theme currently paints it, for the drawings.
 *
 * A canvas cannot read the stylesheet, so everything drawn rather than laid
 * out — the pitch lane, the maker's editor, the DSP's phase scope — used to
 * carry the ocean values written out, and went teal on a black theme. Read
 * once per frame from the same custom property the stylesheets use; the
 * fallback is only for a test DOM with no stylesheet loaded.
 */
export const readSurface = (
  name:
    | '--surface-base'
    | '--surface-panel'
    | '--surface-block'
    | '--surface-well'
    | '--track-well',
  fallback: string,
): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
  fallback;

const HEX = /^#([0-9a-f]{6})$/i;

/**
 * The same surface with an alpha, for the drawings that paint a wash. The
 * property holds a hex; the canvas API wants a functional colour.
 */
export const readSurfaceAlpha = (
  name: Parameters<typeof readSurface>[0],
  alpha: number,
  fallback: string,
): string => {
  const match = HEX.exec(readSurface(name, fallback));
  if (!match) {
    return fallback;
  }
  const hex = match[1];
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
