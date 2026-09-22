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
 *
 * `black` is nonetheless the default. It arrived in 1.6 and is what a fresh
 * install and an upgrade from anything earlier both open in; Ocean stays one
 * pick away and, once picked, is remembered like any other choice.
 */
export const THEMES = ['ocean', 'black'] as const;
export type TTheme = (typeof THEMES)[number];

/** Which window the choice belongs to: the full app, or the amp. */
export type TThemeScope = 'app' | 'player';

/**
 * THE AMP KEEPS ITS OWN (Ivan, 2026-09-22). The full app can be on Black
 * while the amp is on Ocean, because the two are never on screen at once:
 * one window, one theme at a time, and a choice remembered for each.
 *
 * So there is no second set of colours to declare anywhere. The theme is one
 * attribute on the document, and the only question is which of the two
 * choices is written there — answered by the mode the window is in.
 */
const STORAGE_KEY = 'fluideq.theme';
const PLAYER_STORAGE_KEY = 'fluideq.theme.player';
/** What `:root` paints with no attribute; see the note above. */
const ROOT_THEME: TTheme = 'ocean';
const DEFAULT_THEME: TTheme = 'black';

const isTheme = (value: string | null): value is TTheme =>
  value !== null && (THEMES as readonly string[]).includes(value);

const listeners = new Set<() => void>();

const storedTheme = (key: string): TTheme => {
  const stored = readStored(key);
  return isTheme(stored) ? stored : DEFAULT_THEME;
};

/** One choice per mode, and which mode the window is in. */
const chosen: Record<TThemeScope, TTheme> = {
  app: storedTheme(STORAGE_KEY),
  player: storedTheme(PLAYER_STORAGE_KEY),
};
let scope: TThemeScope = 'app';
let current: TTheme = chosen.app;

/**
 * Written to the root element rather than to a wrapper, so the menus and
 * bars portalled to `document.body` — which live outside every React tree —
 * take the theme too. A wrapper would have themed the workspace and left
 * every dropdown in the old colours.
 */
const applyTheme = (theme: TTheme) => {
  const root = document.documentElement;
  if (theme === ROOT_THEME) {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  // The window's backdrop material is no longer the theme's business. It used
  // to be — black wanted none, because a blur of the desktop under a true
  // black floor made it grey — and the floor is opaque now, so no theme can
  // see one either way. What a material still decides is the shape of the
  // window: without one Windows 11 stops rounding the corners and stops
  // drawing its lit edge, on every theme. See `windowBackdrop.ts`.
};

applyTheme(current);

export const getTheme = (): TTheme => current;

/**
 * The window has become the app or the amp: wear that one's choice.
 *
 * Called by the mode store on every switch. Nothing is written down here —
 * the choice being shown is not a choice being made.
 */
export const applyThemeScope = (next: TThemeScope) => {
  scope = next;
  if (chosen[next] === current) {
    return;
  }
  current = chosen[next];
  applyTheme(current);
  listeners.forEach((listener) => listener());
};

export const setTheme = (next: TTheme) => {
  chosen[scope] = next;
  writeStored(scope === 'player' ? PLAYER_STORAGE_KEY : STORAGE_KEY, next);
  if (next === current) {
    return;
  }
  current = next;
  applyTheme(next);
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

export type TSurfaceName =
  | '--surface-base'
  | '--surface-panel'
  | '--surface-block'
  | '--surface-well'
  | '--track-well'
  | '--accent'
  | '--accent-light'
  | '--accent-dark'
  | '--accent-darker'
  | '--dsp-base-curve'
  | '--dsp-output'
  | '--dsp-applied'
  | '--dsp-sky'
  | '--dsp-field'
  | '--dsp-spectrum'
  | '--text-primary'
  | '--text-muted'
  | '--text-faint'
  | '--meter-well'
  | '--meter-well-pulse'
  | '--meter-unlit';

/**
 * Changes to the stylesheets themselves: one added or removed, or one
 * rewritten in place, as development's hot reload does. Counted by an
 * observer on the head, started with the first read.
 */
let sheetEdits = 0;
let watchingSheets = false;

const watchSheets = () => {
  if (watchingSheets || typeof MutationObserver === 'undefined') {
    return;
  }
  watchingSheets = true;
  new MutationObserver(() => {
    sheetEdits += 1;
  }).observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });
};

