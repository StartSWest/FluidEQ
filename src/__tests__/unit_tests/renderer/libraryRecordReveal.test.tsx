/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import LibraryTrackMenu from 'renderer/library/LibraryTrackMenu';

/**
 * Show in Explorer for a whole record (Ivan, 2026-11-14: "for album add also
 * show in explorer same as we have for each song"): offered on a record of
 * many songs when the record lives in one folder, never twice beside a
 * song's own, and never for songs spread over several folders.
 */
jest.mock('renderer/library/PlaylistContext', () => ({
  usePlaylists: () => ({
    isFavorite: () => false,
    addTracks: () => undefined,
    removeTracks: () => undefined,
  }),
}));

const anchor = document.createElement('button');
document.body.append(anchor);

const menu = (
  trackIds: readonly string[],
  onRevealFolder?: () => void,
  onReveal: (trackId: string) => void = () => undefined,
) =>
  render(
    <LibraryTrackMenu
      anchor={anchor}
      isOpen
      trackIds={trackIds}
      onReveal={onReveal}
      onRevealFolder={onRevealFolder}
      onClose={() => undefined}
    />,
  );

const revealItems = () =>
  screen.queryAllByRole('button', { name: 'Show in Explorer' });

afterEach(cleanup);

describe('Show in Explorer on a record', () => {
  it('opens the record’s folder from a record of many songs in one folder', () => {
    const onRevealFolder = jest.fn();
    menu(['a', 'b', 'c'], onRevealFolder);
    expect(revealItems()).toHaveLength(1);
    fireEvent.click(revealItems()[0]);
    expect(onRevealFolder).toHaveBeenCalledTimes(1);
  });

  it('is not offered for songs spread over several folders', () => {
    menu(['a', 'b', 'c']);
    expect(revealItems()).toHaveLength(0);
  });

  it('shows a lone song’s own file once, never the folder item beside it', () => {
    const onRevealFolder = jest.fn();
    const onReveal = jest.fn();
    menu(['a'], onRevealFolder, onReveal);
    expect(revealItems()).toHaveLength(1);
    fireEvent.click(revealItems()[0]);
    expect(onReveal).toHaveBeenCalledWith('a');
    expect(onRevealFolder).not.toHaveBeenCalled();
  });
});
