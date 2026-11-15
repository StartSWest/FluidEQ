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
import type { ILibrarySubtitlesAnswer } from 'common/library/subtitles';
import type { ILibraryTrack } from 'common/library/types';
import LibraryLyricsTab from 'renderer/library/LibraryLyricsTab';

/**
 * A video's Lyrics tab is its Subtitles: the file beside it lit line by
 * line on the player's clock and pressed to play from a line, a language
 * picker where there are several, and subtitle sites — never lyric sites —
 * where there are none. A song's tab beside it is the control: it still
 * asks for lyrics and offers lyric sites. Every line was written for this
 * test.
 */

const mockPlayer = {
  positionMs: 0,
  isPlaying: false,
  seek: jest.fn<void, [number]>(),
  toggle: jest.fn<void, []>(),
};

jest.mock('renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayer: () => mockPlayer,
  useLibraryPlayerSessionIfAny: () => undefined,
}));

const item = (id: string, kind: 'audio' | 'video'): ILibraryTrack => ({
  id,
  rootId: 'r1',
  path: `C:\\Media\\${id}.${kind === 'video' ? 'mp4' : 'mp3'}`,
  kind,
  isPlayable: true,
  title: kind === 'video' ? 'The.Pier.2020.1080p.WEBRip' : id,
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
});

const TWO_LANGUAGES: ILibrarySubtitlesAnswer = {
  files: [{ fileName: 'Pier.srt' }, { fileName: 'Pier.es.srt', tag: 'es' }],
  shown: {
    fileName: 'Pier.es.srt',
    lines: [
      { timeMs: 1000, text: 'Las luces del muelle' },
      { timeMs: 4000, text: 'El café cerró temprano' },
    ],
  },
  looked: ['Pier.srt', 'Pier.vtt'],
};

let subtitles: ILibrarySubtitlesAnswer | undefined;
const libraryTrackSubtitles = jest.fn(
  (_id: string, _wanted: string | undefined, _preferred: readonly string[]) =>
    Promise.resolve(subtitles),
);
const libraryTrackLyrics = jest.fn((): Promise<ILibraryLyricsAnswer> =>
  Promise.resolve({ looked: [] }),
);
const pickLibrarySubtitlesFile = jest.fn();
const importLibrarySubtitles = jest.fn();

beforeEach(() => {
  mockPlayer.positionMs = 0;
  mockPlayer.isPlaying = false;
  mockPlayer.seek.mockClear();
  mockPlayer.toggle.mockClear();
  libraryTrackSubtitles.mockClear();
  libraryTrackLyrics.mockClear();
  subtitles = undefined;
  window.localStorage.clear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        libraryTrackSubtitles,
        libraryTrackLyrics,
        pickLibrarySubtitlesFile,
        importLibrarySubtitles,
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

const show = async (track: ILibraryTrack) => {
  const view = render(<LibraryLyricsTab track={track} />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

describe("a video's Subtitles tab", () => {
  it('asks main for subtitles by id, in the app’s language, and never for lyrics', async () => {
    subtitles = TWO_LANGUAGES;
    await show(item('pier', 'video'));
    expect(libraryTrackSubtitles).toHaveBeenCalledWith('pier', undefined, [
      'en',
    ]);
    expect(libraryTrackLyrics).not.toHaveBeenCalled();
    expect(screen.getByText('From Pier.es.srt')).toBeInTheDocument();
    expect(
      screen.getByRole('list', {
        name: 'Subtitles. Press a line to play from it.',
      }),
    ).toBeInTheDocument();
  });

  it('lights the line the film has reached and plays from a pressed one', async () => {
    subtitles = TWO_LANGUAGES;
    mockPlayer.positionMs = 4500;
    await show(item('pier', 'video'));
    const reached = screen.getByRole('button', {
      name: 'El café cerró temprano',
    });
    expect(reached).toHaveAttribute('aria-current', 'true');
    fireEvent.click(
      screen.getByRole('button', { name: 'Las luces del muelle' }),
    );
    expect(mockPlayer.seek).toHaveBeenCalledWith(1000);
    expect(mockPlayer.toggle).toHaveBeenCalledTimes(1);
  });

  it('offers a language picker only where there is more than one file', async () => {
    subtitles = TWO_LANGUAGES;
    const { unmount } = await show(item('pier', 'video'));
    expect(screen.getByText(/español/i)).toBeInTheDocument();
    unmount();

    subtitles = {
      ...TWO_LANGUAGES,
      files: [{ fileName: 'Pier.es.srt', tag: 'es' }],
    };
    await show(item('pier-one', 'video'));
    expect(screen.queryByText(/español/i)).toBeNull();
    expect(screen.getByText('From Pier.es.srt')).toBeInTheDocument();
  });

  it('with no subtitles, names the files looked for and offers subtitle sites', async () => {
    subtitles = { files: [], looked: ['Pier.srt', 'Pier.vtt'] };
    await show(item('pier-bare', 'video'));
    expect(screen.getByText('No subtitles for this video')).toBeInTheDocument();
    expect(screen.getByText('Pier.vtt')).toBeInTheDocument();
    expect(screen.getByText('OpenSubtitles')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Searches for “The Pier”. Download a .srt or .vtt file there, then bring it in below.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('LRCLIB')).toBeNull();
    expect(
      screen.getByRole('button', { name: /Import subtitles/ }),
    ).toBeInTheDocument();
  });
});

describe("a song's Lyrics tab beside it", () => {
  it('still asks for lyrics and offers lyric sites, never subtitles', async () => {
    await show(item('Harbour Lights', 'audio'));
    expect(libraryTrackLyrics).toHaveBeenCalledWith('Harbour Lights');
    expect(libraryTrackSubtitles).not.toHaveBeenCalled();
    expect(screen.getByText('LRCLIB')).toBeInTheDocument();
    expect(screen.queryByText('OpenSubtitles')).toBeNull();
  });
});
