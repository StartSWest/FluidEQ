/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a moving song costs the Karaoke tab.
 *
 * The playhead, the singer's pitch and the microphone's level were state of
 * the whole workspace, so each tick — forty to sixty a second while somebody
 * sang — re-rendered all of it, published a new position to the register
 * every reader of which re-rendered too, and a timer saved the session to
 * disk every second and a half whether anything had changed or not.
 */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { setTransportSlot } from '../../renderer/audio/transportSlot';
import { useTransportSources } from '../../renderer/audio/transportSource';
import KaraokeWorkspace from '../../renderer/karaoke/KaraokeWorkspace';

let mockWorkspaceRenders = 0;
// Drawn straight from the workspace's own render and nowhere else — never
// behind a memo or a subscription — so its renders are the workspace's.
jest.mock('../../renderer/karaoke/KaraokePaneSplitter', () => ({
  __esModule: true,
  default: () => {
    mockWorkspaceRenders += 1;
    return null;
  },
}));

/**
 * Whether the stage's words and pitch lane may run their frame loops, as the
 * workspace last said. The Maker's own preview of the words is left out: it
 * is the one drawing while the Maker is open.
 */
const mockStageLoops: { lyrics?: boolean; lane?: boolean } = {};
jest.mock('../../renderer/karaoke/KaraokeLyrics', () => ({
  __esModule: true,
  default: (props: { isActive?: boolean; showFollowButton?: boolean }) => {
    if (props.showFollowButton === undefined) {
      mockStageLoops.lyrics = props.isActive ?? true;
    }
    return null;
  },
}));
jest.mock('../../renderer/karaoke/KaraokePitchLane', () => ({
  __esModule: true,
  default: (props: { isActive: boolean }) => {
    mockStageLoops.lane = props.isActive;
    return null;
  },
}));

/**
 * The position of every publish to the register, in order. A reader of the
 * register renders once per publish, which is the cost being counted.
 */
const published: number[] = [];
const RegisterReader = () => {
  const positionMs = useTransportSources().karaoke?.positionMs;
  if (positionMs !== undefined) {
    published.push(positionMs);
  }
  return null;
};

