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
import {
  karaokeFileBaseName,
  setKaraokeRelativePath,
} from 'common/karaoke/files';
import { parseLrc as parseKaraokeLrc } from 'common/karaoke/lrc';
import { createKaraokeMakerProject } from 'common/karaoke/makerProject';
import { parseLrc } from 'common/library/lyrics';
import { lrcFromLines } from 'common/library/lyricsLrc';
import { setTransportSlot } from 'renderer/audio/transportSlot';
import KaraokeWorkspace from 'renderer/karaoke/KaraokeWorkspace';
import {
  createKaraokeAudioClock,
  IKaraokeAudioClock,
} from 'renderer/karaoke/karaokeAudioClock';
import { sendSongToKaraokeMaker } from 'renderer/library/karaokeHandoff';
import { FakeClockContext, openFakeClock } from '../../utils/fakeAudioClock';

/**
 * The Library's "Open in Karaoke" arriving in the Karaoke tab: the Maker
 * opens on the song with the words it was sent with, a karaoke the listener
 * was already making is opened as it was rather than overwritten, and "Save
 * to Library" hands the Maker's timing back to the song by its Library id.
 */

jest.mock('renderer/audio/LiveAudioContext', () => ({
  ...jest.requireActual('renderer/audio/LiveAudioContext'),
  useLiveAudioCapture: jest.fn(),
  useLiveAudioControl: () => ({ isPaused: false, readFrame: () => undefined }),
}));

let mockClockContext = new FakeClockContext();
let mockClock: IKaraokeAudioClock = createKaraokeAudioClock(
  openFakeClock(mockClockContext),
);
jest.mock('renderer/karaoke/karaokeAudioClock', () => ({
  ...jest.requireActual('renderer/karaoke/karaokeAudioClock'),
  useKaraokeAudioClock: () => mockClock,
}));

const LINES = [
  {
    timeMs: 1000,
    text: 'Ropes on the harbour wall',
    words: [
      { timeMs: 1000, text: 'Ropes ' },
      { timeMs: 1400, text: 'on ' },
      { timeMs: 1700, text: 'the ' },
      { timeMs: 2000, text: 'harbour ' },
      { timeMs: 2600, text: 'wall' },
    ],
  },
  { timeMs: 4000, text: 'Home before the tide' },
];

const loadKaraokeMakerDraft = jest.fn();
const saveKaraokeMakerDraft = jest.fn();
const importLibraryTrackLyrics = jest.fn();

const audioFile = () =>
  setKaraokeRelativePath(
    new File(['audio-bytes'], 'Harbour Lights.mp3', {
      type: 'audio/mpeg',
      lastModified: 1_700_000_000_000,
    }),
    'Harbour Lights.mp3',
  );

const lrcFile = () =>
  setKaraokeRelativePath(
    new File(
      [lrcFromLines(LINES, { title: 'Harbour Lights' })],
      'Harbour Lights.lrc',
      {
        type: 'text/plain',
      },
    ),
    'Harbour Lights.lrc',
  );

let barSlot: HTMLDivElement | undefined;
let canvasContext: jest.SpyInstance;

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:karaoke-song'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });
  ['load', 'pause'].forEach((name) =>
    Object.defineProperty(HTMLMediaElement.prototype, name, {
      configurable: true,
      value: jest.fn(),
    }),
  );
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });
});

