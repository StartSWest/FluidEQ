import { useEffect, useState } from 'react';
import type { IGalleryScene } from 'common/plusGallery';
import { isSceneRenderingAvailable } from '../graph/sceneHealth';
import { blobAsDataUrl, renderSceneStill } from '../graph/sceneStill';

/**
 * Every picture in the gallery is the real scene.
 *
 * A published scene carries the picture its maker took in the Studio, and
 * that is what a card shows. A scene without one — a development sample, or
 * a picture that would not download — gets a frame drawn here from the scene
 * itself, under the same showcase signal the Studio uses, so the gallery
 * never shows a drawing standing in for a scene. Those are drawn one at a
 * time, on one shared context, and only for cards near the screen.
 */

export type TScenePicture =
  | { state: 'loading' }
  | { state: 'ready'; url: string }
  /** Nothing could be downloaded or drawn. */
  | { state: 'none' };

type TSceneRef = Pick<
  IGalleryScene,
  'lookId' | 'authorId' | 'sceneId' | 'version'
>;

/** Pictures by scene version: a data URL, or null for one that cannot draw. */
const pictures = new Map<string, string | null>();

/**
 * Pictures kept here at most. Each is a few hundred kilobytes of text; past
 * this the longest-kept go first, and a card that scrolls back asks the main
 * process, which keeps its own.
 */
const MAX_PICTURES = 120;

const keep = (key: string, picture: string | null) => {
  pictures.delete(key);
  pictures.set(key, picture);
  while (pictures.size > MAX_PICTURES) {
    const [oldest] = pictures.keys();
    pictures.delete(oldest);
  }
};
const inFlight = new Map<string, Promise<string | null | undefined>>();
/** Frames are drawn one after another; this is the end of the line. */
let drawing: Promise<unknown> = Promise.resolve();

const bridge = () => window.electron?.ipcRenderer;

const pictureKey = (scene: TSceneRef) => `${scene.lookId}@${scene.version}`;

/**
 * A frame of the scene itself, drawn in turn. Undefined when the scene could
 * not be had — worth asking again later; null when it came and would not
 * draw, which the same scene will not do differently this session.
 */
const drawFrame = (scene: TSceneRef): Promise<string | null | undefined> => {
  const turn = drawing.then(async () => {
    const outcome = await bridge()?.previewGalleryScene?.(
      scene.authorId,
      scene.sceneId,
      scene.version,
    );
    if (!outcome?.ok) {
      return undefined;
    }
    if (!isSceneRenderingAvailable()) {
      return null;
    }
    const blob = await renderSceneStill(outcome.pack);
    return blob ? blobAsDataUrl(blob) : null;
  });
  const settled = turn.catch(() => undefined);
  drawing = settled;
  return settled;
};

const pictureOf = (scene: TSceneRef) => {
  const key = pictureKey(scene);
  const asked = inFlight.get(key);
  if (asked) {
    return asked;
  }
  const request = (async () => {
    const published = await bridge()
      ?.galleryPicture?.(scene.authorId, scene.sceneId, scene.version)
      .catch(() => undefined);
    return published ?? drawFrame(scene);
  })().then((result) => {
    inFlight.delete(key);
    if (result !== undefined) {
      keep(key, result);
    }
    return result;
  });
  inFlight.set(key, request);
  return request;
};

const asPicture = (value: string | null | undefined): TScenePicture => {
  if (value === undefined) {
    return { state: 'loading' };
  }
  return value === null ? { state: 'none' } : { state: 'ready', url: value };
};

/**
 * A scene's picture, asked for once `element` is near the screen, so a page
 * of sixty cards fetches the dozen that are visible first.
 */
export const useScenePicture = (
  scene: TSceneRef,
  element: Element | null,
): TScenePicture => {
  const key = pictureKey(scene);
  const [picture, setPicture] = useState<TScenePicture>(() =>
    asPicture(pictures.get(key)),
  );

  useEffect(() => {
    const known = pictures.get(key);
    setPicture(asPicture(known));
    if (known !== undefined || !element) {
      return undefined;
    }
    let cancelled = false;
    const ask = () => {
      pictureOf(scene)
        .then((result) => {
          if (!cancelled) {
            // A picture that could not be had shows as none now, and is
            // asked for again the next time the card is on screen.
            setPicture(
              result === undefined ? { state: 'none' } : asPicture(result),
            );
          }
          return undefined;
        })
        .catch(() => undefined);
    };
    if (typeof IntersectionObserver === 'undefined') {
      ask();
      return () => {
        cancelled = true;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          ask();
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // The key names the scene's version; the ids inside it do not change
    // without it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, element]);

  return picture;
};

/** For tests: a clean module between runs. */
export const resetScenePictures = () => {
  pictures.clear();
  inFlight.clear();
  drawing = Promise.resolve();
};
