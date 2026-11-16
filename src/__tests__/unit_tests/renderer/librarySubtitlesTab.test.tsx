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
import type {
  ILibrarySubtitlesAnswer,
  TSubtitleRemoveResult,
} from 'common/library/subtitles';
import type { ILibraryTrack } from 'common/library/types';
import LibraryLyricsTab from 'renderer/library/LibraryLyricsTab';

/**
 * A video's Lyrics tab is its Subtitles: the files beside the film named by
 * language (never by file), the one in use marked and a press putting
 * another in use, the captions' style, and subtitle sites — never lyric
 * sites — to find more. The captions themselves are drawn over the film,
 * not here. A song's tab beside it is the control: it still asks for
 * lyrics and offers lyric sites. Every line was written for this test.
 */

jest.mock('renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayer: () => ({
    positionMs: 0,
    isPlaying: false,
    seek: () => undefined,
    toggle: () => undefined,
  }),
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

const THREE_FILES: ILibrarySubtitlesAnswer = {
  files: [
    { fileName: 'TAYLOR SWIFT MISS AMERICANA [2020].srt' },
    { fileName: 'TAYLOR SWIFT MISS AMERICANA [2020].2.srt', tag: '2' },
    { fileName: 'TAYLOR SWIFT MISS AMERICANA [2020].es.srt', tag: 'es' },
  ],
  shown: {
    fileName: 'TAYLOR SWIFT MISS AMERICANA [2020].es.srt',
    cues: [{ startMs: 1000, endMs: 2000, text: 'Las luces del muelle' }],
  },
  looked: [],
};

let subtitles: ILibrarySubtitlesAnswer | undefined;
const libraryTrackSubtitles = jest.fn(
  (_id: string, _wanted: string | undefined, _preferred: readonly string[]) =>
    Promise.resolve(subtitles),
);
const libraryTrackLyrics = jest.fn((): Promise<ILibraryLyricsAnswer> =>
  Promise.resolve({ looked: [] }),
);
let removeAnswer: TSubtitleRemoveResult = { state: 'removed' };
const removeLibrarySubtitle = jest.fn(
  (_id: string, _fileName: string): Promise<TSubtitleRemoveResult> =>
    Promise.resolve(removeAnswer),
);

