/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import { ScenePicture } from 'renderer/plus/GalleryParts';
import GalleryToolbar from 'renderer/plus/GalleryToolbar';
import type { IBrowseFilters } from 'renderer/plus/plusNavigation';
import { SceneStillsContext } from 'renderer/plus/scenePictures';
import { I18nProvider } from 'renderer/utils/I18nContext';

/**
 * The gallery's search, sort, own scenes and category chips, handed their
 * filters (`GalleryToolbar`): the gallery hands it the member's, Help's
 * drawing made-up ones.
 */

/** Undone after the case that asked for it, passed or failed. */
const undo: (() => void)[] = [];
const afterThis = (step: () => void) => undo.push(step);
afterEach(() => {
  undo.splice(0).forEach((step) => step());
});

const show = (filters: IBrowseFilters) => {
  const onFilters = jest.fn();
  const onMine = jest.fn();
  render(
    <I18nProvider>
      <GalleryToolbar filters={filters} onFilters={onFilters} onMine={onMine} />
    </I18nProvider>,
  );
  return { onFilters, onMine };
};

it('sorts, searches and opens the member’s own scenes', () => {
  const { onFilters, onMine } = show({ sort: 'liked', text: '' });
  fireEvent.click(screen.getByRole('button', { name: 'Newest' }));
  expect(onFilters).toHaveBeenLastCalledWith({ sort: 'new', text: '' });
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'neon' },
  });
  expect(onFilters).toHaveBeenLastCalledWith({ sort: 'liked', text: 'neon' });
  fireEvent.click(screen.getByRole('button', { name: /Your scenes/ }));
  expect(onMine).toHaveBeenCalledTimes(1);
});

it('picks a category, and the same chip again lets it go', () => {
  const { onFilters } = show({ sort: 'week', text: 'sea', category: 'water' });
  fireEvent.click(screen.getByRole('button', { name: 'Nature' }));
  expect(onFilters).toHaveBeenLastCalledWith({
    sort: 'week',
    text: 'sea',
    category: 'nature',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Water' }));
  expect(onFilters).toHaveBeenLastCalledWith({ sort: 'week', text: 'sea' });
});

// Help draws the gallery from stills the app ships: a picture in hand is
// shown at once, and nothing is fetched or drawn for it.
it('shows a scene picture already in hand, without asking for one', () => {
  const galleryPicture = jest.fn();
  const previewGalleryScene = jest.fn();
  Object.assign(window, {
    electron: { ipcRenderer: { galleryPicture, previewGalleryScene } },
  });
  afterThis(() => {
    delete (window as { electron?: unknown }).electron;
  });
  const { container } = render(
    <SceneStillsContext.Provider value={new Map([['help-scene', 'still.jpg']])}>
      <ScenePicture
        scene={{
          lookId: 'help-scene',
          authorId: FLUIDEQ_CREATOR_ID,
          sceneId: 'help-scene',
          version: 1,
        }}
      />
    </SceneStillsContext.Provider>,
  );
  expect(container.querySelector('img')).toHaveAttribute('src', 'still.jpg');
  expect(galleryPicture).not.toHaveBeenCalled();
  expect(previewGalleryScene).not.toHaveBeenCalled();
});
