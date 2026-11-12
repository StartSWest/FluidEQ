/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The gallery's week views (Ivan, 2026-11-12: "This week: new" and "This
 * week: updates"), Most used and "Not mine yet": offered only once the
 * server's rows say when each scene first went out, because a server from
 * before them answers a new order with its default one, silently, and
 * refuses the new parameter. Each case stands beside the gallery as it is on
 * such a server.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import {
  isGallerySort,
  parseGalleryRow,
  type IGalleryQuery,
  type IGalleryScene,
} from 'common/plusGallery';
import { isNewScene } from 'common/sceneVersionNote';
import type { TGalleryListOutcome } from 'main/ipc/plusGallery';
import GalleryToolbar from 'renderer/plus/GalleryToolbar';
import {
  browseQuery,
  galleryServerViews,
  resetGalleryStore,
  useGalleryList,
} from 'renderer/plus/galleryStore';
import type { IBrowseFilters } from 'renderer/plus/plusNavigation';
import { I18nProvider } from 'renderer/utils/I18nContext';

const DAY = 24 * 60 * 60 * 1000;

const row = (over: Record<string, unknown> = {}) => ({
  author_id: '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30',
  author_name: 'Mei',
  author_handle: 'mei',
  scene_id: 'neon-city',
  version: 2,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050A1A', '#00e5cf'],
  has_photo: false,
  likes: 3,
  likes_week: 1,
  adds: 4,
  updated_at: '2026-11-10T10:00:00Z',
  liked: false,
  added: false,
  official: false,
  first_version: 1,
  ...over,
});

describe('a row from the server', () => {
  it('says when the scene first went out, null where the server keeps none', () => {
    expect(
      parseGalleryRow(row({ first_published_at: '2026-11-01T10:00:00Z' }))
        ?.firstPublishedAt,
    ).toBe('2026-11-01T10:00:00Z');
    expect(parseGalleryRow(row({ first_published_at: null }))).toHaveProperty(
      'firstPublishedAt',
      null,
    );
    // The control: a server from before it sends no such column at all.
    expect(parseGalleryRow(row())).not.toHaveProperty('firstPublishedAt');
  });

  it('knows the new orders, and nothing else', () => {
    ['week-new', 'week-updated', 'added', 'liked'].forEach((sort) =>
      expect(isGallerySort(sort)).toBe(true),
    );
    expect(isGallerySort('oldest')).toBe(false);
  });
});

it('calls a scene new for the week after it first went out, and only from the server’s time', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  expect(
    isNewScene(
      { firstPublishedAt: new Date(now - 2 * DAY).toISOString() },
      now,
    ),
  ).toBe(true);
  expect(
    isNewScene(
      { firstPublishedAt: new Date(now - 8 * DAY).toISOString() },
      now,
    ),
  ).toBe(false);
  expect(isNewScene({ firstPublishedAt: null }, now)).toBe(false);
  expect(isNewScene({}, now)).toBe(false);
});

describe('learning what the server answers', () => {
  let answer: ((outcome: TGalleryListOutcome) => void) | undefined;
  beforeEach(() => {
    resetGalleryStore();
    window.electron = {
      ipcRenderer: {
        listGallery: (_query: IGalleryQuery) =>
          new Promise<TGalleryListOutcome>((resolve) => {
            answer = resolve;
          }),
      },
    } as unknown as typeof window.electron;
  });

  const listed = (scene: Partial<IGalleryScene>) =>
    ({ lookId: 'member:a:one', sceneId: 'one', ...scene }) as IGalleryScene;

  it('learns it from rows that carry the first-publish time, and not before', async () => {
    renderHook(() => useGalleryList({ sort: 'new' }));
    await act(async () =>
      answer?.({ ok: true, scenes: [listed({})], more: false }),
    );
    expect(galleryServerViews()).toBe(false);

    renderHook(() => useGalleryList({ sort: 'liked' }));
    await act(async () =>
      answer?.({
        ok: true,
        scenes: [listed({ firstPublishedAt: null })],
        more: false,
      }),
    );
    expect(galleryServerViews()).toBe(true);
  });
});

