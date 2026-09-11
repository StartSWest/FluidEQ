import { useSyncExternalStore } from 'react';
import type {
  IGalleryQuery,
  IGalleryScene,
  TGallerySort,
  TPlusCategory,
} from 'common/plusGallery';

/**
 * Where the member is inside the Plus tab: which place in its rail — a
 * channel, the Visualizers gallery, the leaderboard or the Studio — and in
 * the gallery, which page.
 *
 * Kept outside the components so it outlives them. The tab unmounts whenever
 * another one is chosen in the title bar, and coming back should find the
 * scene or the maker that was open, not the top of the gallery. Kept here
 * too so a gallery page can send the member to the Studio.
 */

export type TPlusPlace = 'channel' | 'visualizers' | 'board' | 'studio';

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
  /** The pages behind this one, most recent last, for Back. */
  trail: TGalleryPage[];
  filters: IBrowseFilters;
}

const INITIAL: IPlusNavigation = {
  place: 'channel',
  page: { kind: 'browse' },
  trail: [],
  filters: { sort: 'liked', text: '' },
};

/** Deep enough for scene → maker → scene → maker and back out. */
const MAX_TRAIL = 12;

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

/** Opens a gallery page on top of the one showing. */
export const openGalleryPage = (page: TGalleryPage) =>
  publish({
    ...navigation,
    place: 'visualizers',
    page,
    trail:
      page.kind === 'browse'
        ? []
        : [...navigation.trail, navigation.page].slice(-MAX_TRAIL),
  });

/**
 * Shows `page` in place of the one showing: the next scene in a list rather
 * than a page opened on top, so Back still goes where the member came from.
 */
export const replaceGalleryPage = (page: TGalleryPage) =>
  publish({ ...navigation, place: 'visualizers', page });

/**
 * How far down each page was scrolled, by page, so Back lands where the
 * member left rather than at the top of the gallery.
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

export const goBackInGallery = () => {
  const trail = [...navigation.trail];
  const previous = trail.pop() ?? { kind: 'browse' as const };
  publish({ ...navigation, page: previous, trail });
};

/** For tests: a clean module between runs. */
export const resetPlusNavigation = () => {
  navigation = INITIAL;
  listeners.clear();
  scrolled.clear();
};
