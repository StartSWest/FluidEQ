import { useSyncExternalStore } from 'react';
import type {
  IGalleryQuery,
  IGalleryScene,
  TGallerySort,
  TPlusCategory,
} from 'common/plusGallery';

/**
 * Where the member is inside the Plus tab: which place in its rail — the
 * Visualizers gallery, the leaderboard or the Studio — and in the gallery,
 * which page.
 *
 * Kept outside the components so it outlives them. The tab unmounts whenever
 * another one is chosen in the title bar, and coming back should find the
 * scene or the maker that was open, not the top of the gallery. Kept here
 * too so a gallery page can send the member to the Studio.
 */

export type TPlusPlace = 'visualizers' | 'board' | 'studio';

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
}

const INITIAL: IPlusNavigation = {
  place: 'visualizers',
  page: { kind: 'browse' },
  filters: { sort: 'liked', text: '' },
};

let navigation = INITIAL;
const listeners = new Set<() => void>();

const publish = (next: IPlusNavigation) => {
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
 */
export const goBackInGallery = () =>
  publish({ ...navigation, page: { kind: 'browse' } });

/** For tests: a clean module between runs. */
export const resetPlusNavigation = () => {
  navigation = INITIAL;
  listeners.clear();
  scrolled.clear();
};