beforeEach(() => {
  mockClockContext = new FakeClockContext();
  mockClock = createKaraokeAudioClock(openFakeClock(mockClockContext));
  canvasContext = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null);
  loadKaraokeMakerDraft.mockReset().mockResolvedValue(undefined);
  saveKaraokeMakerDraft.mockReset().mockResolvedValue(undefined);
  importLibraryTrackLyrics.mockReset().mockResolvedValue({
    state: 'saved',
    place: 'beside',
    fileName: 'Harbour Lights.lrc',
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      platform: 'win32',
      ipcRenderer: {
        getPathForFile: jest.fn(() => ''),
        saveKaraokeSession: jest.fn().mockResolvedValue(undefined),
        restoreKaraokeSession: jest.fn().mockResolvedValue(undefined),
        readKaraokeSessionFile: jest.fn().mockResolvedValue(undefined),
        clearKaraokeSession: jest.fn().mockResolvedValue(undefined),
        loadKaraokeMakerDraft,
        saveKaraokeMakerDraft,
        deleteKaraokeMakerDraft: jest.fn().mockResolvedValue(undefined),
        importLibraryTrackLyrics,
        loadKaraokeStems: jest.fn().mockResolvedValue(null),
        saveKaraokeStems: jest.fn().mockResolvedValue(undefined),
        releaseKaraokeSeparationModel: jest.fn(),
        cancelKaraokeSeparation: jest.fn(),
        separateKaraokeVocals: jest.fn(),
        onKaraokeSeparationProgress: jest.fn().mockReturnValue(() => {}),
      },
    },
  });
  window.localStorage.clear();
  barSlot = document.createElement('div');
  document.body.append(barSlot);
  setTransportSlot(barSlot);
});

afterEach(async () => {
  await act(async () => {
    cleanup();
    setTransportSlot(null);
  });
  barSlot?.remove();
  barSlot = undefined;
  canvasContext.mockRestore();
});

const maker = () =>
  waitFor(() => {
    const element = document.querySelector('.karaoke-maker');
    expect(element).not.toBeNull();
    return element as HTMLElement;
  });

/** What "Save to Library" sent main, read back by the Library's reader. */
const savedLines = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save to Library' }));
  await waitFor(() => expect(importLibraryTrackLyrics).toHaveBeenCalled());
  const [trackId, text, replace] = importLibraryTrackLyrics.mock.calls[0];
  return { trackId, replace, lines: parseLrc(text as string) };
};

it('writes Library lyrics the Karaoke tab reads at the same times', () => {
  // The handoff file itself: every line and word where it was held.
  const parsed = parseKaraokeLrc(lrcFromLines(LINES));
  expect(parsed.lines.map((line) => line.startMs)).toEqual([1000, 4000]);
  expect(parsed.lines[0].tokens.map((token) => token.startMs)).toEqual([
    1000, 1400, 1700, 2000, 2600,
  ]);
  expect(parseLrc(lrcFromLines(LINES))).toEqual(LINES);
});

it('opens the Maker on the song with its timed lyrics, and saves the timing back by the song id', async () => {
  render(<KaraokeWorkspace isHidden={false} />);
  act(() => {
    sendSongToKaraokeMaker({
      audio: audioFile(),
      lyrics: lrcFile(),
      origin: { trackId: 'harbour', timedInTags: false },
    });
  });
  await maker();
  expect(
    await screen.findByText(
      'Opened with the song’s timed lyrics from the Library.',
    ),
  ).toBeVisible();

  const { trackId, replace, lines } = await savedLines();
  expect(trackId).toBe('harbour');
  // Never over a file without being asked.
  expect(replace).toBe(false);
  expect(lines?.map((line) => [line.timeMs, line.text])).toEqual([
    [1000, 'Ropes on the harbour wall'],
    [4000, 'Home before the tide'],
  ]);
  expect(lines?.[0].words?.map((word) => word.timeMs)).toEqual([
    1000, 1400, 1700, 2000, 2600,
  ]);
  expect(
    await screen.findByText('Saved beside the song as Harbour Lights.lrc.'),
  ).toBeVisible();
});

it('asks in the Maker before replacing a lyrics file already beside the song', async () => {
  importLibraryTrackLyrics.mockResolvedValueOnce({
    state: 'exists',
    place: 'beside',
    fileName: 'Harbour Lights.lrc',
  });
  render(<KaraokeWorkspace isHidden={false} />);
  act(() => {
    sendSongToKaraokeMaker({
      audio: audioFile(),
      lyrics: lrcFile(),
      origin: { trackId: 'harbour', timedInTags: true },
    });
  });
  await maker();
  const { replace } = await savedLines();
  expect(replace).toBe(false);
  expect(
    await screen.findByRole('alertdialog', {
      name: 'Replace Harbour Lights.lrc?',
    }),
  ).toBeVisible();
  // Nothing more is sent until the listener answers.
  expect(importLibraryTrackLyrics).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
  await waitFor(() =>
    expect(importLibraryTrackLyrics).toHaveBeenCalledTimes(2),
  );
  expect(importLibraryTrackLyrics.mock.calls[1][2]).toBe(true);
  expect(importLibraryTrackLyrics.mock.calls[1][1]).toBe(
    importLibraryTrackLyrics.mock.calls[0][1],
  );
  // Timed words in the song's tags are read first, and the Maker says so.
  expect(
    await screen.findByText(/the Library shows those first/),
  ).toBeVisible();
});

