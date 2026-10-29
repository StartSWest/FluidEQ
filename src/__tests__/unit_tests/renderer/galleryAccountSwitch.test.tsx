/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import { act, renderHook } from '@testing-library/react';
import type { IAccountState } from 'main/account/session';
import type { TGalleryListOutcome } from 'main/ipc/plusGallery';
import type { IGalleryScene } from 'common/plusGallery';
import * as accounts from 'renderer/account/accountStore';
import { resetGalleryStore, useGalleryList } from 'renderer/plus/galleryStore';
import {
  openGalleryPage,
  openPlusPlace,
  resetPlusNavigation,
  usePlusNavigation,
} from 'renderer/plus/plusNavigation';

const account = (id: string): IAccountState => ({
  status: 'signed-in',
  identity: { id, email: `${id}@example.com` },
});
let state: IAccountState;
let changed: () => void;
let asks: Array<(outcome: TGalleryListOutcome) => void>;
const scene = (name: string) =>
  ({ lookId: `premium:${name}`, sceneId: name }) as IGalleryScene;
const answer = async (index: number, name: string) => {
  await act(async () =>
    asks[index]({ ok: true, scenes: [scene(name)], more: false }),
  );
};

beforeEach(() => {
  resetGalleryStore();
  resetPlusNavigation();
  state = account('first');
  asks = [];
  changed = () => {};
  jest.spyOn(accounts, 'getAccountSnapshot').mockImplementation(() => state);
  jest.spyOn(accounts, 'subscribeAccount').mockImplementation((listener) => {
    changed = listener;
    return () => {};
  });
  window.electron = {
    ipcRenderer: {
      listGallery: () =>
        new Promise<TGalleryListOutcome>((resolve) => {
          asks.push(resolve);
        }),
    },
  } as unknown as typeof window.electron;
});
afterEach(() => {
  resetGalleryStore();
  resetPlusNavigation();
  jest.restoreAllMocks();
});

test('account switching discards cached scenes and likes before loading the new account', async () => {
  const view = renderHook(() => useGalleryList({ sort: 'liked' }));
  await answer(0, 'first-scene');
  expect(view.result.current.list.scenes[0].sceneId).toBe('first-scene');
  act(() => {
    state = account('second');
    changed();
  });
  expect(view.result.current.list.scenes).toEqual([]);
  expect(view.result.current.list.loading).toBe(true);
  await answer(1, 'second-scene');
  expect(view.result.current.list.scenes[0].sceneId).toBe('second-scene');
});

test('a late old-account answer cannot match a new request for the same gallery query', async () => {
  const view = renderHook(() => useGalleryList({ sort: 'liked' }));
  act(() => {
    state = account('second');
    changed();
  });
  await answer(1, 'second-scene');
  await answer(0, 'first-scene');
  expect(view.result.current.list.scenes.map((row) => row.sceneId)).toEqual([
    'second-scene',
  ]);
});

test('reopening the gallery after an account change requests the new account even with a fresh old cache', async () => {
  const first = renderHook(() => useGalleryList({ sort: 'liked' }));
  await answer(0, 'first-scene');
  first.unmount();
  state = account('second');

  const next = renderHook(() => useGalleryList({ sort: 'liked' }));
  expect(next.result.current.list.scenes).toEqual([]);
  expect(asks).toHaveLength(2);
  expect(next.result.current.list.loading).toBe(true);
  await answer(1, 'second-scene');
  expect(next.result.current.list.scenes[0].sceneId).toBe('second-scene');
});

test('signing out clears the previous account even when the server has not answered', async () => {
  const view = renderHook(() => useGalleryList({ sort: 'liked' }));
  act(() => {
    state = { status: 'signed-out' };
    changed();
  });
  await answer(0, 'private-to-first');
  expect(view.result.current.list.scenes).toEqual([]);
});

test('a new account leaves the old creator page but preserves its chosen workspace', () => {
  const view = renderHook(() => usePlusNavigation());
  act(() => {
    openGalleryPage({ kind: 'mine' });
    openPlusPlace('studio');
  });
  expect(view.result.current.page.kind).toBe('mine');
  act(() => {
    state = account('second');
    changed();
  });
  expect(view.result.current.page.kind).toBe('browse');
  expect(view.result.current.place).toBe('studio');
});

test('a deliberate destination opened after an account change is preserved', () => {
  const first = renderHook(() => usePlusNavigation());
  act(() => {
    openGalleryPage({ kind: 'mine' });
  });
  first.unmount();
  state = account('second');
  openGalleryPage({
    kind: 'maker',
    maker: { authorId: 'second', name: 'Second', handle: null },
  });
  const next = renderHook(() => usePlusNavigation());
  expect(next.result.current.page.kind).toBe('maker');
});
