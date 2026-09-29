/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  karaokeFileBaseName,
  setKaraokeRelativePath,
} from '../../common/karaoke/files';
import { createKaraokeMakerProject } from '../../common/karaoke/makerProject';
import { parseUltraStar } from '../../common/karaoke/ultrastar';
import { setTransportSlot } from '../../renderer/audio/transportSlot';
import KaraokeWorkspace from '../../renderer/karaoke/KaraokeWorkspace';
import { sendFilesToKaraoke } from '../../renderer/library/karaokeHandoff';
import { karaokeLayoutStorageKey } from '../../renderer/karaoke/karaokeLayout';
import {
  createKaraokeAudioClock,
  IKaraokeAudioClock,
} from '../../renderer/karaoke/karaokeAudioClock';
import { FakeClockContext, openFakeClock } from '../utils/fakeAudioClock';

/**
 * The count-in, the Maker's countdown and its auditions keep time on the sound
 * card's clock, which jsdom does not have. One clock the test moves by hand,
 * shared by the workspace and its Maker as the real one is.
 */
let mockClockContext = new FakeClockContext();
let mockClock: IKaraokeAudioClock = createKaraokeAudioClock(
  openFakeClock(mockClockContext),
);
jest.mock('../../renderer/karaoke/karaokeAudioClock', () => ({
  ...jest.requireActual('../../renderer/karaoke/karaokeAudioClock'),
  useKaraokeAudioClock: () => mockClock,
}));

/** An animation's end, named, as the element's own or bubbled from a child. */
const animationEnd = (element: Element, animationName: string) => {
  const event = new Event('animationend', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  act(() => {
    element.dispatchEvent(event);
  });
};

/**
 * Moves the sound card's clock on, once any waiting `resume()` has settled,
 * and lets what the cues set off — a `play()` that resolves — land inside
 * `act` as well.
 */
const advanceAudioClock = async (seconds: number) => {
  await act(async () => undefined);
  await act(async () => {
    mockClockContext.advance(seconds);
  });
};

const fireTestPointer = (
  target: Element,
  type: string,
  pointerId: number,
  clientX: number,
  clientY = 0,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
  });
  fireEvent(target, event);
};

