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
  rainbowFromColours,
  sceneColourHex,
  setRainbowStops,
} from '../utils/rainbowPalette';
import { useUsableScenes } from '../utils/scenePacks';
import { useRememberedSceneSky } from '../utils/sceneTintStore';

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

  // As text, so the effect compares it by value: the lists are rebuilt
  // whenever either arrives, with the same swatch in a new array.
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
  useLayoutEffect(() => {
    setRainbowStops(swatch ? rainbowFromColours(swatch.split(' ')) : undefined);
  }, [swatch]);

  return null;
};

export default RainbowSource;
