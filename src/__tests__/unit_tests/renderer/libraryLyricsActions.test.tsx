/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { readKaraokeTextFile } from 'common/karaoke/files';
import type { ILibraryLyricsAnswer } from 'common/library/lyrics';
import { parseLrc } from 'common/library/lyrics';
import type { ILibraryTrack } from 'common/library/types';
import {
  takeKaraokeMakerRequest,
  type IKaraokeMakerRequest,
} from 'renderer/library/karaokeHandoff';
import LibraryLyricsTab from 'renderer/library/LibraryLyricsTab';

/**
 * The Lyrics tab's foot: "Open in Karaoke" hands the song and the words on
 * show to the Karaoke tab's Maker, and "Remove lyrics" asks first, removes
 * only a lyrics file FluidEQ may remove, and shows what is left.
 */

jest.mock('renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayer: () => ({
    positionMs: 0,
    isPlaying: false,
    seek: jest.fn(),
  }),
}));

const track = (id: string, path = `C:\\Music\\${id}.mp3`): ILibraryTrack => ({
  id,
  rootId: 'r1',
  path,
  kind: 'audio',
  isPlayable: true,
  title: 'Harbour Lights',
  artist: 'The Gulls',
  sizeBytes: 11,
  mtimeMs: 1_700_000_000_000,
  addedAt: 1,
});

const TIMED: ILibraryLyricsAnswer = {
  lyrics: {
    kind: 'synced',
    source: 'lrc',
    fileName: 'harbour.lrc',
    lines: [
      {
        timeMs: 1000,
        text: 'Ropes on the wall',
        words: [
          { timeMs: 1000, text: 'Ropes ' },
          { timeMs: 1500, text: 'on ' },
          { timeMs: 1800, text: 'the ' },
          { timeMs: 2100, text: 'wall' },
        ],
      },
      { timeMs: 4250, text: 'Home before the tide' },
    ],
  },
  looked: ['harbour.lrc', 'harbour.txt'],
};

const PLAIN_TAGS: ILibraryLyricsAnswer = {
  lyrics: { kind: 'plain', source: 'tags', text: 'Words in the tags' },
  looked: ['harbour.lrc', 'harbour.txt'],
};

const NONE: ILibraryLyricsAnswer = { looked: ['harbour.lrc', 'harbour.txt'] };

let answers: ILibraryLyricsAnswer[];
const libraryTrackLyrics = jest.fn(() =>
  Promise.resolve(answers.length > 1 ? answers.shift() : answers[0]),
);
const libraryTrackBytes = jest.fn(() =>
  Promise.resolve(new TextEncoder().encode('audio-bytes').buffer),
);
const removeLibraryTrackLyrics = jest.fn(() =>
  Promise.resolve({ state: 'removed' }),
);

beforeEach(() => {
  libraryTrackLyrics.mockClear();
  libraryTrackBytes.mockClear();
  removeLibraryTrackLyrics.mockClear();
  takeKaraokeMakerRequest();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        libraryTrackLyrics,
        libraryTrackBytes,
        removeLibraryTrackLyrics,
      },
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 300,
  });
  Element.prototype.scrollTo = jest.fn();
});

afterEach(cleanup);

/** A fresh song id per case: the tab keeps answers that found words. */
let songCount = 0;
const show = async (answer: ILibraryLyricsAnswer[], path?: string) => {
  answers = answer;
  songCount += 1;
  const id = `song-${songCount}`;
  render(<LibraryLyricsTab track={track(id, path)} />);
  await act(async () => {
    await Promise.resolve();
  });
  return id;
};

const requested = async (): Promise<IKaraokeMakerRequest> => {
  let request: IKaraokeMakerRequest | undefined;
  await waitFor(() => {
    request = takeKaraokeMakerRequest();
    expect(request).toBeDefined();
  });
  return request as IKaraokeMakerRequest;
};

