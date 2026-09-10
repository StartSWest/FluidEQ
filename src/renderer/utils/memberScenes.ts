import { useSyncExternalStore } from 'react';
import { lockedLookId, type IScenePack } from 'common/scenePacks';
import type { IMemberScenesListing } from 'main/ipc/memberScenes';
import type { IMemberSceneSummary } from 'main/memberScenes/store';
import type { TSceneFailure } from 'main/scenePackStore';
import { isSceneRenderingAvailable } from '../graph/sceneHealth';

/**
 * The scenes this member made, as the renderer sees them.
 *
 * The same shape as the Plus looks' store beside it, and for the same reasons:
 * summaries only until a scene is about to draw, and "usable" decided here,
 * once — the account has Plus, the main process has not quarantined it, this
 * renderer has not blocked it, and this machine can run a scene at all — so a
 * scene that cannot draw is never offered anywhere a look is offered.
 */

export interface IUsableMemberScene {
  kind: 'member';
  lookId: string;
  authorId: string;
  packId: string;
  version: number;
  names: IMemberSceneSummary['names'];
  fallbackStyle: IMemberSceneSummary['fallbackStyle'];
  swatch: string[];
  spectrumRange?: IScenePack['spectrumRange'];
  own: boolean;
}

/** A scene the member made, while their membership is off. Never a selection. */
export interface ILockedMemberScene {
  lookId: string;
  names: IMemberSceneSummary['names'];
  fallbackStyle: IMemberSceneSummary['fallbackStyle'];
  swatch: string[];
}

const EMPTY: IMemberScenesListing = { entitled: false, scenes: [], locked: [] };

let listing: IMemberScenesListing = EMPTY;
let loaded = false;
const blocked = new Set<string>();
let subscribed = false;
const listeners = new Set<() => void>();
let usable: IUsableMemberScene[] = [];
let locked: ILockedMemberScene[] = [];

const bridge = () => window.electron?.ipcRenderer;

const recompute = () => {
  const canDraw = isSceneRenderingAvailable();
  usable =
    listing.entitled && canDraw
      ? listing.scenes
          .filter((scene) => !scene.quarantined && !blocked.has(scene.lookId))
          .map((scene) => ({
            kind: 'member' as const,
            lookId: scene.lookId,
            authorId: scene.authorId,
            packId: scene.packId,
            version: scene.version,
            names: scene.names,
            fallbackStyle: scene.fallbackStyle,
            swatch: scene.swatch,
            own: scene.own,
            ...(scene.spectrumRange
              ? { spectrumRange: scene.spectrumRange }
              : {}),
          }))
      : [];
  locked =
    !listing.entitled && canDraw
      ? listing.locked.map((scene) => ({
          // The Plus looks' locked prefix, so the picker treats both the same:
          // choosing one opens the Plus card and no selection lands on it.
          lookId: lockedLookId(scene.lookId),
          names: scene.names,
          fallbackStyle: scene.fallbackStyle,
          swatch: scene.swatch,
        }))
      : [];
};

const publish = () => {
  recompute();
  listeners.forEach((listener) => listener());
};

const adopt = (next: IMemberScenesListing) => {
  listing = next;
  loaded = true;
  // A new save lifts a quarantine in the main process; lift the local block
  // with it, so the fix is tried.
  next.scenes.forEach((scene) => {
    if (!scene.quarantined) {
      blocked.delete(scene.lookId);
    }
  });
  publish();
};

const start = () => {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;
  const api = bridge();
  api
    ?.listMemberScenes?.()
    .then(adopt)
    .catch(() => {
      // No backend, or no handler: no member scenes is already the state.
    });
  return api?.onMemberScenesChanged?.(adopt) ?? (() => {});
};

let stop: () => void = () => {};

export const subscribeMemberScenes = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isMemberSceneListingLoaded = (): boolean => loaded;
export const getUsableMemberScenes = (): readonly IUsableMemberScene[] =>
  usable;
export const getUsableMemberScene = (
  lookId: string,
): IUsableMemberScene | undefined =>
  usable.find((scene) => scene.lookId === lookId);
export const getMemberSceneSummary = (
  lookId: string,
): IMemberSceneSummary | undefined =>
  [...listing.scenes, ...listing.locked].find(
    (scene) => scene.lookId === lookId,
  );
export const getLockedMemberScenes = (): readonly ILockedMemberScene[] =>
  locked;

export const useUsableMemberScenes = (): readonly IUsableMemberScene[] =>
  useSyncExternalStore(
    subscribeMemberScenes,
    getUsableMemberScenes,
    getUsableMemberScenes,
  );

export const useLockedMemberScenes = (): readonly ILockedMemberScene[] =>
  useSyncExternalStore(
    subscribeMemberScenes,
    getLockedMemberScenes,
    getLockedMemberScenes,
  );

export const loadMemberScene = async (
  lookId: string,
): Promise<IScenePack | undefined> => bridge()?.loadMemberScene?.(lookId);

/** The scene itself failed here: stop offering it now, and remember why. */
export const reportMemberSceneFailure = async (
  lookId: string,
  reason: TSceneFailure,
): Promise<void> => {
  if (!blocked.has(lookId)) {
    blocked.add(lookId);
    publish();
  }
  await bridge()?.reportMemberSceneFailure?.(lookId, reason);
};

/** This machine cannot run it right now. This session only. */
export const blockMemberScene = (lookId: string) => {
  if (!blocked.has(lookId)) {
    blocked.add(lookId);
    publish();
  }
};

/** For tests: a clean module between runs. */
export const resetMemberSceneStore = () => {
  stop();
  stop = () => {};
  subscribed = false;
  listeners.clear();
  blocked.clear();
  listing = EMPTY;
  loaded = false;
  recompute();
};

/** For tests: hand the store a listing without an IPC bridge. */
export const adoptMemberSceneListingForTesting = (next: IMemberScenesListing) =>
  adopt(next);
