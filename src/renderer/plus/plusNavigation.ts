import { useSyncExternalStore } from 'react';
import type {
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
  | { kind: 'scene'; scene: IGalleryScene }
  | { kind: 'maker'; maker: IMakerRef }
  | { kind: 'mine' };

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
};
