/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId } from 'common/scenePacks';
import { usePageDaylight } from '../graph/sceneDaylight';
import {
  measureSceneSky,
  measureStudioSky,
  sceneSkyVersion,
} from '../graph/sceneSky';
import useStudioDayColours from '../studio/useStudioDayColours';
import { useSelectedLookId } from '../utils/graphStyle';
import {
  isWornAsNamed,
  MEASURED_STOPS,
  stopColoursAt,
  stopKeyOf,
  type TSceneStopColours,
} from '../utils/sceneDayColours';
import { studioDraftOwner, useDraftedSides } from '../utils/windowColourDraft';
import { LAGOON_SKY } from '../utils/rainbowPalette';
import {
  tintedLagoon,
  useWindowTint,
  useWindowTintColour,
  useWindowTintSecondary,
} from '../utils/windowTint';
import { isUsableGlow } from '../utils/pickedWindow';
import { isHueless, labOf, withoutHue } from '../utils/windowLight';
import { skyFromSwatch } from '../utils/sceneTint';
import {
  skyFromWindowColours,
  windowColoursFromStops,
  windowColoursOfSky,
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
  useStudioTintSource,
} from '../utils/sceneTintStore';
import useIsBackdrop from '../utils/useIsBackdrop';

/**
 * How `paintKey` marks colours to be worn as named, exactly as picked: the
 * scene's points are its walk through the day, never the Brightness darkening
 * them again (Ivan, 2026-11-18: "whatever colours are selected are the ones
 * used").
 */
const PICKED = 'picked';

/**
 * The colours a scene or a Studio project lends at `daylight`, as text the
 * effect below compares by value: its points blended at that hour
 * (`sceneDayColours.ts`), worn as named when any is somebody's choice - the
 * listener's or the pack's - else lending their hue, as colours the app
 * worked out from a palette or a picture always have.
 */
