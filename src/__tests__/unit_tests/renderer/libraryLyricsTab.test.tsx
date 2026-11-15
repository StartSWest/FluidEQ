/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { ILibraryLyricsAnswer } from 'common/library/lyrics';
import type { ILibraryTrack } from 'common/library/types';
import LibraryLyricsTab from 'renderer/library/LibraryLyricsTab';

/**
 * The right pane's Lyrics tab: timed lines lit and followed by the player's
 * clock, a press on a line playing from it, scrolling by hand letting go of
 * the song until asked back, plain words to read, and an empty state that
 * names the files it looked for. Every line was written for this test.
 */

const mockPlayer = {
  positionMs: 0,
  isPlaying: false,
  seek: jest.fn<void, [number]>(),
  toggle: jest.fn<void, []>(),
};

jest.mock('renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayer: () => mockPlayer,
}));

const track = (id: string): ILibraryTrack => ({
  id,
  rootId: 'r1',
  path: `C:\\Music\\${id}.mp3`,
  kind: 'audio',
  isPlayable: true,
  title: id,
  album: 'Album',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
});

const SYNCED: ILibraryLyricsAnswer = {
  lyrics: {
    kind: 'synced',
    source: 'lrc',
    fileName: 'Harbour Lights.lrc',
    lines: [
      { timeMs: 1000, text: 'Ropes on the harbour wall' },
      { timeMs: 4000, text: '' },
      {
        timeMs: 8000,
        text: 'Gulls over the ferry',
        words: [
          { timeMs: 8000, text: 'Gulls ' },
          { timeMs: 8500, text: 'over ' },
          { timeMs: 9000, text: 'the ' },
          { timeMs: 9800, text: 'ferry' },
        ],
      },
      { timeMs: 12_000, text: 'Home before the tide' },
    ],
  },
  looked: ['Harbour Lights.lrc', 'Harbour Lights.txt'],
};

let answers: Record<string, ILibraryLyricsAnswer | undefined>;
const libraryTrackLyrics = jest.fn((id: string) =>
  Promise.resolve(answers[id]),
);
const scrollTo = jest.fn();

beforeEach(() => {
  mockPlayer.positionMs = 0;
  mockPlayer.isPlaying = false;
  mockPlayer.seek.mockClear();
  mockPlayer.toggle.mockClear();
  libraryTrackLyrics.mockClear();
  scrollTo.mockClear();
  answers = {};
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { libraryTrackLyrics } },
  });
  // jsdom lays nothing out: a list with height, so the line can be placed.
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 300,
  });
  Element.prototype.scrollTo = scrollTo;
});

afterEach(cleanup);

