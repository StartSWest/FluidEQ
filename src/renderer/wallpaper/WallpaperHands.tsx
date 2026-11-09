/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type { IWallpaperSurfaceBridge } from 'common/wallpaper';
import ScenePointerLayer from '../graph/ScenePointerLayer';
import type { ISceneInteraction } from '../graph/sceneInteraction';
import SceneViewReset from '../graph/SceneViewReset';
import '../styles/Button.scss';
import './hands.scss';

/**
 * The viewer's hands on a desktop background (Ivan, 2026-11-09: "I want to
 * eanble desltop walpaper to be interactive as the viz un the app"): the
 * graph's own (`sceneInteraction.ts`), attached to the whole stage, with the
 * view's reset and what the scene throws from the hand beside them.
 *
 * Windows gives this page no mouse of its own — it lies behind the icons —
 * so main hands it the mouse as the desktop helper reports it over this
 * monitor's bare desktop: real input for the pointer and its buttons, which
 * makes every event here the browser's own, and a message for the wheel,
 * which reaches a window that cannot take focus no other way. That message is
 * dispatched as a wheel event where the pointer is, so the interaction hears
 * it exactly as on the graph: Ctrl and the wheel move the camera in and out.
 */
export default function WallpaperHands({
  interaction,
  stage,
  bridge,
  pack,
  interactive,
  awake,
}: {
  interaction: ISceneInteraction;
  stage: HTMLElement;
  bridge: IWallpaperSurfaceBridge;
  pack: IScenePack;
  /** The listener's switch (`IWallpaperChoice.interactive`). */
  interactive: boolean;
  /**
   * Playing rather than paused. Paused, no mouse arrives and the hands come
   * off, but a view somebody turned stays turned for when it plays again.
   */
  awake: boolean;
}) {
  // Nothing can turn the view back once the mouse is off, so it goes back to
  // the scene's own then — and only then.
  useEffect(() => {
    if (!interactive) {
      interaction.home();
    }
  }, [interaction, interactive]);

  const handsOn = interactive && awake;
  useEffect(() => {
    if (!handsOn) {
      return undefined;
    }
    const detach = interaction.attach(stage, {
      frame: () => stage.getBoundingClientRect(),
    });
    const stopWheel = bridge.onWheel(({ x, y, deltaY, ctrlKey }) => {
      const target = document.elementFromPoint(x, y) ?? stage;
      target.dispatchEvent(
        new WheelEvent('wheel', {
          clientX: x,
          clientY: y,
          deltaY,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          ctrlKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    return () => {
      stopWheel();
      detach();
    };
  }, [interaction, stage, bridge, handsOn]);

  if (!handsOn) {
    return null;
  }
  return (
    <>
      {pack.pointer && (
        <ScenePointerLayer
          gestures={interaction.onGesture}
          pointer={pack.pointer}
          ambient={pack.ambient}
          artwork={pack.artwork}
        />
      )}
      <SceneViewReset
        interaction={interaction}
        className="wallpaper-hands__reset"
      />
    </>
  );
}