beforeEach(() => {
  libraryTrackSubtitles.mockClear();
  libraryTrackLyrics.mockClear();
  removeLibrarySubtitle.mockClear();
  removeAnswer = { state: 'removed' };
  subtitles = undefined;
  window.localStorage.clear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        libraryTrackSubtitles,
        libraryTrackLyrics,
        pickLibrarySubtitlesFile: jest.fn(),
        importLibrarySubtitles: jest.fn(),
        removeLibrarySubtitle,
      },
    },
  });
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
    subtitles = THREE_FILES;
    await show(item('pier', 'video'));
    expect(libraryTrackSubtitles).toHaveBeenCalledWith('pier', undefined, [
      'en',
    ]);
    expect(libraryTrackLyrics).not.toHaveBeenCalled();
  });

  // Each row is the language over the file's own name, with its kind (Ivan,
  // 2026-11-15: "also show the sub name in the list").
  it('names each file by language over its own name, and marks the one in use', async () => {
    subtitles = THREE_FILES;
    await show(item('pier-names', 'video'));
    const list = screen.getByRole('radiogroup', { name: 'Subtitle files' });
    const rows = Array.from(list.querySelectorAll('[role="radio"]'));
    const read = (selector: string) =>
      rows.map((row) => row.querySelector(selector)?.textContent);
    expect(read('.library-subtitles__file-language')).toEqual([
      'Subtitles 1',
      'Subtitles 2',
      'español',
    ]);
    expect(read('.library-subtitles__file-name')).toEqual(
      THREE_FILES.files.map((file) => file.fileName),
    );
    expect(read('.library-subtitles__file-kind')).toEqual([
      'SRT',
      'SRT',
      'SRT',
    ]);
    const inUse = screen.getByRole('radio', { name: /^español/ });
    expect(inUse).toHaveAttribute('aria-checked', 'true');
    expect(inUse).toHaveClass('is-active');
    // The file it is stays reachable, in its tooltip.
    expect(inUse).toHaveAttribute(
      'title',
      'TAYLOR SWIFT MISS AMERICANA [2020].es.srt',
    );
  });

  it('puts another file in use on a press, and asks main for it', async () => {
    subtitles = THREE_FILES;
    await show(item('pier-pick', 'video'));
    fireEvent.click(screen.getByRole('radio', { name: /^Subtitles 2/ }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(libraryTrackSubtitles).toHaveBeenLastCalledWith(
      'pier-pick',
      'TAYLOR SWIFT MISS AMERICANA [2020].2.srt',
      ['en'],
    );
  });

  it('holds the captions’ style, kept for the next film', async () => {
    subtitles = THREE_FILES;
    await show(item('pier-style', 'video'));
    expect(
      screen.getByRole('checkbox', { name: 'Show captions' }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'XL' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Yellow' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Top right' }));
    expect(
      JSON.parse(
        window.localStorage.getItem('fluideq.library.subtitleStyle') ?? '{}',
      ),
    ).toMatchObject({
      size: 'xl',
      colour: 'yellow',
      position: { x: 1, y: 0 },
    });
    // The box's opacity is offered with the box alone.
    expect(
      screen.queryByRole('radiogroup', { name: 'Box opacity' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Box' }));
    expect(
      screen.getByRole('radiogroup', { name: 'Box opacity' }),
    ).toBeInTheDocument();
  });

  it('turns moving on the picture on and off from its button', async () => {
    subtitles = THREE_FILES;
    await show(item('pier-move', 'video'));
    const move = screen.getByRole('button', { name: /Move on the picture/ });
    expect(move).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(move);
    expect(screen.getByRole('button', { name: /Done moving/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /Done moving/ }));
    expect(
      screen.getByRole('button', { name: /Move on the picture/ }),
    ).toBeInTheDocument();
  });

  it('with no subtitles, names the files looked for and offers subtitle sites', async () => {
    subtitles = { files: [], looked: ['Pier.srt', 'Pier.vtt'] };
    await show(item('pier-bare', 'video'));
    expect(screen.getByText('No subtitles for this video')).toBeInTheDocument();
    expect(screen.getByText('Pier.vtt')).toBeInTheDocument();
    expect(screen.getByText('OpenSubtitles')).toBeInTheDocument();
    expect(screen.queryByText('LRCLIB')).toBeNull();
    // No style to set for captions there are none of.
    expect(screen.queryByText('Caption style')).toBeNull();
    expect(
      screen.getByRole('button', { name: /Import subtitles/ }),
    ).toBeInTheDocument();
  });
});

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

describe("a video's last used subtitles", () => {
  it('are remembered for that video and asked for when it opens again', async () => {
    subtitles = THREE_FILES;
    const { unmount } = await show(item('pier-memory', 'video'));
    fireEvent.click(screen.getByRole('radio', { name: /^Subtitles 2/ }));
    await settle();
    expect(
      JSON.parse(
        window.localStorage.getItem('fluideq.library.subtitleByVideo') ?? '[]',
      ),
    ).toEqual([['pier-memory', 'TAYLOR SWIFT MISS AMERICANA [2020].2.srt']]);
    unmount();
    libraryTrackSubtitles.mockClear();
    await show(item('pier-memory', 'video'));
    expect(libraryTrackSubtitles).toHaveBeenCalledWith(
      'pier-memory',
      'TAYLOR SWIFT MISS AMERICANA [2020].2.srt',
      ['en'],
    );
  });

  it('leave a video with no choice of its own to the language (the control)', async () => {
    subtitles = THREE_FILES;
    await show(item('pier-fresh', 'video'));
    expect(libraryTrackSubtitles).toHaveBeenCalledWith(
      'pier-fresh',
      undefined,
      ['en'],
    );
  });
});

describe('removing a subtitle file', () => {
  it('gives every row a Remove, asked in the row before anything is touched', async () => {
    subtitles = THREE_FILES;
    await show(item('pier-ask', 'video'));
    const removes = screen.getAllByRole('button', { name: /^Remove / });
    expect(removes.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Remove Subtitles 1',
      'Remove Subtitles 2',
      'Remove español',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Subtitles 1' }));
    expect(
      screen.getByText('Remove Subtitles 1? It goes to the bin.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass(
      'danger',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass(
      'subtle',
    );
    expect(removeLibrarySubtitle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByText('Remove Subtitles 1? It goes to the bin.'),
    ).toBeNull();
    expect(removeLibrarySubtitle).not.toHaveBeenCalled();
  });

  it('sends the file to main by the name it listed, and reads the list again', async () => {
    subtitles = THREE_FILES;
    await show(item('pier-remove', 'video'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Subtitles 1' }));
    libraryTrackSubtitles.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await settle();
    expect(removeLibrarySubtitle).toHaveBeenCalledWith(
      'pier-remove',
      'TAYLOR SWIFT MISS AMERICANA [2020].srt',
    );
    expect(libraryTrackSubtitles).toHaveBeenCalled();
  });

  it('puts the next file in use when the one in use is removed', async () => {
    subtitles = THREE_FILES;
    await show(item('pier-in-use', 'video'));
    // español is in use and last, so the one before it takes its place.
    fireEvent.click(screen.getByRole('button', { name: 'Remove español' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await settle();
    expect(libraryTrackSubtitles).toHaveBeenLastCalledWith(
      'pier-in-use',
      'TAYLOR SWIFT MISS AMERICANA [2020].2.srt',
      ['en'],
    );
  });

  it('says so in the row when the file could not be removed', async () => {
    subtitles = THREE_FILES;
    removeAnswer = { state: 'failed' };
    await show(item('pier-fail', 'video'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Subtitles 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await settle();
    expect(
      screen.getByText('Subtitles 2 couldn’t be removed.'),
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
