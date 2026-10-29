/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import LookPickerMore from 'renderer/graph/LookPickerMore';
import {
  gallerySeenAt,
  markGallerySeen,
  scenesNewSince,
} from 'renderer/plus/gallerySeen';
import { I18nProvider } from 'renderer/utils/I18nContext';

/**
 * The Visualizers column's last line: the way to more scenes in the gallery,
 * and how many went up since the gallery was last opened.
 */

const mockNewest: { scenes: { updatedAt: string }[] } = { scenes: [] };
const mockOpen = jest.fn();

jest.mock('renderer/plus/galleryStore', () => ({
  useGalleryList: () => ({ list: mockNewest }),
}));
jest.mock('renderer/account/accountStore', () => ({
  useAccount: () => ({ status: 'signed-in' }),
}));
jest.mock('renderer/graph/lookPickerPlaces', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockOpen(...args),
}));

const SEEN_KEY = 'fluideq.gallery.seenAt';
const at = (iso: string) => Date.parse(iso);

beforeEach(() => {
  window.localStorage.clear();
  mockOpen.mockClear();
  mockNewest.scenes = [];
});

describe('what counts as new', () => {
  it('is what went up after the gallery was last opened', () => {
    const scenes = [
      { updatedAt: '2026-10-29T10:00:00Z' },
      { updatedAt: '2026-10-28T10:00:00Z' },
      { updatedAt: '2026-10-29T12:00:00Z' },
    ];
    expect(scenesNewSince(scenes, at('2026-10-29T09:00:00Z'))).toBe(2);
    expect(scenesNewSince(scenes, at('2026-10-30T00:00:00Z'))).toBe(0);
  });

  it('starts from the first look, so a first run calls nothing new', () => {
    const first = at('2026-10-29T08:00:00Z');
    expect(gallerySeenAt(first)).toBe(first);
    expect(window.localStorage.getItem(SEEN_KEY)).toBe(String(first));
    // Later looks keep the first moment until the gallery is opened.
    expect(gallerySeenAt(first + 60_000)).toBe(first);
    markGallerySeen(first + 120_000);
    expect(gallerySeenAt(first + 180_000)).toBe(first + 120_000);
  });
});

describe('the line under the visualizers', () => {
  const show = () =>
    render(
      <I18nProvider>
        <LookPickerMore onLeave={jest.fn()} />
      </I18nProvider>,
    );

  it('offers the gallery quietly when nothing is new', () => {
    show();
    expect(screen.getByText('More scenes in the gallery')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Explore scenes/ });
    expect(button).toHaveClass('button', 'small', 'subtle');
    expect(button).not.toHaveTextContent(/new/);
  });

  it('says how many are new, in the accent, and opens the gallery', () => {
    window.localStorage.setItem(SEEN_KEY, String(at('2026-10-29T09:00:00Z')));
    mockNewest.scenes = [
      { updatedAt: '2026-10-29T10:00:00Z' },
      { updatedAt: '2026-10-29T11:00:00Z' },
      { updatedAt: '2026-10-20T11:00:00Z' },
    ];
    show();
    const button = screen.getByRole('button', { name: /Explore scenes/ });
    expect(button).toHaveTextContent('2 new');
    expect(button).not.toHaveClass('subtle');

    fireEvent.click(button);
    expect(mockOpen).toHaveBeenCalledWith(
      'gallery',
      expect.any(Function),
      true,
    );
  });
});
