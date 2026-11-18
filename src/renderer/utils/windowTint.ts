/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { readStored, removeStored, writeStored } from './graphStorage';
import { LAGOON_SKY, rainbowBetween, sceneColourHex } from './rainbowPalette';
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

/**
 * THE SECOND COLOUR (Ivan, 2026-11-18: "I need to be able to also select
 * the secondary colour in the picker, so I have control of both colours",
 * "by default the primary and the secondary have the same colour, and if
 * the user changes it, the gradient is created"). Unset, it is the first
 * colour, whatever that is, and what the window draws in its stops is that
 * one colour; set, the stops run from the first to this one
 * (`windowTintStops`). Kept apart from the first, so moving the slider or
 * picking a new first colour keeps the second where the listener put it.
 */
const SECONDARY_KEY = 'fluideq.windowTintSecondary';

let tint = parse(readStored(STORAGE_KEY));
let colour = parseColour(readStored(COLOUR_KEY));
let secondary = parseColour(readStored(SECONDARY_KEY));
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

/** The second colour (`#rrggbb`), or undefined for the first colour again. */
export const setWindowTintSecondary = (next: string | undefined) => {
  const value = next?.toLowerCase();
  if (value !== undefined && !HEX.test(value)) {
    return;
  }
  if (value === secondary) {
    return;
  }
  secondary = value;
  if (value === undefined) {
    removeStored(SECONDARY_KEY);
  } else {
    writeStored(SECONDARY_KEY, value);
  }
  announce();
};

/** The Tint as it stands, so a colour picker can put it back on Cancel. */
export interface IWindowTintSnapshot {
  tint: number | undefined;
  colour: string | undefined;
  secondary: string | undefined;
}

export const windowTintSnapshot = (): IWindowTintSnapshot => ({
  tint,
  colour,
  secondary,
});

/** Puts the Tint back exactly as `snapshot` held it. */
export const restoreWindowTint = (snapshot: IWindowTintSnapshot) => {
  tint = snapshot.tint;
  if (tint === undefined) {
    removeStored(STORAGE_KEY);
  } else {
    writeStored(STORAGE_KEY, String(tint));
  }
  storeColour(snapshot.colour);
  secondary = snapshot.secondary;
  if (secondary === undefined) {
    removeStored(SECONDARY_KEY);
  } else {
    writeStored(SECONDARY_KEY, secondary);
  }
  announce();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useWindowTintSecondary = () =>
  useSyncExternalStore(
    subscribe,
    () => secondary,
    () => undefined,
  );

export const useWindowTintColour = () =>
  useSyncExternalStore(
    subscribe,
    () => colour,
    () => undefined,
  );

export const useWindowTint = () =>
  useSyncExternalStore(
    subscribe,
    () => tint,
    () => undefined,
  );

const turned = (colour: ISceneColour, by: number): ISceneColour => ({
  ...colour,
  hue: wrapHue(colour.hue + by),
});

/** Lagoon turned round the wheel until its accent stands at `hue`. */
export const tintedLagoon = (hue: number): ISceneSky => {
  const by = hue - LAGOON_HUE;
  return {
    ...turned(LAGOON_SKY, by),
    accent: LAGOON_SKY.accent && turned(LAGOON_SKY.accent, by),
    active: LAGOON_SKY.active && turned(LAGOON_SKY.active, by),
  };
};

/**
 * The first colour as the window wears it (`SceneTint`): the colour picked
 * whole, else Lagoon's accent turned to the hue, else Lagoon's own accent.
 * What the swatch shows and where the stops start.
 */
export const windowPrimaryColour = (
  hue: number | undefined,
  picked: string | undefined,
): string => {
  if (picked !== undefined) {
    return picked;
  }
  const accent = tintedLagoon(hue ?? LAGOON_HUE).accent ?? LAGOON_SKY;
  return sceneColourHex(accent);
};

/**
 * What the window draws in its stops — the graph's curves, the faders, the
 * meters, the wave — with its own colours: the first colour alone, or a
 * gradient from it to the second where the listener chose one. It replaced
 * Lagoon's seven-hue rainbow turned to the tint, which drew a rainbow
 * nobody had asked for once Colourful mode could no longer be switched off.
 */
export const windowTintStops = (
  primary: string,
  second: string | undefined,
): string[] => rainbowBetween(primary, second ?? primary);
