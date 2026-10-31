import { createContext, useContext, useEffect, useState } from 'react';
import type { IGalleryScene } from 'common/plusGallery';

/**
 * Every picture in the gallery is the real scene.
 *
 * Only the captured photograph is requested. A missing/failed photo never
 * falls back to downloading and rendering the full scene, including official
 * scenes. That would hand unowned source to clients merely browsing cards.
 */

export type TScenePicture =
  | { state: 'loading' }
  | { state: 'ready'; url: string }
  /** Nothing could be downloaded or drawn. */
  | { state: 'none' };

type TSceneRef = Pick<
  IGalleryScene,
  'lookId' | 'authorId' | 'sceneId' | 'version'
> &
  Partial<Pick<IGalleryScene, 'updatedAt'>>;

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

const bridge = () => window.electron?.ipcRenderer;

const pictureKey = (scene: TSceneRef) =>
  `${scene.lookId}@${scene.version}:${scene.updatedAt ?? ''}`;

const pictureOf = (scene: TSceneRef) => {
  const key = pictureKey(scene);
  const asked = inFlight.get(key);
  if (asked) {
    return asked;
  }
  const request = (async () => {
    const published = await bridge()
      ?.galleryPicture?.(
        scene.authorId,
        scene.sceneId,
        scene.version,
        scene.updatedAt,
      )
      .catch(() => undefined);
    if (published !== undefined) {
      return published;
    }
    return undefined;
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
 * Pictures already in hand, by look id, shown as they are and never drawn or
 * fetched: Help draws the gallery from made-up scenes and the stills the app
 * ships (`help/live/plusFigures`). Empty everywhere else.
 */
export const SceneStillsContext = createContext<ReadonlyMap<string, string>>(
  new Map(),
);

/**
 * A scene's picture, asked for once `element` is near the screen, so a page
 * of sixty cards fetches the dozen that are visible first.
 */
export const useScenePicture = (
  scene: TSceneRef,
  element: Element | null,
): TScenePicture => {
  const key = pictureKey(scene);
  const still = useContext(SceneStillsContext).get(scene.lookId);
  const [picture, setPicture] = useState<TScenePicture>(() =>
    asPicture(still ?? pictures.get(key)),
  );

  useEffect(() => {
    const known = still ?? pictures.get(key);
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
    // without it. A picture in hand is named on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, element, still]);

  return picture;
};

/** For tests: a clean module between runs. */
export const resetScenePictures = () => {
  pictures.clear();
  inFlight.clear();
};
