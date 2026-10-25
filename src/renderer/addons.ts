import { useSyncExternalStore, type ComponentType } from 'react';
import type { IGalleryScene } from 'common/plusGallery';

/**
 * The window's slots for an add-on: code a developer keeps in their own
 * checkout (`addons/<name>/renderer`) and never ships.
 *
 * Nothing here knows any add-on. The development renderer loads each
 * add-on's entry ahead of the app (`webpack.config.renderer.dev.ts`), and the
 * entry calls `registerRendererAddon`; the release renderer is built from the
 * app's own entry alone, so no add-on can reach it. With none registered,
 * every slot below is empty and the app is exactly the one that ships.
 */

/** A place an add-on adds to the Plus tab's rail. */
export type TAddonPlace = `addon:${string}`;

export const isAddonPlace = (value: unknown): value is TAddonPlace =>
  typeof value === 'string' && /^addon:[a-z0-9-]+$/.test(value);

export interface IAddonRailProps {
  accountId: string;
  /** The place open now, the app's own or an add-on's. */
  activePlace: string;
  openPlace: (place: TAddonPlace) => void;
}

export interface IAddonPlaceProps {
  place: TAddonPlace;
  accountId: string;
}

export interface IAddonScenePageProps {
  scene: IGalleryScene;
  /** The scene's name as the page shows it. */
  name: string;
  /** What the add-on opened the page with (`openGalleryPage`), if it did. */
  context: unknown;
}

/** What an add-on can say about the signed-in account. */
export interface IAddonCapabilities {
  /** The account publishes FluidEQ's own scenes, which are then its own. */
  ownsOfficialScenes: boolean;
  /** Its publications go out without waiting for review. */
  publishesWithoutReview: boolean;
}

const NO_CAPABILITIES: IAddonCapabilities = {
  ownsOfficialScenes: false,
  publishesWithoutReview: false,
};

export interface IAddonCapabilitySource {
  subscribe: (listener: () => void) => () => void;
  get: () => Partial<IAddonCapabilities>;
}

export interface IRendererAddon {
  name: string;
  /** Places of its own, offered in the rail by `RailPlaces`. */
  places?: readonly TAddonPlace[];
  /** Its entries in the Plus tab's rail, under the app's own places. */
  RailPlaces?: ComponentType<IAddonRailProps>;
  /** Beside the member's handle at the foot of the rail. */
  AccountBadge?: ComponentType;
  /** One of its places, open. */
  Place?: ComponentType<IAddonPlaceProps>;
  /** Mounted at the app root beside the app's own corner notices. */
  Notices?: ComponentType;
  /** Shown on a gallery scene's page under its head. */
  SceneHeadExtras?: ComponentType<IAddonScenePageProps>;
  /** Shown on a gallery scene's page with its actions. */
  SceneActionExtras?: ComponentType<IAddonScenePageProps>;
  /** Whether a page it opened with this context leaves out "Report". */
  hidesSceneReport?: (context: unknown) => boolean;
  capabilities?: IAddonCapabilitySource;
  /** The Plus tab opened, or another account signed in: ask again. */
  refresh?: (accountId: string | undefined) => void;
}

const addons: IRendererAddon[] = [];
const listeners = new Set<() => void>();
let capabilities: IAddonCapabilities = NO_CAPABILITIES;

const combine = (): IAddonCapabilities =>
  addons.reduce<IAddonCapabilities>((all, addon) => {
    const own = addon.capabilities?.get() ?? {};
    return {
      ownsOfficialScenes:
        all.ownsOfficialScenes || own.ownsOfficialScenes === true,
      publishesWithoutReview:
        all.publishesWithoutReview || own.publishesWithoutReview === true,
    };
  }, NO_CAPABILITIES);

const recombine = () => {
  const next = combine();
  if (
    next.ownsOfficialScenes !== capabilities.ownsOfficialScenes ||
    next.publishesWithoutReview !== capabilities.publishesWithoutReview
  ) {
    capabilities = next;
    listeners.forEach((listener) => listener());
  }
};

/** Called by an add-on's renderer entry, once, before the app renders. */
export const registerRendererAddon = (addon: IRendererAddon) => {
  addons.push(addon);
  addon.capabilities?.subscribe(recombine);
  recombine();
};

/** The add-ons loaded: none in any build that ships. */
export const rendererAddons = (): readonly IRendererAddon[] => addons;

/** The place an add-on opens, or nothing when none offers it. */
export const addonForPlace = (place: string): IRendererAddon | undefined =>
  addons.find((addon) => addon.places?.some((own) => own === place));

export const refreshAddons = (accountId: string | undefined) =>
  addons.forEach((addon) => addon.refresh?.(accountId));

export const addonsHideSceneReport = (context: unknown) =>
  context !== undefined &&
  addons.some((addon) => addon.hidesSceneReport?.(context) === true);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getCapabilities = () => capabilities;

export const useAddonCapabilities = (): IAddonCapabilities =>
  useSyncExternalStore(subscribe, getCapabilities, getCapabilities);

/** For tests: no add-on between runs. */
export const resetRendererAddons = () => {
  addons.length = 0;
  capabilities = NO_CAPABILITIES;
  listeners.clear();
};
