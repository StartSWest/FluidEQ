/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useLayoutEffect, useMemo, useRef } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId } from 'common/scenePacks';
import type { ISceneWindowColours } from 'common/sceneWindowColours';
import {
  measureSceneSky,
  measureStudioSky,
  sceneSkyVersion,
  type TSkyMeasurement,
} from '../graph/sceneSky';
import { useSelectedLookId } from '../utils/graphStyle';
import { LAGOON_SKY } from '../utils/rainbowPalette';
import { tintedLagoon, useWindowTint } from '../utils/windowTint';
import { skyFromSwatch } from '../utils/sceneTint';
import {
  skyFromWindowColours,
  windowColoursFromStops,
} from '../utils/sceneOwnColours';
import { useStudioAppColours } from '../utils/sceneAppColours';
import { useListenerParams } from '../utils/sceneParamStore';
import useSceneWindowColours from '../utils/useSceneWindowColours';
import { useUsableMemberScenes } from '../utils/memberScenes';
import { useUsableScenes } from '../utils/scenePacks';
import {
  lendSceneSky,
  recallSceneSky,
  showSceneSky,
  showWindowColours,
  studioSkyKey,
  useAmpHoldsWindow,
  useSceneTintEnabled,
  useStudioTintMode,
  useStudioTintSource,
} from '../utils/sceneTintStore';
import useIsBackdrop from '../utils/useIsBackdrop';

/** How `ownColoursKey` marks colours to be worn as named. */
const PICKED = 'picked';

/**
 * The colours a scene or a Studio project lends, as text the effect below
 * compares by value: `named` (the listener's own, or what its pack names),
 * worn as named, else `worked` out from its palette, which lends its hue.
 */
const ownColoursKey = (
  named: ISceneWindowColours | undefined,
  worked: ISceneWindowColours | undefined,
): string | undefined => {
  const colours = named ?? worked;
  return (
    colours &&
    `${named ? PICKED : 'toned'} ${colours.surface} ${colours.accent} ${colours.glow}`
  );
};

/**
 * Puts the whole window in the colour of a Plus scene. Renders nothing.
 *
 * Three things can ask for it. The Studio, while the member's own scene plays
 * on its stage with the Studio's switch on — and that wins, because somebody
 * looking at their scene there is judging that one. Otherwise the graph,
 * while its switch is on and the chosen look is a Plus visualizer: the Plus
 * looks and the scenes members make, the only looks drawn by a scene whose
 * sky can be measured. Choosing an ordinary look puts the theme back, and so
 * does Plus lapsing: the selection leaves the scene, and this follows it.
 * And with no visualizer chosen at all: the window in some of Lagoon's
 * colours, Rainbow mode's own palette (`rainbowPalette.ts`), whether the
 * mode is on or not.
 *
 * Mounted at the root of the app rather than in the graph, because the colour
 * belongs to the window: it stays while the graph is on another tab, and the
 * graph unmounts there.
 *
 * A scene that names the colours it lends the window, or has a palette to
 * work them out from (`sceneOwnColours.ts`), is shown in those at once and
 * never drawn to find out. Any other scene is measured once per version and
 * remembered — a graph look by
 * its id, a Studio project by its own — so a launch opens straight in the
 * colour it closed in, before the scene lists have even arrived, and going
 * back to a project is its colour at once. While a graph look nobody has
 * measured is drawn off screen, the window keeps the colour it has, so
 * moving from one look to the next is one change rather than a trip back
 * through the theme; a new save in the Studio does the same.
 */