/**
 * Everything the surface properties on `:root` can change with: its theme
 * attribute, its class, its inline style — where a scene's tint writes the
 * surfaces — and the stylesheets that declare them. All of it is read
 * without asking for a style.
 */
const rootStateOf = (root: HTMLElement) =>
  `${root.getAttribute('data-theme') ?? ''}|${root.className}|${root.getAttribute('style') ?? ''}|${document.styleSheets.length}|${sheetEdits}`;

const surfaces = new Map<TSurfaceName, string>();
let surfacesFor = '';

/**
 * A surface colour as the theme currently paints it, for the drawings.
 *
 * A canvas cannot read the stylesheet, so everything drawn rather than laid
 * out — the pitch lane, the maker's editor, the DSP's phase scope — used to
 * carry the ocean values written out, and went teal on a black theme. The
 * value comes from the same custom property the stylesheets use; the
 * fallback is only for a test DOM with no stylesheet loaded.
 *
 * Asked of the style only when `:root` has changed since the last answer.
 * The drawings ask every frame, and a computed style is only as cheap as the
 * document is clean: with the Studio's meters writing their numbers each
 * frame, every one of those reads made the browser recalculate the whole
 * page's style there and then — 85 recalculations in 90 frames, over half of
 * all the style work the Studio did — before it would have done so once, on
 * its own, at the end of the frame.
 */
export const readSurface = (name: TSurfaceName, fallback: string): string => {
  watchSheets();
  const root = document.documentElement;
  const state = rootStateOf(root);
  if (state !== surfacesFor) {
    surfaces.clear();
    surfacesFor = state;
  }
  let value = surfaces.get(name);
  if (value === undefined) {
    value = getComputedStyle(root).getPropertyValue(name).trim();
    surfaces.set(name, value);
  }
  return value || fallback;
};

/** Canvas captions use the same opaque ink as DOM labels in both themes. */
export const readTextInk = (): string => readSurface('--text-faint', '#bfd3e3');

/**
 * Whatever changes the surfaces changes an attribute of `:root` — the theme,
 * a scene's tint, the colours the tint writes inline — so watching those is
 * watching the colours. One observer, shared by everyone asking.
 */
const rootListeners = new Set<() => void>();
let rootObserver: MutationObserver | undefined;

const subscribeRoot = (listener: () => void) => {
  rootListeners.add(listener);
  if (!rootObserver && typeof MutationObserver !== 'undefined') {
    rootObserver = new MutationObserver(() => {
      rootListeners.forEach((each) => each());
    });
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-theme', 'data-scene-tint'],
    });
  }
  return () => {
    rootListeners.delete(listener);
    if (rootListeners.size === 0) {
      rootObserver?.disconnect();
      rootObserver = undefined;
    }
  };
};

/**
 * A surface as it is painted right now, for something outside the stylesheets
 * that has to follow it — a guest page on the Media tab cannot read this
 * document's custom properties, so it is handed the colour itself. Read after
 * the change has landed on `:root`, never from the tint's wish for it: the
 * tint announces the sky it wants before it has painted the colours.
 */
export const useLiveSurface = (name: TSurfaceName, fallback: string): string =>
  useSyncExternalStore(
    subscribeRoot,
    () => readSurface(name, fallback),
    () => fallback,
  );

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

/**
 * The accent as the theme paints it, at an alpha, for the drawings — the
 * EQ's handles and curve on the DSP page, the meter's lit segments, the
 * titlebar wave's glow. Ocean says cyan; a monochrome theme says white, and
 * a drawing that kept cyan written in would be the one thing on screen that
 * had not heard.
 */
export const readAccent = (alpha: number, fallback: string): string =>
  alpha >= 1
    ? readSurface('--accent', fallback)
    : readSurfaceAlpha('--accent', alpha, fallback);

export const readAccentLight = (alpha: number, fallback: string): string =>
  alpha >= 1
    ? readSurface('--accent-light', fallback)
    : readSurfaceAlpha('--accent-light', alpha, fallback);

/**
 * The light accent as channels, for a drawing that mixes its own tints — the
 * meter's gas, which wants five shades of one colour and builds them from
 * the channels rather than from five literals.
 */
export const readAccentLightChannels = (
  fallback: [number, number, number],
): [number, number, number] => {
  const match = HEX.exec(readSurface('--accent-light', ''));
  if (!match) {
    return fallback;
  }
  const hex = match[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
};