it('opens a karaoke already being made as it was, never over it', async () => {
  const audio = audioFile();
  const songId = `${karaokeFileBaseName(audio.name)}-${audio.size}-${audio.lastModified}`;
  const draft = createKaraokeMakerProject({
    id: songId,
    title: 'Harbour Lights',
    assets: [
      { id: `${songId}-audio`, role: 'audio', file: audio, extension: 'mp3' },
    ],
    timingPrecision: 'line',
    lines: [
      {
        id: 'mine',
        kind: 'lyrics',
        startMs: 7000,
        endMs: 9000,
        tokens: [{ text: 'My own timing', startMs: 7000, endMs: 9000 }],
      },
    ],
    pitch: { kind: 'none', reason: 'missing' },
    meta: { sourceFormat: 'lrc', gapMs: 0 },
  });
  loadKaraokeMakerDraft.mockResolvedValue(draft);

  render(<KaraokeWorkspace isHidden={false} />);
  act(() => {
    sendSongToKaraokeMaker({
      audio,
      lyrics: lrcFile(),
      origin: { trackId: 'harbour', timedInTags: false },
    });
  });
  await maker();
  expect(
    await screen.findByText(/You were already making a karaoke of this song/),
  ).toBeVisible();
  // Nothing was written over the draft on the way in.
  expect(saveKaraokeMakerDraft).not.toHaveBeenCalled();
  // The project is the listener's own, not the Library's words.
  const { lines } = await savedLines();
  expect(lines?.map((line) => [line.timeMs, line.text])).toEqual([
    [7000, 'My own timing'],
  ]);
});

it('puts plain lyrics into the Maker’s lyric editor to be timed', async () => {
  render(<KaraokeWorkspace isHidden={false} />);
  act(() => {
    sendSongToKaraokeMaker({
      audio: audioFile(),
      plainText: 'Ropes on the harbour wall\nHome before the tide',
      origin: { trackId: 'harbour', timedInTags: false },
    });
  });
  await maker();
  const editor = await waitFor(() => {
    const field = document.querySelector('.karaoke-maker textarea');
    expect(field).not.toBeNull();
    return field as HTMLTextAreaElement;
  });
  expect(editor.value).toBe('Ropes on the harbour wall\nHome before the tide');
});

it('leaves no timing from an earlier send under words now sent plain', async () => {
  render(<KaraokeWorkspace isHidden={false} />);
  act(() => {
    sendSongToKaraokeMaker({
      audio: audioFile(),
      lyrics: lrcFile(),
      origin: { trackId: 'harbour', timedInTags: false },
    });
  });
  expect(
    await screen.findByText(
      'Opened with the song’s timed lyrics from the Library.',
    ),
  ).toBeVisible();
  // The timed file was removed in the Library; the song comes back plain.
  act(() => {
    sendSongToKaraokeMaker({
      audio: audioFile(),
      plainText: 'New words',
      origin: { trackId: 'harbour', timedInTags: false },
    });
  });
  await waitFor(() =>
    expect(
      (document.querySelector('.karaoke-maker textarea') as HTMLTextAreaElement)
        ?.value,
    ).toBe('New words'),
  );
  // The project under the editor holds none of the old timed lines.
  fireEvent.click(screen.getByRole('button', { name: 'Save to Library' }));
  expect(
    await screen.findByText('Nothing to save yet: no line has a time.'),
  ).toBeVisible();
  expect(importLibraryTrackLyrics).not.toHaveBeenCalled();
});
