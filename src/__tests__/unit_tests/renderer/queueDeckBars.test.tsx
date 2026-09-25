/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The three bars beside the queue's current song stand still while the
 * Library is paused. They follow the Library's own playing, not the player's
 * source: with a video playing over a paused Library, the source is the
 * video's, and the bars kept dancing for a song nobody was hearing.
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import type { ILibraryQueue } from 'common/library/queue';
import type { ILibraryTrack } from 'common/library/types';
import type { TPlaybackOwner } from 'renderer/audio/playbackOwner';
import {
  resetTransportSource,
  setTransportSource,
} from 'renderer/audio/transportSource';
import QueueDeck from 'renderer/player/QueueDeck';
import { usePublishedLibraryDeck } from 'renderer/player/libraryDeck';

jest.mock('renderer/library/LibraryCoverArt', () => () => null);

const track = {
  id: 'a',
  title: 'Song A',
  artist: 'Someone',
  durationMs: 60_000,
} as unknown as ILibraryTrack;
const queue: ILibraryQueue = {
  trackIds: ['a'],
  order: [0],
  position: 0,
  repeat: 'off',
  isShuffled: false,
};

/** Stands in for the Library's provider, which is where the deck comes from. */
const Publisher = () => {
  usePublishedLibraryDeck({
    queue,
    track,
    trackById: new Map([['a', track]]),
    isShuffled: false,
    repeat: 'off',
    stop: () => undefined,
    setShuffle: () => undefined,
    cycleRepeat: () => undefined,
    jumpToQueuePosition: () => undefined,
    addFiles: () => Promise.resolve(),
    moveUpNext: () => undefined,
  });
  return null;
};

const plays = (owner: TPlaybackOwner, isPlaying: boolean) =>
  act(() =>
    setTransportSource({
      owner,
      title: owner === 'library' ? 'Song A' : 'A video',
      isPlaying,
      positionMs: 0,
      durationMs: 60_000,
      toggle: () => undefined,
    }),
  );

const bars = (container: HTMLElement) => {
  const found = container.querySelector('.player-queue__bars');
  if (!found) {
    throw new Error('the current song should carry its bars');
  }
  return found;
};

afterEach(() => {
  act(() => resetTransportSource());
});

it('stands the bars still for a paused Library while a video plays', () => {
  const { container } = render(
    <>
      <Publisher />
      <QueueDeck onOpenLibrary={() => undefined} />
    </>,
  );
  plays('library', false);
  plays('media', true);

  expect(bars(container)).toHaveClass('is-paused');
});

it('keeps them moving while the Library plays', () => {
  const { container } = render(
    <>
      <Publisher />
      <QueueDeck onOpenLibrary={() => undefined} />
    </>,
  );
  plays('library', true);

  expect(bars(container)).not.toHaveClass('is-paused');
});
