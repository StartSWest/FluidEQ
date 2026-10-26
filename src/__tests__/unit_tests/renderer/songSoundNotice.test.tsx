/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { translate } from 'common/i18n';
import type { ISongSoundEntry } from 'common/songSound';
import SongSoundNotice from 'renderer/components/SongSoundNotice';
import * as session from 'renderer/audio/songSoundSession';

/**
 * What the song memory's card says when a song's own sound goes on. The
 * memory keeps no name for a song that is not the listener's own file
 * (`songMemoryNames.ts`), so the card names the song that is playing.
 */
jest.mock('renderer/audio/songSoundSession');
jest.mock('renderer/utils/noticeTurn', () => ({
  useNoticeTurn: (_name: string, wants: boolean) => wants,
}));

const mockUseSongSoundNotice = session.useSongSoundNotice as jest.Mock;

const entry: ISongSoundEntry = {
  sound: { presetId: 'none', filters: {} },
  title: '',
  plays: 2,
  updatedAt: 1,
};

afterEach(() => {
  jest.resetAllMocks();
});

it('names the song playing, which the memory may not', () => {
  mockUseSongSoundNotice.mockReturnValue({
    kind: 'lent',
    id: 1,
    identity: {
      key: 'system:chrome.exe:a tune:',
      title: 'A tune',
      source: 'system',
    },
    entry,
  });

  render(<SongSoundNotice />);

  expect(
    screen.getByText(
      translate('en', 'songSound.noticeBodyNoPreset', { title: 'A tune' }),
    ),
  ).toBeVisible();
});

it('draws nothing while no song’s sound has gone on', () => {
  // The control for the case above: the card is drawn by the notice alone.
  mockUseSongSoundNotice.mockReturnValue(undefined);

  const { container } = render(<SongSoundNotice />);

  expect(container).toBeEmptyDOMElement();
});
