/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useLayoutEffect, useMemo, useRef } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId } from 'common/scenePacks';
import {
  measureSceneSky,
  measureStudioSky,
  type TSkyMeasurement,
} from '../graph/sceneSky';
import { useSelectedLookId } from '../utils/graphStyle';
import { useUsableMemberScenes } from '../utils/memberScenes';
import { useUsableScenes } from '../utils/scenePacks';
import {
  recallSceneSky,
  showSceneSky,
  studioSkyKey,
  useSceneTintEnabled,
  useStudioTintSource,
} from '../utils/sceneTintStore';
import { useTheme } from '../utils/theme';

/**
 * Puts the whole window in the colour of a Plus scene. Renders nothing.
 *
 * Two things can ask for it. The Studio, while the member's own scene plays
 * on its stage with the Studio's switch on — and that wins, because somebody
 * looking at their scene there is judging that one. Otherwise the graph,
 * while its switch is on and the chosen look is a Plus visualizer: the Plus
 * looks and the scenes members make, the only looks drawn by a scene whose
 * sky can be measured. Choosing an ordinary look puts the theme back, and so
 * does Plus lapsing: the selection leaves the scene, and this follows it.
 *
 * Mounted at the root of the app rather than in the graph, because the colour
 * belongs to the window: it stays while the graph is on another tab, and the
 * graph unmounts there.
 *
 * Every scene is measured once per version and remembered — a graph look by
 * its id, a Studio project by its own — so a launch opens straight in the
 * colour it closed in, before the scene lists have even arrived, and going
 * back to a project is its colour at once. While a graph look nobody has
 * measured is drawn off screen, the window keeps the colour it has, so
 * moving from one look to the next is one change rather than a trip back
 * through the theme; a new save in the Studio does the same.
 */
const SceneTint = () => {
  const isEnabled = useSceneTintEnabled();
  const studio = useStudioTintSource();
  const lookId = useSelectedLookId();
  const scenes = useUsableScenes();
  const memberScenes = useUsableMemberScenes();
  // The palette is toned from the theme's own values, so a change of theme
  // has to tone it again.
  const theme = useTheme();
  const hasPainted = useRef(false);

  const isSceneLook = isPremiumLookId(lookId) || isMemberLookId(lookId);
  // The version the graph draws, in the same form `SceneCanvas` keys it by.
  // Undefined until the lists arrive, or for a scene that is not usable.
  const version = useMemo(() => {
    const scene = isPremiumLookId(lookId)
      ? scenes.find((entry) => entry.lookId === lookId)
      : memberScenes.find((entry) => entry.lookId === lookId);
    return scene && (scene.revision ?? String(scene.version));
  }, [lookId, scenes, memberScenes]);

  // A layout effect, so a launch's first frame is already in the remembered
  // colour instead of flashing the theme first.
  useLayoutEffect(() => {
    const fade = hasPainted.current;
    hasPainted.current = true;
    let isCurrent = true;
    // A scene that could not be measured lends nothing either: holding the
    // last scene's colour past this point would be keeping a colour that
    // belongs to something no longer on screen.
    const showMeasured = (measuring: Promise<TSkyMeasurement>) => {
      measuring
        .then((sky) => {
          if (isCurrent) {
            showSceneSky(sky ?? undefined, true);
          }
          return undefined;
        })
        .catch(() => undefined);
    };
    const stop = () => {
      isCurrent = false;
    };

    if (studio) {
      // The project's own colour straight away, as last measured — and the
      // theme for a project never measured, never the previous project's
      // colour held while this one loads. A new save of the same project
      // keeps its colour until the new build is measured.
      const remembered = recallSceneSky(studioSkyKey(studio.project));
      showSceneSky(remembered?.sky ?? undefined, fade);
      const { playing } = studio;
      if (playing && remembered?.version !== playing.build) {
        showMeasured(
          measureStudioSky(studio.project, playing.build, playing.pack),
        );
      }
      return stop;
    }

    if (!isEnabled || !isSceneLook) {
      showSceneSky(undefined, fade);
      return stop;
    }
    const remembered = recallSceneSky(lookId);
    if (remembered) {
      showSceneSky(remembered.sky ?? undefined, fade);
    }
    if (version !== undefined && remembered?.version !== version) {
      showMeasured(measureSceneSky(lookId, version));
    }
    return stop;
  }, [studio, isEnabled, isSceneLook, lookId, version, theme]);

  return null;
};

export default SceneTint;