const paintKey = (
  sides: TSceneStopColours,
  daylight: number,
): string | undefined => {
  const colours = stopColoursAt(sides, daylight);
  if (!colours) {
    return undefined;
  }
  let kind = 'toned';
  if (isWornAsNamed(sides)) {
    kind = PICKED;
  }
  return `${kind} ${colours.surface} ${colours.accent} ${colours.glow}`;
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
  const tintColour = useWindowTintColour();
  const tintSecond = useWindowTintSecondary();
  const studio = useStudioTintSource();
  const lookId = useSelectedLookId();
  const scenes = useUsableScenes();
  const memberScenes = useUsableMemberScenes();
  const hasPainted = useRef(false);
  // Colours and Ambient hold the scene's colour however low the Brightness
  // goes; the Backdrop's glass darkens with it (`TSkyTone`). The Studio's
  // own mode while it is the one asking, which never has the Backdrop.
  const isBackdrop = useIsBackdrop();
  const isStudioAsking = studio !== undefined;
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
  // The hour the scene is played at, whole: the window's colours step with
  // it, which in a morning or an evening on the clock is once every minute
  // or two, and while the Brightness is dragged once per step of the slider
  // - a repaint the drag already causes - never once a frame.
  const daylight = Math.round(usePageDaylight());
  // The colours the listener chose for this scene in the Window colours
  // menu, else the scene's own, for its night and its day: the ones it
  // names, from its listing, so they are on the window as it is chosen, the
  // ones its palette gives as the listener's choices leave it, or its
  // picture's (`useSceneWindowColours`) - blended at the scene's hour.
  const windowColours = useSceneWindowColours(isSceneLook ? lookId : '');
  // With the colour being picked in an editor standing in at its point, so
  // the whole window shows it before it is accepted (`windowColourDraft.ts`).
  const lookSides = useDraftedSides(
    isSceneLook ? lookId : '',
    windowColours.sides,
  );
  const own = paintKey(lookSides, daylight);
  // "On" while the window wears its own colours (`IOwnOn`): the Tint's
  // second colour where the listener gave one. With a scene on Original and
  // the Tint left as it came, the scene's glow of the hour, as its colours
  // draw the stops there too (`RainbowSource`, the same rule); a glow that
  // cannot say "on" (`isUsableGlow`) is passed over. Otherwise none, and
  // "on" is the first colour itself.
  const isTintTouched =
    tint !== undefined || tintColour !== undefined || tintSecond !== undefined;
  const sceneGlow =
    isSceneLook && !isTintTouched ? own?.split(' ')[3] : undefined;
  const sceneGlowLab = sceneGlow === undefined ? undefined : labOf(sceneGlow);
  const ownSecond =
    tintSecond ??
    (sceneGlowLab && isUsableGlow(sceneGlowLab) ? sceneGlow : undefined);
  const { version, swatch } = useMemo(() => {
    const scene = isPremiumLookId(lookId)
      ? scenes.find((entry) => entry.lookId === lookId)
      : memberScenes.find((entry) => entry.lookId === lookId);
    return {
      version: scene && (scene.revision ?? String(scene.version)),
      swatch: scene?.swatch.join(' '),
    };
  }, [lookId, scenes, memberScenes]);
  // The Studio's project, as its pack names its colours, as the member edits
  // its palette on the bench, or as its picture was measured.
  const studioPalette = useMemo(
    () => (studioStops ? windowColoursFromStops(studioStops) : undefined),
    [studioStops],
  );
  const studioColours = useStudioDayColours(
    studio?.project,
    studio?.playing?.pack,
    studioPalette,
  );
  const studioSides = useDraftedSides(
    studio ? studioDraftOwner(studio.project) : '',
    studioColours.sides,
  );
  const studioOwn = studio ? paintKey(studioSides, daylight) : undefined;

  // The pictures the colours come from where nothing else says them: each
  // end of the day the scene names nothing for is drawn at that hour, once
  // per version (`graph/sceneSky.ts`), and lands in the remembered skies the
  // colours above are read from. Apart from the painting below, so a new
  // hour never asks for a drawing. As text, so the effect compares by value.
  const studioMeasured = studioColours.measured.join(' ');
  const lookMeasured = windowColours.measured.join(' ');
  useEffect(() => {
    if (studio) {
      const { playing } = studio;
      if (!playing) {
        return;
      }
      MEASURED_STOPS.forEach((stop) => {
        const key = stopKeyOf(studioSkyKey(studio.project), stop);
        if (
          studioMeasured.split(' ').includes(stop) &&
          recallSceneSky(key)?.version !== playing.build
        ) {
          measureStudioSky(studio.project, playing.build, playing.pack, stop);
        }
      });
      return;
    }
    if (!isSceneLook || !isEnabled || version === undefined) {
      return;
    }
    // Measured for the choices the listener made in it, which can swap the
    // palette it is drawn in, and remembered under them.
    const wanted = sceneSkyVersion(lookId, version, chosen);
    MEASURED_STOPS.forEach((stop) => {
      if (
        lookMeasured.split(' ').includes(stop) &&
        recallSceneSky(stopKeyOf(lookId, stop))?.version !== wanted
      ) {
        measureSceneSky(lookId, version, chosen, stop);
      }
    });
  }, [
    studio,
    studioMeasured,
    isSceneLook,
    isEnabled,
    lookId,
    version,
    chosen,
    lookMeasured,
  ]);

  // What the window is in the colours of; only a change of it fades. A new
  // hour of the same scene, or a colour changed in an editor, is the same
  // window a step on, painted at once: faded, every step of a Brightness
  // drag queued a fade behind the last one.
  const subject = studio
    ? `studio:${studio.project}`
    : `${isSceneLook && isEnabled ? `look:${lookId}` : 'window'} ${tone} ${tint ?? ''} ${tintColour ?? ''}`;
  const paintedSubject = useRef<string | undefined>(undefined);

  // A layout effect, so a launch's first frame is already in the remembered
  // colour instead of flashing the theme first.
  useLayoutEffect(() => {
    const fade = hasPainted.current && paintedSubject.current !== subject;
    hasPainted.current = true;
    paintedSubject.current = subject;

    // Colours a scene says it lends are shown as they are, and nothing is
    // drawn to second-guess them: the same on every computer, from the first
    // frame. Named ones are worn as named; ones worked out from a palette or a
    // picture lend their hue (`paintKey`).
    const wearOwn = (text: string) => {
      const [kind, surface, accent, glow] = text.split(' ');
      const colours = { surface, accent, glow };
      const sky = skyFromWindowColours(colours);
      if (kind === PICKED) {
        showWindowColours(colours, sky, fade, tone, undefined, 'points');
      } else {
        showSceneSky(sky, fade, tone);
      }
    };
    if (studio && studioOwn) {
      wearOwn(studioOwn);
      return;
    }
    if (studio) {
      // The project's own colour straight away, as last measured — and the
      // theme for a project never measured, never the previous project's
      // colour held while this one loads. A new save of the same project
      // keeps its colour until the new build is measured.
      const remembered = recallSceneSky(studioSkyKey(studio.project));
      showSceneSky(remembered?.sky ?? undefined, fade, tone);
      return;
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
      // "On" is the first colour, or the second where there is one
      // (`IOwnOn`), whichever way the first is worn.
      const on = { second: ownSecond };
      if (tint !== undefined && tintColour !== undefined) {
        // A colour picked whole (`windowTint.ts`): worn as picked, the
        // buttons and the curve in exactly it, black included on a white
        // window; the panes are Lagoon's turned to its hue. The glow is
        // "on" as `on` says, so the glyphs drawn from this sky show it too.
        // A colour with no hue (black, grey, white) has no hue to turn the
        // panes to: they took the picker's slider's leftover hue, and black
        // picked put the window on a brown floor (Ivan, 2026-11-18). There
        // the panes are Lagoon's at their own lightness, in grey, and the
        // window is monochrome (`filledOn`).
        const lent = windowColoursOfSky(tintedLagoon(tint));
        const colours = {
          ...lent,
          surface: isHueless(tintColour)
            ? withoutHue(lent.surface)
            : lent.surface,
          accent: tintColour,
          glow: ownSecond ?? tintColour,
        };
        showWindowColours(
          colours,
          skyFromWindowColours(colours),
          fade,
          'held',
          on,
        );
      } else if (tint === undefined) {
        lendSceneSky(LAGOON_SKY, fade, on);
      } else {
        showSceneSky(tintedLagoon(tint), fade, 'held', on);
      }
      return;
    }
    if (own) {
      wearOwn(own);
      return;
    }
    // Measured as nothing - a picture with no colour to lend - the theme: a
    // scene that could not lend a colour keeps none of the last scene's.
    const remembered = recallSceneSky(lookId);
    if (remembered) {
      showSceneSky(remembered.sky ?? undefined, fade, tone);
      return;
    }
    // Never measured: its swatch's colour as it is chosen, not the last
    // scene's held until this one has loaded and been measured.
    const provisional = swatch ? skyFromSwatch(swatch.split(' ')) : undefined;
    if (provisional) {
      showSceneSky(provisional, fade, tone);
    }
  }, [
    studio,
    studioOwn,
    isEnabled,
    isSceneLook,
    lookId,
    swatch,
    own,
    tone,
    tint,
    tintColour,
    ownSecond,
    subject,
  ]);

  return null;
};

export default SceneTint;
