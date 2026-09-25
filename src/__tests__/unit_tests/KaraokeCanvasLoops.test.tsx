/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two frame loops on the karaoke stage: the pitch lane's and the words'.
 *
 * The lane listed the pitch and the playhead among what its loop depended on,
 * so each detector report and each playhead tick — forty a second between
 * them — tore the loop and its ResizeObserver down and built them again. And
 * both loops drew every frame for as long as they were mounted, the amp's
 * `display: none` over the whole app included.
 */

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import type {
  IKaraokeSong,
  TKaraokePitchTarget,
} from '../../common/karaoke/types';
import type { IKaraokeLivePitch } from '../../renderer/karaoke/useKaraokeMicrophone';

let mockIsShown = true;
let mockShown: ((shown: boolean) => void) | undefined;
const mockStopWatching = jest.fn();

jest.mock('../../renderer/utils/observeShown', () => ({
  __esModule: true,
  // Answers at once, as the real one does, and then whenever it is told.
  default: (_element: Element, onChange: (shown: boolean) => void) => {
    mockShown = onChange;
    onChange(mockIsShown);
    return mockStopWatching;
  },
}));

/** What the watcher would report: the amp over the app, or back again. */
const setShown = (shown: boolean) => {
  mockIsShown = shown;
  act(() => mockShown?.(shown));
};

/* eslint-disable import/first -- the watcher mock above has to be in place first. */
import KaraokeLyrics from '../../renderer/karaoke/KaraokeLyrics';
import KaraokePitchLane from '../../renderer/karaoke/KaraokePitchLane';
import { I18nProvider } from '../../renderer/utils/I18nContext';
/* eslint-enable import/first */

const livePitch = (midi: number): IKaraokeLivePitch => ({
  frequencyHz: 440 * 2 ** ((midi - 69) / 12),
  midi,
  note: 'A4',
  cents: 0,
  confidence: 0.98,
  rms: 0.2,
  capturedAtMs: 1,
  processingMs: 1,
});

const noteAt = (targetMidi: number): TKaraokePitchTarget => ({
  kind: 'notes',
  source: 'ultrastar',
  coordinateSystem: 'midi-semitones',
  octavePolicy: 'absolute',
  notes: [
    {
      text: 'sing',
      startsWord: true,
      startMs: 0,
      endMs: 10_000,
      targetMidi,
    },
  ],
});

/** Frames asked for and not yet run, by handle. */
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

const runFrame = (timeMs: number) => {
  const due = [...frames.values()];
  frames.clear();
  act(() => {
    due.forEach((callback) => callback(timeMs));
  });
};

