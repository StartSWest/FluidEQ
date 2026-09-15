import { useSyncExternalStore } from 'react';
import type {
  IGalleryQuery,
  IGalleryScene,
  TGallerySort,
  TPlusCategory,
} from 'common/plusGallery';
import type { IReportedScene } from 'common/plusModeration';
import { readStored, removeStored, writeStored } from '../utils/graphStorage';

/**
 * Where the member is inside the Plus tab: which place in its rail — the
 * Visualizers gallery, the leaderboard, the Studio, the lighting, or the
 * admin's own place — in the gallery which page, and in the admin's place
 * which of its pages.
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

export const PLUS_PLACES = [
  'visualizers',
  'board',
  'studio',
  'lighting',
  'admin',
] as const;
export type TPlusPlace = (typeof PLUS_PLACES)[number];

/**
 * The admin's pages: every account, the Plus given away, and the scenes
 * members reported. Only the admin is offered the place; the server refuses
 * anybody else on every call regardless.
 */
export const ADMIN_SECTIONS = ['accounts', 'gifts', 'reported'] as const;
export type TAdminSection = (typeof ADMIN_SECTIONS)[number];

const PLACE_KEY = 'fluideq.plusPlace';

const isPlusPlace = (value: unknown): value is TPlusPlace =>
  typeof value === 'string' &&
  (PLUS_PLACES as readonly string[]).includes(value);

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
      /** Opened from the admin's queue: what it was reported for. */
      report?: IReportedScene;
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
}

interface IPlusNavigation {
  place: TPlusPlace;
  page: TGalleryPage;
  filters: IBrowseFilters;
  admin: TAdminSection;
}

const INITIAL: IPlusNavigation = {
  place: 'visualizers',
  page: { kind: 'browse' },
  filters: { sort: 'liked', text: '' },
  admin: 'accounts',
};

let navigation: IPlusNavigation = { ...INITIAL, place: storedPlace() };
const listeners = new Set<() => void>();

const publish = (next: IPlusNavigation) => {
  if (next.place !== navigation.place) {
    writeStored(PLACE_KEY, next.place);
  }
  navigation = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePlusNavigation = (): IPlusNavigation =>
  useSyncExternalStore(
    subscribe,
    () => navigation,
    () => INITIAL,
  );

export const openPlusPlace = (place: TPlusPlace) => {
  if (place !== navigation.place) {
    publish({ ...navigation, place });
  }
};

/** Shows a gallery page in place of the one showing. */
export const openGalleryPage = (page: TGalleryPage) =>
  publish({ ...navigation, place: 'visualizers', page });

/** Shows one of the admin's pages. */
export const openAdminSection = (admin: TAdminSection) =>
  publish({ ...navigation, place: 'admin', admin });

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
 * A scene the admin opened from the reported queue goes back to that queue:
 * the admin came from there, not from the gallery.
 */
export const goBackInGallery = () => {
  const { page } = navigation;
  publish({
    ...navigation,
    page: { kind: 'browse' },
    ...(page.kind === 'scene' && page.report
      ? { place: 'admin', admin: 'reported' }
      : {}),
  });
};

/** For tests: a clean module between runs. */
export const resetPlusNavigation = () => {
  removeStored(PLACE_KEY);
  navigation = INITIAL;
  listeners.clear();
  scrolled.clear();
};