describe('Open in Karaoke', () => {
  it('is offered only for a song that has lyrics and that Karaoke can play', async () => {
    await show([NONE]);
    expect(
      screen.queryByRole('button', { name: /Open in Karaoke/ }),
    ).not.toBeInTheDocument();
    cleanup();
    await show([TIMED], 'C:\\Music\\clip.mkv');
    expect(screen.getByText('Ropes on the wall')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Open in Karaoke/ }),
    ).not.toBeInTheDocument();
    cleanup();
    await show([TIMED]);
    expect(
      screen.getByRole('button', { name: /Open in Karaoke/ }),
    ).toBeInTheDocument();
  });

  it('sends the song and its timed lines, each at its own time', async () => {
    const id = await show([TIMED]);
    fireEvent.click(screen.getByRole('button', { name: /Open in Karaoke/ }));
    const request = await requested();
    expect(libraryTrackBytes).toHaveBeenCalledWith(id);
    expect(request.origin).toEqual({ trackId: id, timedInTags: false });
    expect(request.plainText).toBeUndefined();
    // The song keeps its own time, so its Maker work is found again.
    expect(request.audio.name).toBe(`${id}.mp3`);
    expect(request.audio.lastModified).toBe(1_700_000_000_000);
    // The words as the `.lrc` the playlist pairs with the song.
    const lyricsFile = request.lyrics as File;
    expect(lyricsFile.name).toBe(`${id}.lrc`);
    // Read as the Karaoke tab reads a lyrics file.
    const text = await readKaraokeTextFile(lyricsFile);
    expect(parseLrc(text)).toEqual(
      TIMED.lyrics?.kind === 'synced' ? TIMED.lyrics.lines : [],
    );
  });

  it('sends plain words as text for the Maker to time', async () => {
    await show([PLAIN_TAGS]);
    fireEvent.click(screen.getByRole('button', { name: /Open in Karaoke/ }));
    const request = await requested();
    expect(request.lyrics).toBeUndefined();
    expect(request.plainText).toBe('Words in the tags');
  });
});

describe('Remove lyrics', () => {
  it('asks first, then removes the file beside the song and shows what is left', async () => {
    const id = await show([TIMED, PLAIN_TAGS]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove lyrics' }));
    expect(
      screen.getByText(
        'Remove harbour.lrc? The lyrics file beside the song is deleted.',
      ),
    ).toBeVisible();
    // Asked, not done.
    expect(removeLibraryTrackLyrics).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(removeLibraryTrackLyrics).toHaveBeenCalledWith(id, {
        place: 'beside',
        extension: '.lrc',
      }),
    );
    // Read again: the next source down is what the tab shows.
    expect(await screen.findByText('Words in the tags')).toBeVisible();
    expect(libraryTrackLyrics).toHaveBeenCalledTimes(2);
  });

  it('keeps everything on Keep', async () => {
    await show([TIMED]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove lyrics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(removeLibraryTrackLyrics).not.toHaveBeenCalled();
    expect(screen.getByText('Ropes on the wall')).toBeInTheDocument();
  });

  it('names FluidEQ’s own copy when that is where the words came from', async () => {
    const id = await show([
      {
        lyrics: {
          kind: 'plain',
          source: 'txt',
          kept: true,
          text: 'Pasted by mistake',
        },
        looked: [],
      },
      NONE,
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove lyrics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(removeLibraryTrackLyrics).toHaveBeenCalledWith(id, {
        place: 'store',
        extension: '.txt',
      }),
    );
    expect(await screen.findByText('No lyrics in this song')).toBeVisible();
  });

  it('removes nothing from the song’s own tags, and says why', async () => {
    await show([PLAIN_TAGS]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove lyrics' }));
    expect(
      screen.getByText(/These lyrics are inside the song’s own file/),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Remove' }),
    ).not.toBeInTheDocument();
    expect(removeLibraryTrackLyrics).not.toHaveBeenCalled();
  });
});
