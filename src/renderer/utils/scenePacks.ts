import { useSyncExternalStore } from 'react';
import type { IScenePack, IScenePackCatalogueEntry } from 'common/scenePacks';
import { lockedLookId, premiumLookId } from 'common/scenePacks';
import type { IScenePacksListing } from 'main/ipc/scenePacks';
import type { IScenePackSummary, TSceneFailure } from 'main/scenePackStore';
import { isSceneRenderingAvailable } from '../graph/sceneHealth';

/**
 * The premium looks this machine holds, as the renderer sees them.
 *
 * A module store, like the custom looks beside it. Summaries only: a shader's
 * source crosses from the main process when a scene is about to be drawn, and
 * not before — the picker does not need sixty kilobytes of GLSL to draw a row.
 *
 * "Usable" is decided here, once, from three facts: the account is entitled,
 * the main process has not quarantined the pack, and this machine can run a
 * scene at all. Everything that offers a premium look — the picker, the
 * arrows, Space, the click on the plot and the auto-cycle — reads that one list
 * through `getSelectableLooks`, so a look that cannot draw is never offered
 * anywhere.
 */

export interface IUsableScene {
  id: string;
  version: number;
  revision?: string;
  lookId: string;
  names: IScenePackSummary['names'];
  fallbackStyle: IScenePackSummary['fallbackStyle'];
  swatch: string[];
  spectrumRange?: IScenePack['spectrumRange'];
}

/**
 * A Plus look this account cannot draw, shown in the picker anyway.
 *
 * Its `lookId` carries the locked prefix, so it is never a selection: choosing
 * the row opens the upgrade card and the current look stays where it is. Same
 * fields as a usable scene otherwise, because the row is painted the same way.
 */
export interface ILockedScene {
  id: string;
  lookId: string;
  names: IScenePackCatalogueEntry['names'];
  fallbackStyle: IScenePackCatalogueEntry['fallbackStyle'];
  swatch: string[];
}

const EMPTY: IScenePacksListing = { entitled: false, packs: [], locked: [] };

let listing: IScenePacksListing = EMPTY;
/** Whether the main process has answered at least once. */
let loaded = false;
/**
 * Scenes this renderer found it could not run — a context lost, a compile
 * that failed — kept here until the main process confirms a quarantine or a
 * new version arrives. Renderer-local so the fallback is immediate.
 */
const blocked = new Set<string>();
let subscribed = false;
const listeners = new Set<() => void>();
let usable: IUsableScene[] = [];
let locked: ILockedScene[] = [];

const bridge = () => window.electron?.ipcRenderer;

const recompute = () => {
  // Neither list exists on a machine that cannot run a scene: a locked row
  // that would still not draw after paying is a promise the app cannot keep.
  const canDraw = isSceneRenderingAvailable();
  usable =
    listing.entitled && canDraw
      ? listing.packs
          .filter((pack) => !pack.quarantined && !blocked.has(pack.id))
          .map((pack) => ({
            id: pack.id,
            version: pack.version,
            revision: pack.revision,
            lookId: premiumLookId(pack.id),
            names: pack.names,
            fallbackStyle: pack.fallbackStyle,
            swatch: pack.swatch,
            ...(pack.spectrumRange
              ? { spectrumRange: pack.spectrumRange }
              : {}),
          }))
      : [];
  locked =
    !listing.entitled && canDraw
      ? listing.locked.map((entry) => ({
          id: entry.id,
          lookId: lockedLookId(entry.id),
          names: entry.names,
          fallbackStyle: entry.fallbackStyle,
          swatch: entry.swatch,
        }))
      : [];
};

const publish = () => {
  recompute();
  listeners.forEach((listener) => listener());
};

const adopt = (next: IScenePacksListing) => {
  listing = next;
  loaded = true;
  // A new version of a pack gets its chance again; the main process has
  // already released its quarantine on adopt.
  next.packs.forEach((pack) => {
    if (!pack.quarantined) {
      blocked.delete(pack.id);
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
    ?.listScenePacks?.()
    .then(adopt)
    .catch(() => {
      // No backend, or no handler. Nothing premium is already the state.
    });
  return api?.onScenePacksChanged?.(adopt) ?? (() => {});
};

let stop: () => void = () => {};

export const subscribeScenePacks = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getScenePackListing = (): IScenePacksListing => listing;
export const isScenePackListingLoaded = (): boolean => loaded;
export const getUsableScenes = (): readonly IUsableScene[] => usable;
export const getUsableScene = (packId: string): IUsableScene | undefined =>
  usable.find((scene) => scene.id === packId);
export const getScenePackSummary = (
  packId: string,
): IScenePackSummary | undefined =>
  listing.packs.find((pack) => pack.id === packId);

export const useUsableScenes = (): readonly IUsableScene[] =>
  useSyncExternalStore(subscribeScenePacks, getUsableScenes, getUsableScenes);

export const getLockedScenes = (): readonly ILockedScene[] => locked;

export const useLockedScenes = (): readonly ILockedScene[] =>
  useSyncExternalStore(subscribeScenePacks, getLockedScenes, getLockedScenes);

export const loadScenePack = async (
  packId: string,
): Promise<IScenePack | undefined> => bridge()?.loadScenePack?.(packId);

/**
 * This scene will not run here. Stops offering it at once, then tells the main
 * process so the answer survives a restart.
 */
export const reportSceneFailure = async (
  packId: string,
  reason: TSceneFailure,
): Promise<void> => {
  if (!blocked.has(packId)) {
    blocked.add(packId);
    publish();
  }
  await bridge()?.reportScenePackFailure?.(packId, reason);
};

/**
 * This scene will not run here RIGHT NOW — the machine is too slow for it, or
 * no context could be had. Falls back for this session only; nothing is told
 * to the main process and nothing is written down, so the next launch tries
 * again. Compare `reportSceneFailure`, which is for a pack that is broken.
 */
export const blockScene = (packId: string) => {
  if (!blocked.has(packId)) {
    blocked.add(packId);
    publish();
  }
};

/** A context came back. The scene may be tried again. */
export const unblockScene = (packId: string) => {
  if (blocked.delete(packId)) {
    publish();
  }
};

export const refreshScenePacks = async (localOnly = false) => {
  const next = localOnly
    ? await bridge()?.listScenePacks?.()
    : await bridge()?.refreshScenePacks?.();
  if (next) {
    adopt(next);
  }
};

/** For tests: a clean module between runs. */
export const resetScenePackStore = () => {
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
export const adoptScenePackListingForTesting = (next: IScenePacksListing) =>
  adopt(next);