describe("the karaoke stage's frame loops", () => {
  let paints: jest.SpyInstance;
  const originalResizeObserver = window.ResizeObserver;

  beforeEach(() => {
    frames.clear();
    mockIsShown = true;
    mockShown = undefined;
    mockStopWatching.mockClear();
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        const handle = nextFrame;
        nextFrame += 1;
        frames.set(handle, callback);
        return handle;
      });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
      frames.delete(handle);
    });
    // Asked for once per painted frame, and by nothing else.
    paints = jest.spyOn(HTMLCanvasElement.prototype, 'getContext');
    paints.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.ResizeObserver = originalResizeObserver;
    Reflect.deleteProperty(document, 'hidden');
  });

  it("builds the lane's loop once while the pitch and the playhead move", () => {
    // One built per setup of the loop, which is what is being counted.
    const observers = jest.fn().mockImplementation(() => ({
      observe: () => undefined,
      unobserve: () => undefined,
      disconnect: () => undefined,
    }));
    window.ResizeObserver = observers as unknown as typeof ResizeObserver;
    const lane = (tick: number, target: TKaraokePitchTarget) => (
      <I18nProvider>
        <KaraokePitchLane
          isActive
          isPlaying
          analysisStatus="ready"
          microphoneStatus="live"
          pitch={livePitch(69 + (tick % 3))}
          target={target}
          playheadMs={1_000 + tick * 50}
          durationMs={60_000}
        />
      </I18nProvider>
    );
    const firstTarget = noteAt(69);
    const { rerender } = render(lane(0, firstTarget));
    for (let tick = 1; tick <= 40; tick += 1) {
      rerender(lane(tick, firstTarget));
    }

    expect(observers).toHaveBeenCalledTimes(1);
    // The control: what the loop does depend on still rebuilds it.
    rerender(lane(41, noteAt(72)));
    expect(observers).toHaveBeenCalledTimes(2);
  });

  it('stops painting the lane while it cannot be seen, and paints again when it can', () => {
    render(
      <KaraokePitchLane
        isActive
        analysisStatus="idle"
        microphoneStatus="off"
        playheadMs={0}
      />,
    );
    runFrame(16);
    expect(paints).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);

    setShown(false);
    // Nothing to listen to with the microphone off: no frame at all.
    expect(frames.size).toBe(0);

    setShown(true);
    runFrame(32);
    expect(paints).toHaveBeenCalledTimes(2);
  });

  it('keeps listening to a live microphone while the lane is out of sight', () => {
    let nowMs = 1_000;
    jest.spyOn(performance, 'now').mockImplementation(() => nowMs);
    const { getByRole } = render(
      <KaraokePitchLane
        isActive
        isPlaying
        analysisStatus="ready"
        microphoneStatus="live"
        // Nine semitones over the note, every sample: the review has to say
        // so, from samples taken while nothing was painted.
        pitch={livePitch(69)}
        target={noteAt(60)}
        readPlayheadMs={() => nowMs}
        durationMs={60_000}
        onPracticeIssue={jest.fn()}
      />,
    );
    const canvas = getByRole('button', {
      name: 'Real-time singer pitch curve over the song notes',
    });
    setShown(false);
    paints.mockClear();
    expect(canvas).toHaveAttribute('tabindex', '-1');

    for (let frame = 0; frame < 8; frame += 1) {
      nowMs += 60;
      runFrame(nowMs);
    }

    expect(paints).not.toHaveBeenCalled();
    expect(canvas).toHaveAttribute('aria-disabled', 'false');
    expect(canvas).toHaveAttribute('tabindex', '0');
  });

  describe('the words', () => {
    const song: IKaraokeSong = {
      id: 'glide-song',
      title: 'Glide Song',
      assets: [],
      timingPrecision: 'line',
      lines: Array.from({ length: 6 }, (_, index) => ({
        id: `line-${index}`,
        startMs: index * 1_000,
        endMs: (index + 1) * 1_000,
        tokens: [{ text: `Line ${index + 1}` }],
      })),
      pitch: { kind: 'none', reason: 'missing' },
      meta: { sourceFormat: 'lrc', gapMs: 0 },
    };

    /** The height `Line 5` is written at, in each frame that writes it. */
    const lineFiveYs: number[] = [];

    beforeEach(() => {
      lineFiveYs.length = 0;
      const context = new Proxy(
        {
          measureText: (text: string) => ({ width: text.length * 10 }),
          fillText: (text: string, _x: number, y: number) => {
            if (text === 'Line 5') {
              lineFiveYs.push(y);
            }
          },
          createLinearGradient: () => ({ addColorStop: () => undefined }),
        },
        {
          // Every other call and property is inert: only where `Line 5`
          // lands is measured.
          get: (target, property) =>
            property in target
              ? target[property as keyof typeof target]
              : () => undefined,
          set: () => true,
        },
      );
      paints.mockReturnValue(context as unknown as CanvasRenderingContext2D);
      jest
        .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
        .mockReturnValue({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 1_000,
          bottom: 400,
          width: 1_000,
          height: 400,
          toJSON: () => ({}),
        });
    });

    it('stops drawing the words while they cannot be seen', () => {
      render(
        <KaraokeLyrics song={song} playheadMs={1_200} onSeek={jest.fn()} />,
      );
      expect(frames.size).toBe(1);
      setShown(false);
      expect(frames.size).toBe(0);
      setShown(true);
      expect(frames.size).toBe(1);
    });

    const returnToLineFive = (hiddenByWindow: boolean) => {
      const { rerender } = render(
        <KaraokeLyrics song={song} playheadMs={1_200} onSeek={jest.fn()} />,
      );
      runFrame(0);
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: hiddenByWindow,
      });
      setShown(false);
      rerender(
        <KaraokeLyrics song={song} playheadMs={4_200} onSeek={jest.fn()} />,
      );
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: false,
      });
      setShown(true);
      lineFiveYs.length = 0;
      runFrame(16);
      return lineFiveYs[0];
    };

    it('come back from the amp where they belong, as a loop that never stopped left them', () => {
      // Half way down the 400px canvas is the singing line.
      expect(returnToLineFive(false)).toBeCloseTo(200, 6);
    });

    it('POSITIVE CONTROL: a minimised window still resumes mid-glide', () => {
      expect(returnToLineFive(true)).toBeGreaterThan(200);
    });
  });
});
