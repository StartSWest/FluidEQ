import { useSyncExternalStore } from 'react';
import type {
  IGalleryQuery,
  IGalleryScene,
  TGallerySort,
  TPlusCategory,
} from 'common/plusGallery';
import { isAddonPlace, type TAddonPlace } from '../addons';
import { readStored, removeStored, writeStored } from '../utils/graphStorage';
import { getAccountSnapshot, subscribeAccount } from '../account/accountStore';

/**
 * Where the member is inside the Plus tab: which place in its rail — the
 * Visualizers gallery, the Studio, the lighting, or a place an add-on adds
 * (`renderer/addons.ts`) — and in the gallery which page.
 *
 * Kept outside the components so it outlives them. The tab unmounts whenever
 * another one is chosen in the title bar, and coming back should find the
 * scene or the maker that was open, not the top of the gallery. Kept here
 * too so a gallery page can send the member to the Studio.
 *
 * The place is also remembered across a reload and a restart. The window
 * already reopens on the Plus tab it was left on, and it then always showed
 * the Visualizers, so somebody working in the Studio or on the lighting was
 * sent away from it every time the window reloaded.
 */

export const PLUS_PLACES = ['visualizers', 'studio', 'lighting'] as const;
export type TPlusPlace = (typeof PLUS_PLACES)[number] | TAddonPlace;

const PLACE_KEY = 'fluideq.plusPlace';

const isPlusPlace = (value: unknown): value is TPlusPlace =>
  isAddonPlace(value) ||
  (typeof value === 'string' &&
    (PLUS_PLACES as readonly string[]).includes(value));

/** The place last opened, or the gallery when none was or it is not a place. */
const storedPlace = (): TPlusPlace => {
  const stored = readStored(PLACE_KEY);
  return isPlusPlace(stored) ? stored : 'visualizers';
};

export interface IMakerRef {
  authorId: string;
  name: string | null;
  handle: string | null;
}

export type TGalleryPage =
  | { kind: 'browse' }
  | {
      kind: 'scene';
      scene: IGalleryScene;
      /**
       * The list the scene was opened from, so its page can step to the one
       * before and after it without going back to that list.
       */
      from?: Omit<IGalleryQuery, 'offset'>;
      /**
       * What an add-on opened the page with, for its own part of the page
       * (`ScenePageExtras`); the app never reads it.
       */
      context?: unknown;
      /** Where Back goes instead of the gallery, for a page an add-on opened. */
      onBack?: () => void;
    }
  | { kind: 'maker'; maker: IMakerRef }
  | { kind: 'mine' };

/** A page's own name, for what is remembered about it. */
export const galleryPageKey = (page: TGalleryPage) => {
  switch (page.kind) {
    case 'scene':
      return `scene:${page.scene.lookId}`;
    case 'maker':
      return `maker:${page.maker.authorId}`;
    default:
      return page.kind;
  }
};

/** The gallery's front page as the member left it: sort, category, search. */
export interface IBrowseFilters {
  sort: TGallerySort;
  category?: TPlusCategory;
  text: string;
  /** "Not mine yet": only the scenes this member cannot play yet. */
  notMine?: boolean;
}

interface IPlusNavigation {
  place: TPlusPlace;
  page: TGalleryPage;
  filters: IBrowseFilters;
}

/**
 * The order the gallery opens on, every time it is opened (Ivan, 2026-11-09:
 * "gallery newest is always default"). A member may pick another for the
 * visit — from the list to a scene and back keeps it — and the next visit
 * starts on Newest again; no choice is remembered past the visit.
 */
export const OPENING_SORT: TGallerySort = 'new';

const INITIAL: IPlusNavigation = {
  place: 'visualizers',
  page: { kind: 'browse' },
  filters: { sort: OPENING_SORT, text: '' },
};

/** The filters as a new visit finds them: Newest, the rest as they were. */
const opened = (filters: IBrowseFilters): IBrowseFilters =>
  filters.sort === OPENING_SORT ? filters : { ...filters, sort: OPENING_SORT };

let navigation: IPlusNavigation = { ...INITIAL, place: storedPlace() };
const listeners = new Set<() => void>();
// Reading the account at import time couples otherwise independent startup stores.
let owner: string | undefined;
let stopAccount = () => {};

const publish = (next: IPlusNavigation) => {
  if (next.place !== navigation.place) {
    writeStored(PLACE_KEY, next.place);
  }
  navigation = next;
  listeners.forEach((listener) => listener());
};

