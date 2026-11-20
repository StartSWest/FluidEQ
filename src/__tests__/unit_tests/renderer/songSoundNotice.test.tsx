/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { translate } from 'common/i18n';
import type { ISongIdentity } from 'common/songIdentity';
import SongSoundNotice from 'renderer/components/SongSoundNotice';
import {
  dismissSongSoundNotice,
  showSongSoundNotice,
} from 'renderer/audio/songSoundNotice';

/**
 * What Auto EQ's card says when a saved sound goes on: the song's own, or
 * its album's. The memory keeps no name for a song that is not the
 * listener's own file (`songMemoryNames.ts`), so the card names the song
 * that is playing.
 */
jest.mock('renderer/utils/noticeTurn', () => ({
  useNoticeTurn: (_name: string, wants: boolean) => wants,
}));

const playing: ISongIdentity = {
  key: 'system:chrome.exe:a tune:',
  title: 'A tune',
  source: 'system',
};
const noName = translate('en', 'songSound.noPresetName');

afterEach(() => {
  act(() => dismissSongSoundNotice());
});

it('names the song playing, which the memory may not', () => {
  render(<SongSoundNotice />);
  act(() =>
    showSongSoundNotice({
      identity: playing,
      owner: 'song',
      presetId: 'none',
    }),
  );

  expect(
    screen.getByText(translate('en', 'songSound.noticeTitle')),
  ).toBeVisible();
  expect(
    screen.getByText(
      translate('en', 'songSound.noticeBody', {
        title: 'A tune',
        preset: noName,
      }),
    ),
  ).toBeVisible();
});

it('says when the sound is the album’s, and which album', () => {
  render(<SongSoundNotice />);
  act(() =>
    showSongSoundNotice({
      identity: playing,
      owner: 'album',
      presetId: 'none',
      albumTitle: 'Night Album',
    }),
  );

  expect(
    screen.getByText(
      translate('en', 'songSound.albumNoticeTitle', { album: 'Night Album' }),
    ),
  ).toBeVisible();
  expect(
    screen.getByText(
      translate('en', 'songSound.albumNoticeBody', {
        title: 'A tune',
        preset: noName,
      }),
    ),
  ).toBeVisible();
});

it('draws nothing while no saved sound has gone on', () => {
  // The control for the cases above: the card is drawn by a sound going on.
  const { container } = render(<SongSoundNotice />);
  expect(container).toBeEmptyDOMElement();
});
