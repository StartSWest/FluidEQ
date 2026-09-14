/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { FLUIDEQ_CREATOR_ID, type IGalleryScene } from 'common/plusGallery';
import type { TLocalizedName } from 'common/scenePacks';
import { findGalleryScene } from '../plus/galleryStore';
import { markSceneVersionSeen } from '../utils/seenSceneVersions';

/**
 * The one notice the graph gives when the Plus look it is playing arrives at a
 * new version: its name, the version, what its maker wrote, and the scene's
 * gallery entry for "See what's new" when there is one to open.
 *
 * Raised from the moment the new version is played, not from when it was
 * downloaded: the listener hears about the change while looking at it.
 */

export interface ISceneUpdateNotice {
  ok: true;
  names: TLocalizedName;
  version: number;
  note?: string;
  scene?: IGalleryScene;
}

export interface IPlayedScene {
  lookId: string;
  version: number;
  names: TLocalizedName;
  /** Undefined for FluidEQ's own scenes. */
  authorId?: string;
}

let notice: ISceneUpdateNotice | undefined;
const listeners = new Set<() => void>();

const publish = (next: ISceneUpdateNotice) => {
  notice = next;
  listeners.forEach((listener) => listener());
};

/**
 * The gallery's entry for this version of the scene: the one already loaded
 * when the gallery was open this session, otherwise its maker's newest page.
 */
const galleryEntry = async (
  played: IPlayedScene,
): Promise<IGalleryScene | undefined> => {
  const known = findGalleryScene(played.lookId);
  if (known?.version === played.version) {
    return known;
  }
  const listed = await window.electron?.ipcRenderer
    ?.listGallery?.({
      sort: 'new',
      authorId: played.authorId ?? FLUIDEQ_CREATOR_ID,
    })
    .catch(() => undefined);
  return listed?.ok
    ? listed.scenes.find(
        (entry) =>
          entry.lookId === played.lookId && entry.version === played.version,
      )
    : undefined;
};

/**
 * `played` just became the drawn scene. Remembers its version, and when the
 * one played before here was older, raises the notice.
 */
export const reportScenePlayed = async (played: IPlayedScene) => {
  const before = markSceneVersionSeen(played.lookId, played.version);
  if (before === undefined) {
    return;
  }
  const scene = await galleryEntry(played);
  publish({
    ok: true,
    names: scene?.names ?? played.names,
    version: played.version,
    ...(scene?.versionNote ? { note: scene.versionNote } : {}),
    ...(scene ? { scene } : {}),
  });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSceneUpdateNotice = () =>
  useSyncExternalStore(
    subscribe,
    () => notice,
    () => undefined,
  );
