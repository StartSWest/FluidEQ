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
 * the user changes it, the gradient is created"). With one colour asked for
 * it is the first colour, whatever that is, and what the window draws in its
 * stops is that one colour; otherwise the stops run from the first to this
 * one (`windowTintStops`). Kept apart from the first, so moving the slider or
 * picking a new first colour keeps the second where the listener put it.
 *
 * A NEW WINDOW HAS ONE ALREADY (Ivan, 2026-11-24: "I think we should default
 * a second color for the app UI. Pick a nice purple one"; he chose the violet
 * from a board of six measured in the app). Without it the gradient, the
 * Colouring row and the Spectrogram were one flat cyan until somebody found
 * the swatch. Stored, the key holds one of three things, and only the first
 * is the default's:
 *
 *   absent      nothing chosen: the default violet
 *   `#rrggbb`   a colour chosen there, worn whatever the default is
 *   `none`      one colour chosen on purpose (the swatch's ×), kept so
 *
 * The default is never written: a listener who chose a colour or chose one
 * colour keeps that choice, and Reset all settings, which removes the key,
 * brings the default back.
 */
const SECONDARY_KEY = 'fluideq.windowTintSecondary';

/** The second colour a window has before anybody chooses one. */
export const DEFAULT_SECOND_COLOUR = '#8b6cff';

/** What the key holds once the listener asked for one colour. */
const ONE_COLOUR = 'none';

/** What the listener chose for the second colour: a colour, one colour, or
 * nothing yet (`undefined`). */
type TSecondChoice = string | typeof ONE_COLOUR | undefined;

const parseSecondChoice = (raw: string | null): TSecondChoice =>
  raw === ONE_COLOUR ? ONE_COLOUR : parseColour(raw);

/** The second colour the window wears for a choice: none for one colour. */
const secondOf = (choice: TSecondChoice): string | undefined => {
  if (choice === ONE_COLOUR) {
    return undefined;
  }
  return choice ?? DEFAULT_SECOND_COLOUR;
};

let tint = parse(readStored(STORAGE_KEY));
let colour = parseColour(readStored(COLOUR_KEY));
let secondChoice = parseSecondChoice(readStored(SECONDARY_KEY));
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

const storeSecondChoice = (next: TSecondChoice) => {
  secondChoice = next;
  if (next === undefined) {
    removeStored(SECONDARY_KEY);
  } else {
    writeStored(SECONDARY_KEY, next);
  }
};

/**
 * The second colour (`#rrggbb`), or undefined for one colour: the first
 * colour again, kept as a choice so the default does not come back.
 */
export const setWindowTintSecondary = (next: string | undefined) => {
  const value = next === undefined ? ONE_COLOUR : next.toLowerCase();
  if (value !== ONE_COLOUR && !HEX.test(value)) {
    return;
  }
  if (value === secondChoice) {
    return;
  }
  storeSecondChoice(value);
  announce();
};

/** The Tint as it stands, so a colour picker can put it back on Cancel. */
export interface IWindowTintSnapshot {
  tint: number | undefined;
  colour: string | undefined;
  /** The second colour as chosen, not as worn: nothing chosen stays so. */
  secondChoice: TSecondChoice;
}

export const windowTintSnapshot = (): IWindowTintSnapshot => ({
  tint,
  colour,
  secondChoice,
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
  storeSecondChoice(snapshot.secondChoice);
  announce();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The second colour as the window wears it, read by the drawings outside
 * React: the one chosen, the default where none was, undefined for one
 * colour.
 */
export const getWindowTintSecondary = (): string | undefined =>
  secondOf(secondChoice);

export const useWindowTintSecondary = () =>
  useSyncExternalStore(
    subscribe,
    () => secondOf(secondChoice),
    () => secondOf(undefined),
  );

/**
 * A second colour the listener CHOSE, never the default: what decides
 * whether the Tint was touched, so a scene the window is set to Original
 * over keeps its own colours until somebody picks one (`SceneTint`,
 * `RainbowSource`).
 */
export const useWindowTintSecondChosen = () =>
  useSyncExternalStore(
    subscribe,
    () => (secondChoice === ONE_COLOUR ? undefined : secondChoice),
    () => undefined,
  );

/** Whether the listener asked for one colour: the second follows the first. */
export const useWindowTintOneColour = () =>
  useSyncExternalStore(
    subscribe,
    () => secondChoice === ONE_COLOUR,
    () => false,
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
