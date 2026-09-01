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
import { karaokeLayoutStorageKey } from '../../renderer/karaoke/karaokeLayout';

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

describe('KaraokeWorkspace', () => {
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

  afterEach(() => {
    setTransportSlot(null);
    barSlot?.remove();
    barSlot = undefined;
    jest.useRealTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
  });

  /**
   * The two things this tab has to say, and which is which.
   *
   * `getByRole('status')` was unambiguous while there was one notice. There
   * are two now and they answer different questions: the import's own line is
   * about the folder that was just opened — a `.srt` nothing here reads, two
   * lyric files matching one song — while the lyric line sits beside the
   * words and is about the song on the stage. A bare role query matches both.
   */
  const importNotice = (container: HTMLElement) =>
    container.querySelector(
      '.karaoke-workspace__notice.is-warning',
    ) as HTMLElement;

  const lyricNotice = (container: HTMLElement) =>
    container.querySelector('.karaoke-lyrics__notice') as HTMLElement;

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

  it('offers real local import actions in the empty state', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);

    // Nothing about being empty until the question has been answered. Last
    // session's playlist is read back a moment after the tab opens, and for
    // that moment this drew a microphone and "drop a folder here" over a
    // playlist that was about to appear.
    expect(
      container.querySelector('.karaoke-workspace__restoring'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        container.querySelector('.karaoke-workspace__restoring'),
      ).not.toBeInTheDocument(),
    );

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
    // Named members rather than the whole string: the accept list grows every
    // time a format lands, and a test that fails because the picker started
    // offering one more extension is testing the list, not the picker.
    const accept = (input?.getAttribute('accept') ?? '').split(',');
    ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.lrc', '.elrc', '.txt'].forEach(
      (extension) => expect(accept).toContain(extension),
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

  it('lets the pitch guide be hidden and restored independently of the mic', () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);

    const hideGuide = screen.getByRole('button', {
      name: 'Hide pitch guide',
    });
    expect(hideGuide).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Pitch lane' }),
    ).toBeVisible();

    fireEvent.click(hideGuide);

    expect(
      screen.queryByRole('heading', { level: 3, name: 'Pitch lane' }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.karaoke-workspace__readiness'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('separator', { name: 'Resize pitch lane' }),
    ).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem('fluideq-karaoke-pitch-guide-visible'),
    ).toBe('false');

    const showGuide = screen.getByRole('button', {
      name: 'Show pitch guide',
    });
    expect(showGuide).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(showGuide);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Pitch lane' }),
    ).toBeVisible();
    expect(
      window.localStorage.getItem('fluideq-karaoke-pitch-guide-visible'),
    ).toBe('true');
  });

  // The positive control for the test below: without it, "no toggle did
  // anything" and "the stage never had artwork" look identical.
  it('offers the cover art toggle disabled when the song has no artwork', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);

    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [new File(['audio'], 'bare-song.mp3', { type: 'audio/mpeg' })],
        },
      },
    );
    expect(
      await screen.findByRole('heading', { name: 'bare song' }),
    ).toBeVisible();

    expect(
      screen.getByRole('button', { name: 'This song has no cover art' }),
    ).toBeDisabled();
    expect(
      container.querySelector('.karaoke-stage-media'),
    ).not.toBeInTheDocument();
  });

  it('hides and restores cover art, and remembers which', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);

    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'painted-song.mp3', { type: 'audio/mpeg' }),
            new File(['image'], 'painted-song.jpg', { type: 'image/jpeg' }),
          ],
        },
      },
    );
    expect(
      await screen.findByRole('heading', { name: 'painted song' }),
    ).toBeVisible();
    expect(container.querySelector('.karaoke-stage-media')).toBeInTheDocument();

    const hideArt = screen.getByRole('button', { name: 'Hide cover art' });
    expect(hideArt).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(hideArt);

    expect(
      container.querySelector('.karaoke-stage-media'),
    ).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem('fluideq-karaoke-stage-art-visible'),
    ).toBe('false');

    const showArt = screen.getByRole('button', { name: 'Show cover art' });
    expect(showArt).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(showArt);

    expect(container.querySelector('.karaoke-stage-media')).toBeInTheDocument();
    expect(
      window.localStorage.getItem('fluideq-karaoke-stage-art-visible'),
    ).toBe('true');
  });

  it('toggles full screen from the Karaoke surface without hijacking controls', () => {
    const toggleFullScreen = jest.fn();
    const { container, rerender } = render(
      <KaraokeWorkspace
        isHidden={false}
        onToggleFullScreen={toggleFullScreen}
      />,
    );
    const stage = container.querySelector(
      '.karaoke-workspace__stage',
    ) as HTMLElement;

    fireEvent.doubleClick(stage);
    expect(toggleFullScreen).toHaveBeenCalledTimes(1);

    rerender(
      <KaraokeWorkspace
        isHidden={false}
        isFullScreen
        onToggleFullScreen={toggleFullScreen}
      />,
    );
    fireEvent.doubleClick(
      container.querySelector('.karaoke-workspace__stage') as HTMLElement,
    );
    expect(toggleFullScreen).toHaveBeenCalledTimes(2);

    fireEvent.doubleClick(
      screen.getByRole('button', { name: 'Exit full screen' }),
    );
    expect(toggleFullScreen).toHaveBeenCalledTimes(2);
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

  it('rebuilds the imported original when the Maker is restored', async () => {
    // The imported original of a bare audio file has no lyrics at all, so
    // typing some and then restoring has an unambiguous right answer: they go
    // away again, and the saved draft that held them is deleted rather than
    // left to be handed back the next time the Maker opens.
    const canvasContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Restore me.mp3', { type: 'audio/mpeg' }),
          ],
        },
      },
    );
    expect(
      await screen.findByRole('heading', { name: 'Restore me' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));

    const maker = await waitFor(() => {
      const element = container.querySelector('.karaoke-maker');
      expect(element).toBeInTheDocument();
      return element as HTMLElement;
    });
    // The timeline draws its words onto a canvas, so the lyrics editor is what
    // can actually be read back — and it re-seeds itself from the project each
    // time it opens, which makes it a faithful view of what the project holds.
    const openLyrics = async () => {
      fireEvent.click(
        maker.querySelector('button[aria-label="Lyrics"]') as HTMLButtonElement,
      );
      return screen.findByRole('dialog', {
        name: 'Paste or edit one lyric line per row',
      });
    };
    const closeLyrics = (dialog: HTMLElement) =>
      fireEvent.click(
        dialog.querySelector(
          '.karaoke-maker__lyrics-modal-close',
        ) as HTMLButtonElement,
      );

    const lyricsDialog = await openLyrics();
    fireEvent.change(lyricsDialog.querySelector('textarea') as HTMLElement, {
      target: { value: 'A line that restore should discard' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept lyrics' }));
    await waitFor(() => expect(maker).toHaveTextContent('6 words'));

    fireEvent.click(
      maker.querySelector(
        'button[aria-label="Restore original"]',
      ) as HTMLButtonElement,
    );
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Restore original',
    });
    expect(confirm).toHaveTextContent('Restore the original karaoke?');
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Restore original' }),
    );

    expect(
      await screen.findByText('The imported original was restored.'),
    ).toBeVisible();
    expect(deleteKaraokeMakerDraft).toHaveBeenCalledTimes(1);
    const afterRestore = await openLyrics();
    expect(afterRestore.querySelector('textarea')).toHaveValue('');
    closeLyrics(afterRestore);

    // Restore is destructive, so its confirmation promises an Undo in the same
    // words the other two destructive actions use. That promise has to hold.
    fireEvent.click(
      maker.querySelector('button[aria-label="Undo"]') as HTMLButtonElement,
    );
    const afterUndo = await openLyrics();
    await waitFor(() =>
      expect(afterUndo.querySelector('textarea')).toHaveValue(
        'A line that restore should discard',
      ),
    );
    canvasContext.mockRestore();
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
    const commandDock = maker.querySelector(
      '.karaoke-maker__command-dock',
    ) as HTMLElement;
    const makerHeader = maker.querySelector(
      '.karaoke-maker__header',
    ) as HTMLElement;
    expect(makerHeader).toContainElement(
      maker.querySelector('.karaoke-maker__header-tools'),
    );
    expect(makerHeader).toContainElement(
      maker.querySelector('.karaoke-maker__tools'),
    );
    expect(commandDock).not.toContainElement(
      maker.querySelector('.karaoke-maker__tools'),
    );
    expect(commandDock).toContainElement(
      maker.querySelector('.karaoke-maker__status-row'),
    );
    expect(commandDock).toContainElement(
      maker.querySelector('.karaoke-maker__inspector'),
    );
    expect(commandDock.previousElementSibling).toHaveClass(
      'karaoke-maker-preview',
    );
    expect(
      screen.queryByRole('button', { name: 'Preview · 1, 2, 3' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tap words' }),
    ).not.toBeInTheDocument();
    expect(
      maker.querySelector('button[aria-label="Prepare karaoke"]'),
    ).not.toBeInTheDocument();
    fireEvent.click(
      maker.querySelector('button[aria-label="Lyrics"]') as HTMLButtonElement,
    );
    const lyricsDialog = await screen.findByRole('dialog', {
      name: 'Paste or edit one lyric line per row',
    });
    fireEvent.change(lyricsDialog.querySelector('textarea') as HTMLElement, {
      target: { value: 'First complete lyric line\nSecond lyric line' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Accept and record timing',
      }),
    );
    expect(screen.getByText('Ready to record the lyric timing?')).toBeVisible();
    const captureCoach = container.querySelector(
      '.karaoke-maker__capture-coach',
    ) as HTMLElement;
    expect(captureCoach.parentElement).toBe(maker);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(screen.getByText(/Press Enter when the line starts/)).toBeVisible();
    expect(screen.getByText('mark the next word')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Mark line start' }),
    ).not.toBeInTheDocument();
    jest.useFakeTimers();
    play.mockClear();
    const guidedAudio = container.querySelector('audio') as HTMLAudioElement;
    guidedAudio.currentTime = 18;
    expect(
      screen.getByRole('button', { name: 'Start recording' }),
    ).toHaveAttribute('aria-keyshortcuts', 'Enter');
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(guidedAudio.currentTime).toBe(0);
    const captureCue = () =>
      container.querySelector(
        '.karaoke-maker__capture-coach-countdown strong',
      ) as HTMLElement;
    expect(captureCue()).toHaveTextContent('1');
    act(() => jest.advanceTimersByTime(650));
    expect(captureCue()).toHaveTextContent('2');
    act(() => jest.advanceTimersByTime(650));
    expect(captureCue()).toHaveTextContent('3');
    act(() => jest.advanceTimersByTime(650));
    expect(captureCue()).toHaveTextContent('GO');
    expect(play).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(550));
    jest.useRealTimers();
    guidedAudio.currentTime = 5;
    fireEvent.keyDown(window, {
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      shiftKey: true,
    });
    expect(guidedAudio.currentTime).toBe(4);
    fireEvent.keyDown(window, {
      key: 'ArrowRight',
      code: 'ArrowRight',
      shiftKey: true,
    });
    expect(guidedAudio.currentTime).toBe(5);
    guidedAudio.currentTime = 1;
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(captureCoach).toHaveTextContent('2 · END');
    expect(screen.getByRole('button', { name: /Next word/ })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Stop recording' }),
    ).toBeVisible();
    guidedAudio.currentTime = 1.4;
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
    guidedAudio.currentTime = 1.8;
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
    guidedAudio.currentTime = 2.2;
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
    expect(
      screen.queryByRole('button', { name: /Next word/ }),
    ).not.toBeInTheDocument();
    guidedAudio.currentTime = 3;
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    fireEvent.keyDown(window, { key: 'ArrowUp', code: 'ArrowUp' });
    // This lies inside the old recorded range. It used to be misread as END,
    // which advanced to the next lyric instead of replacing START.
    guidedAudio.currentTime = 2.4;
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(captureCoach).toHaveTextContent('2 · END');
    expect(maker).toHaveTextContent('First complete lyric line');
    fireEvent.click(screen.getByRole('button', { name: 'Ignore line' }));
    expect(captureCoach).toHaveTextContent('1 · START');
    expect(maker).toHaveTextContent('Second lyric line');
    guidedAudio.currentTime = 4;
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    guidedAudio.currentTime = 5;
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(
      await screen.findByText(
        'Line timing complete. Ready to review and use in the player.',
      ),
    ).toBeVisible();
    play.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Play word' }));
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(
      maker.querySelector('button[aria-label="Lyrics"]') as HTMLButtonElement,
    );
    const reviewLyricsDialog = await screen.findByRole('dialog', {
      name: 'Paste or edit one lyric line per row',
    });
    const timedWord = Array.from(
      reviewLyricsDialog.querySelectorAll<HTMLButtonElement>(
        '.karaoke-maker__lyrics-token-line button',
      ),
    ).find((button) => button.textContent === 'First') as HTMLButtonElement;
    fireEvent.click(timedWord);
    expect(play).toHaveBeenCalledTimes(2);
    expect(guidedAudio.currentTime).toBeGreaterThan(0);
    fireEvent.click(
      reviewLyricsDialog.querySelector(
        '.karaoke-maker__lyrics-modal-close',
      ) as HTMLButtonElement,
    );
    const wordTimingSliders = maker.querySelectorAll<HTMLInputElement>(
      '.karaoke-maker__selection-coach .karaoke-maker__word-timing-sliders input[type="range"]',
    );
    expect(wordTimingSliders).toHaveLength(2);
    expect(wordTimingSliders[0]).toBeEnabled();
    expect(wordTimingSliders[1]).toBeEnabled();
    const availableLongerDuration = Math.min(
      Number(wordTimingSliders[1].max),
      Number(wordTimingSliders[1].value) + 50,
    );
    fireEvent.change(wordTimingSliders[1], {
      target: { value: availableLongerDuration },
    });
    expect(Number(wordTimingSliders[1].value)).toBe(availableLongerDuration);

    play.mockClear();
    pause.mockClear();
    fireEvent.keyDown(window, { key: 'Control', code: 'ControlLeft' });
    const sentenceStartMs = guidedAudio.currentTime;
    expect(sentenceStartMs).toBeGreaterThan(0);
    expect(play).toHaveBeenCalledTimes(1);
    guidedAudio.currentTime = sentenceStartMs + 0.7;
    const pauseCallsBeforeRelease = pause.mock.calls.length;
    fireEvent.keyUp(window, { key: 'Control', code: 'ControlLeft' });
    expect(pause).toHaveBeenCalledTimes(pauseCallsBeforeRelease + 1);
    expect(guidedAudio.currentTime).toBeCloseTo(sentenceStartMs, 3);

    const previewSelectionCoach = maker.querySelector(
      '.karaoke-maker__selection-coach',
    ) as HTMLElement;
    fireEvent.keyDown(window, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(previewSelectionCoach).toHaveTextContent('Second');
    fireEvent.keyDown(window, { key: 'ArrowUp', code: 'ArrowUp' });
    expect(previewSelectionCoach).toHaveTextContent('First');

    fireEvent.click(
      screen.getByRole('button', { name: 'Split word into syllables' }),
    );
    expect(screen.getByText('Split “First”')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Toggle split after “F”' }),
    );
    expect(
      screen.getByRole('button', { name: 'Apply syllable split' }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const hand = maker.querySelector(
      'button[aria-label="Hand · pan timeline"]',
    ) as HTMLButtonElement;
    const paintNotes = maker.querySelector(
      'button[aria-label="Paint notes"]',
    ) as HTMLButtonElement;
    const deleteSelection = maker.querySelector(
      'button[aria-label="Delete"]',
    ) as HTMLButtonElement;
    // The transport is no longer a row inside the editor: the app has one bar
    // and karaoke draws into it, Maker open or not. Same button and the same
    // shortcut — only where it lands has moved.
    const editorPlay = screen.getByRole('button', { name: 'Play' });
    expect(editorPlay).toHaveAttribute('aria-keyshortcuts', 'Space');
    expect(editorPlay).toHaveAttribute('data-tooltip', 'Play · Space');

    play.mockClear();
    paintNotes.focus();
    fireEvent.keyDown(paintNotes, { key: ' ', code: 'Space' });
    expect(play).toHaveBeenCalledTimes(1);

    const songTitle = screen.getByRole('textbox', { name: 'Song title' });
    songTitle.focus();
    fireEvent.keyDown(songTitle, { key: ' ', code: 'Space' });
    expect(play).toHaveBeenCalledTimes(1);

    play.mockClear();
    fireEvent.keyDown(maker, { key: ' ', code: 'Space' });
    expect(play).toHaveBeenCalledTimes(1);
    play.mockClear();
    const bpm = screen.getByRole('spinbutton', { name: 'BPM' });
    bpm.focus();
    fireEvent.keyDown(bpm, { key: ' ', code: 'Space' });
    expect(play).toHaveBeenCalledTimes(1);

    const editorCanvas = maker.querySelector(
      '.karaoke-maker__canvas',
    ) as HTMLCanvasElement;
    const audio = container.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', {
      configurable: true,
      value: 12,
    });
    // And announce it. The transport belongs to the bar now and the bar is
    // driven by the session, not by the element — a duration set on the tag
    // and never announced leaves "jump to the end" with nowhere to jump to.
    fireEvent.durationChange(audio);
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
    fireTestPointer(editorCanvas, 'pointerdown', 17, 300);
    expect(editorCanvas).toHaveClass('is-scrubbing');
    fireTestPointer(editorCanvas, 'pointermove', 17, 700);
    expect(audio.currentTime).toBeGreaterThan(7);
    fireTestPointer(editorCanvas, 'pointerup', 17, 700);
    expect(editorCanvas).not.toHaveClass('is-scrubbing');

    fireEvent.click(screen.getByRole('button', { name: 'Jump to song start' }));
    expect(audio.currentTime).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Jump to song end' }));
    expect(audio.currentTime).toBe(12);

    expect(deleteSelection).toBeDisabled();
    fireEvent.click(paintNotes);
    fireTestPointer(editorCanvas, 'pointerdown', 18, 300, 300);
    fireTestPointer(editorCanvas, 'pointerup', 18, 380, 300);
    expect(deleteSelection).toBeEnabled();
    const selectionCoach = maker.querySelector(
      '.karaoke-maker__selection-coach',
    ) as HTMLElement;
    expect(selectionCoach).toBeVisible();
    expect(selectionCoach.parentElement).toBe(maker);
    expect(
      screen.getByRole('button', { name: 'Close selection tools' }),
    ).toBeVisible();
    jest.spyOn(maker, 'getBoundingClientRect').mockReturnValue({
      bottom: 800,
      height: 800,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    jest.spyOn(selectionCoach, 'getBoundingClientRect').mockReturnValue({
      bottom: 500,
      height: 110,
      left: 200,
      right: 800,
      top: 390,
      width: 600,
      x: 200,
      y: 390,
      toJSON: () => ({}),
    });
    const selectionDragHandle = screen.getByRole('button', {
      name: /Drag to move the selection tools/,
    });
    const selectionLeftBeforeDrag = selectionCoach.style.left;
    fireTestPointer(selectionDragHandle, 'pointerdown', 28, 400, 420);
    fireTestPointer(selectionDragHandle, 'pointermove', 28, 470, 450);
    fireTestPointer(selectionDragHandle, 'pointerup', 28, 470, 450);
    expect(selectionCoach.style.left).not.toBe(selectionLeftBeforeDrag);
    expect(
      maker.querySelector(
        '.karaoke-maker__inspector .karaoke-maker__selection-info',
      ),
    ).not.toBeInTheDocument();
    const copyNotes = screen.getByRole('button', {
      name: 'Copy selected notes',
    });
    const pasteNotes = screen.getByRole('button', {
      name: 'Paste notes at playhead',
    });
    expect(copyNotes).toBeEnabled();
    expect(pasteNotes).toBeDisabled();
    fireEvent.click(copyNotes);
    expect(pasteNotes).toBeEnabled();
    audio.currentTime = 6;
    fireEvent.click(pasteNotes);
    expect(screen.getByText('Note pasted at the playhead.')).toBeVisible();
    fireEvent.keyDown(window, { key: 'Delete', code: 'Delete' });
    expect(deleteSelection).toBeDisabled();
    expect(
      maker.querySelector('.karaoke-maker__selection-coach'),
    ).not.toBeInTheDocument();
    fireTestPointer(editorCanvas, 'pointerdown', 19, 420, 300);
    fireTestPointer(editorCanvas, 'pointerup', 19, 500, 300);
    const clearNotes = screen.getByRole('button', { name: 'Clear notes' });
    expect(clearNotes).toBeEnabled();
    fireEvent.click(clearNotes);
    expect(
      screen.getByRole('alertdialog', { name: 'Clear notes' }),
    ).toHaveTextContent('keeping all lyrics and word timing');
    fireEvent.click(
      screen
        .getByRole('alertdialog', { name: 'Clear notes' })
        .querySelector('button.is-danger') as HTMLButtonElement,
    );
    expect(clearNotes).toBeDisabled();
    const clearLyrics = screen.getByRole('button', { name: 'Clear lyrics' });
    expect(clearLyrics).toBeEnabled();
    fireEvent.click(clearLyrics);
    expect(
      screen.getByRole('alertdialog', { name: 'Clear lyrics' }),
    ).toHaveTextContent('Melody notes remain');
    fireEvent.click(
      screen
        .getByRole('alertdialog', { name: 'Clear lyrics' })
        .querySelector('button.is-danger') as HTMLButtonElement,
    );
    expect(clearLyrics).toBeDisabled();
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
    ).not.toBeInTheDocument();
    const fullscreenMakerDock = container.querySelector(
      '.karaoke-maker.is-fullscreen > .karaoke-maker__command-dock',
    );
    expect(fullscreenMakerDock).toBeInTheDocument();
    // The dock keeps its tools and no longer keeps a transport. There is one
    // bar in this app and karaoke draws into it from wherever it is — the
    // editor full screen included, which used to stack a second row of
    // controls a few pixels above the first.
    expect(
      fullscreenMakerDock?.querySelector('.karaoke-transport'),
    ).not.toBeInTheDocument();
    const barTransport = barSlot?.querySelector('.karaoke-transport');
    expect(barTransport).toBeInTheDocument();
    expect(
      barTransport?.querySelector('button[aria-label="Play"]'),
    ).toBeInTheDocument();
    canvasContext.mockRestore();
    /**
     * Twenty seconds, because this one test drives most of the Maker.
     *
     * Four hundred lines of it: entering the full-screen surface, the lyrics
     * dialog, accepting timings, and back out again. Alone it finishes in a
     * couple of seconds and it has always been the slowest test in the file.
     *
     * It began failing when the DSP engine stopped being switchable, because
     * every mount of the player now attempts to engage the host rather than
     * skipping it on a `typescript` selection that no longer exists. That is
     * correct behaviour costing real time in a suite already running twenty
     * files in parallel, and the answer is a budget that matches what the test
     * actually does rather than a five-second default it never fitted in.
     */
  }, 20_000);

  it('offers the detector without taking the manual paths away', async () => {
    const canvasContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(['audio'], 'Manual maker.mp3')],
      },
    });
    await screen.findByRole('heading', { name: 'Manual maker' });
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));
    const maker = await waitFor(() => {
      const element = container.querySelector('.karaoke-maker');
      expect(element).toBeInTheDocument();
      return element as HTMLElement;
    });
    expect(
      maker.querySelector('button[aria-label="Prepare karaoke"]'),
    ).not.toBeInTheDocument();
    fireEvent.click(
      maker.querySelector('button[aria-label="Lyrics"]') as HTMLButtonElement,
    );
    const lyricsDialog = await screen.findByRole('dialog', {
      name: 'Paste or edit one lyric line per row',
    });
    // Offered, but not armed: there are no lyrics in this dialog yet, so the
    // detector has nothing to align against.
    expect(
      screen.getByRole('button', { name: 'Detect timing and melody' }),
    ).toBeDisabled();
    // And nothing has been downloaded behind the user's back. The consent
    // dialog appears when they ask for the detector, not when they open the
    // lyric editor.
    expect(
      screen.queryByRole('dialog', { name: 'Download the speech model?' }),
    ).not.toBeInTheDocument();
    expect(
      lyricsDialog.querySelector('.karaoke-maker__lyrics-progress'),
    ).not.toBeInTheDocument();
    expect(lyricsDialog.querySelector('textarea')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Accept lyrics' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Accept and record timing' }),
    ).toBeVisible();
    expect(
      maker.querySelector('.karaoke-maker__analysis-progress'),
    ).not.toBeInTheDocument();
    canvasContext.mockRestore();
  });

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

  it('uses the fullscreen layout without duplicating Karaoke chrome under a graph', () => {
    const { container } = render(
      <KaraokeWorkspace isHidden={false} isFullScreen isGraphOverlay />,
    );

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
    const readiness = container.querySelector(
      '.karaoke-workspace__readiness',
    ) as HTMLElement;
    const transport = container.querySelector(
      '.karaoke-transport',
    ) as HTMLElement;
    expect(readiness.nextElementSibling).toBe(transport);
    expect(
      container.querySelector('.karaoke-workspace__stage .karaoke-transport'),
    ).not.toBeInTheDocument();
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
    expect(lyricNotice(container)).toHaveTextContent(
      'voice.lrc carries no timings FluidEQ could read. The audio remains available without timed lyrics.',
    );
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });

  // Every lyric failure used to reach the user as the same sentence, so a
  // duet, a mis-encoded pack and a plain untimed sheet were indistinguishable.
  // `KaraokeParseError` has carried the reason the whole time.
  it('names the BPM an UltraStar file never declared', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'beatless.mp3', { type: 'audio/mpeg' }),
            new File(
              ['#TITLE:Beatless\n#GAP:0\n: 0 4 0 Hello\nE'],
              'beatless.txt',
              { type: 'text/plain' },
            ),
          ],
        },
      },
    );

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(lyricNotice(container)).toHaveTextContent(
      'beatless.txt declares no BPM, which an UltraStar file needs. The audio remains available without timed lyrics.',
    );
  });

  it('points at the row a malformed UltraStar note sits on', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'broken.mp3', { type: 'audio/mpeg' }),
            new File(
              [
                // A row that announces itself as a note and then carries two
                // numbers where four belong: skipped prose would not be worth
                // rejecting a file over, this is.
                '#TITLE:Broken Row\n#ARTIST:Test\n#BPM:120\n#GAP:0\n: 0 4 0 Hello\n: 1 2\nE',
              ],
              'broken.txt',
              { type: 'text/plain' },
            ),
          ],
        },
      },
    );

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(lyricNotice(container)).toHaveTextContent(
      'broken.txt has a note row FluidEQ could not read. Line 6. The audio remains available without timed lyrics.',
    );
  });

  // `selectKaraokePlaylist` has computed `ignored` since it was written and
  // nothing read it: `Song.mp3` beside `Song.srt` played with no lyrics and no
  // explanation, which is what a broken feature looks like.
  it('names the formats an import set aside instead of dropping them silently', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Sing Along.mp3', { type: 'audio/mpeg' }),
            new File(['subtitles'], 'Sing Along.srt', { type: 'text/plain' }),
            new File(['graphics'], 'Sing Along.cdg'),
          ],
        },
      },
    );

    expect(
      await screen.findByRole('heading', { name: 'Sing Along' }),
    ).toBeVisible();
    expect(importNotice(container)).toHaveTextContent(
      'FluidEQ has no karaoke reader for these files yet, so they were set aside: CDG, SRT.',
    );
  });

  it('says two lyric files matched one song, so neither was used', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Twin.mp3', { type: 'audio/mpeg' }),
            new File(['[00:01.00]Hello'], 'Twin.lrc', { type: 'text/plain' }),
            new File(
              ['#TITLE:Twin\n#BPM:120\n#GAP:0\n: 0 4 0 Hello\nE'],
              'Twin.txt',
              { type: 'text/plain' },
            ),
          ],
        },
      },
    );

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(importNotice(container)).toHaveTextContent(
      'Two lyric files matched the same song, so neither was used: Twin.lrc, Twin.txt.',
    );
  });

  it('stops claiming two lyric files matched a song that has been removed', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Twin.mp3', { type: 'audio/mpeg' }),
            new File(['[00:01.00]Hello'], 'Twin.lrc', { type: 'text/plain' }),
            new File(
              ['#TITLE:Twin\n#BPM:120\n#GAP:0\n: 0 4 0 Hello\nE'],
              'Twin.txt',
              { type: 'text/plain' },
            ),
          ],
        },
      },
    );

    expect(await screen.findByText('Audio only')).toBeVisible();
    expect(importNotice(container)).toHaveTextContent(
      'Two lyric files matched the same song, so neither was used: Twin.lrc, Twin.txt.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Twin' }));

    // The song those two files were competing over has gone, so the sentence
    // that named it is no longer true. It used to survive the removal word for
    // word, naming a match against a library entry that no longer existed.
    expect(
      screen
        .queryAllByRole('status')
        .map((node) => node.textContent ?? '')
        .join(' '),
    ).not.toContain('Two lyric files matched the same song');
    expect(importNotice(container)).toHaveTextContent(
      'No audio file matches these lyric files, so they were not used: Twin.lrc, Twin.txt.',
    );
  });

  // The 2000s UltraStar pack the stage's own comments are written about: one
  // AVI, no artwork. The stage drew nothing at all while the art toggle stayed
  // enabled over it.
  it('draws the unplayable-video notice when it is all the stage has', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Retro Pack.mp3', { type: 'audio/mpeg' }),
            new File(['video'], 'Retro Pack [VD#0].avi', {
              type: 'video/x-msvideo',
            }),
          ],
        },
      },
    );

    expect(
      await screen.findByRole('heading', { name: 'Retro Pack' }),
    ).toBeVisible();
    const notice = container.querySelector(
      '.karaoke-stage-media__unsupported',
    ) as HTMLElement;
    expect(notice).toHaveTextContent('AVI video cannot be played here');
    expect(notice).toHaveClass('is-alone');
    // Role queries skip anything under `aria-hidden`, which the whole media
    // layer used to be — the sighted user read the notice and a screen reader
    // was told the stage was empty.
    expect(
      screen.getAllByRole('status').map((node) => node.textContent),
    ).toContain('AVI video cannot be played here');
    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide cover art' }),
    ).toBeEnabled();
  });

  it('lets a picture that will not decode step aside for the gradient', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Broken Art.mp3', { type: 'audio/mpeg' }),
            new File(['not really an image'], 'Broken Art.jpg', {
              type: 'image/jpeg',
            }),
          ],
        },
      },
    );

    expect(
      await screen.findByRole('heading', { name: 'Broken Art' }),
    ).toBeVisible();
    const still = container.querySelector(
      '.karaoke-stage-media__still',
    ) as HTMLImageElement;
    expect(still).toBeInTheDocument();

    fireEvent.error(still);

    // Gone rather than showing the browser's broken-image frame across the
    // whole stage, which is what a truncated or mislabelled picture drew.
    expect(
      container.querySelector('.karaoke-stage-media__still'),
    ).not.toBeInTheDocument();
    // And silently: artwork is scenery at 0.32 opacity behind the words, so
    // the stage now looks exactly like an audio-only song's. A caption over a
    // stage that looks correct is noise the video notice is not.
    expect(
      container.querySelector('.karaoke-stage-media__unsupported'),
    ).not.toBeInTheDocument();
  });

  it('says a supported container failed to decode rather than falling back mutely', async () => {
    const { container } = render(<KaraokeWorkspace isHidden={false} />);
    fireEvent.change(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      {
        target: {
          files: [
            new File(['audio'], 'Modern.mp3', { type: 'audio/mpeg' }),
            new File(['video'], 'Modern.mp4', { type: 'video/mp4' }),
          ],
        },
      },
    );

    expect(
      await screen.findByRole('heading', { name: 'Modern' }),
    ).toBeVisible();
    // The extension says playable, so nothing is said until the decoder
    // disagrees — an HEVC or AC-3 MP4 gets this far and then errors.
    expect(
      container.querySelector('.karaoke-stage-media__unsupported'),
    ).not.toBeInTheDocument();

    fireEvent.error(container.querySelector('video') as HTMLVideoElement);

    expect(
      container.querySelector('.karaoke-stage-media__unsupported'),
    ).toHaveTextContent('MP4 video could not be decoded here');
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
    const transportBeforeTabChange =
      barSlot?.querySelector('.karaoke-transport');

    rerender(<KaraokeWorkspace isHidden />);

    expect(pause).toHaveBeenCalledTimes(pausesBeforeTabChange);
    expect(audio).toHaveAttribute('src', 'blob:karaoke-song');
    expect(barSlot?.querySelector('.karaoke-transport')).toBe(
      transportBeforeTabChange,
    );
    expect(
      screen.getByRole('button', { name: 'Jump to song start' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Jump to song end' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeVisible();
    audio.currentTime = 4;
    const pausesBeforeStop = pause.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(pause).toHaveBeenCalledTimes(pausesBeforeStop + 1);
    expect(audio.currentTime).toBe(0);
  });

  it('releases the hidden stage DOM when another tab opens', () => {
    const { container } = render(<KaraokeWorkspace isHidden />);
    const workspace = container.querySelector('.karaoke-workspace');

    expect(workspace).not.toBeInTheDocument();
    expect(container.querySelector('.karaoke-audio-host')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'A stage built around your music',
      }),
    ).not.toBeInTheDocument();
  });
});