/** Renders the tab and waits for main's answer to land. */
const show = async (id: string) => {
  const view = render(<LibraryLyricsTab track={track(id)} />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

const line = (text: string) => screen.getByRole('button', { name: text });

describe('timed lyrics', () => {
  beforeEach(() => {
    answers.harbour = SYNCED;
  });

  it('asks main by the song id, and names the file the words came from', async () => {
    await show('harbour');
    expect(libraryTrackLyrics).toHaveBeenCalledWith('harbour');
    expect(screen.getByText('From Harbour Lights.lrc')).toBeInTheDocument();
  });

  it('lights the line the clock has reached, dims the ones sung', async () => {
    mockPlayer.positionMs = 500;
    const { rerender } = await show('harbour');
    expect(screen.queryByRole('button', { current: true })).toBeNull();

    mockPlayer.positionMs = 1500;
    rerender(<LibraryLyricsTab track={track('harbour')} />);
    expect(line('Ropes on the harbour wall')).toHaveAttribute(
      'aria-current',
      'true',
    );

    mockPlayer.positionMs = 12_500;
    rerender(<LibraryLyricsTab track={track('harbour')} />);
    expect(line('Home before the tide')).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(line('Ropes on the harbour wall')).toHaveClass('is-past');
    expect(line('Ropes on the harbour wall')).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('lights the active line word by word as the clock reaches each', async () => {
    mockPlayer.positionMs = 8600;
    await show('harbour');
    const words = line('Gulls over the ferry').querySelectorAll(
      '.library-lyrics__word',
    );
    expect(Array.from(words, (word) => word.className)).toEqual([
      'library-lyrics__word is-sung',
      'library-lyrics__word is-sung',
      'library-lyrics__word',
      'library-lyrics__word',
    ]);
  });

  it('carries the word on with painted frames between clock readings', async () => {
    const frames: FrameRequestCallback[] = [];
    const raf = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    const caf = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const now = jest.spyOn(performance, 'now').mockReturnValue(10_000);
    try {
      mockPlayer.positionMs = 8100;
      mockPlayer.isPlaying = true;
      await show('harbour');
      const sung = () =>
        line('Gulls over the ferry').querySelectorAll('.is-sung').length;
      expect(sung()).toBe(1);
      // 950 ms after the reading, with no new reading: the third word.
      act(() => {
        frames.shift()?.(10_950);
      });
      expect(sung()).toBe(3);
      // A clock that stops reporting never runs the words on past a second
      // after its last reading: ten seconds on, the fourth word (at 9.8 s)
      // is still waiting.
      act(() => {
        frames.shift()?.(20_000);
      });
      expect(sung()).toBe(3);
    } finally {
      raf.mockRestore();
      caf.mockRestore();
      now.mockRestore();
    }
  });

  it('jumps a playing song to a line when it is pressed, and keeps it playing', async () => {
    mockPlayer.isPlaying = true;
    await show('harbour');
    fireEvent.click(line('Home before the tide'));
    expect(mockPlayer.seek).toHaveBeenCalledWith(12_000);
    // Play again would pause it.
    expect(mockPlayer.toggle).not.toHaveBeenCalled();
  });

  it('starts a paused or stopped song from the line pressed', async () => {
    await show('harbour');
    fireEvent.click(line('Home before the tide'));
    expect(mockPlayer.seek).toHaveBeenCalledWith(12_000);
    expect(mockPlayer.toggle).toHaveBeenCalledTimes(1);
    // The jump first, so it plays from the line and not from where it was.
    expect(mockPlayer.seek.mock.invocationCallOrder[0]).toBeLessThan(
      mockPlayer.toggle.mock.invocationCallOrder[0],
    );
  });

  it('holds the line being sung in the middle as the song moves', async () => {
    mockPlayer.positionMs = 1500;
    const { rerender } = await show('harbour');
    const calls = scrollTo.mock.calls.length;
    mockPlayer.positionMs = 8200;
    rerender(<LibraryLyricsTab track={track('harbour')} />);
    expect(scrollTo.mock.calls.length).toBeGreaterThan(calls);
  });

  it('lets go of the song on a hand scroll, and comes back when asked', async () => {
    mockPlayer.positionMs = 1500;
    const { rerender } = await show('harbour');
    fireEvent.wheel(screen.getByRole('list'));
    const calls = scrollTo.mock.calls.length;

    mockPlayer.positionMs = 8200;
    rerender(<LibraryLyricsTab track={track('harbour')} />);
    expect(scrollTo.mock.calls.length).toBe(calls);

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to the playing line' }),
    );
    expect(scrollTo.mock.calls.length).toBeGreaterThan(calls);
    expect(
      screen.queryByRole('button', { name: 'Back to the playing line' }),
    ).toBeNull();
  });
});

describe('plain lyrics and none', () => {
  it('shows plain words to read, saying they came from the tags', async () => {
    answers.plain = {
      lyrics: { kind: 'plain', source: 'tags', text: 'A bell\nA boat' },
      looked: ['plain.lrc', 'plain.txt'],
    };
    const { container } = await show('plain');
    expect(container.querySelector('.library-lyrics__plain')).toHaveTextContent(
      'A bell A boat',
    );
    expect(screen.getByText('From the song’s tags')).toBeInTheDocument();
  });

  it('says there are none and names the files it looked for', async () => {
    answers.none = { looked: ['None.lrc', 'None.txt'] };
    await show('none');
    expect(screen.getByText('No lyrics in this song')).toBeInTheDocument();
    expect(screen.getByText('None.lrc')).toBeInTheDocument();
    expect(screen.getByText('None.txt')).toBeInTheDocument();
  });

  it('asks again for a song that had none, the next time it plays', async () => {
    answers.none = { looked: ['None.lrc', 'None.txt'] };
    await show('none');
    cleanup();
    await show('none');
    expect(libraryTrackLyrics).toHaveBeenCalledTimes(2);
  });

  it('asks once for a song whose words were found', async () => {
    answers.found = {
      lyrics: { kind: 'plain', source: 'txt', fileName: 'f.txt', text: 'x' },
      looked: [],
    };
    await show('found');
    cleanup();
    await show('found');
    expect(libraryTrackLyrics).toHaveBeenCalledTimes(1);
  });

  it('asks the listener to play a song when nothing plays', () => {
    render(<LibraryLyricsTab track={undefined} />);
    expect(
      screen.getByText('Play a song to see its lyrics'),
    ).toBeInTheDocument();
  });
});
