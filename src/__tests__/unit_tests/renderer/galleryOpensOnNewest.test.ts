/**
 * The gallery opens on Newest, every time it is opened (Ivan, 2026-11-09:
 * "gallery newest is always default"). A sort chosen during a visit holds
 * for that visit — from the list to a scene and back — and the next visit
 * starts on Newest again; its category and search are left as they were.
 */
import { act, renderHook } from '@testing-library/react';
import type { IGalleryScene } from 'common/plusGallery';
import {
  openGalleryPage,
  openPlusPlace,
  plusPlace,
  plusTabOpened,
  resetPlusNavigation,
  setBrowseFilters,
  usePlusNavigation,
} from 'renderer/plus/plusNavigation';

const scene = {
  lookId: 'premium:aurora',
  sceneId: 'aurora',
} as unknown as IGalleryScene;

// One reader per case, subscribed as the tab is, and every change made the
// way a press makes it.
let reader: { result: { current: ReturnType<typeof usePlusNavigation> } };
const now = () => reader.result.current;
const press = (change: () => void) => act(change);

beforeEach(() => {
  resetPlusNavigation();
  reader = renderHook(() => usePlusNavigation());
});

it('opens on Newest', () => {
  expect(now().filters).toEqual({ sort: 'new', text: '' });
});

it('keeps a sort chosen during the visit, through a scene and back', () => {
  press(() => setBrowseFilters({ sort: 'liked', text: '' }));
  press(() => openGalleryPage({ kind: 'scene', scene }));
  press(() => openGalleryPage({ kind: 'browse' }));
  expect(now().filters.sort).toBe('liked');
  // And staying in the gallery is not opening it.
  press(() => openPlusPlace('visualizers'));
  expect(now().filters.sort).toBe('liked');
});

it('starts the next visit on Newest, with its category and search as they were', () => {
  press(() =>
    setBrowseFilters({ sort: 'week', category: 'water', text: 'lake' }),
  );
  press(() => openGalleryPage({ kind: 'scene', scene }));
  press(() => plusTabOpened());
  expect(now().filters).toEqual({
    sort: 'new',
    category: 'water',
    text: 'lake',
  });
  // The scene that was open is still the page coming back.
  expect(now().page).toEqual({ kind: 'scene', scene });
});

it('starts on Newest again coming back from the Studio', () => {
  press(() => setBrowseFilters({ sort: 'liked', text: '' }));
  press(() => openPlusPlace('studio'));
  // The Studio leaves the gallery's choice alone while it is open.
  expect(now().filters.sort).toBe('liked');
  press(() => openPlusPlace('visualizers'));
  expect(plusPlace()).toBe('visualizers');
  expect(now().filters.sort).toBe('new');
});

it('starts on Newest when another part of the app sends the member to a gallery page', () => {
  press(() => setBrowseFilters({ sort: 'liked', text: '' }));
  press(() => openPlusPlace('lighting'));
  press(() => openGalleryPage({ kind: 'scene', scene }));
  expect(now().filters.sort).toBe('new');
});
