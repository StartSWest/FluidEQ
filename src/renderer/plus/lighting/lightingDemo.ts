/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LIGHTING_GRID_HEIGHT,
  LIGHTING_GRID_WIDTH,
  type ILightingFrame,
} from 'common/lighting/lightingModel';
import { DEFAULT_LIGHTING_PROFILE } from 'common/lighting/lightingProfiles';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import { premiumLookId, type IScenePack } from 'common/scenePacks';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../../audio/LiveAudioContext';
import { playLampScene } from '../../lighting/lampScenePlay';
import { publishLightingPreview } from '../../lighting/lightingPreview';
import { fillSwatchGrid, swatchColours } from '../../lighting/swatchGrid';
import { useLockedScenes, type ILockedScene } from '../../utils/scenePacks';
import { useTasteSamples } from '../tasteSamples';

/**
 * The scene that lights the desk on the Dynamic lighting page of an account
 * without Plus: the same page the member gets, drawn with one scene so what
 * Plus does is on screen rather than described.
 *
 * The scene plays on the desk for as long as the page is open, with the
 * music — Ivan's call over the ten-second taste the scene pages give: the
 * desk is the argument, and a desk that stops is an argument that stops. The
 * server decides which official scenes may play at all (`tasteSamples`); the
 * scene's picture holds the desk until it plays and whenever it cannot, and a
 * machine that is offline or signed out still sees a lit desk, because the
 * picture needs neither.
 *
 * Nothing here reaches a device. The frames go to the page's own feed only;
 * lighting a keyboard is what the membership buys.
 */

/** Alpine when the app knows it: mountains and water read at eight lamps. */
const PREFERRED = 'alpine';

export type TLightingDemo =
  /** Nothing to show yet: no scene listed. */
  | { state: 'dark' }
  /** The scene itself, drawn on the audio clock. */
  | { state: 'playing' }
  /** Its picture, or its colours: before it plays, and when it cannot. */
  | { state: 'still' };

/**
 * The scene a page without Plus shows. One object for one scene: the listing
 * is rebuilt on every refresh, and a scene keyed on a fresh object would be
 * fetched and started again each time the app looked for new scenes. A
 * republished scene carries a new version, so it is a new object.
 */
export const useDemoScene = (): ILockedScene | undefined => {
  const locked = useLockedScenes();
  const found = locked.find((scene) => scene.id === PREFERRED) ?? locked[0];
  const key = found
    ? `${found.id}@${found.version}:${found.swatch.join()}`
    : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on what names the scene, see above
  return useMemo(() => found, [key]);
};

/**
 * The scene's picture as a lamp frame: the grid the lamps would take from it
 * and the picture itself for the desk's monitor.
 *
 * A frame carries no silence — the lamps hold the picture's colours at the
 * brightness of an ordinary frame rather than dimming to their idle.
 */
const stillFrame = async (
  url: string,
  sceneId: string,
): Promise<{ frame: ILightingFrame; source: ImageBitmap } | undefined> => {
  if (typeof createImageBitmap !== 'function') {
    return undefined;
  }
  // Loaded as a picture, not fetched: the window's content security policy
  // lets an image come from a data URL and lets a fetch reach only the app
  // and its servers, so `fetch(url)` on the gallery's picture is refused.
  const picture = new Image();
  await new Promise<void>((resolve, reject) => {
    picture.onload = () => resolve();
    picture.onerror = () => reject(new Error('the scene picture did not load'));
    picture.src = url;
  });
  const source = await createImageBitmap(picture);
  const canvas = new OffscreenCanvas(LIGHTING_GRID_WIDTH, LIGHTING_GRID_HEIGHT);
  const context = canvas.getContext('2d');
  if (!context) {
    source.close();
    return undefined;
  }
  // Cover, like the desk's monitor draws it: a letterboxed grid would light
  // the edge lamps with black bars.
  const scale = Math.max(
    LIGHTING_GRID_WIDTH / source.width,
    LIGHTING_GRID_HEIGHT / source.height,
  );
  const width = source.width * scale;
  const height = source.height * scale;
  context.drawImage(
    source,
    (LIGHTING_GRID_WIDTH - width) / 2,
    (LIGHTING_GRID_HEIGHT - height) / 2,
    width,
    height,
  );
  const { data } = context.getImageData(
    0,
    0,
    LIGHTING_GRID_WIDTH,
    LIGHTING_GRID_HEIGHT,
  );
  const rgb = new Uint8Array(LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3);
  for (let pixel = 0; pixel < rgb.length / 3; pixel += 1) {
    rgb[pixel * 3] = data[pixel * 4];
    rgb[pixel * 3 + 1] = data[pixel * 4 + 1];
    rgb[pixel * 3 + 2] = data[pixel * 4 + 2];
  }
  return {
    source,
    frame: {
      width: LIGHTING_GRID_WIDTH,
      height: LIGHTING_GRID_HEIGHT,
      rgb,
      // A loud, steady frame: the still is what the page is selling, and a
      // desk lit at half is a desk that looks switched off. Under the beat
      // threshold, so nothing kicks on a picture that does not move.
      level: 0.85,
      beat: 0.4,
      bass: 0.8,
      mid: 0.7,
      treble: 0.6,
      deltaMs: 1000 / 30,
      sceneId,
      timeSeconds: 0,
      activity: 1,
      ambient: false,
    },
  };
};

