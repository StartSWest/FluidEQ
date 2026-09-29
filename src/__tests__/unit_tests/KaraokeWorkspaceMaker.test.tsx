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
import { setTransportSlot } from '../../renderer/audio/transportSlot';
import KaraokeWorkspace from '../../renderer/karaoke/KaraokeWorkspace';
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

describe('KaraokeWorkspace with the Maker', () => {
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
        dialog.querySelector('.dialog-close') as HTMLButtonElement,
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
    // Named by its question, as every confirmation on the small frame is.
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Restore the original karaoke?',
    });
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
    // A beat is 650 ms of the sound card's clock, and a millisecond short of
    // it is still the beat before.
    await advanceAudioClock(0.649);
    expect(captureCue()).toHaveTextContent('1');
    await advanceAudioClock(0.002);
    expect(captureCue()).toHaveTextContent('2');
    await advanceAudioClock(0.65);
    expect(captureCue()).toHaveTextContent('3');
    expect(play).not.toHaveBeenCalled();
    await advanceAudioClock(0.65);
    expect(captureCue()).toHaveTextContent('GO');
    expect(play).toHaveBeenCalledTimes(1);
    await advanceAudioClock(0.55);
    expect(captureCue()).toBeNull();
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
    // Up until its own linger animation ends — not a child's, not another's.
    const timingNotice = screen
      .getByText('Line timing complete. Ready to review and use in the player.')
      .closest('.karaoke-maker__notice') as HTMLElement;
    animationEnd(
      timingNotice.firstElementChild as HTMLElement,
      'karaoke-maker-notice-linger',
    );
    animationEnd(timingNotice, 'karaoke-maker-toast');
    expect(timingNotice).toBeInTheDocument();
    animationEnd(timingNotice, 'karaoke-maker-notice-linger');
    expect(timingNotice).not.toBeInTheDocument();
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
      reviewLyricsDialog.querySelector('.dialog-close') as HTMLButtonElement,
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
    // And a space typed into a name is a space in the name. The transport
    // takes the key everywhere else, which is why this is worth pinning: the
    // rule used to be shown with the BPM box, a number field it did take the
    // key from, and that box did nothing at all and came off the page on
    // 2026-09-20.
    const artist = screen.getByRole('textbox', { name: 'Artist' });
    artist.focus();
    fireEvent.keyDown(artist, { key: ' ', code: 'Space' });
    expect(play).not.toHaveBeenCalled();

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
    // Each confirmation is named by its question and answered by its red
    // button, which says what it does.
    const notesQuestion = screen.getByRole('alertdialog', {
      name: 'Clear all melody notes?',
    });
    expect(notesQuestion).toHaveTextContent(
      'keeping all lyrics and word timing',
    );
    fireEvent.click(
      within(notesQuestion).getByRole('button', { name: 'Clear notes' }),
    );
    expect(clearNotes).toBeDisabled();
    const clearLyrics = screen.getByRole('button', { name: 'Clear lyrics' });
    expect(clearLyrics).toBeEnabled();
    fireEvent.click(clearLyrics);
    const lyricsQuestion = screen.getByRole('alertdialog', {
      name: 'Clear all lyrics?',
    });
    expect(lyricsQuestion).toHaveTextContent('Melody notes remain');
    fireEvent.click(
      within(lyricsQuestion).getByRole('button', { name: 'Clear lyrics' }),
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
});
