/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The gallery keeps one list per question asked, and the search asks one for
 * each text it settles on. Kept for good, that was a page of scenes for every
 * search of the session.
 */

import { act, renderHook } from '@testing-library/react';
import type { IGalleryQuery } from 'common/plusGallery';
import {
  resetGalleryStore,
  useGalleryList,
  type TListQuery,
} from 'renderer/plus/galleryStore';

let asked: string[];

beforeEach(() => {
  resetGalleryStore();
  asked = [];
  window.electron = {
    ipcRenderer: {
      listGallery: (query: IGalleryQuery) => {
        asked.push(query.query ?? '');
        return Promise.resolve({ ok: true, scenes: [], more: false });
      },
    },
  } as unknown as typeof window.electron;
});

const search = (text: string): TListQuery => ({ sort: 'liked', query: text });

it('asks again for a search nobody came back to, and not for a recent one', async () => {
  const view = renderHook(({ query }) => useGalleryList(query), {
    initialProps: { query: search('q0') },
  });
  await act(async () => undefined);
  for (let index = 1; index <= 32; index += 1) {
    view.rerender({ query: search(`q${index}`) });
    // eslint-disable-next-line no-await-in-loop -- one answer before the next text, as the search asks
    await act(async () => undefined);
  }
  expect(asked).toHaveLength(33);

  // The control: a search shown a moment ago is still held.
  view.rerender({ query: search('q31') });
  await act(async () => undefined);
  expect(asked).toHaveLength(33);

  // The first one was let go, and showing it asks the server again.
  view.rerender({ query: search('q0') });
  await act(async () => undefined);
  expect(asked).toHaveLength(34);
  expect(asked[33]).toBe('q0');
});
