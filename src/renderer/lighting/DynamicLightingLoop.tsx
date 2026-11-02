/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type {
  ILampPreview,
  ILampSceneChoice,
  TLampDaylight,
} from 'common/lighting/lampSceneChoice';
import { useLiveAudioControl } from '../audio/LiveAudioContext';
import { pageDaylight } from '../graph/sceneDaylight';
import { parseAccent } from '../graph/sceneUniforms';
import { isMemberSceneListingLoaded } from '../utils/memberScenes';
import { useSceneDaylightSetting } from '../utils/sceneDaylightSetting';
import { isScenePackListingLoaded } from '../utils/scenePacks';
import { subscribeRoot, useThemeShade } from '../utils/theme';
import { useLampScene } from './lampScene';
import { publishLightingPreview } from './lightingPreview';

/**
 * The window's part of the desk lights: what they play, told to main.
 *
 * The lamps are drawn by `FluidEQ-Scenes.exe`, which main runs while
 * dynamic lighting is on (`main/lighting/lampScenes.ts`), so they light the
 * desk with this window in the tray or let go of. They used to be drawn
 * here — this window's own capture of the output, its scene in a worker,
 * thirty frames a second sent to main — which kept the whole window alive
 * for as long as the desk was lit.
 *
 * What stays is what only the window knows: the look the member chose and
 * whether the account owns it (`lampScene.ts`), whether the live displays
 * are paused, the time of day the window asks of its scenes, and its
 * accent. Sent whole whenever any of them moves, and only once the scene
 * lists have arrived: before that, every look reads as one nobody owns, and
 * the desk main lit from what it kept would go out for nothing. Main sends
 * back each frame while the Lighting page is open, for the page's desk.
 *
 * Mounted once, at the root, and renders nothing.
 */

/** The window's accent as the scenes take it, followed as the theme moves. */
const readAccent = (): [number, number, number] =>
  parseAccent(
    getComputedStyle(document.documentElement).getPropertyValue('--accent'),
  );

const useAccent = (): [number, number, number] => {
  const [accent, setAccent] = useState(readAccent);
  useEffect(() => {
    // Read once a frame at most, with the frame that paints it: a scene's
    // tint that moves changes the root's colours on every one.
    let frame = 0;
    const read = () => {
      frame = 0;
      const next = readAccent();
      setAccent((last) => (last.join() === next.join() ? last : next));
    };
    const stop = subscribeRoot(() => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(read);
      }
    });
    return () => {
      stop();
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);
  return accent;
};

/** A picture of RGB bytes as an image the page's desk can draw. */
const pictureImage = (
  picture: NonNullable<ILampPreview['picture']>,
): Promise<ImageBitmap> => {
  const rgba = new Uint8ClampedArray(picture.width * picture.height * 4);
  for (let at = 0; at < picture.width * picture.height; at += 1) {
    rgba[at * 4] = picture.rgb[at * 3];
    rgba[at * 4 + 1] = picture.rgb[at * 3 + 1];
    rgba[at * 4 + 2] = picture.rgb[at * 3 + 2];
    rgba[at * 4 + 3] = 255;
  }
  return createImageBitmap(new ImageData(rgba, picture.width, picture.height));
};

export default function DynamicLightingLoop() {
  const scene = useLampScene();
  const { isPaused } = useLiveAudioControl();
  const setting = useSceneDaylightSetting();
  // Subscribed for its change alone: the Brightness moves the time of day.
  useThemeShade();
  const accent = useAccent();
  const listed = isScenePackListingLoaded() && isMemberSceneListingLoaded();
  // The clock is read by the host on every frame it draws; any other time of
  // day is the window's, and travels as a value.
  const heldDaylight = setting.source === 'clock' ? undefined : pageDaylight();

  useEffect(() => {
    if (!listed) {
      return;
    }
    const daylight: TLampDaylight =
      heldDaylight === undefined
        ? { clock: true }
        : { clock: false, value: heldDaylight };
    const choice: ILampSceneChoice = {
      scene,
      paused: isPaused,
      daylight,
      accent,
    };
    // Optional like every bridge call here: a test's partial bridge, or a
    // window whose preload predates it, has none.
    window.electron?.ipcRenderer?.chooseLampScene?.(choice);
  }, [listed, scene, isPaused, heldDaylight, accent]);

  useEffect(() => {
    const api = window.electron?.ipcRenderer;
    if (!api?.onLampPreview) {
      return undefined;
    }
    let newest = 0;
    const stop = api.onLampPreview((preview) => {
      newest += 1;
      const mine = newest;
      if (!preview.picture) {
        publishLightingPreview(preview.frame);
        return;
      }
      pictureImage(preview.picture)
        .then((image) => {
          // A newer frame came while this one was made: it is shown, not this.
          if (mine === newest) {
            publishLightingPreview(preview.frame, image);
          } else {
            image.close();
          }
          return undefined;
        })
        .catch(() => publishLightingPreview(preview.frame));
    });
    return () => {
      stop();
      publishLightingPreview(undefined);
    };
  }, []);

  return null;
}
