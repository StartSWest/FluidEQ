/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { readStored, removeStored, writeStored } from './graphStorage';
import { LAGOON, LAGOON_SKY, turnedPalette } from './rainbowPalette';
import type { ISceneColour, ISceneSky } from './sceneTint';

/**
 * THE WINDOW'S OWN COLOUR WITH A STANDARD LOOK (Ivan, 2026-10-25: "add a
 * colour tint option so they choose any colour with a slider next to the
 * brightness", "same for the full app, add a tint if on standard viz mode",
 * "instead of showing transparency disabled we show the tint"). With no Plus
 * visualizer to lend the window its colours it wears Lagoon (`LAGOON_SKY`,
 * `SceneTint`); a tint turns all of Lagoon round the colour wheel until its
 * accent stands at the hue chosen, every lightness and chroma kept, so the
 * window reads in any colour exactly as it does in Lagoon. Unset, it is
 * Lagoon itself. One setting for the app and the amp, remembered.
 */
const STORAGE_KEY = 'fluideq.windowTint';

/** Lagoon's own accent hue: where the slider stands while nothing is set. */
export const LAGOON_HUE = LAGOON_SKY.accent?.hue ?? LAGOON_SKY.hue;

const wrapHue = (hue: number) => ((hue % 360) + 360) % 360;

const parse = (raw: string | null): number | undefined => {
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? wrapHue(value) : undefined;
};

/**
 * A colour picked whole from the swatch's colour picker (Ivan, 2026-11-18:
 * "when the user selects the round colour on the right, open the colour
 * picker, so they can choose better colours and more variety; the slider is
 * limited to those colours and that brightness"). The slider only turns
 * Lagoon's accent round the wheel at Lagoon's own lightness and strength; a
 * picked colour is worn as picked, the buttons and the curve in exactly it
 * (`SceneTint`, through the named colours' path), and the slider stands at
 * its hue. Moving the slider again goes back to the wheel.
 */
const COLOUR_KEY = 'fluideq.windowTintColour';
const HEX = /^#[0-9a-f]{6}$/;

const parseColour = (raw: string | null): string | undefined =>
  raw !== null && HEX.test(raw) ? raw : undefined;

let tint = parse(readStored(STORAGE_KEY));
let colour = parseColour(readStored(COLOUR_KEY));
const listeners = new Set<() => void>();

const announce = () => listeners.forEach((listener) => listener());

const storeColour = (next: string | undefined) => {
  colour = next;
  if (next === undefined) {
    removeStored(COLOUR_KEY);
  } else {
    writeStored(COLOUR_KEY, next);
  }
};

/** The hue chosen, in degrees, or undefined for Lagoon as it is. A hue set
 * here lets go of a colour picked whole. */
export const setWindowTint = (next: number | undefined) => {
  const value = next === undefined ? undefined : wrapHue(Math.round(next));
  if (value === tint && colour === undefined) {
    return;
  }
  tint = value;
  storeColour(undefined);
  if (value === undefined) {
    removeStored(STORAGE_KEY);
  } else {
    writeStored(STORAGE_KEY, String(value));
  }
  announce();
};

/** A colour picked whole (`#rrggbb`), standing at `hue` on the slider. */
export const setWindowTintColour = (next: string, hue: number) => {
  const value = next.toLowerCase();
  if (!HEX.test(value)) {
    return;
  }
  const at = wrapHue(Math.round(hue));
  if (value === colour && at === tint) {
    return;
  }
  tint = at;
  writeStored(STORAGE_KEY, String(at));
  storeColour(value);
  announce();
};

export const useWindowTintColour = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => colour,
    () => undefined,
  );

export const useWindowTint = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => tint,
    () => undefined,
  );

const turned = (colour: ISceneColour, by: number): ISceneColour => ({
  ...colour,
  hue: wrapHue(colour.hue + by),
});

/**
 * Lagoon's rainbow turned with it, for what Rainbow mode draws — the graph's
 * curves and the faders — so a tinted window keeps its rainbow, in the
 * colour chosen.
 */
export const tintedLagoonStops = (hue: number): string[] =>
  turnedPalette(LAGOON, hue - LAGOON_HUE);

/** Lagoon turned round the wheel until its accent stands at `hue`. */
export const tintedLagoon = (hue: number): ISceneSky => {
  const by = hue - LAGOON_HUE;
  return {
    ...turned(LAGOON_SKY, by),
    accent: LAGOON_SKY.accent && turned(LAGOON_SKY.accent, by),
    active: LAGOON_SKY.active && turned(LAGOON_SKY.active, by),
  };
};