describe('KaraokeWorkspace while a song moves', () => {
  let barSlot: HTMLDivElement;
  const getPathForFile = jest.fn((_file: File) => '');
  const saveKaraokeSession = jest.fn().mockResolvedValue(undefined);
  const restoreKaraokeSession = jest.fn().mockResolvedValue(undefined);

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:karaoke-song'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
  });

  beforeEach(() => {
    mockWorkspaceRenders = 0;
    mockStageLoops.lyrics = undefined;
    mockStageLoops.lane = undefined;
    published.length = 0;
    getPathForFile.mockReset().mockReturnValue('');
    saveKaraokeSession.mockReset().mockResolvedValue(undefined);
    restoreKaraokeSession.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        platform: 'win32',
        ipcRenderer: {
          getPathForFile,
          saveKaraokeSession,
          restoreKaraokeSession,
          readKaraokeSessionFile: jest.fn().mockResolvedValue(undefined),
          clearKaraokeSession: jest.fn().mockResolvedValue(undefined),
          loadKaraokeMakerDraft: jest.fn().mockResolvedValue(undefined),
          saveKaraokeMakerDraft: jest.fn().mockResolvedValue(undefined),
          deleteKaraokeMakerDraft: jest.fn().mockResolvedValue(undefined),
          loadKaraokeStems: jest.fn().mockResolvedValue(null),
          saveKaraokeStems: jest.fn().mockResolvedValue(undefined),
          releaseKaraokeSeparationModel: jest.fn(),
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
    barSlot.remove();
    jest.useRealTimers();
    // Back to jsdom's own answer, from its prototype.
    Reflect.deleteProperty(document, 'hidden');
  });

  const openSong = async (name: string) => {
    const view = render(
      <>
        <KaraokeWorkspace isHidden={false} />
        <RegisterReader />
      </>,
    );
    await waitFor(() => expect(restoreKaraokeSession).toHaveBeenCalled());
    fireEvent.change(
      view.container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [new File(['audio'], `${name}.mp3`, { type: 'audio/mpeg' })],
        },
      },
    );
    expect(await screen.findByRole('heading', { name })).toBeVisible();
    const audio = view.container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 60,
    });
    // jsdom never selects a source, and the session only calls a stopped
    // element paused once one has been.
    Object.defineProperty(audio, 'currentSrc', {
      configurable: true,
      value: 'blob:karaoke-song',
    });
    fireEvent.durationChange(audio);
    return audio;
  };

  const setDocumentHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: hidden,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  };

  it('stands the stage down while the Maker covers it, and brings it back when it closes', async () => {
    await openSong('Covered');
    // The control: an uncovered stage runs both loops.
    expect(mockStageLoops).toEqual({ lyrics: true, lane: true });

    fireEvent.click(screen.getByRole('button', { name: 'Make' }));
    expect(
      await screen.findByRole('button', { name: 'Close maker' }),
    ).toBeVisible();
    // Covered is not hidden — nothing told the stage it could not be seen —
    // and both loops drew every frame under the Maker.
    expect(mockStageLoops).toEqual({ lyrics: false, lane: false });

    fireEvent.click(screen.getByRole('button', { name: 'Close maker' }));
    await waitFor(() =>
      expect(mockStageLoops).toEqual({ lyrics: true, lane: true }),
    );
  });

  it('moves the readout at the foot of the window without re-rendering the workspace', async () => {
    const audio = await openSong('Ticking');
    fireEvent.playing(audio);
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeVisible();
    const clock = () =>
      barSlot.querySelector('.karaoke-transport__time') as HTMLElement;
    const rendersWhilePlaying = mockWorkspaceRenders;
    expect(rendersWhilePlaying).toBeGreaterThan(0);

    audio.currentTime = 2.3;
    await waitFor(() => expect(clock()).toHaveTextContent('0:02'));
    audio.currentTime = 5.1;
    await waitFor(() => expect(clock()).toHaveTextContent('0:05'));

    // The control: the readout moved, twice, on the playhead alone.
    expect(mockWorkspaceRenders).toBe(rendersWhilePlaying);
  });

  it('tells the register the position at the quarter second, and only when that moves', async () => {
    const audio = await openSong('Quarters');
    fireEvent.playing(audio);
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeVisible();
    // The seek line takes the playhead as it is, to its own 100 ms step.
    const seekLine = () =>
      barSlot.querySelector(
        '.karaoke-transport__timeline input[type="range"]',
      ) as HTMLInputElement;
    published.length = 0;

    audio.currentTime = 2.3;
    await waitFor(() => expect(seekLine().value).toBe('2300'));
    // The same quarter second: the playhead moved and the register was not
    // told again.
    audio.currentTime = 2.2;
    await waitFor(() => expect(seekLine().value).toBe('2200'));
    audio.currentTime = 5.1;
    await waitFor(() => expect(published).toContain(5_000));

    expect(published).toEqual([2_250, 5_000]);
  });

  /*
   * Nothing writes during continuous playback otherwise, so a crash three
   * minutes into a song came back to where it was chosen. The place follows
   * the element's own time, once per five seconds of the song, into the
   * renderer's record only.
   */
  it('keeps its place in the renderer’s own record while a song plays, and asks main nothing', async () => {
    getPathForFile.mockImplementation(
      (file: File) => `C:\\Music\\${file.name}`,
    );
    const audio = await openSong('Remember');
    await waitFor(() => expect(saveKaraokeSession).toHaveBeenCalled());
    const saved = saveKaraokeSession.mock.calls.length;
    const place = () =>
      JSON.parse(
        window.localStorage.getItem('fluideq.karaoke.current-progress.v1') ??
          '{}',
      ).playheadMs;

    fireEvent.playing(audio);
    audio.currentTime = 6.2;
    fireEvent.timeUpdate(audio);
    expect(place()).toBe(6_200);

    // Within the same five seconds of the song: not written again.
    audio.currentTime = 8.9;
    fireEvent.timeUpdate(audio);
    expect(place()).toBe(6_200);

    // The next five: written.
    audio.currentTime = 10.1;
    fireEvent.timeUpdate(audio);
    expect(place()).toBe(10_100);

    expect(saveKaraokeSession).toHaveBeenCalledTimes(saved);
  });

  it('saves the session on a pause, never on a clock, and never the same one twice', async () => {
    getPathForFile.mockImplementation(
      (file: File) => `C:\\Music\\${file.name}`,
    );
    const audio = await openSong('Remember');
    await waitFor(() =>
      expect(saveKaraokeSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ selectedPlaylistId: 'remember.mp3' }),
      ),
    );
    const savedOnOpening = saveKaraokeSession.mock.calls.length;

    // It used to save every 1.5 seconds for as long as the tab was mounted.
    jest.useFakeTimers();
    act(() => {
      jest.advanceTimersByTime(15_000);
    });
    jest.useRealTimers();
    expect(saveKaraokeSession).toHaveBeenCalledTimes(savedOnOpening);

    fireEvent.playing(audio);
    audio.currentTime = 12;
    fireEvent.pause(audio);
    await waitFor(() =>
      expect(saveKaraokeSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ playheadMs: 12_000 }),
      ),
    );
    const savedOnPause = saveKaraokeSession.mock.calls.length;
    expect(savedOnPause).toBe(savedOnOpening + 1);

    // Nothing has changed since: going out of sight sends nothing.
    setDocumentHidden(true);
    setDocumentHidden(false);
    expect(saveKaraokeSession).toHaveBeenCalledTimes(savedOnPause);

    // A seek goes to the renderer's own record at once, and to main with the
    // next reason to save — which a changed place then is.
    audio.currentTime = 20;
    fireEvent.seeked(audio);
    expect(
      JSON.parse(
        window.localStorage.getItem('fluideq.karaoke.current-progress.v1') ??
          '{}',
      ),
    ).toMatchObject({ selectedPlaylistId: 'remember.mp3', playheadMs: 20_000 });
    expect(saveKaraokeSession).toHaveBeenCalledTimes(savedOnPause);
    setDocumentHidden(true);
    setDocumentHidden(false);
    expect(saveKaraokeSession).toHaveBeenCalledTimes(savedOnPause + 1);
    expect(saveKaraokeSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ playheadMs: 20_000 }),
    );
  });
});
