/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { IScenePack } from 'common/scenePacks';
import { isSceneRenderingAvailable } from './sceneHealth';
import { blobAsDataUrl, renderSceneStill } from './sceneStill';

/**
 * A Plus visualizer's picture, for its row in the graph's picker.
 *
 * The picture its maker published when the gallery has one — for the official
 * collection that is the frame chosen in the Studio, which says more than any
 * frame picked here — and otherwise a frame drawn from the scene installed on
 * this computer, in the same worker and under the same showcase signal the
 * gallery uses. A scene that is neither published nor installed (a member's
 * scene while the membership is off) has no picture, and its row keeps the
 * swatch glyph.
 *
 * Drawn one at a time and only for rows scrolled near the list's own edge, so
 * opening a picker of forty scenes starts with the half-dozen on screen.
 */

export interface ILookThumbnailRef {
  lookId: string;
  /** Moves with the scene, so a new version is pictured again. */
  version: string;
  /** Where the gallery keeps the picture its maker published, if anywhere. */
  published?: {
    authorId: string;
    sceneId: string;
    version: number;
    revision?: string;
  };
  /** The scene installed on this computer, when it is. */
  load?: () => Promise<IScenePack | undefined>;
}

export type TLookThumbnail =
  { state: 'loading' } | { state: 'ready'; url: string } | { state: 'none' };

/** Pictures by scene version: a data URL, or null for a scene with none. */
const pictures = new Map<string, string | null>();

/**
 * Kept here at most, the longest-kept going first. A few hundred kilobytes of
 * text each, as the gallery's are.
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

const inFlight = new Map<string, Promise<string | null>>();
/** Frames are drawn one after another; this is the end of the line. */
let drawing: Promise<unknown> = Promise.resolve();

const keyOf = (ref: ILookThumbnailRef) => `${ref.lookId}@${ref.version}`;

const drawFrame = (
  load: () => Promise<IScenePack | undefined>,
): Promise<string | null> => {
  const turn = drawing.then(async () => {
    if (!isSceneRenderingAvailable()) {
      return null;
    }
    const pack = await load();
    if (!pack) {
      return null;
    }
    const blob = await renderSceneStill(pack);
    return blob ? blobAsDataUrl(blob) : null;
  });
  const settled = turn.catch(() => null);
  drawing = settled;
  return settled;
};

const pictureOf = (ref: ILookThumbnailRef): Promise<string | null> => {
  const key = keyOf(ref);
  const asked = inFlight.get(key);
  if (asked) {
    return asked;
  }
  const request = (async () => {
    const { published, load } = ref;
    const url = published
      ? await window.electron?.ipcRenderer
          ?.galleryPicture?.(
            published.authorId,
            published.sceneId,
            published.version,
            published.revision,
          )
          .catch(() => undefined)
      : undefined;
    if (url) {
      return url;
    }
    return load ? drawFrame(load) : null;
  })().then((result) => {
    inFlight.delete(key);
    keep(key, result);
    return result;
  });
  inFlight.set(key, request);
  return request;
};

const asThumbnail = (value: string | null | undefined): TLookThumbnail => {
  if (value === undefined) {
    return { state: 'loading' };
  }
  return value === null ? { state: 'none' } : { state: 'ready', url: value };
};

/**
 * A scene's picture, asked for once `element` comes near the visible part of
 * the list it scrolls in.
 */
export const useLookThumbnail = (
  ref: ILookThumbnailRef,
  element: Element | null,
): TLookThumbnail => {
  const key = keyOf(ref);
  const [thumbnail, setThumbnail] = useState<TLookThumbnail>(() =>
    asThumbnail(pictures.get(key)),
  );

  useEffect(() => {
    const known = pictures.get(key);
    setThumbnail(asThumbnail(known));
    if (known !== undefined || !element) {
      return undefined;
    }
    let cancelled = false;
    const ask = () => {
      pictureOf(ref)
        .then((result) => {
          if (!cancelled) {
            setThumbnail(asThumbnail(result));
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
    // The list's own box rather than the window: a row scrolled out of the
    // list is still inside the window, and would be asked for with the rest.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          ask();
        }
      },
      {
        root: element.closest('[data-look-picker-scroll]'),
        rootMargin: '160px 0px',
      },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // The key names the scene's version; nothing else in `ref` changes
    // without it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, element]);

  return thumbnail;
};

/** For tests: a clean module between runs. */
export const resetLookThumbnails = () => {
  pictures.clear();
  inFlight.clear();
  drawing = Promise.resolve();
};
