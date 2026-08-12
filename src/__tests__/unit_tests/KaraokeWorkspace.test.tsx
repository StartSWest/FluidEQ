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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setKaraokeRelativePath } from '../../common/karaoke/files';
import KaraokeWorkspace from '../../renderer/karaoke/KaraokeWorkspace';
import { karaokeLayoutStorageKey } from '../../renderer/karaoke/karaokeLayout';

const fireTestPointer = (
  target: Element,
  type: string,
  pointerId: number,
  clientX: number,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: 0 },
    pointerId: { value: pointerId },
  });
  fireEvent(target, event);
};

describe('KaraokeWorkspace', () => {
  const originalMatchMedia = window.matchMedia;
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
        },
      },
    });
    window.localStorage.clear();
  });

  afterEach(() => {
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
    await waitFor(() => expect(cue()).toHaveTextContent('2'), {
      timeout: 1_000,
    });
    await waitFor(() => expect(cue()).toHaveTextContent('3'), {
      timeout: 1_000,
    });
    await waitFor(() => expect(cue()).toHaveTextContent('GO'), {
      timeout: 1_000,
    });
  };

  it('offers real local import actions in the empty state', () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const readiness = container.querySelector(
      '.karaoke-workspace__readiness',
    ) as HTMLElement;

    expect(container.querySelector('.karaoke-workspace')).toHaveClass(
      'is-empty',
    );
    expect(readiness).toHaveClass('is-pitch-only');
    expect(
      readiness.querySelector('.karaoke-microphone'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'A stage built around your music',
      }),
    ).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Open song' })).toHaveLength(
      2,
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Pitch lane' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Enter full screen' }),
    ).toBeVisible();
    expect(
      container.querySelector('.karaoke-workspace__microphone-art'),
    ).toBeVisible();
    expect(
      container.querySelector('.karaoke-workspace__disc'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Microphone settings' }),
    ).toBeVisible();

    const input = container.querySelector('input[type="file"]');
    expect(input).toHaveAttribute(
      'accept',
      '.mp3,.wav,.ogg,.flac,.m4a,.lrc,.elrc,.txt,audio/*',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Microphone settings' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Microphone settings' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Microphone' }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: 'Turn on mic' }),
    ).not.toHaveLength(0);
  });

  it('moves the actions into the lyric surface in full screen', async () => {
    const toggleTopBar = jest.fn();
    const { container } = render(
      <KaraokeWorkspace
        isHidden={false}
        isFullScreen
        hasFullScreenTopBar={false}
        onToggleFullScreenTopBar={toggleTopBar}
      />,
    );

    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'A stage built around your music',
      }),
    ).not.toBeInTheDocument();
    const emptyToolbar = screen.getByRole('toolbar', {
      name: 'Karaoke actions',
    });
    expect(emptyToolbar).toHaveClass('is-stage-toolbar');
    expect(emptyToolbar.parentElement).toHaveClass('karaoke-workspace__stage');

    fireEvent.click(
      screen.getByRole('button', { name: 'Show the FluidEQ header' }),
    );
    expect(toggleTopBar).toHaveBeenCalledTimes(1);

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['audio'], 'Full screen.mp3', { type: 'audio/mpeg' })],
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Full screen' }),
    ).toBeVisible();
    const lyricToolbar = screen.getByRole('toolbar', {
      name: 'Karaoke actions',
    });
    expect(lyricToolbar.parentElement).toHaveClass('karaoke-workspace__stage');
  });

  it('lets the Maker enter and exit the Karaoke full-screen surface', async () => {
    const canvasContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    const toggleFullScreen = jest.fn();
    const { container, rerender } = render(
      <KaraokeWorkspace
        isHidden={false}
        onToggleFullScreen={toggleFullScreen}
      />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['audio'], 'Maker screen.mp3', { type: 'audio/mpeg' }),
        ],
      },
    });
    expect(
      await screen.findByRole('heading', { name: 'Maker screen' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));

    const maker = await waitFor(() => {
      const element = container.querySelector('.karaoke-maker');
      expect(element).toBeInTheDocument();
      return element as HTMLElement;
    });
    expect(
      screen.queryByRole('button', { name: 'Preview · 1, 2, 3' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      maker.querySelector(
        'button[aria-label="Prepare karaoke"]',
      ) as HTMLButtonElement,
    );
    expect(
      screen.getByRole('dialog', { name: 'Download Whisper Tiny?' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    const hand = maker.querySelector(
      'button[aria-label="Hand · pan timeline"]',
    ) as HTMLButtonElement;
    const addNote = maker.querySelector(
      'button[aria-label="Note"]',
    ) as HTMLButtonElement;
    const deleteSelection = maker.querySelector(
      'button[aria-label="Delete"]',
    ) as HTMLButtonElement;
    expect(deleteSelection).toBeDisabled();
    fireEvent.click(addNote);
    expect(deleteSelection).toBeEnabled();
    fireEvent.keyDown(window, { key: 'Delete', code: 'Delete' });
    expect(deleteSelection).toBeDisabled();
    fireEvent.click(hand);
    expect(hand).toHaveAttribute('aria-pressed', 'true');
    expect(maker.querySelector('.karaoke-maker__canvas')).toHaveClass(
      'is-hand-pan',
    );
    expect(maker).toHaveTextContent(
      'drag anywhere on the canvas to move through the song without editing',
    );
    const enter = maker.querySelector(
      'button[aria-label="Enter full screen"]',
    ) as HTMLButtonElement;
    fireEvent.click(enter);
    expect(toggleFullScreen).toHaveBeenCalledTimes(1);

    rerender(
      <KaraokeWorkspace
        isHidden={false}
        isFullScreen
        onToggleFullScreen={toggleFullScreen}
      />,
    );
    expect(container.querySelector('.karaoke-maker')).toHaveClass(
      'is-fullscreen',
    );
    expect(
      container.querySelector(
        '.karaoke-maker button[aria-label="Exit full screen"]',
      ),
    ).not.toHaveTextContent('Exit full screen');
    const fullscreenMakerHeader = container.querySelector(
      '.karaoke-maker.is-fullscreen > .karaoke-maker__header',
    );
    expect(fullscreenMakerHeader).toBeInTheDocument();
    expect(
      fullscreenMakerHeader?.querySelector('input[aria-label="Song title"]'),
    ).toHaveValue('Maker screen');
    expect(
      fullscreenMakerHeader?.querySelector('button[aria-label="Play"]'),
    ).toBeInTheDocument();
    canvasContext.mockRestore();
  });

  it('only applies the idle fade to the full-screen actions', () => {
    const { rerender } = render(
      <KaraokeWorkspace isHidden={false} isFullScreen isChromeIdle />,
    );

    expect(
      screen.getByRole('toolbar', { name: 'Karaoke actions' }),
    ).toHaveClass('is-stage-toolbar', 'is-idle');

    rerender(<KaraokeWorkspace isHidden={false} isChromeIdle />);
    expect(
      screen.getByRole('toolbar', { name: 'Karaoke actions' }),
    ).not.toHaveClass('is-stage-toolbar', 'is-idle');
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
    fireTestPointer(pitchCanvas, 'pointerdown', 11, 500);
    fireTestPointer(pitchCanvas, 'pointermove', 11, 300);
    fireTestPointer(pitchCanvas, 'pointerup', 11, 300);
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

  it('moves the redesigned pitch lane beside the mic in a compact window', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: false,
        media: '(min-width: 1120px)',
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      } as MediaQueryList),
    });
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [new File(['audio'], 'compact.mp3', { type: 'audio/mpeg' })],
      },
    });

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(
      container.querySelector('.karaoke-workspace__stage .karaoke-pitch'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.karaoke-workspace__readiness .karaoke-pitch'),
    ).toBeVisible();
    expect(
      container.querySelector('.karaoke-workspace__stage'),
    ).not.toHaveClass('has-stage-pitch');
  });

  it('keeps audio usable when a malformed lyric file is selected', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['audio'], 'voice.ogg', { type: 'audio/ogg' }),
          new File(['not timed'], 'voice.lrc', { type: 'text/plain' }),
        ],
      },
    });

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('could not be parsed');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });

  it('imports a whole folder as a paired, selectable playlist', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const folderInput = container.querySelectorAll(
      'input[type="file"]',
    )[1] as HTMLInputElement;
    const firstAudio = setKaraokeRelativePath(
      new File(['audio'], 'Artist - First.mp3', { type: 'audio/mpeg' }),
      'Album/Artist - First.mp3',
    );
    const firstLyrics = setKaraokeRelativePath(
      new File(
        [
          '#TITLE:Folder First\n#ARTIST:Folder Artist\n#BPM:120\n#GAP:0\n: 0 4 0 Hello\nE',
        ],
        'Artist - First.txt',
        { type: 'text/plain' },
      ),
      'Album/Artist - First.txt',
    );
    const secondAudio = setKaraokeRelativePath(
      new File(['audio'], 'Artist - Second.mp3', { type: 'audio/mpeg' }),
      'Album/Artist - Second.mp3',
    );
    const license = setKaraokeRelativePath(
      new File(['license'], 'License.txt'),
      'Album/License.txt',
    );

    fireEvent.change(folderInput, {
      target: {
        files: [secondAudio, license, firstLyrics, firstAudio],
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Folder First' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Playlist' })).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.queryByText('License')).not.toBeInTheDocument();
    const groupFolders = screen.getByRole('button', {
      name: 'Group by folder',
    });
    expect(groupFolders).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Album')).not.toBeInTheDocument();
    fireEvent.click(groupFolders);
    expect(groupFolders).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Album')).toBeVisible();
    expect(
      window.localStorage.getItem('fluideq-karaoke-playlist-group-by-folder'),
    ).toBe('true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Artist Second' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Artist Second' }),
    ).toBeVisible();
    expect(createObjectURL).toHaveBeenLastCalledWith(secondAudio);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Artist First' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Folder First' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue(
      'Folder First',
    );
    const audio = container.querySelector('audio') as HTMLAudioElement;
    fireEvent.playing(audio);
    fireEvent.ended(audio);
    expect(
      await screen.findByRole('heading', { name: 'Artist Second' }),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Song title' })).toHaveValue(
      'Artist Second',
    );
    expect(play).not.toHaveBeenCalled();
    await finishCountIn(container);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('attaches a separately dropped lyric file to an existing audio item', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const audio = new File(['audio'], 'Late Lyrics.mp3', {
      type: 'audio/mpeg',
    });
    fireEvent.change(fileInput, { target: { files: [audio] } });
    expect(await screen.findByText('Audio only')).toBeVisible();

    const lyrics = new File(
      [
        '#TITLE:Lyrics Attached\n#ARTIST:Drop Test\n#BPM:120\n#GAP:0\n: 0 4 0 Ready\nE',
      ],
      'Late Lyrics.txt',
      { type: 'text/plain' },
    );
    const workspace = container.querySelector(
      '.karaoke-workspace',
    ) as HTMLElement;
    fireEvent.drop(workspace, {
      dataTransfer: {
        types: ['Files'],
        items: [],
        files: [lyrics],
      },
    });

    expect(
      await screen.findByRole('heading', { name: 'Lyrics Attached' }),
    ).toBeVisible();
    expect(screen.getByText('UltraStar · syllables + pitch')).toBeVisible();
    expect(screen.getByText('ultrastar')).toBeVisible();
  });

  it('keeps song playback alive when another FluidEQ tab hides Karaoke', async () => {
    const { container, rerender } = render(
      <KaraokeWorkspace isHidden={false} />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['audio'], 'persistent.wav', { type: 'audio/wav' })],
      },
    });
    expect(await screen.findByText('Audio only')).toBeVisible();
    const audio = container.querySelector('audio') as HTMLAudioElement;
    fireEvent.playing(audio);
    const pausesBeforeTabChange = pause.mock.calls.length;

    rerender(<KaraokeWorkspace isHidden />);

    expect(pause).toHaveBeenCalledTimes(pausesBeforeTabChange);
    expect(audio).toHaveAttribute('src', 'blob:karaoke-song');
  });

  it('stays mounted but leaves the accessibility tree when another tab opens', () => {
    const { container } = render(<KaraokeWorkspace isHidden />);
    const workspace = container.querySelector('.karaoke-workspace');

    expect(workspace).toHaveClass('is-hidden');
    expect(workspace).toHaveAttribute('aria-hidden', 'true');
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'A stage built around your music',
      }),
    ).not.toBeInTheDocument();
  });
});
