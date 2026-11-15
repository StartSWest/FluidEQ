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
  TLyricsImportResult,
  TLyricsPickResult,
} from 'common/library/lyricsImport';
import type { ILibraryTrack } from 'common/library/types';
import LibraryLyricsTab from 'renderer/library/LibraryLyricsTab';

/**
 * The Lyrics tab's way to a song's words: searches on three lyrics sites,
 * opened in the browser, and lyrics picked, pasted or dropped, kept with the
 * song through main — asking in the tab before a file already there is
 * replaced, and showing the words as soon as they are kept.
 */

jest.mock('renderer/library/player/LibraryPlayerContext', () => ({
  useLibraryPlayer: () => ({
    positionMs: 0,
    isPlaying: false,
    seek: jest.fn(),
  }),
}));

const track = (id: string): ILibraryTrack => ({
  id,
  rootId: 'r1',
  path: `C:\\Users\\listener\\Music\\${id}.mp3`,
  kind: 'audio',
  isPlayable: true,
  title: 'Harbour Lights',
  artist: 'The Quay',
  album: 'Private Album',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
});

const KEPT: ILibraryLyricsAnswer = {
  lyrics: {
    kind: 'plain',
    source: 'txt',
    fileName: 'Harbour Lights.txt',
    text: 'Salt on the rope',
  },
  looked: ['Harbour Lights.lrc', 'Harbour Lights.txt'],
};

let answers: Record<string, ILibraryLyricsAnswer | undefined>;
let picked: TLyricsPickResult;
let imports: TLyricsImportResult[];
const libraryTrackLyrics = jest.fn((trackId: string) =>
  Promise.resolve(answers[trackId]),
);
const pickLibraryLyricsFile = jest.fn(() => Promise.resolve(picked));
const importLibraryTrackLyrics = jest.fn(
  (trackId: string, _text: string, _replace: boolean) => {
    const result = imports.shift();
    if (result?.state === 'saved') {
      answers[trackId] = KEPT;
    }
    return Promise.resolve(result);
  },
);
const open = jest.fn();
// A song of its own for each test: the tab keeps the words it found for the
// session, so a song given words in one test would have them in the next.
let id = '';
let songs = 0;

beforeEach(() => {
  songs += 1;
  id = `song-${songs}`;
  answers = {};
  imports = [];
  picked = { state: 'canceled' };
  libraryTrackLyrics.mockClear();
  pickLibraryLyricsFile.mockClear();
  importLibraryTrackLyrics.mockClear();
  open.mockClear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        libraryTrackLyrics,
        pickLibraryLyricsFile,
        importLibraryTrackLyrics,
      },
    },
  });
  jest.spyOn(window, 'open').mockImplementation(open);
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.scrollTo = jest.fn();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

/** Lets every answer from main land. */
const settle = async () => {
  await act(async () => {
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve);
    });
  });
  await act(async () => {
    await Promise.resolve();
  });
};

const show = async (id: string) => {
  const view = render(<LibraryLyricsTab track={track(id)} />);
  await settle();
  return view;
};

describe('finding a song’s lyrics', () => {
  it('opens each site’s search for the artist and title in the browser', async () => {
    answers[id] = { looked: ['Harbour Lights.lrc', 'Harbour Lights.txt'] };
    await show(id);
    fireEvent.click(screen.getByRole('button', { name: /LRCLIB/ }));
    fireEvent.click(screen.getByRole('button', { name: /Genius/ }));
    fireEvent.click(screen.getByRole('button', { name: /Musixmatch/ }));
    expect(open.mock.calls).toEqual([
      [
        'https://lrclib.net/search/The%20Quay%20Harbour%20Lights',
        '_blank',
        'noopener',
      ],
      [
        'https://genius.com/search?q=The%20Quay%20Harbour%20Lights',
        '_blank',
        'noopener',
      ],
      [
        'https://www.musixmatch.com/search/The%20Quay%20Harbour%20Lights',
        '_blank',
        'noopener',
      ],
    ]);
  });

  it('makes importing the loud action when the song has no lyrics', async () => {
    answers[id] = { looked: [] };
    await show(id);
    expect(
      screen.getByRole('button', { name: 'Import lyrics…' }),
    ).not.toHaveClass('subtle');
    expect(screen.getByRole('button', { name: 'Paste' })).toHaveClass('subtle');
  });
});

