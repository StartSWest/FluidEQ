/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How often the gallery's lists ask the server, and what a failed ask leaves
 * on screen.
 *
 * Every list is the server's most expensive query, run for this member.
 * Opening the tab used to ask for the first list twice, and every visit
 * asked again however recent the list was; a failed "more" put "could not
 * load the gallery" over a loaded gallery; and a call that threw left the
 * list loading for good.
 */

import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import type { IGalleryQuery, IGalleryScene } from 'common/plusGallery';
import type { TGalleryListOutcome } from 'main/ipc/plusGallery';
import GalleryList from 'renderer/plus/GalleryList';
import {
  GALLERY_REFRESH_AFTER_MS,
  refreshGalleryOnShow,
  resetGalleryStore,
  useGalleryList,
  type TListQuery,
} from 'renderer/plus/galleryStore';

const scene = (sceneId: string) =>
  ({
    lookId: `member:someone:${sceneId}`,
    sceneId,
  }) as unknown as IGalleryScene;

/** Every ask, answered only when the test says. */
let asks: Array<{
  query: IGalleryQuery;
  answer: (outcome: TGalleryListOutcome) => void;
  fail: (error: Error) => void;
}>;

beforeEach(() => {
  resetGalleryStore();
  asks = [];
  window.electron = {
    ipcRenderer: {
      listGallery: (query: IGalleryQuery) =>
        new Promise<TGalleryListOutcome>((resolve, reject) => {
          asks.push({ query, answer: resolve, fail: reject });
        }),
    },
  } as unknown as typeof window.electron;
});

const QUERY: TListQuery = { sort: 'liked' };

const answer = async (index: number, outcome: TGalleryListOutcome) => {
  await act(async () => asks[index].answer(outcome));
};

describe('asking for a list', () => {
  it('asks once when the tab opens on a list it has not got yet', async () => {
    const view = renderHook(() => useGalleryList(QUERY));
    // The tab's own effect runs after its child's has started the list.
    act(() => refreshGalleryOnShow());
    expect(asks).toHaveLength(1);
    await answer(0, { ok: true, scenes: [scene('one')], more: false });
    expect(asks).toHaveLength(1);
    expect(view.result.current.list.scenes).toHaveLength(1);
  });

  it('leaves a list less than a minute old alone on opening the tab, and asks again once it is older', async () => {
    const start = Date.now();
    const view = renderHook(() => useGalleryList(QUERY));
    await answer(0, { ok: true, scenes: [scene('one')], more: false });

    act(() => refreshGalleryOnShow(start + GALLERY_REFRESH_AFTER_MS / 2));
    view.rerender();
    expect(asks).toHaveLength(1);

    act(() => refreshGalleryOnShow(Date.now() + GALLERY_REFRESH_AFTER_MS));
    view.rerender();
    expect(asks).toHaveLength(2);
    // What was on screen stays there while it is asked.
    expect(view.result.current.list.scenes).toHaveLength(1);
  });

  it('answers a call that threw as offline instead of loading for good', async () => {
    const view = renderHook(() => useGalleryList(QUERY));
    await act(async () => asks[0].fail(new Error('main went away')));
    expect(view.result.current.list).toMatchObject({
      loading: false,
      error: 'offline',
    });
  });
});

describe('what a failed ask leaves on screen', () => {
  const Page = () => {
    const { list, loadMore, reload } = useGalleryList(QUERY);
    return (
      <GalleryList list={list} onMore={loadMore} onRetry={reload} empty="none">
        {list.scenes.map((entry) => (
          <span key={entry.lookId}>{entry.sceneId}</span>
        ))}
      </GalleryList>
    );
  };

  it('says a later page failed at the foot, under the pages it already has', async () => {
    render(<Page />);
    await answer(0, { ok: true, scenes: [scene('one')], more: true });
    await act(async () => {
      screen.getByRole('button', { name: 'Show more' }).click();
    });
    await answer(1, { ok: false, reason: 'server' });

    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('gallery-more__error');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Couldn’t load more scenes. Try again.',
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the gallery on screen when refreshing it fails, and says so only over an empty one', async () => {
    const view = render(<Page />);
    await answer(0, { ok: false, reason: 'server' });
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'Try again' }).click();
    });
    await answer(1, { ok: true, scenes: [scene('one')], more: false });
    act(() => refreshGalleryOnShow(Date.now() + GALLERY_REFRESH_AFTER_MS));
    view.rerender(<Page />);
    await answer(2, { ok: false, reason: 'server' });

    expect(screen.getByText('one')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });
});