const SceneTint = () => {
  // The amp is the Backdrop whatever the app's mode (`setAmpHoldsWindow`),
  // so it wears the scene's colours as the Backdrop does.
  const isAmp = useAmpHoldsWindow();
  const isEnabled = useSceneTintEnabled() || isAmp;
  const tint = useWindowTint();
  const studio = useStudioTintSource();
  const lookId = useSelectedLookId();
  const scenes = useUsableScenes();
  const memberScenes = useUsableMemberScenes();
  const hasPainted = useRef(false);
  // Colours and Ambient hold the scene's colour however low the Brightness
  // goes; the Backdrop's glass darkens with it (`TSkyTone`). The Studio's
  // own mode while it is the one asking, which never has the Backdrop.
  const isBackdrop = useIsBackdrop();
  const studioMode = useStudioTintMode();
  const isStudioAsking = studio !== undefined && studioMode !== 'theme';
  const tone = isBackdrop && !isStudioAsking ? 'follow' : 'held';

  const isSceneLook = isPremiumLookId(lookId) || isMemberLookId(lookId);
  // THE COLOUR FOLLOWS THE SWITCH, NOT THE PICTURE (Ivan, 2026-09-22: "if the
  // viz is hidden also show the entire amp ui that color if ambient or tint is
  // selected"). It was gated on the player's visualizer being open, so closing
  // that deck put the whole amp back to the theme's cyan while the switch was
  // still on — and the scene's drifting ambient, which is gated on the switch
  // alone, kept flying over it in the scene's own colours. One answer for
  // both: the switch. With it off the amp is the standard cyan, as it always
  // was.
  // The version the graph draws, in the same form `SceneCanvas` keys it by,
  // and the swatch its picker row is drawn in (`skyFromSwatch`), as text so
  // the effect below compares it by value. Undefined until the lists arrive,
  // or for a scene that is not usable.
  const chosen = useListenerParams(lookId);
  const studioStops = useStudioAppColours();
  // The colours the listener chose for this scene in the Window colours
  // menu, else the scene's own: the ones it names, from its listing, so they
  // are on the window as it is chosen, or the ones its palette gives as the
  // listener's choices leave it (`useSceneWindowColours`).
  const windowColours = useSceneWindowColours(isSceneLook ? lookId : '');
  const own = ownColoursKey(
    windowColours.chosen ?? windowColours.named,
    windowColours.declared,
  );
  const { version, swatch } = useMemo(() => {
    const scene = isPremiumLookId(lookId)
      ? scenes.find((entry) => entry.lookId === lookId)
      : memberScenes.find((entry) => entry.lookId === lookId);
    return {
      version: scene && (scene.revision ?? String(scene.version)),
      swatch: scene?.swatch.join(' '),
    };
  }, [lookId, scenes, memberScenes]);
  // The Studio's project, as its pack names its colours or as the member
  // edits its palette on the bench.
  const studioOwn = useMemo(
    () =>
      ownColoursKey(
        studio?.playing?.pack.windowColours,
        studioStops ? windowColoursFromStops(studioStops) : undefined,
      ),
    [studio, studioStops],
  );

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
            showSceneSky(sky ?? undefined, true, tone);
          }
          return undefined;
        })
        .catch(() => undefined);
    };
    const stop = () => {
      isCurrent = false;
    };

    // Colours a scene says it lends are shown as they are, and nothing is
    // drawn to second-guess them: the same on every computer, from the first
    // frame. Named ones are worn as named; ones worked out from a palette lend
    // their hue (`ownColoursKey`).
    const wearOwn = (text: string) => {
      const [kind, surface, accent, glow] = text.split(' ');
      const colours = { surface, accent, glow };
      const sky = skyFromWindowColours(colours);
      if (kind === PICKED) {
        showWindowColours(colours, sky, fade, tone);
      } else {
        showSceneSky(sky, fade, tone);
      }
    };
    if (studio && studioOwn) {
      wearOwn(studioOwn);
      return stop;
    }
    if (studio) {
      // The project's own colour straight away, as last measured — and the
      // theme for a project never measured, never the previous project's
      // colour held while this one loads. A new save of the same project
      // keeps its colour until the new build is measured.
      const remembered = recallSceneSky(studioSkyKey(studio.project));
      showSceneSky(remembered?.sky ?? undefined, fade, tone);
      const { playing } = studio;
      const build = playing?.build;
      if (playing && build && remembered?.version !== build) {
        showMeasured(measureStudioSky(studio.project, build, playing.pack));
      }
      return stop;
    }

    // Original under a Plus visualizer is the app's own colour too, the one
    // its Tint picks (Ivan, 2026-11-16: "color = original so they change the
    // color via app color slider"): it was the bare theme, with no slider that
    // moved it.
    if (!isSceneLook || !isEnabled) {
      // No visualizer chosen: the window wears Lagoon (`LAGOON_SKY`), Rainbow
      // mode or not. Rainbow on used to lend it and Rainbow off to put the
      // bare theme back, so the switch changed every pane and the floor under
      // them; Ivan wants the two identical, in Rainbow's colours ("app or
      // pane … need to be exactly the same with rainbow and no rainbow, and I
      // want the one that rainbow on has now", 2026-09-27). Rainbow changes
      // only what is drawn in its stops. Lent, so it fades out toward Black,
      // which is black and grey ("moving toward the 0 make it no tinting").
      // The listener's own colour where they chose one (Ivan, 2026-10-25:
      // "add a colour tint option ... choose any colour", `windowTint.ts`),
      // held at every Brightness as Colours holds a scene's: a colour picked
      // by hand that faded away toward Black left the controls untinted
      // there ("when brightness is zero it's not tinting the controls").
      if (tint === undefined) {
        lendSceneSky(LAGOON_SKY, fade);
      } else {
        showSceneSky(tintedLagoon(tint), fade, 'held');
      }
      return stop;
    }
    if (own) {
      wearOwn(own);
      return stop;
    }
    const remembered = recallSceneSky(lookId);
    if (remembered) {
      showSceneSky(remembered.sky ?? undefined, fade, tone);
    } else {
      // Never measured: its swatch's colour as it is chosen, not the last
      // scene's held until this one has loaded and been measured.
      const provisional = swatch ? skyFromSwatch(swatch.split(' ')) : undefined;
      if (provisional) {
        showSceneSky(provisional, fade, tone);
      }
    }
    // Measured for the choices the listener made in it, which can swap the
    // palette it is drawn in, and remembered under them.
    if (
      version !== undefined &&
      remembered?.version !== sceneSkyVersion(lookId, version, chosen)
    ) {
      showMeasured(measureSceneSky(lookId, version, chosen));
    }
    return stop;
  }, [
    studio,
    studioOwn,
    isEnabled,
    isSceneLook,
    lookId,
    version,
    swatch,
    own,
    chosen,
    tone,
    tint,
  ]);

  return null;
};

export default SceneTint;