describe('KaraokeWorkspace sessions and layout', () => {
  const originalMatchMedia = window.matchMedia;
  let barSlot: HTMLDivElement | undefined;
  const createObjectURL = jest.fn(() => 'blob:karaoke-song');
  const revokeObjectURL = jest.fn();
  const load = jest.fn();
  const pause = jest.fn();
  const play = jest.fn().mockResolvedValue(undefined);
  const getPathForFile = jest.fn((_file: File) => '');
  const saveKaraokeSession = jest.fn().mockResolvedValue(undefined);
  const restoreKaraokeSession = jest.fn().mockResolvedValue(undefined);
  const readKaraokeSessionFile = jest.fn().mockResolvedValue(undefined);
  const clearKaraokeSession = jest.fn().mockResolvedValue(undefined);
  const loadKaraokeMakerDraft = jest.fn().mockResolvedValue(undefined);
  const saveKaraokeMakerDraft = jest.fn().mockResolvedValue(undefined);
  const deleteKaraokeMakerDraft = jest.fn().mockResolvedValue(undefined);

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: load,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pause,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: play,
    });
  });

  beforeEach(() => {
    mockClockContext = new FakeClockContext();
    mockClock = createKaraokeAudioClock(openFakeClock(mockClockContext));
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    load.mockClear();
    pause.mockClear();
    play.mockClear();
    getPathForFile.mockReset().mockReturnValue('');
    saveKaraokeSession.mockReset().mockResolvedValue(undefined);
    restoreKaraokeSession.mockReset().mockResolvedValue(undefined);
    readKaraokeSessionFile.mockReset().mockResolvedValue(undefined);
    clearKaraokeSession.mockReset().mockResolvedValue(undefined);
    loadKaraokeMakerDraft.mockReset().mockResolvedValue(undefined);
    saveKaraokeMakerDraft.mockReset().mockResolvedValue(undefined);
    deleteKaraokeMakerDraft.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        platform: 'win32',
        ipcRenderer: {
          getPathForFile,
          saveKaraokeSession,
          restoreKaraokeSession,
          readKaraokeSessionFile,
          clearKaraokeSession,
          loadKaraokeMakerDraft,
          saveKaraokeMakerDraft,
          deleteKaraokeMakerDraft,
          // The separation surface. Stems resolve to "none on disk" so the
          // restore effect stays quiet unless a test says otherwise.
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

    // The strip of the shared transport bar this tab draws into.
    //
    // The app has one bar and karaoke portals its controls — faders, jumps
    // and pitch tone — into it rather than drawing a second row of its own.
    // Without the node the bar supplies there is nowhere for them to land, so
    // a workspace mounted alone has no play button at all. This is the bar's
    // own ref callback, given a node to hand over.
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
    jest.useRealTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
  });

  const finishCountIn = async (container: HTMLElement) => {
    const cue = () =>
      container.querySelector('.karaoke-count-in strong') as HTMLElement;
    await waitFor(() => expect(cue()).toHaveTextContent('1'));
    await advanceAudioClock(0.551);
    expect(cue()).toHaveTextContent('2');
    await advanceAudioClock(0.55);
    expect(cue()).toHaveTextContent('3');
    await advanceAudioClock(0.55);
    expect(cue()).toHaveTextContent('GO');
  };

  it('opens an existing karaoke with the current player timing instead of a shifted saved draft', async () => {
    const canvasContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    const audio = new File(['audio'], 'Existing karaoke.mp3', {
      type: 'audio/mpeg',
      lastModified: 123,
    });
    const lyricText =
      '#TITLE:Existing karaoke\n#ARTIST:Timing test\n#BPM:120\n#GAP:1000\n: 0 4 0 Hello\nE';
    const lyrics = new File([lyricText], 'Existing karaoke.txt', {
      type: 'text/plain',
      lastModified: 123,
    });
    const parsed = parseUltraStar(lyricText);
    const songId = `${karaokeFileBaseName(audio.name)}-${audio.size}-${audio.lastModified}`;
    const saved = createKaraokeMakerProject({
      id: songId,
      title: parsed.title ?? 'Existing karaoke',
      artist: parsed.artist,
      assets: [
        {
          id: `${songId}-audio`,
          role: 'audio',
          file: audio,
          extension: 'mp3',
        },
      ],
      timingPrecision: parsed.timingPrecision,
      lines: parsed.lines,
      pitch: parsed.pitch,
      meta: {
        sourceFormat: parsed.sourceFormat,
        gapMs: parsed.gapMs,
        bpm: parsed.bpm,
      },
    });
    saved.meta.gapMs = 9_000;
    saved.updatedAt = new Date(Date.now() + 1_000).toISOString();
    saved.lyrics.lines.forEach((line) => {
      line.tokens.forEach((token) => {
        if (token.startMs !== undefined) {
          token.startMs += 8_000;
        }
        if (token.endMs !== undefined) {
          token.endMs += 8_000;
        }
      });
    });
    saved.melody.notes.forEach((note) => {
      note.startMs += 8_000;
      note.endMs += 8_000;
    });
    loadKaraokeMakerDraft.mockResolvedValue(saved);

    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      { target: { files: [audio, lyrics] } },
    );
    expect(
      await screen.findByRole('heading', { name: 'Existing karaoke' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));

    expect(
      await screen.findByText(
        'Using the current player timing. Undo restores your saved draft.',
      ),
    ).toBeVisible();
    // Gone on its fade's end: the drift beside it ends at once under reduced
    // motion and must not take it down.
    const toast = container.querySelector(
      '.karaoke-maker__toast',
    ) as HTMLElement;
    animationEnd(toast, 'karaoke-maker-toast-drift');
    expect(toast).toBeInTheDocument();
    animationEnd(toast, 'karaoke-maker-toast');
    expect(toast).not.toBeInTheDocument();
    const timingButton = screen.getByRole('button', {
      name: 'Lyrics timing',
    });
    fireEvent.click(timingButton);
    expect(
      screen.getByRole('dialog', { name: 'Lyrics timing' }),
    ).toHaveTextContent('1000 ms');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.queryByText('Draft restored')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    if (!screen.queryByRole('dialog', { name: 'Lyrics timing' })) {
      fireEvent.click(timingButton);
    }
    expect(
      screen.getByRole('dialog', { name: 'Lyrics timing' }),
    ).toHaveTextContent('9000 ms');
    canvasContext.mockRestore();
  });

  it('moves the editor playhead silently while it is dragged', async () => {
    const canvasContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    const audioFile = new File(['audio'], 'Audible scrub.mp3', {
      type: 'audio/mpeg',
    });
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      { target: { files: [audioFile] } },
    );
    expect(
      await screen.findByRole('heading', { name: 'Audible scrub' }),
    ).toBeVisible();
    const audio = container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 12,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));
    const maker = await waitFor(() => {
      const element = container.querySelector('.karaoke-maker');
      expect(element).toBeInTheDocument();
      return element as HTMLElement;
    });
    const editorCanvas = maker.querySelector(
      '.karaoke-maker__canvas',
    ) as HTMLCanvasElement;
    jest.spyOn(editorCanvas, 'getBoundingClientRect').mockReturnValue({
      bottom: 420,
      height: 400,
      left: 0,
      right: 1000,
      top: 20,
      width: 1000,
      x: 0,
      y: 20,
      toJSON: () => ({}),
    });
    Object.defineProperties(editorCanvas, {
      setPointerCapture: { configurable: true, value: jest.fn() },
      hasPointerCapture: {
        configurable: true,
        value: jest.fn(() => true),
      },
      releasePointerCapture: { configurable: true, value: jest.fn() },
    });

    play.mockClear();
    pause.mockClear();
    fireTestPointer(editorCanvas, 'pointerdown', 23, 300);
    const heldTime = audio.currentTime;

    expect(heldTime).toBeGreaterThan(2);
    expect(play).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalledTimes(1);

    fireTestPointer(editorCanvas, 'pointermove', 23, 600);
    const movedTime = audio.currentTime;
    expect(movedTime).toBeGreaterThan(heldTime);
    expect(play).not.toHaveBeenCalled();
    fireTestPointer(editorCanvas, 'pointerup', 23, 600);
    expect(audio.currentTime).toBeCloseTo(movedTime, 3);
    expect(pause).toHaveBeenCalledTimes(1);
    canvasContext.mockRestore();
  });

  it('only applies the idle fade to the full-screen actions', async () => {
    const { rerender } = render(
      <KaraokeWorkspace isHidden={false} isFullScreen isChromeIdle />,
    );
    await act(async () => Promise.resolve());

    expect(
      screen.getByRole('toolbar', { name: 'Karaoke actions' }),
    ).toHaveClass('is-stage-toolbar', 'is-idle');

    rerender(<KaraokeWorkspace isHidden={false} isChromeIdle />);
    expect(
      screen.getByRole('toolbar', { name: 'Karaoke actions' }),
    ).not.toHaveClass('is-stage-toolbar', 'is-idle');
  });

  it('uses the fullscreen layout without duplicating Karaoke chrome under a graph', async () => {
    const { container } = render(
      <KaraokeWorkspace isHidden={false} isFullScreen isGraphOverlay />,
    );
    await act(async () => Promise.resolve());

    expect(container.querySelector('.karaoke-workspace')).toHaveClass(
      'is-fullscreen',
      'is-graph-overlay',
    );
    expect(
      screen.queryByRole('toolbar', { name: 'Karaoke actions' }),
    ).not.toBeInTheDocument();
  });

  it('persists independent normal and fullscreen splitter layouts', async () => {
    const { container, rerender } = render(
      <KaraokeWorkspace isHidden={false} />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(['audio'], 'Resizable.mp3', { type: 'audio/mpeg' })],
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Resizable' }),
    ).toBeVisible();
    const normalPitchSplitter = screen.getByRole('separator', {
      name: 'Resize pitch lane',
    });
    expect(normalPitchSplitter).toHaveAttribute('aria-valuenow', '34');
    fireEvent.keyDown(normalPitchSplitter, { key: 'ArrowUp' });
    const normalPitchValue = normalPitchSplitter.getAttribute('aria-valuenow');
    const normalPlaylistSplitter = screen.getByRole('separator', {
      name: 'Resize playlist and stage',
    });
    expect(normalPlaylistSplitter).toHaveAttribute('aria-valuenow', '27');
    fireEvent.keyDown(normalPlaylistSplitter, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse playlist' }));

    const normal = JSON.parse(
      window.localStorage.getItem(karaokeLayoutStorageKey('normal')) ?? '{}',
    );
    expect(normal.playlistCollapsed).toBe(true);
    expect(normal.playlistShare).toBeGreaterThan(0.27);
    expect(normal.pitchShare).toBeGreaterThan(0.34);
    expect(
      screen.getByRole('button', { name: 'Expand playlist' }),
    ).toBeVisible();
    // Folded, not gone, so the column can close around it; and nothing in it
    // can be reached while it cannot be seen.
    expect(
      screen.getByRole('complementary', { name: 'Playlist' }),
    ).toHaveAttribute('inert');

    rerender(<KaraokeWorkspace isHidden={false} isFullScreen />);

    expect(
      screen.getByRole('button', { name: 'Collapse playlist' }),
    ).toBeVisible();
    expect(
      screen.getByRole('separator', { name: 'Resize playlist and stage' }),
    ).toHaveAttribute('aria-valuenow', '22');
    const fullscreenPitchSplitter = screen.getByRole('separator', {
      name: 'Resize pitch lane',
    });
    expect(fullscreenPitchSplitter).toHaveAttribute('aria-valuenow', '40');
    fireEvent.keyDown(fullscreenPitchSplitter, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('button', { name: 'Collapse playlist' }));

    const fullscreen = JSON.parse(
      window.localStorage.getItem(karaokeLayoutStorageKey('fullscreen')) ??
        '{}',
    );
    expect(fullscreen.playlistCollapsed).toBe(true);
    expect(fullscreen.pitchShare).toBeLessThan(0.4);

    rerender(<KaraokeWorkspace isHidden={false} />);
    expect(
      screen.getByRole('button', { name: 'Expand playlist' }),
    ).toBeVisible();
    expect(
      screen.getByRole('separator', { name: 'Resize pitch lane' }),
    ).toHaveAttribute('aria-valuenow', normalPitchValue);
  });

  it('restores the previous song and playhead with lazy audio loading', async () => {
    restoreKaraokeSession.mockResolvedValueOnce({
      files: [
        {
          token: 'saved-audio',
          name: 'Restored.mp3',
          relativePath: 'Album/Restored.mp3',
          type: 'audio/mpeg',
          lastModified: 100,
          role: 'audio',
        },
        {
          token: 'saved-lyrics',
          name: 'Restored.lrc',
          relativePath: 'Album/Restored.lrc',
          type: 'text/plain',
          lastModified: 100,
          role: 'lyrics',
          text: '[ti:Remembered Song]\n[ar:Saved Artist]\n[00:01.00]Still here',
        },
      ],
      playlistOrder: ['album/restored.mp3'],
      selectedPlaylistId: 'album/restored.mp3',
      playheadMs: 3_250,
    });
    readKaraokeSessionFile.mockResolvedValueOnce({
      data: new Uint8Array([1, 2, 3]),
      lastModified: 100,
      type: 'audio/mpeg',
    });

    const { container } = render(<KaraokeWorkspace isHidden={false} />);

    expect(
      await screen.findByRole('heading', { name: 'Remembered Song' }),
    ).toBeVisible();
    expect(screen.getByText('Saved Artist')).toBeVisible();
    expect(readKaraokeSessionFile).toHaveBeenCalledWith('saved-audio');
    expect(createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Restored.mp3', size: 3 }),
    );
    expect(
      (container.querySelector('audio') as HTMLAudioElement).currentTime,
    ).toBe(3.25);
  });

  /**
   * "Send to Karaoke" mounts this tab, and mounting starts the saved-session
   * read — so the song being sent is imported while that read is still in
   * flight. The read used to finish a moment later and replace the whole list
   * with what it found; the tab changed, the Maker closed, and the song was
   * nowhere. Every first send after a launch failed like that. The restore
   * must merge with what arrived while it was reading, and the song that was
   * asked for stays the one selected.
   */
  it('keeps a song sent while the saved playlist was still loading', async () => {
    let finishRestore: (value: unknown) => void = () => undefined;
    restoreKaraokeSession.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRestore = resolve;
      }),
    );

    render(<KaraokeWorkspace isHidden={false} />);
    // Arrives before the read has answered — the drain runs on mount.
    act(() => {
      sendFilesToKaraoke([
        setKaraokeRelativePath(
          new File(['audio'], 'Sent Over.mp3', { type: 'audio/mpeg' }),
          'Sent Over.mp3',
        ),
      ]);
    });
    expect((await screen.findAllByText('Sent Over')).length).toBeGreaterThan(0);

    await act(async () => {
      finishRestore({
        files: [
          {
            token: 'saved-audio',
            name: 'Restored.mp3',
            relativePath: 'Album/Restored.mp3',
            type: 'audio/mpeg',
            lastModified: 100,
            role: 'audio',
          },
        ],
        playlistOrder: ['album/restored.mp3'],
        selectedPlaylistId: 'album/restored.mp3',
        playheadMs: 3_250,
      });
      await Promise.resolve();
    });

    // Both are in the list, and the sent one is still the one chosen.
    expect(await screen.findByText('Restored')).toBeVisible();
    expect(screen.getAllByText('Sent Over').length).toBeGreaterThan(0);
    expect(screen.getByText('2')).toBeVisible();
    const current = document.querySelector(
      '.karaoke-playlist__song[aria-current="true"]',
    );
    expect(current).not.toBeNull();
    expect(within(current as HTMLElement).getByText('Sent Over')).toBeVisible();
    // The saved session's own song was never loaded over it.
    expect(readKaraokeSessionFile).not.toHaveBeenCalled();
  });

  it('persists a newly opened song and clears the saved session on demand', async () => {
    getPathForFile.mockImplementation(
      (file: File) => `C:\\Music\\${file.name}`,
    );
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    await waitFor(() => expect(restoreKaraokeSession).toHaveBeenCalled());
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(['audio'], 'Remember.mp3', { type: 'audio/mpeg' })],
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Remember' }),
    ).toBeVisible();
    await waitFor(() =>
      expect(saveKaraokeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          files: [
            {
              localPath: 'C:\\Music\\Remember.mp3',
              relativePath: 'Remember.mp3',
            },
          ],
          selectedPlaylistId: 'remember.mp3',
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(clearKaraokeSession).toHaveBeenCalledTimes(1);
  });

  it('imports local audio plus LRC, exposes transport, and revokes resources', async () => {
    const { container, unmount } = render(
      <KaraokeWorkspace isHidden={false} />,
    );
    const audioFile = new File(['audio'], 'clockwork-lights.mp3', {
      type: 'audio/mpeg',
    });
    const lyricFile = new File(
      [
        '[ti:Clockwork Lights]\n[ar:Test Artist]\n[00:01.00]First line\n[00:03.00]Second line',
      ],
      'clockwork-lights.lrc',
      { type: 'text/plain' },
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [audioFile, lyricFile] },
    });

    expect(
      await screen.findByRole('heading', { name: 'Clockwork Lights' }),
    ).toBeVisible();
    expect(screen.getByText('Test Artist')).toBeVisible();
    expect(screen.getByText('LRC · line timing')).toBeVisible();
    const lyricSize = screen.getByRole('slider', {
      name: 'Lyric text size',
    });
    expect(lyricSize).toHaveValue('100');
    expect(lyricSize).toHaveAttribute('max', '300');
    expect(lyricSize.closest('.karaoke-song__tools')).toBeInTheDocument();
    fireEvent.change(lyricSize, { target: { value: '180' } });
    expect(lyricSize).toHaveValue('180');
    expect(lyricSize).toHaveAttribute('aria-valuetext', '180%');
    expect(window.localStorage.getItem('fluideq-karaoke-lyric-text-size')).toBe(
      '180',
    );
    fireEvent.change(lyricSize, { target: { value: '300' } });
    expect(lyricSize).toHaveValue('300');
    expect(lyricSize).toHaveAttribute('aria-valuetext', '300%');
    expect(container.querySelector('.karaoke-workspace')).toHaveClass(
      'has-song',
    );
    const lyricCanvas = screen.getByRole('button', {
      name: 'Lyric line 1',
    });
    expect(lyricCanvas.tagName).toBe('CANVAS');
    expect(container.querySelector('.karaoke-lyrics__line')).toBeNull();
    expect(container.querySelector('.karaoke-lyrics__token')).toBeNull();
    expect(screen.getAllByRole('heading', { name: 'Pitch lane' })).toHaveLength(
      1,
    );
    expect(
      container.querySelector('.karaoke-workspace__stage .karaoke-pitch'),
    ).toBeVisible();
    // The transport is drawn into the bar at the foot of the window, not
    // under the stage: this app has one transport and one place for it, and
    // rendered in both it was two bars stacked on each other.
    expect(
      container.querySelector('.karaoke-transport'),
    ).not.toBeInTheDocument();
    expect(barSlot?.querySelector('.karaoke-transport')).toBeInTheDocument();
    expect(
      screen.queryByRole('separator', {
        name: 'Resize microphone and pitch panels',
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(createObjectURL).toHaveBeenCalledWith(audioFile);

    const audio = container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 8,
    });
    fireEvent.loadedMetadata(audio);
    const pitchCanvas = container.querySelector(
      '.karaoke-pitch__canvas canvas',
    ) as HTMLCanvasElement;
    jest.spyOn(pitchCanvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1_000,
      bottom: 240,
      width: 1_000,
      height: 240,
      toJSON: () => ({}),
    });
    // The click a drag's release sends was swallowed by a flag a zero-delay
    // timer cleared; the next press clears it now.
    const scrubTimers = jest.spyOn(window, 'setTimeout');
    fireTestPointer(pitchCanvas, 'pointerdown', 11, 500);
    fireTestPointer(pitchCanvas, 'pointermove', 11, 300);
    fireTestPointer(pitchCanvas, 'pointerup', 11, 300);
    fireEvent.click(pitchCanvas);
    expect(scrubTimers).not.toHaveBeenCalled();
    scrubTimers.mockRestore();
    expect(audio.currentTime).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(play).not.toHaveBeenCalled();
    await finishCountIn(container);
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.playing(audio);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();

    fireEvent.keyDown(lyricCanvas, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'Lyric line 2' })).toBe(
      lyricCanvas,
    );
    fireEvent.keyDown(lyricCanvas, { key: 'Enter' });
    expect(audio.currentTime).toBe(3);
    expect(play).toHaveBeenCalledTimes(1);
    await finishCountIn(container);
    expect(play).toHaveBeenCalledTimes(2);

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:karaoke-song');
  });
});
