/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { IScenePaletteValue } from 'common/scenePalette';
import type {
  IScenePack,
  IScenePackColour,
  IScenePackPalette,
  IScenePackParam,
} from 'common/scenePacks';
import { isShownBy } from 'common/sceneShowWhen';
import { rainbowFromColours, rainbowFromPalette } from './rainbowPalette';

/**
 * THE COLOURS A SCENE CHOSE, AS THE APP'S OWN (Ivan, 2026-11-08: "so scene
 * colors picking should affect the app palete in general", "make ut nice so
 * it works for all cases").
 *
 * A scene with a palette (contract 9) hands it to Colourful mode: the
 * titlebar's wave, the meters, the bands, the faders — everything drawn in
 * the rainbow (`rainbowPalette.ts`) — wear the palette the scene is drawn in,
 * as the member has it in the Studio while they edit it, and as the scene
 * was published for anyone playing it. `RainbowSource` decides; this file
 * says what a scene hands over.
 *
 * - Its first palette, the scene's main colours. A scene with two hands over
 *   its first, and the brief and the Studio say so.
 * - A palette its choices have put away (`showWhen`) is not what the scene is
 *   drawn in just then: a "One colour" mode hiding the gradient hands over
 *   the single colour it shows in its place, the way a swatch's colours make
 *   a rainbow — ahead of a second palette, which is the scene's sky or
 *   ground, not its subject. With neither, a second palette it is showing.
 *   Switching the choice back hands the first palette back.
 * - Neither, or only greys: nothing, and the scene's swatch or its measured
 *   colours stand as they did before palettes existed. A FluidEQ older than
 *   contract 9 never reads a palette, so it keeps the swatch too.
 */

/** What of a pack decides the colours it hands over. */
export interface ISceneColourControls {
  params: readonly IScenePackParam[];
  palettes?: readonly IScenePackPalette[];
  colours?: readonly IScenePackColour[];
}

/** Values over the pack's own: the member's in the Studio, the listener's choices on the graph. */
export interface ISceneColourValues {
  params?: Readonly<Record<string, number>>;
  palettes?: Readonly<Record<string, IScenePaletteValue>>;
  colours?: Readonly<Record<string, string>>;
}

/**
 * The seven stops a scene hands Colourful mode, or undefined for one that
 * hands none (no palette and no colour showing, or only greys).
 */
export const sceneAppColourStops = (
  controls: ISceneColourControls,
  values: ISceneColourValues = {},
): string[] | undefined => {
  const standing = Object.fromEntries(
    controls.params.map((param) => [
      param.id,
      values.params?.[param.id] ?? param.value,
    ]),
  );
  const choiceIds = new Set(
    controls.params.filter((param) => param.options).map((param) => param.id),
  );
  const isShown = (entry: { showWhen?: IScenePackParam['showWhen'] }) =>
    isShownBy(entry.showWhen, standing, choiceIds);
  const fromPalette = (palette: IScenePackPalette) =>
    isShown(palette)
      ? rainbowFromPalette(values.palettes?.[palette.id] ?? palette)
      : undefined;
  const [main, ...others] = controls.palettes ?? [];
  const fromMain = main && fromPalette(main);
  if (fromMain) {
    return fromMain;
  }
  // What a choice shows in the main palette's place comes before a second
  // palette: a "One colour" mode paints its bars in that colour while the
  // sky behind them keeps its own palette, and the bars are what the wave
  // and the meters stand for.
  const colours = (controls.colours ?? [])
    .filter(isShown)
    .map((colour) => values.colours?.[colour.id] ?? colour.value);
  const fromColours = colours.length ? rainbowFromColours(colours) : undefined;
  return fromColours ?? others.map(fromPalette).find(Boolean);
};

// *** What each visualizer on screen came with *********************************

/**
 * The colour controls of the packs that have been drawn this session, by look
 * id, reported by whatever loaded one — the graph or a player outside it — so
 * the window's colours follow the visualizer wherever it is playing. The
 * picker's listings carry no palettes, and loading a pack again only for its
 * colours would read fifteen megabytes of artwork for three of them.
 */
const known = new Map<string, ISceneColourControls>();
const knownListeners = new Set<() => void>();

/** `pack`'s colour controls, for `lookId`. A pack with neither is forgotten. */
export const reportSceneColourControls = (lookId: string, pack: IScenePack) => {
  const before = known.get(lookId);
  if (
    before?.params === pack.params &&
    before.palettes === pack.palettes &&
    before.colours === pack.colours
  ) {
    return;
  }
  if (!pack.palettes?.length && !pack.colours?.length) {
    if (!known.delete(lookId)) {
      return;
    }
  } else {
    known.set(lookId, {
      params: pack.params,
      ...(pack.palettes ? { palettes: pack.palettes } : {}),
      ...(pack.colours ? { colours: pack.colours } : {}),
    });
  }
  knownListeners.forEach((listener) => listener());
};

const subscribeKnown = (listener: () => void) => {
  knownListeners.add(listener);
  return () => {
    knownListeners.delete(listener);
  };
};

/** The colour controls `lookId` came with, once a pack of it has been drawn. */
export const useSceneColourControls = (lookId: string) =>
  useSyncExternalStore(
    subscribeKnown,
    () => (lookId ? known.get(lookId) : undefined),
    () => undefined,
  );

// *** The Studio's project ******************************************************

/**
 * The stops the project on the Studio's bench hands over, while the bench is
 * on screen and the project has a palette or a colour showing: set as the
 * member edits, so the window follows the strip as it is dragged. It wins
 * over the graph's visualizer, as the Studio's tint does (`sceneTintStore`):
 * somebody tuning their own scene is judging that one.
 */
let studio: readonly string[] | undefined;
const studioListeners = new Set<() => void>();

export const setStudioAppColours = (next: readonly string[] | undefined) => {
  if (
    next === studio ||
    (next !== undefined &&
      studio !== undefined &&
      next.length === studio.length &&
      next.every((stop, index) => stop === studio?.[index]))
  ) {
    return;
  }
  studio = next;
  studioListeners.forEach((listener) => listener());
};

const subscribeStudio = (listener: () => void) => {
  studioListeners.add(listener);
  return () => {
    studioListeners.delete(listener);
  };
};

export const useStudioAppColours = () =>
  useSyncExternalStore(
    subscribeStudio,
    () => studio,
    () => undefined,
  );
