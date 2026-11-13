/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which version of a scene the app shows, and where (Ivan, 2026-11-13).
 * Balloon Dawn's page said v1 while its list said v2: the page took the
 * first copy of the scene any cached list held, and lists are kept oldest
 * first. And the graph's look picker now says which version is in the looks,
 * beside the maker, with a newer one the gallery has said quietly.
 */

import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import type { IGalleryScene } from 'common/plusGallery';
import type { IUsableMemberScene } from 'renderer/utils/memberScenes';
import type { TGalleryListOutcome } from 'main/ipc/plusGallery';
import LookPickerScene from 'renderer/graph/LookPickerScene';
import { buildPlusRows, type IPlusRow } from 'renderer/graph/lookPickerRows';
import {
  findGalleryScene,
  resetGalleryStore,
  useGalleryList,
  useGalleryScene,
} from 'renderer/plus/galleryStore';
import { I18nProvider } from 'renderer/utils/I18nContext';
import { translate } from 'common/i18n';

const LOOK = 'member:40000000-0000-4000-8000-0000000000bb:balloon';

const copy = (version: number, updatedAt: string) =>
  ({
    lookId: LOOK,
    sceneId: 'balloon',
    authorId: '40000000-0000-4000-8000-0000000000bb',
    version,
    updatedAt,
  }) as unknown as IGalleryScene;

const V1 = copy(1, '2026-11-11T10:00:00Z');
const V2 = copy(2, '2026-11-13T02:58:00Z');

describe('the copy of a scene a page shows', () => {
  let answers: Array<(outcome: TGalleryListOutcome) => void>;
  beforeEach(() => {
    resetGalleryStore();
    answers = [];
    window.electron = {
      ipcRenderer: {
        listGallery: () =>
          new Promise<TGalleryListOutcome>((resolve) => {
            answers.push(resolve);
          }),
      },
    } as unknown as typeof window.electron;
  });

  const listed = async (sort: 'liked' | 'new', scene: IGalleryScene) => {
    renderHook(() => useGalleryList({ sort }));
    await act(async () =>
      answers[answers.length - 1]?.({ ok: true, scenes: [scene], more: false }),
    );
  };

  it('is the newest any list holds, however old the list that had it first', async () => {
    // The list loaded before the approval, then one loaded after it.
    await listed('liked', V1);
    // The control: with one list, that list's copy.
    expect(findGalleryScene(LOOK)?.version).toBe(1);
    await listed('new', V2);
    expect(findGalleryScene(LOOK)?.version).toBe(2);
  });

  it('opens on the newest copy, even when it was opened from an older one', async () => {
    await listed('new', V2);
    const { result } = renderHook(() => useGalleryScene(V1));
    expect(result.current.version).toBe(2);
  });

  it('keeps the copy it was opened with when every list is older', async () => {
    await listed('liked', V1);
    const { result } = renderHook(() => useGalleryScene(V2));
    expect(result.current.version).toBe(2);
  });
});

describe('the version in the graph’s look picker', () => {
  const t = (
    key: Parameters<typeof translate>[1],
    vars?: Record<string, string | number>,
  ) => translate('en', key, vars);

  const member = {
    lookId: LOOK,
    authorId: '40000000-0000-4000-8000-0000000000bb',
    packId: 'balloon',
    version: 1,
    names: { en: 'Balloon Dawn' },
    swatch: ['#2a1f3a', '#ffd36f'],
    fallbackStyle: 'skyline',
    own: false,
    authorName: 'Prime',
  } as unknown as IUsableMemberScene;

  const rowWith = (gallery: IGalleryScene | undefined) =>
    buildPlusRows({
      usable: [],
      locked: [],
      members: [member],
      lockedMembers: [],
      locale: 'en',
      t,
      findInGallery: () => gallery,
    }).find((row) => row.id === LOOK);

  it('knows a newer version the gallery has, and nothing when it has none', () => {
    expect(rowWith(V2)?.latest).toBe(2);
    expect(rowWith(V1)).not.toHaveProperty('latest');
    expect(rowWith(undefined)).not.toHaveProperty('latest');
  });

  const show = (row: IPlusRow) =>
    render(
      <I18nProvider>
        <LookPickerScene
          row={row}
          selected={false}
          tabbable
          heading={false}
          onChoose={jest.fn()}
        />
      </I18nProvider>,
    );

  it('says the version beside the maker', () => {
    const row = rowWith(V1);
    if (!row) {
      throw new Error('no row');
    }
    show(row);
    expect(screen.getByText('by Prime')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
  });

  it('says quietly that a newer version is available', () => {
    const row = rowWith(V2);
    if (!row) {
      throw new Error('no row');
    }
    show(row);
    expect(screen.getByText('v1 · v2 available')).toHaveClass('has-newer');
    // Its own span: a long maker's name is what shortens, never the number.
    expect(screen.getByText('by Prime')).toHaveClass(
      'look-picker__caption-text',
    );
  });
});