/**
 * The scene's own colours washed across the grid, for a desk that has no
 * picture to hold it: the palette at full height, never the spectrum bars —
 * this is a still, and bars on a page nobody is playing music to read as a
 * broken scene.
 */
const washFrame = (
  swatch: readonly string[],
  sceneId: string,
): ILightingFrame => ({
  width: LIGHTING_GRID_WIDTH,
  height: LIGHTING_GRID_HEIGHT,
  rgb: fillSwatchGrid(
    swatchColours(swatch),
    new Uint8Array(LIGHTING_GRID_WIDTH).fill(255),
    LIGHTING_GRID_WIDTH,
    LIGHTING_GRID_HEIGHT,
    new Uint8Array(LIGHTING_GRID_WIDTH * LIGHTING_GRID_HEIGHT * 3),
  ),
  level: 0.7,
  beat: 0.3,
  bass: 0.7,
  mid: 0.6,
  treble: 0.5,
  deltaMs: 1000 / 30,
  sceneId,
  timeSeconds: 0,
  activity: 1,
  ambient: false,
});

export const useLightingDemo = (
  scene: ILockedScene | undefined,
  pictureUrl: string | undefined,
): TLightingDemo => {
  const samples = useTasteSamples();
  const { capture, isPaused } = useLiveAudioControl();
  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;
  /**
   * The scene as fetched, with everything its run needs: a run keyed on the
   * scene object as well would start once more, with the old pack, in the
   * render where the scene changes and the pack has not yet been let go.
   */
  const [pack, setPack] = useState<{
    pack: IScenePack;
    sceneId: string;
    swatch: readonly string[];
  }>();
  /** The output could not be listened to: the scene has nothing to follow. */
  const [unheard, setUnheard] = useState(false);
  const [still, setStill] = useState<{
    frame: ILightingFrame;
    source: ImageBitmap;
  }>();
  // Nothing to hear is nothing to draw with: the picture holds the desk
  // rather than the page claiming a scene is playing on an empty stage.
  const playing = Boolean(pack) && !unheard && Boolean(capture);
  useLiveAudioCapture(Boolean(pack) && !unheard, 'display');

  const sceneId = scene ? premiumLookId(scene.id) : undefined;
  const sample = scene !== undefined && samples.has(scene.id);

  useEffect(() => {
    setPack(undefined);
    setUnheard(false);
    if (!scene || !sample) {
      return undefined;
    }
    let cancelled = false;
    window.electron?.ipcRenderer
      ?.previewGalleryScene?.(FLUIDEQ_CREATOR_ID, scene.id, scene.version)
      .then((outcome) => {
        if (!cancelled && outcome.ok) {
          setPack({
            pack: outcome.pack,
            sceneId: premiumLookId(scene.id),
            swatch: scene.swatch,
          });
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [scene, sample]);

  useEffect(() => {
    if (!pictureUrl || !sceneId) {
      setStill(undefined);
      return undefined;
    }
    let cancelled = false;
    stillFrame(pictureUrl, sceneId)
      .then((made) => {
        if (cancelled) {
          made?.source.close();
        } else {
          setStill(made);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pictureUrl, sceneId]);

  useEffect(
    () => () => {
      still?.source.close();
    },
    [still],
  );

  // The picture holds the desk whenever the scene is not being drawn on it,
  // and its colours do when there is no picture to be had — signed out, or
  // offline. A desk drawn dark on the page selling a lit desk is no page.
  //
  // Nothing is cleared when the scene starts: its first frame is seconds
  // away while the program links, and the desk keeps the still until it
  // comes rather than going black for the wait.
  useEffect(() => {
    if (playing) {
      return undefined;
    }
    if (!scene || sceneId === undefined) {
      publishLightingPreview(undefined);
      return undefined;
    }
    // Emptied first, in the same turn: the lamps ease from frame to frame,
    // and a single frame after the wash or the scene's last one would leave
    // them one step from where they were — the wash's colours under the
    // picture. An empty frame drops that history, and the one after it
    // lands exactly on its colours. Two publishes in one turn paint once.
    let cancelled = false;
    if (still) {
      // A copy per publish: the preview channel closes the picture it
      // replaces, and this frame is published again whenever the page is.
      createImageBitmap(still.source)
        .then((copy) => {
          if (cancelled) {
            copy.close();
          } else {
            publishLightingPreview(undefined);
            publishLightingPreview(still.frame, copy);
          }
          return undefined;
        })
        .catch(() => undefined);
    } else {
      publishLightingPreview(undefined);
      publishLightingPreview(washFrame(scene.swatch, sceneId));
    }
    return () => {
      cancelled = true;
    };
  }, [playing, still, scene, sceneId]);

  // The page closing gives the desk back: the feed it fed is gone with it.
  useEffect(() => () => publishLightingPreview(undefined), []);

  useEffect(() => {
    if (!pack || unheard || !capture) {
      return undefined;
    }
    const player = playLampScene({
      pack: pack.pack,
      sceneId: pack.sceneId,
      guarded: false,
      capture,
      isPaused: () => pausedRef.current,
      profile: () => DEFAULT_LIGHTING_PROFILE,
      swatch: pack.swatch,
      onFrame: publishLightingPreview,
      onCannotHear: () => setUnheard(true),
    });
    return () => player.close();
  }, [pack, unheard, capture]);

  if (playing) {
    return { state: 'playing' };
  }
  return sceneId === undefined ? { state: 'dark' } : { state: 'still' };
};