const bindAccount = () => {
  const next = getAccountSnapshot().identity?.id;
  if (next !== owner) {
    owner = next;
    // A saved scene page carries the previous account's likes and actions.
    // Keep the chosen workspace (including a guest's Studio destination),
    // but open a fresh gallery page for the next account.
    publish({ ...navigation, page: { kind: 'browse' } });
  }
};

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) {
    stopAccount = subscribeAccount(bindAccount);
    bindAccount();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopAccount();
    }
  };
};

export const usePlusNavigation = (): IPlusNavigation =>
  useSyncExternalStore(
    subscribe,
    () => navigation,
    () => INITIAL,
  );

/** The place open now, for code that is not a component. */
export const plusPlace = (): TPlusPlace => navigation.place;

export const openPlusPlace = (place: TPlusPlace) => {
  bindAccount();
  if (place !== navigation.place) {
    publish({
      ...navigation,
      place,
      // Back to the gallery from the Studio or the lighting is a new visit.
      filters:
        place === 'visualizers'
          ? opened(navigation.filters)
          : navigation.filters,
    });
  }
};

/**
 * The Plus tab opened from the title bar, or the window from a restart: a
 * new visit to whatever place it shows, so the gallery's order is Newest
 * again. The page open in it is kept — coming back finds the scene that was
 * open — and so are its category and search.
 */
export const plusTabOpened = () => {
  bindAccount();
  const filters = opened(navigation.filters);
  if (filters !== navigation.filters) {
    publish({ ...navigation, filters });
  }
};

/** Shows a gallery page in place of the one showing. */
export const openGalleryPage = (page: TGalleryPage) => {
  bindAccount();
  publish({
    ...navigation,
    place: 'visualizers',
    page,
    // Sent here from elsewhere — the graph's looks, an update notice — is a
    // visit of its own; from the gallery's own list it is the same visit.
    filters:
      navigation.place === 'visualizers'
        ? navigation.filters
        : opened(navigation.filters),
  });
};

/**
 * The gallery's front page showing only the scenes this member cannot play
 * yet, every scene of them: no category, no search. Where the starter
 * credits, once claimed, are spent (Ivan, 2026-11-13).
 */
export const openNotMineYet = () => {
  bindAccount();
  publish({
    ...navigation,
    place: 'visualizers',
    page: { kind: 'browse' },
    filters: { sort: navigation.filters.sort, text: '', notMine: true },
  });
};

/**
 * The gallery's front page filed under one category, no search: where the
 * look picker sends a member whose own scenes hold none of that category
 * (Ivan, 2026-11-13: the picker "must always have all the gallery's
 * categories"), so the chip leads somewhere instead of to a blank list.
 */
export const openGalleryCategory = (category: TPlusCategory) => {
  bindAccount();
  publish({
    ...navigation,
    place: 'visualizers',
    page: { kind: 'browse' },
    filters: { ...opened(navigation.filters), category, text: '' },
  });
};

/**
 * How far down each page was scrolled, by page, so Back lands where the
 * member left the gallery rather than at its top.
 */
const scrolled = new Map<string, number>();

export const rememberGalleryScroll = (key: string, top: number) => {
  scrolled.set(key, top);
};

export const galleryScrollOf = (key: string) => scrolled.get(key) ?? 0;

export const setBrowseFilters = (filters: IBrowseFilters) => {
  if (filters !== navigation.filters) {
    publish({ ...navigation, filters });
  }
};

/**
 * Back is the gallery, in one press, from any page — scene, maker, the next
 * scene and the one after. It used to walk back through every page opened,
 * which after a few arrows and a maker or two meant pressing it over and
 * over to get anywhere (Ivan: "tiene que ir al root siempre de una sola
 * vez"). The gallery reopens where it was scrolled to.
 *
 * A scene page an add-on opened goes back where the add-on says: the person
 * came from there, not from the gallery.
 */
export const goBackInGallery = () => {
  const { page } = navigation;
  publish({ ...navigation, page: { kind: 'browse' } });
  if (page.kind === 'scene') {
    page.onBack?.();
  }
};

/** For tests: a clean module between runs. */
export const resetPlusNavigation = () => {
  stopAccount();
  stopAccount = () => {};
  owner = getAccountSnapshot().identity?.id;
  removeStored(PLACE_KEY);
  navigation = INITIAL;
  listeners.clear();
  scrolled.clear();
};
