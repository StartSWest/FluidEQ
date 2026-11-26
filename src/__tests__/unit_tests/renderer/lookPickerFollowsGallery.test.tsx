/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { IGalleryScene } from 'common/plusGallery';
import type { TGalleryListOutcome } from 'main/ipc/plusGallery';
import LookPicker from 'renderer/graph/LookPicker';
import type { IPlusRow } from 'renderer/graph/lookPickerRows';
import { resetGalleryStore } from 'renderer/plus/galleryStore';

/**
 * Ivan, 2026-11-25: "the plus viz and the selector in the EQ need to be
 * always in sync, it cannot be that there are new things in the library not
 * showing here". The picker read the gallery's lists as it opened and never
 * again, so the newest page it asks for itself as it opens landed after its
 * rows were built: a scene republished that day said nothing of its new
 * version until the picker was closed and opened again.
 */

const KOI = 'member:maker:koi';

// The rows as the real builder makes them from what the gallery says: the
// version on this computer is 3, and the gallery's word on it, when it has
// one, files it and says whether a newer version is out.
jest.mock('renderer/graph/lookPickerRows', () => ({
  ...jest.requireActual<object>('renderer/graph/lookPickerRows'),
  buildPlusRows: ({
    findInGallery,
  }: {
    findInGallery: (lookId: string) => IGalleryScene | undefined;
  }): IPlusRow[] => {
    const gallery = findInGallery(KOI);
    return [
      {
        id: KOI,
        name: 'Koi Pond',
        swatch: ['#000000'],
        maker: 'members',
        author: 'Maker',
        categories: gallery ? [gallery.category] : [],
        locked: false,
        version: 3,
        ...(gallery && gallery.version > 3 ? { latest: gallery.version } : {}),
        search: 'koi pond',
      },
    ];
  },
}));

const PICKER = 'Styles and scenes';

const listed = (version: number): IGalleryScene =>
  ({
    lookId: KOI,
    authorId: 'maker',
    sceneId: 'koi',
    authorName: 'Maker',
    authorHandle: null,
    version,
    category: 'water',
    names: { en: 'Koi Pond' },
    swatch: ['#000000'],
    hasPhoto: false,
    likes: 0,
    likesWeek: 0,
    adds: 0,
    updatedAt: '2026-11-25T09:00:00Z',
    liked: false,
    added: true,
  }) as IGalleryScene;

let answer: (outcome: TGalleryListOutcome) => void = () => undefined;

beforeEach(() => {
  resetGalleryStore();
  window.electron = {
    ipcRenderer: {
      listGallery: () =>
        new Promise<TGalleryListOutcome>((resolve) => {
          answer = resolve;
        }),
    },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  resetGalleryStore();
});

const newerMarks = () =>
  within(screen.getByRole('dialog', { name: PICKER }))
    .getByText('Koi Pond')
    .closest('.look-picker__item')
    ?.querySelectorAll('.look-picker__version.has-newer').length ?? 0;

it('shows a version the gallery has just told it about without being reopened', async () => {
  render(<LookPicker value="analyzer" disabled={false} onChoose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: PICKER }));

  // The control: before the gallery has answered, nothing is known newer.
  expect(newerMarks()).toBe(0);

  await act(async () => {
    answer({ ok: true, scenes: [listed(4)], more: false });
  });

  // Still open, never closed: the gallery's word is on the tile.
  expect(screen.getByRole('dialog', { name: PICKER })).toBeInTheDocument();
  expect(newerMarks()).toBe(1);
});

it('says nothing newer when the gallery holds the version this computer has', async () => {
  render(<LookPicker value="analyzer" disabled={false} onChoose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: PICKER }));

  await act(async () => {
    answer({ ok: true, scenes: [listed(3)], more: false });
  });

  expect(newerMarks()).toBe(0);
});
