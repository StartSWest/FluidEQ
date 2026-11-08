/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useLayoutEffect, useMemo } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId } from 'common/scenePacks';
import { useSelectedLookId } from '../utils/graphStyle';
import { useUsableMemberScenes } from '../utils/memberScenes';
import {
  sceneAppColourStops,
  useSceneColourControls,
  useStudioAppColours,
} from '../utils/sceneAppColours';
import { useListenerParams } from '../utils/sceneParamStore';
import {
  rainbowFromColours,
  sceneColourHex,
  setRainbowStops,
} from '../utils/rainbowPalette';
import { useUsableScenes } from '../utils/scenePacks';
import { useRememberedSceneSky } from '../utils/sceneTintStore';
import { tintedLagoonStops, useWindowTint } from '../utils/windowTint';

/**
 * Chooses Rainbow mode's palette. Renders nothing.
 *
 * While the graph's look is a Plus visualizer — a Plus look or a scene a
 * member made — the palette is that scene's own colours (Ivan, 2026-09-26:
 * "when plus viz and rainbow mode we need the plus viz rainbow matching its
 * current theme, like different rainbow modes depending on the current plus
 * viz"): the five read from its own frames (`findSceneSky`'s `palette`) once
 * it has been measured, since the visualizers know nothing about colours
 * ("read from the same viz automatically"), and the two to four its picker
 * icon is drawn in until then. Otherwise, and for a scene in greys, it is
 * Lagoon (`rainbowPalette.ts`).
 *
 * A scene that chose its colours says so first (`sceneAppColours.ts`): its
 * palette, or the single colour its choices show instead, as the listener's
 * choices on the graph stand — and while the Studio's bench is on screen,
 * the project there, as the member is editing it. The swatch and the
 * measured colours are what a scene without either still hands over.
 *
 * Whatever the window's colours are set to: Theme, Colours, Ambient or the
 * Backdrop decide what the scene does to the panes, and the rainbow is the
 * mode's own. Mounted beside `SceneTint`, at the root, because the palette
 * belongs to the window and stays while the graph is on another tab.
 */
const RainbowSource = () => {
  const lookId = useSelectedLookId();
  const scenes = useUsableScenes();
  const memberScenes = useUsableMemberScenes();
  const isScene = isPremiumLookId(lookId) || isMemberLookId(lookId);
  const measured = useRememberedSceneSky(isScene ? lookId : '');
  const controls = useSceneColourControls(isScene ? lookId : '');
  const chosen = useListenerParams(lookId);
  const studio = useStudioAppColours();

  // The stops a scene chose, ready to use: never re-sorted round the wheel
  // as a swatch is, because a palette's order is bass to treble. As text, so
  // the effect compares them by value.
  const chosenStops = useMemo(() => {
    if (studio) {
      return studio.join(' ');
    }
    if (!isScene || !controls) {
      return undefined;
    }
    return sceneAppColourStops(
      controls,
      chosen ? { params: chosen } : {},
    )?.join(' ');
  }, [studio, isScene, controls, chosen]);

  // As text too: the lists are rebuilt whenever either arrives, with the same
  // swatch in a new array.
  const swatch = useMemo(() => {
    if (!isScene) {
      return undefined;
    }
    if (measured?.palette && measured.palette.length > 0) {
      return measured.palette.map(sceneColourHex).join(' ');
    }
    const scene = isPremiumLookId(lookId)
      ? scenes.find((entry) => entry.lookId === lookId)
      : memberScenes.find((entry) => entry.lookId === lookId);
    return scene?.swatch.join(' ');
  }, [isScene, measured, lookId, scenes, memberScenes]);

  // A layout effect, so the first frame a new scene is drawn in already has
  // its rainbow round it.
  // With a standard look the rainbow is Lagoon's, turned to the window's
  // tint where one is chosen (`windowTint.ts`), so the graph and the faders
  // follow the colour the window wears.
  const tint = useWindowTint();
  useLayoutEffect(() => {
    if (chosenStops) {
      setRainbowStops(chosenStops.split(' '));
    } else if (swatch) {
      setRainbowStops(rainbowFromColours(swatch.split(' ')));
    } else {
      setRainbowStops(tint === undefined ? undefined : tintedLagoonStops(tint));
    }
  }, [chosenStops, swatch, tint]);

  return null;
};

export default RainbowSource;
