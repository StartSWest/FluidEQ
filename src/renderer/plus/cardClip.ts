import { useEffect, useState, useSyncExternalStore } from 'react';
import type { IGalleryScene } from 'common/plusGallery';
import useReducedMotion from '../utils/useReducedMotion';

/**
 * A gallery card's published clip, played while the card is hovered or
 * focused (Ivan, 2026-11-13: "add hover and play the video only not the
 * scene"). The ten silent, watermarked seconds the Studio recorded when the
 * scene was published — never the scene itself: a hover starts no scene
 * worker and no GL context, on a card or anywhere else.
 *
 * Cheap by construction, because a grid can hold sixty cards:
 * - nothing is asked for until a card is hovered, and the answer is used only
 *   if the card is still the one hovered when it lands — a pointer that only
 *   passed over leaves nothing playing, without a timer to guess how long
 *   "passing" is;
 * - one card plays at a time: hovering or focusing another stops the first;
 * - leaving a card drops its video and revokes its bytes, so a long grid never
 *   holds a decoder per card;
 * - a scene that has no clip (published before clips, or an official one
 *   without) is remembered as such for this account and session, so hovering
 *   it again asks nothing.
 * Main keeps every clip it fetched on disk by version, so a card hovered twice
 * downloads once.
 */

/** Which card holds the one playing slot; each card's own token. */
let holder: symbol | undefined;
const listeners = new Set<() => void>();

const announce = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const currentHolder = () => holder;

/** The card takes the playing slot; whichever had it stops. */
export const claimCardClip = (card: symbol) => {
  if (holder !== card) {
    holder = card;
    announce();
  }
};

/** The card gives the slot up, if it still has it. */
export const releaseCardClip = (card: symbol) => {
  if (holder === card) {
    holder = undefined;
    announce();
  }
};

/** Scenes asked for and found to have no clip, by account and version. */
const withoutClip = new Set<string>();

const clipKey = (
  me: string | undefined,
  scene: Pick<IGalleryScene, 'authorId' | 'sceneId' | 'version'>,
) => `${me ?? ''}|${scene.authorId}/${scene.sceneId}@${scene.version}`;

/**
 * Whether the scene was asked for and found to have no clip, as a value that
 * changes when the answer lands: a look picker tile holding one of the few
 * clip slots gives it up for a tile with something to play
 * (`lookTileClips.tsx`).
 */
export const useKnownWithoutClip = (
  scene: Pick<ISceneClipRef, 'authorId' | 'sceneId' | 'version'> | undefined,
  me: string | undefined,
): boolean =>
  useSyncExternalStore(
    subscribe,
    () => scene !== undefined && withoutClip.has(clipKey(me, scene)),
  );

/** For tests: forget the slot and every remembered "no clip". */
export const resetCardClips = () => {
  holder = undefined;
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
 * a look picker tile both play through it (`useCardClip`, `lookTileClips.tsx`).
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

/**
 * The clip's object URL while this card is hovered or focused, holds the
 * playing slot, motion is welcome and the scene has a clip; undefined
 * otherwise.
 */
export const useCardClip = (
  scene: Pick<IGalleryScene, 'authorId' | 'sceneId' | 'version' | 'updatedAt'>,
  me: string | undefined,
  card: symbol,
  wanted: boolean,
): string | undefined => {
  const playing = useSyncExternalStore(subscribe, currentHolder) === card;
  return useSceneClip(scene, me, wanted && playing);
};