describe('the toolbar', () => {
  const show = (filters: IBrowseFilters, signedIn = true) => {
    const onFilters = jest.fn();
    render(
      <I18nProvider>
        <GalleryToolbar
          filters={filters}
          onFilters={onFilters}
          onMine={jest.fn()}
          signedIn={signedIn}
        />
      </I18nProvider>,
    );
    return onFilters;
  };

  const serverKnows = async () => {
    resetGalleryStore();
    let answer: ((outcome: TGalleryListOutcome) => void) | undefined;
    window.electron = {
      ipcRenderer: {
        listGallery: () =>
          new Promise<TGalleryListOutcome>((resolve) => {
            answer = resolve;
          }),
      },
    } as unknown as typeof window.electron;
    renderHook(() => useGalleryList({ sort: 'new' }));
    await act(async () =>
      answer?.({
        ok: true,
        scenes: [
          {
            lookId: 'member:a:one',
            sceneId: 'one',
            firstPublishedAt: '2026-11-10T10:00:00Z',
          } as IGalleryScene,
        ],
        more: false,
      }),
    );
  };

  it('offers only the three orders it always had on a server that does not know the rest', () => {
    resetGalleryStore();
    show({ sort: 'new', text: '' });
    expect(
      screen.getByRole('button', { name: 'This week' }),
    ).not.toHaveAttribute('aria-haspopup');
    expect(screen.queryByRole('button', { name: /Not mine yet/ })).toBeNull();
  });

  it('opens This week as a menu of its three orders, and names the one chosen', async () => {
    await serverKnows();
    const onFilters = show({ sort: 'new', text: '' });
    fireEvent.click(screen.getByRole('button', { name: 'This week' }));
    expect(
      screen.getAllByRole('menuitemradio').map((item) => item.textContent),
    ).toEqual([
      'Most liked this week',
      'New this weekfirst published',
      'Updated this weeknew version',
    ]);
    fireEvent.click(
      screen.getByRole('menuitemradio', { name: /Updated this week/ }),
    );
    expect(onFilters).toHaveBeenLastCalledWith({
      sort: 'week-updated',
      text: '',
    });
  });

  it('says which week view is chosen on the segment itself', async () => {
    await serverKnows();
    show({ sort: 'week-new', text: '' });
    expect(
      screen.getByRole('button', { name: 'This week: new' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps Most used in the Most liked menu', async () => {
    await serverKnows();
    const onFilters = show({ sort: 'new', text: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Most liked' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Most used/ }));
    expect(onFilters).toHaveBeenLastCalledWith({ sort: 'added', text: '' });
  });

  // Ivan, 2026-11-12: only the scenes you do not have yet, free ones
  // counted as yours; nothing to compare with for somebody signed out.
  it('offers Not mine yet to somebody signed in, and turns it on', async () => {
    await serverKnows();
    const onFilters = show({ sort: 'new', text: '' });
    fireEvent.click(screen.getByRole('button', { name: /Not mine yet/ }));
    expect(onFilters).toHaveBeenLastCalledWith({
      sort: 'new',
      text: '',
      notMine: true,
    });
  });

  it('leaves Not mine yet out for somebody signed out', async () => {
    await serverKnows();
    show({ sort: 'new', text: '' }, false);
    expect(screen.queryByRole('button', { name: /Not mine yet/ })).toBeNull();
    // The control: the week's views need no account and are still there.
    expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
  });

  it('keeps the chosen category when Not mine yet is switched on and off', async () => {
    await serverKnows();
    const onFilters = show({
      sort: 'new',
      text: '',
      category: 'water',
      notMine: true,
    });
    const toggle = screen.getByRole('button', { name: /Not mine yet/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(onFilters).toHaveBeenLastCalledWith({
      sort: 'new',
      text: '',
      category: 'water',
      notMine: false,
    });
  });
});

// "Not mine yet" is its own list: kept under the same key as the full
// one, switching it on would show the scenes already yours, from memory.
it('asks for the list again when Not mine yet is switched on', async () => {
  resetGalleryStore();
  const asked: IGalleryQuery[] = [];
  window.electron = {
    ipcRenderer: {
      listGallery: async (query: IGalleryQuery) => {
        asked.push(query);
        return { ok: true, scenes: [], more: false };
      },
    },
  } as unknown as typeof window.electron;
  const { rerender } = renderHook(
    ({ notMine }: { notMine: boolean }) =>
      useGalleryList({ sort: 'new', ...(notMine ? { notMine } : {}) }),
    { initialProps: { notMine: false } },
  );
  await act(async () => undefined);
  rerender({ notMine: true });
  await act(async () => undefined);
  expect(asked.map((query) => query.notMine === true)).toEqual([false, true]);
});

// Signed out, "Not mine yet" has nothing to compare with, so even a switch
// left on from a signed-in visit is never sent.
it('asks for Not mine yet only for somebody signed in', () => {
  const filters: IBrowseFilters = {
    sort: 'week-new',
    text: 'neon',
    category: 'cities',
    notMine: true,
  };
  expect(browseQuery(filters, 'neon', true)).toEqual({
    sort: 'week-new',
    category: 'cities',
    query: 'neon',
    notMine: true,
  });
  expect(browseQuery(filters, 'neon', false)).toEqual({
    sort: 'week-new',
    category: 'cities',
    query: 'neon',
  });
});
