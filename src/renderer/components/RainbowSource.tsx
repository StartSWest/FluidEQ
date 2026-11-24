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
import {
  sceneAppColourStops,
  useSceneColourControls,
  useStudioAppColours,
} from '../utils/sceneAppColours';
import { useListenerParams } from '../utils/sceneParamStore';
import { rainbowBetween, setRainbowStops } from '../utils/rainbowPalette';
import {
  stopColoursAt,
  WINDOW_COLOUR_STOPS,
  type TSceneStopColours,
} from '../utils/sceneDayColours';
import { studioDraftOwner, useDraftedSides } from '../utils/windowColourDraft';
import {
  useAmpHoldsWindow,
  useSceneTintEnabled,
  useStudioTintSource,
} from '../utils/sceneTintStore';
import useSceneWindowColours from '../utils/useSceneWindowColours';
import {
  useWindowTint,
  useWindowTintColour,
  useWindowTintSecondChosen,
  useWindowTintSecondary,
  windowPrimaryColour,
  windowTintStops,
} from '../utils/windowTint';

/**
 * `sides` without a set the app measured off the scene's picture. A drawing
 * of a scene catches whatever small bright thing is in it - Alpine's
 * lanterns lent its wave a yellow the scene does not have, under an aurora
 * of cyan and magenta - so the wave never takes its colours from one: what
 * the scene names, what the listener or the member chose, and what its
 * palette gives by the fixed rule (`sceneOwnColours.ts`) are kept.
 */
const withoutMeasured = (sides: TSceneStopColours): TSceneStopColours => {
  const kept: TSceneStopColours = {};
  WINDOW_COLOUR_STOPS.forEach((stop) => {
    const side = sides[stop];
    if (side && side.source !== 'measured') {
      kept[stop] = side;
    }
  });
  return kept;
};

/**
 * Chooses the stops the window draws its colourful marks in — the graph's
 * curves, the faders, the meters, the wave. Renders nothing. Colourful mode
 * has no switch any more (`euphoriaMode.ts`): this is simply what they wear.
 *
 * With a standard look, the window's own pair (`windowTint.ts`): one colour,
 * or the Tint's gradient once the listener gives it a second colour.
 *
 * While the graph's look is a Plus scene - a Plus look or a scene a member
 * made - the stops are the scene's, in this order:
 *
 * 1. A scene that chose the colours of its wave says so first
 *    (`sceneAppColours.ts`): its first palette, as many colours as it names,
 *    in its order bass to treble, or the single colour its choices show
 *    instead, as the listener's choices on the graph leave them (Ivan,
 *    2026-11-24: "some scenes do have a specific colour for the wave, for
 *    example Chrome"). While the Studio lends the window its project, the
 *    project's palette as the member is editing it - and never the graph
 *    look's: a project with no palette on the bench used to wear the palette
 *    of whatever scene was on the graph (Chrome's violet to yellow under
 *    Alpine, "not sure where they came from").
 * 2. Otherwise its window accent to its second colour (Ivan, 2026-11-24:
 *    "let's use the same settings, the colours the scene has ... so it's from
 *    primary to secondary colour"): the pair the window already wears at the
 *    scene's hour, its points blended as the window blends them
 *    (`sceneDayColours.ts`) - named by the scene, chosen by the listener, or
 *    worked out from its palette by the fixed rule - drawn as the window's
 *    own pair is (`rainbowBetween`).
 * 3. Otherwise the window's own pair. Never the scene's picture as measured,
 *    nor its picker swatch (`withoutMeasured`).
 *
 * A Tint the listener touched while the window is set to Original stands
 * over all three (the rule is written beside the effect below).
 *
 * Mounted beside `SceneTint`, at the root, because the palette
 * belongs to the window and stays while the graph is on another tab.
 */
const RainbowSource = () => {
  const lookId = useSelectedLookId();
  const isScene = isPremiumLookId(lookId) || isMemberLookId(lookId);
  const controls = useSceneColourControls(isScene ? lookId : '');
  const chosen = useListenerParams(lookId);
  const studio = useStudioAppColours();
  const studioSource = useStudioTintSource();

  // The stops a scene chose, ready to use: never re-sorted round the wheel
  // as a swatch is, because a palette's order is bass to treble. As text, so
  // the effect compares them by value.
  const chosenStops = useMemo(() => {
    if (studio) {
      return studio.join(' ');
    }
    if (studioSource || !isScene || !controls) {
      return undefined;
    }
    return sceneAppColourStops(
      controls,
      chosen ? { params: chosen } : {},
    )?.join(' ');
  }, [studio, studioSource, isScene, controls, chosen]);

  // The scene's window colours at its hour - the Studio's project while the
  // bench lends the window its colours, else the graph's scene - as the
  // accent and the second colour the stops run between. As text, compared
  // by value.
  const daylight = Math.round(usePageDaylight());
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
      withoutMeasured(studioSource ? studioSides : sceneSides),
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
  const secondChosen = useWindowTintSecondChosen();
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
  // hour. A Tint left as it came still lets the scene's colours through,
  // its default second colour included: only a second colour CHOSEN counts.
  // The Studio's bench is never overridden: a member there is judging their
  // own scene.
  const isSceneTintOn = useSceneTintEnabled();
  const isAmp = useAmpHoldsWindow();
  const isSceneWorn = isSceneTintOn || isAmp;
  const isOwnOverScene =
    isScene &&
    !isSceneWorn &&
    (tint !== undefined || picked !== undefined || secondChosen !== undefined);
  const isStudio = studio !== undefined || studioSource !== undefined;
  const isOwn = !isStudio && (!isScene || isOwnOverScene);

  // A layout effect, so the first frame a new scene is drawn in already has
  // its rainbow round it.
  useLayoutEffect(() => {
    if (isOwn) {
      setRainbowStops(ownStops.split(' '));
    } else if (chosenStops) {
      setRainbowStops(chosenStops.split(' '));
    } else if (timeColours) {
      const [accent, glow] = timeColours.split(' ');
      setRainbowStops(rainbowBetween(accent, glow));
    } else {
      // A scene that names no colours and has no palette to work them out
      // from: the window's own, as with a standard look.
      setRainbowStops(ownStops.split(' '));
    }
  }, [isOwn, ownStops, chosenStops, timeColours]);

  return null;
};

export default RainbowSource;