describe('bringing lyrics in', () => {
  it('keeps a picked file with the song and shows the words at once', async () => {
    answers[id] = { looked: [] };
    picked = { state: 'picked', text: 'Salt on the rope' };
    imports = [
      { state: 'saved', place: 'beside', fileName: 'Harbour Lights.txt' },
    ];
    await show(id);
    fireEvent.click(screen.getByRole('button', { name: 'Import lyrics…' }));
    await settle();
    await settle();
    expect(importLibraryTrackLyrics).toHaveBeenCalledWith(
      id,
      'Salt on the rope',
      false,
    );
    expect(screen.getByText('Salt on the rope')).toBeInTheDocument();
    expect(
      screen.getByText('Saved beside the song as Harbour Lights.txt'),
    ).toBeInTheDocument();
    expect(libraryTrackLyrics).toHaveBeenCalledTimes(2);
  });

  it('asks in the tab before replacing a lyrics file, and replaces only on yes', async () => {
    answers[id] = { looked: [] };
    picked = { state: 'picked', text: 'Salt on the rope' };
    imports = [
      { state: 'exists', place: 'beside', fileName: 'Harbour Lights.txt' },
      { state: 'saved', place: 'beside', fileName: 'Harbour Lights.txt' },
    ];
    await show(id);
    fireEvent.click(screen.getByRole('button', { name: 'Import lyrics…' }));
    await settle();
    expect(
      screen.getByText(
        'Harbour Lights.txt is already beside the song. Replace it?',
      ),
    ).toBeInTheDocument();
    expect(importLibraryTrackLyrics).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await settle();
    await settle();
    expect(importLibraryTrackLyrics).toHaveBeenLastCalledWith(
      id,
      'Salt on the rope',
      true,
    );
    expect(screen.getByText('Salt on the rope')).toBeInTheDocument();
  });

  it('keeps the old file when told to, sending nothing more', async () => {
    answers[id] = { looked: [] };
    picked = { state: 'picked', text: 'Salt on the rope' };
    imports = [
      { state: 'exists', place: 'beside', fileName: 'Harbour Lights.txt' },
    ];
    await show(id);
    fireEvent.click(screen.getByRole('button', { name: 'Import lyrics…' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Keep the old one' }));
    expect(screen.queryByText(/Replace it\?/)).toBeNull();
    expect(importLibraryTrackLyrics).toHaveBeenCalledTimes(1);
  });

  it('keeps pasted words, and says where when FluidEQ had to keep them', async () => {
    answers[id] = { looked: [] };
    imports = [
      { state: 'saved', place: 'store', fileName: 'Harbour Lights.txt' },
    ];
    importLibraryTrackLyrics.mockImplementationOnce((trackId) => {
      imports.shift();
      answers[trackId] = {
        lyrics: { kind: 'plain', source: 'txt', kept: true, text: 'Gulls' },
        looked: [],
      };
      return Promise.resolve({
        state: 'saved',
        place: 'store',
        fileName: 'Harbour Lights.txt',
      });
    });
    await show(id);
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
    const box = screen.getByRole('textbox', {
      name: 'Lyrics to keep with this song',
    });
    expect(screen.getByRole('button', { name: 'Save lyrics' })).toBeDisabled();
    fireEvent.change(box, { target: { value: 'Gulls' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save lyrics' }));
    await settle();
    await settle();
    expect(importLibraryTrackLyrics).toHaveBeenCalledWith(id, 'Gulls', false);
    expect(
      screen.getByText(
        'Saved in FluidEQ’s lyrics folder: the song’s folder can’t be written',
      ),
    ).toBeInTheDocument();
  });

  it('refuses a dropped file that is not lyrics, without asking main', async () => {
    answers[id] = { looked: [] };
    const { container } = await show(id);
    const tab = container.querySelector('.library-lyrics');
    if (tab === null) {
      throw new Error('no tab');
    }
    const file = new File(['ID3'], 'Harbour Lights.mp3', {
      type: 'audio/mpeg',
    });
    fireEvent.drop(tab, { dataTransfer: { files: [file], types: ['Files'] } });
    await settle();
    expect(
      screen.getByText('Only a .lrc or .txt file can be imported.'),
    ).toBeInTheDocument();
    expect(importLibraryTrackLyrics).not.toHaveBeenCalled();
  });

  it('lets the Library card hear a drop it took, marked as taken', async () => {
    // The card adds dropped folders and lights its edge while a drag is
    // over it; it must hear this drop to put the edge out, and must see it
    // was taken so it adds nothing (`LibraryWorkspaceView`).
    answers[id] = { looked: [] };
    const heard: boolean[] = [];
    const { container } = render(
      <div
        onDragOver={(event) => heard.push(event.defaultPrevented)}
        onDrop={(event) => heard.push(event.defaultPrevented)}
      >
        <LibraryLyricsTab track={track(id)} />
      </div>,
    );
    await settle();
    const tab = container.querySelector('.library-lyrics');
    if (tab === null) {
      throw new Error('no tab');
    }
    // Refused by its name before it is read: the drop's path, not the read,
    // is what this case is about.
    const file = new File(['ID3'], 'Harbour Lights.mp3', {
      type: 'audio/mpeg',
    });
    const dataTransfer = {
      files: [file],
      types: ['Files'],
      dropEffect: 'none',
    };
    fireEvent.dragOver(tab, { dataTransfer });
    fireEvent.drop(tab, { dataTransfer });
    expect(heard).toEqual([true, true]);
  });

  it('reaches the same controls from a song that has words, quietly', async () => {
    answers[id] = KEPT;
    await show(id);
    fireEvent.click(screen.getByRole('button', { name: 'Find other lyrics' }));
    expect(screen.getByRole('button', { name: 'Import lyrics…' })).toHaveClass(
      'subtle',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to the lyrics' }));
    expect(screen.getByText('Salt on the rope')).toBeInTheDocument();
  });
});
