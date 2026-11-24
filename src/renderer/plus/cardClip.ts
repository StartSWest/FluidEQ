import { useEffect, useState, useSyncExternalStore } from 'react';
import type { IGalleryScene } from 'common/plusGallery';
import useReducedMotion from '../utils/useReducedMotion';

/**
 * A published scene's clip: the ten silent, watermarked seconds the Studio
 * recorded when the scene was published (Ivan, 2026-11-13: "add hover and
 * play the video only not the scene") - never the scene itself, so a
 * playing card or tile starts no scene worker and no GL context. Which of
 * them play is `clipSlots.tsx`'s: those in view, within a bound.
 *
 * Cheap by construction, because a grid can hold sixty cards:
 * - nothing is asked for until a tile may play, and the answer is used only
 *   if it still may when it lands - a tile that only passed through the view
 *   leaves nothing playing, without a timer to guess how long "passing" is;
 * - a tile that stops playing drops its video and revokes its bytes, so a
 *   long grid never holds a decoder per card;
 * - a scene that has no clip (published before clips, or an official one
 *   without) is remembered as such for this account and session, so it is
 *   not asked again and takes no slot.
 * Main keeps every clip it fetched on disk by version, so a clip seen twice
 * downloads once.
 */

const listeners = new Set<() => void>();

const announce = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Scenes asked for and found to have no clip, by account and version. */
const withoutClip = new Set<string>();

const clipKey = (
  me: string | undefined,
  scene: Pick<IGalleryScene, 'authorId' | 'sceneId' | 'version'>,
) => `${me ?? ''}|${scene.authorId}/${scene.sceneId}@${scene.version}`;

/**
 * Whether the scene was asked for and found to have no clip, as a value that
 * changes when the answer lands: a tile holding one of the few clip slots
 * gives it up for one with something to play (`clipSlots.tsx`).
 */
export const useKnownWithoutClip = (
  scene: Pick<ISceneClipRef, 'authorId' | 'sceneId' | 'version'> | undefined,
  me: string | undefined,
): boolean =>
  useSyncExternalStore(
    subscribe,
    () => scene !== undefined && withoutClip.has(clipKey(me, scene)),
  );

/** For tests: forget every remembered "no clip". */
export const resetCardClips = () => {
  withoutClip.clear();
  announce();
};

/** A published scene's clip is asked for by these, and kept by version. */
export interface ISceneClipRef {
  authorId: string;
  sceneId: string;
  version: number;
  /** When that version went up; main keeps clips by version alone. */
  updatedAt?: string;
}

/**
 * A published scene's clip as an object URL while `active` holds, motion is
 * welcome and the scene has one; undefined otherwise. Asked for only once
 * active, used only if still active when it lands, and revoked the moment
 * any of that stops being true - so nothing that only passed by keeps a
 * clip, without a timer to guess how long passing takes. A gallery card and
 * a look picker tile both play through it (`GalleryCard`, `lookTileClips.tsx`).
 */
export const useSceneClip = (
  scene: ISceneClipRef | undefined,
  me: string | undefined,
  active: boolean,
): string | undefined => {
  const [url, setUrl] = useState<string>();
  const authorId = scene?.authorId;
  const sceneId = scene?.sceneId;
  const version = scene?.version;
  const updatedAt = scene?.updatedAt;
  // Followed while the clip plays: Animations off takes every clip away at
  // once, on a tile and on a gallery card alike, and on again lets the ones
  // still wanted ask again.
  const reduced = useReducedMotion();

  useEffect(() => {
    const ask = window.electron?.ipcRenderer?.galleryClip;
    if (
      authorId === undefined ||
      sceneId === undefined ||
      version === undefined
    ) {
      return undefined;
    }
    const key = clipKey(me, { authorId, sceneId, version });
    if (!active || !ask || withoutClip.has(key) || reduced) {
      return undefined;
    }
    let cancelled = false;
    let made: string | undefined;
    ask(authorId, sceneId, version, updatedAt)
      .then((clip) => {
        if (!clip) {
          withoutClip.add(key);
          announce();
          return undefined;
        }
        if (cancelled) {
          return undefined;
        }
        made = URL.createObjectURL(
          new Blob([new Uint8Array(clip.bytes)], { type: clip.mimeType }),
        );
        setUrl(made);
        return undefined;
      })
      // No clip to be had now: the cover stays, and a later hover asks again.
      .catch(() => undefined);
    return () => {
      cancelled = true;
      setUrl(undefined);
      if (made) {
        URL.revokeObjectURL(made);
      }
    };
  }, [active, reduced, me, authorId, sceneId, version, updatedAt]);

  return url;
};
