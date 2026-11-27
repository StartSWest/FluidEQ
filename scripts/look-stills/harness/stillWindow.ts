/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  readStillRoles,
  type TStillColours,
  type TStillSide,
} from 'renderer/graph/lookStills/stillRoles';
import { labToHex } from 'renderer/utils/oklab';
import { setRainbowStops } from 'renderer/utils/rainbowPalette';
import { DEFAULT_SHADE, setThemeShade } from 'renderer/utils/theme';
import { WINDOW_INK_ATTRIBUTE } from 'renderer/utils/themeInk';
import { setLightWindow } from 'renderer/utils/windowSide';
import {
  DEFAULT_SECOND_COLOUR,
  setWindowTintSecondary,
  windowPrimaryColour,
  windowTintStops,
} from 'renderer/utils/windowTint';
import type { TRgb } from '../fit';
import type { TRealState } from '../protocol';

/**
 * The window's colours as the stills' page sets them: as a listener would
 * have them (a named state), or every one moved its own way (a mixed
 * state), so the generator can tell which colour lands where.
 */

/** The window's colours the generator moves, read by the roles. */
const MOVED_SURFACES = [
  '--surface-base',
  '--ink',
  '--edge-tint',
  '--accent',
  '--accent-light',
  '--text-faint',
  '--text-primary',
  '--text-muted',
  '--surface-panel',
  '--active',
] as const;

/** How far a mixed state moves each surface from the theme's own, of 255. */
const MOVED_BY = 56;

/** The light window's end of the Brightness: white panes. */
const WHITE_SHADE = 100;
/** The Black end of the dark walk. */
const BLACK_SHADE = 0;
/** A colour picked for the window, for a check in colours not Ocean's. */
const PICKED = '#ff7a2f';

export type TState =
  { kind: 'mixed'; seed: number } | { kind: 'real'; name: TRealState };

const root = document.documentElement;
// The window wears Colourful mode for good (`EuphoriaGlow`), and the
// drawings take the stops from it: without it they read the accent's walk.
root.classList.add('is-euphoric');

/**
 * The same colours for the same seed, run after run: Numerical Recipes'
 * linear congruential generator, whose products stay inside a double's
 * 53 exact bits.
 */
const MODULUS = 2 ** 32;
const seeded = (seed: number) => {
  let state = seed % MODULUS;
  return () => {
    state = (state * 1664525 + 1013904223) % MODULUS;
    return state / MODULUS;
  };
};

const probe = document.createElement('canvas');
probe.width = 1;
probe.height = 1;
const probeContext = probe.getContext('2d', { willReadFrequently: true });

/** Any CSS colour as the canvas paints it: 0..255 channels and alpha. */
export const rgbaOf = (colour: string): [number, number, number, number] => {
  if (!probeContext) {
    throw new Error('No 2D canvas.');
  }
  probeContext.clearRect(0, 0, 1, 1);
  probeContext.fillStyle = '#000';
  probeContext.fillStyle = colour;
  probeContext.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = probeContext.getImageData(0, 0, 1, 1).data;
  return [red, green, blue, alpha];
};

const hexOf = ([red, green, blue]: readonly number[]) =>
  `#${[red, green, blue]
    .map((channel) =>
      Math.round(Math.max(0, Math.min(255, channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/**
 * A colour a stop could be, never grey, from near-black to near-white: the
 * window wears it for its side (`paletteForSide`), and the drawings bend
 * their ramps at both ends (`levelRampOf`), so the drawings have to see
 * both ends to tell a ramp's stops from the stop they were built from.
 */
const stopColour = (random: () => number) => {
  const hue = random() * Math.PI * 2;
  const chroma = 0.04 + random() * 0.18;
  const lightness = 0.3 + random() * 0.65;
  return labToHex({
    l: lightness,
    a: chroma * Math.cos(hue),
    b: chroma * Math.sin(hue),
  });
};

/**
 * Puts the window in `state`: its side, its stops, and for a mixed state
 * every moved surface pushed off the theme's own value, each its own way,
 * so no two roles move together across the drawings.
 */
export const applyState = (
  side: TStillSide,
  colours: TStillColours,
  state: TState,
) => {
  MOVED_SURFACES.forEach((name) => root.style.removeProperty(name));
  let shade = side === 'light' ? WHITE_SHADE : DEFAULT_SHADE;
  if (state.kind === 'real' && state.name === 'black' && side === 'dark') {
    shade = BLACK_SHADE;
  }
  setThemeShade(shade);
  // The side the window's painter says, as it says it (`sceneTintStore.ts`'s
  // `showInk`): the Brightness's rule alone paints white panes and leaves
  // every drawing on its dark-window path - the light stills came out the
  // dark ones over a white floor.
  if (side === 'light') {
    root.setAttribute(WINDOW_INK_ATTRIBUTE, 'dark');
  } else {
    root.removeAttribute(WINDOW_INK_ATTRIBUTE);
  }
  setLightWindow(side === 'light');
  const second = colours === 'many' ? DEFAULT_SECOND_COLOUR : undefined;
  setWindowTintSecondary(second);
  if (state.kind === 'real') {
    const primary =
      state.name === 'picked'
        ? PICKED
        : windowPrimaryColour(undefined, undefined);
    setRainbowStops(windowTintStops(primary, second));
    return;
  }
  const random = seeded(state.seed);
  const first = stopColour(random);
  setRainbowStops(
    colours === 'one'
      ? Array.from({ length: 7 }, () => first)
      : Array.from({ length: 7 }, (_, index) =>
          index === 0 ? first : stopColour(random),
        ),
  );
  const style = getComputedStyle(root);
  const theme = MOVED_SURFACES.map((name) =>
    rgbaOf(style.getPropertyValue(name).trim() || '#808080'),
  );
  MOVED_SURFACES.forEach((name, index) => {
    const moved = theme[index]
      .slice(0, 3)
      .map((channel) => channel + (random() * 2 - 1) * MOVED_BY);
    root.style.setProperty(name, hexOf(moved));
  });
};

/** Each role's colour as the window hands it to a drawing now. */
export const rolesNow = (colours: TStillColours): Record<string, TRgb> => {
  const read: Record<string, TRgb> = {};
  Object.entries(readStillRoles(colours)).forEach(([name, colour]) => {
    const [red, green, blue, alpha] = rgbaOf(colour);
    if (alpha !== 255) {
      throw new Error(`The role ${name} is not opaque: ${colour}.`);
    }
    read[name] = [red, green, blue];
  });
  return read;
};

/** The window's floor, which the plate shows through. */
export const floorNow = (): TRgb => {
  const [red, green, blue] = rgbaOf(
    getComputedStyle(root).getPropertyValue('--surface-base').trim(),
  );
  return [red, green, blue];
};
