/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { ILibraryTrack } from 'common/library/types';
import LibraryUpNext from 'renderer/library/LibraryUpNext';

/**
 * Surprise me in Up Next (Ivan, 2026-11-13: "inside up next"): beside Keep
 * playing while the queue has songs, larger in an empty queue with what it
 * does written under it, never both at once, and nowhere while there is
 * nothing to surprise from or a video holds the tab.
 */

const mockTracks: ILibraryTrack[] = Array.from({ length: 3 }, (_, index) => ({
  id: `t${index}`,
  rootId: 'r1',
  path: `C:\\Music\\${index}.mp3`,
  kind: 'audio',
  isPlayable: true,
  title: `Song ${index}`,
  album: 'Album',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
}));

jest.mock('renderer/library/useLibraryTracks', () => ({
  useLibraryTracks: () => new Map(mockTracks.map((track) => [track.id, track])),
}));

let mockUpNext: {
  position: number;
  trackId: string;
  isAdded: boolean;
  isContinued: boolean;
}[] = [];
const mockSurprise = jest.fn<Promise<string | null>, []>();

jest.mock('renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayerSession: () => ({
    upNext: mockUpNext,
    jumpToQueuePosition: () => undefined,
    removeUpNextAt: () => undefined,
    moveUpNext: () => undefined,
    isContinuationOn: true,
    setIsContinuationOn: () => undefined,
    surprise: mockSurprise,
  }),
}));

const queued = () =>
  mockTracks.map((track, index) => ({
    position: index + 1,
    trackId: track.id,
    isAdded: false,
    isContinued: false,
  }));

const panel = (canSurprise: boolean) =>
  render(
    <LibraryUpNext
      isCollapsed={false}
      onCollapsedChange={() => undefined}
      restTotal={0}
      canSurprise={canSurprise}
    />,
  );

const surpriseButtons = () =>
  screen.queryAllByRole('button', { name: /Surprise me/ });

/** An animation ending inside `element`. jsdom has no AnimationEvent, so
 * the name the browser carries is put on a plain event, where React reads
 * it from. */
const animationEnded = (element: Element, animationName: string) => {
  const ended = new Event('animationend', { bubbles: true });
  Object.defineProperty(ended, 'animationName', { value: animationName });
  fireEvent(element, ended);
};

beforeEach(() => {
  mockSurprise.mockReset();
  mockSurprise.mockResolvedValue('t9');
});

afterEach(cleanup);

describe('Surprise me in Up Next', () => {
  it('stands beside Keep playing while songs are queued, and starts a surprise', async () => {
    mockUpNext = queued();
    const { container } = panel(true);
    const [button] = surpriseButtons();
    expect(surpriseButtons()).toHaveLength(1);
    // On the switch's own row, the small filled one, its hint in the tooltip.
    expect(button.closest('.library-up-next__keep')).not.toBeNull();
    expect(button).toHaveClass('button', 'small');
    expect(button).toHaveAttribute(
      'title',
      'Play a random song from your library, then more of its style',
    );
    expect(container.querySelector('.library-up-next__start')).toBeNull();

    await act(async () => {
      fireEvent.click(button);
    });
    expect(mockSurprise).toHaveBeenCalledTimes(1);
  });

  it('offers one larger button in an empty queue, with what it does under it', () => {
    mockUpNext = [];
    const { container } = panel(true);
    expect(surpriseButtons()).toHaveLength(1);
    const [button] = surpriseButtons();
    expect(button.closest('.library-up-next__start')).not.toBeNull();
    expect(button).not.toHaveClass('small');
    expect(container.querySelector('.library-up-next__keep button')).toBeNull();
    expect(screen.getByText('Nothing queued yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A random song from your library, then more of its style.',
      ),
    ).toBeInTheDocument();
  });

  it('says so when the library has nothing it can play', async () => {
    mockUpNext = [];
    mockSurprise.mockResolvedValue(null);
    panel(true);
    await act(async () => {
      fireEvent.click(surpriseButtons()[0]);
    });
    expect(
      screen.getByText('Nothing in your library can be played right now.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'A random song from your library, then more of its style.',
      ),
    ).toBeNull();
  });

  it('is offered nowhere without a shelf to surprise from', () => {
    mockUpNext = [];
    panel(false);
    expect(surpriseButtons()).toHaveLength(0);
    expect(screen.getByText('Nothing queued yet')).toBeInTheDocument();
    cleanup();
    mockUpNext = queued();
    panel(false);
    expect(surpriseButtons()).toHaveLength(0);
    // Keep playing is still there, the row's other half.
    expect(
      screen.getByRole('checkbox', { name: 'Keep playing' }),
    ).toBeInTheDocument();
  });

  it('turns its spark on the press itself, and lets it go when it has turned', () => {
    mockUpNext = queued();
    // An answer that has not come back yet: the spark does not wait for it.
    mockSurprise.mockReturnValue(
      new Promise<string | null>(() => {
        // Never settles.
      }),
    );
    panel(true);
    const [button] = surpriseButtons();
    fireEvent.click(button);
    expect(button).toHaveClass('is-sparking');
    // Another animation ending inside the button is not the spark's.
    animationEnded(button, 'something-else');
    expect(button).toHaveClass('is-sparking');
    animationEnded(button, 'library-surprise-spark');
    expect(button).not.toHaveClass('is-sparking');
  });
});
