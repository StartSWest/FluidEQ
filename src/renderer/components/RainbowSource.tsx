/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useLayoutEffect, useMemo } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId } from 'common/scenePacks';
import { usePageDaylight } from '../graph/sceneDaylight';
import useStudioDayColours from '../studio/useStudioDayColours';
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
import { stopColoursAt } from '../utils/sceneDayColours';
import { studioDraftOwner, useDraftedSides } from '../utils/windowColourDraft';
import { useUsableScenes } from '../utils/scenePacks';
import {
  useAmpHoldsWindow,
  useRememberedSceneSky,
  useSceneTintEnabled,
  useStudioTintSource,
} from '../utils/sceneTintStore';
import useSceneWindowColours from '../utils/useSceneWindowColours';
import {
  useWindowTint,
  useWindowTintColour,
  useWindowTintSecondary,
  windowPrimaryColour,
  windowTintStops,
} from '../utils/windowTint';

/**
 * Chooses the stops the window draws its colourful marks in — the graph's
 * curves, the faders, the meters, the wave. Renders nothing. Colourful mode
 * has no switch any more (`euphoriaMode.ts`): this is simply what they wear.
 *
 * With a standard look, the window's own pair (`windowTint.ts`): one colour,
 * or the Tint's gradient once the listener gives it a second colour.
 *
 * While the graph's look is a Plus visualizer — a Plus look or a scene a
 * member made — the palette is that scene's own colours (Ivan, 2026-09-26:
 * "when plus viz and rainbow mode we need the plus viz rainbow matching its
 * current theme, like different rainbow modes depending on the current plus
 * viz"): the five read from its own frames (`findSceneSky`'s `palette`) once
 * it has been measured, since the visualizers know nothing about colours
 * ("read from the same viz automatically"), and the two to four its picker
 * icon is drawn in until then. A scene in greys lends none and the window's
 * own pair stands, and so does a Tint the listener touched while the window
 * is set to Original (the rule is written beside the effect below).
 *
 * A scene that chose its colours says so first (`sceneAppColours.ts`): its
 * palette, or the single colour its choices show instead, as the listener's
 * choices on the graph stand — and while the Studio's bench is on screen,
 * the project there, as the member is editing it.
 *
 * A scene without a palette - every official one - hands over the colours
 * it lends the window at its hour, its points blended as the
 * window blends them (`sceneDayColours.ts`): the accent and the glow. It
 * used to hand over its picture's colours as measured at night, so on Alpine
 * by day the wave and the meters stayed the aurora's cyan under a window in
 * lavender (Ivan, 2026-11-18: "el Rainbow Color no está machando los colores
 * de la escena de día de noche"). The swatch and the measured colours are
 * what a scene with no window colours yet still hands over.
 *
 * Mounted beside `SceneTint`, at the root, because the palette
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

  // The scene's window colours at its hour - the Studio's project while the
  // bench lends the window its colours, else the graph's scene - as the
  // accent and the glow the rainbow is made from. As text, compared by value.
  const daylight = Math.round(usePageDaylight());
  const studioSource = useStudioTintSource();
  // The colour being picked in an editor stands in at its point, as on the
  // window (`windowColourDraft.ts`).
  const studioSides = useDraftedSides(
    studioSource ? studioDraftOwner(studioSource.project) : '',
    useStudioDayColours(
      studioSource?.project,
      studioSource?.playing?.pack,
      undefined,
    ).sides,
  );
  const sceneSides = useDraftedSides(
    isScene ? lookId : '',
    useSceneWindowColours(isScene ? lookId : '').sides,
  );
  const timeColours = useMemo(() => {
    const colours = stopColoursAt(
      studioSource ? studioSides : sceneSides,
      daylight,
    );
    return colours && `${colours.accent} ${colours.glow}`;
  }, [studioSource, studioSides, sceneSides, daylight]);

  // The window's own pair (`windowTint.ts`): its first colour alone, or a
  // gradient to the second where the listener chose one — what a standard
  // look draws in, so the graph and the faders follow the colour the window
  // wears, and in one colour until a second is asked for.
  const tint = useWindowTint();
  const picked = useWindowTintColour();
  const second = useWindowTintSecondary();
  const ownStops = useMemo(
    () => windowTintStops(windowPrimaryColour(tint, picked), second).join(' '),
    [tint, picked, second],
  );
  // THE LISTENER'S OWN COLOURS OVER A SCENE'S, where they say so. With a
  // scene on the graph the window wears the scene's colours unless it is
  // set to Original (`SceneTint`: the switch off, and the amp not holding
  // the window), where it wears the Tint instead; there a Tint the listener
  // has touched — a hue, a colour picked whole, or a second colour — draws
  // the stops as well, ahead of the scene's palette and its colours of the
  // hour. A Tint left as it came still lets the scene's colours through.
  // The Studio's bench is never overridden: a member there is judging their
  // own scene.
  const isSceneTintOn = useSceneTintEnabled();
  const isAmp = useAmpHoldsWindow();
  const isSceneWorn = isSceneTintOn || isAmp;
  const isOwnOverScene =
    isScene &&
    !isSceneWorn &&
    (tint !== undefined || picked !== undefined || second !== undefined);
  const isStudio = studio !== undefined || studioSource !== undefined;
  const isOwn = !isStudio && (!isScene || isOwnOverScene);

  // A layout effect, so the first frame a new scene is drawn in already has
  // its rainbow round it.
  useLayoutEffect(() => {
    const fromTime = timeColours && rainbowFromColours(timeColours.split(' '));
    const fromSwatch = swatch && rainbowFromColours(swatch.split(' '));
    if (isOwn) {
      setRainbowStops(ownStops.split(' '));
    } else if (chosenStops) {
      setRainbowStops(chosenStops.split(' '));
    } else if (fromTime) {
      setRainbowStops(fromTime);
    } else if (fromSwatch) {
      setRainbowStops(fromSwatch);
    } else {
      // A scene in greys lends no colour: the window's own, as with a
      // standard look.
      setRainbowStops(ownStops.split(' '));
    }
  }, [isOwn, ownStops, chosenStops, timeColours, swatch]);

  return null;
};

export default RainbowSource;
