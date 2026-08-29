/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
import { act, render } from '@testing-library/react';
import type { ILibraryIndex, ILibraryTrack } from '../../common/library/types';
import { DSP_DEFAULTS } from '../../common/dsp/chain';
import {
  applyDspSettings,
  readDspInputAnalysis,
} from '../../renderer/dsp/store';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import {
  ILibraryPlayerContextValue,
  LibraryPlayerProvider,
  useLibraryPlayer,
} from '../../renderer/library/player/LibraryPlayerContext';
import LibraryVideoStage from '../../renderer/library/player/LibraryVideoStage';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const videoTrack: ILibraryTrack = {
  id: 'v1',
  rootId: 'r1',
  path: 'C:\\Videos\\show.mp4',
  kind: 'video',
  isPlayable: true,
  title: 'Show',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
};

const audioTrack: ILibraryTrack = {
  id: 'a1',
  rootId: 'r1',
  path: 'C:\\Music\\song.mp3',
  kind: 'audio',
  isPlayable: true,
  title: 'Song',
  sizeBytes: 1,
  mtimeMs: 2,
  addedAt: 2,
};

const secondAudioTrack: ILibraryTrack = {
  ...audioTrack,
  id: 'a2',
  path: 'C:\\Music\\next-song.mp3',
  title: 'Next song',
  mtimeMs: 3,
};

// jsdom's `HTMLMediaElement.prototype.play` returns `undefined` rather than
// the Promise every real engine hands back, and never toggles `.paused` --
// `KaraokeWorkspace.test.tsx` stubs the same two for the same reason.
// `.paused` staying `true` regardless of what is called on the element is
// exactly why the assertions below check the `pause` mock and the `src`
// attribute directly rather than `.paused`: a probe against this exact jsdom
// confirmed `.paused` reads `true` before the fix, after `playTracks`, and
// after `skip` alike, which would make it a null test here.
const mediaPlay = jest.fn().mockResolvedValue(undefined);
const mediaPause = jest.fn();

/** Every `currentTime` assignment any media element receives, in order — see
 * the test that reads it for what an entry during the load would mean. */
const currentTimeSets: number[] = [];

let latestPlayer: ILibraryPlayerContextValue | undefined;
/** Captured from the mocked `onLibraryIndexChanged` subscription so a test
 * can simulate `library-index-changed` arriving mid-playback — the same
 * event a real root removal delivers — without going through any IPC. */
let indexChangedHandler: ((next: ILibraryIndex) => void) | undefined;

/** Reads the context so the test can drive it directly, and renders the
 * stage so a real `<video>` element exists to assert on — the same pairing
 * `App.tsx` mounts, `LibraryPlayerProvider` and `LibraryVideoStage` side by
 * side under it. */
const Harness = () => {
  latestPlayer = useLibraryPlayer();
  return <LibraryVideoStage />;
};

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: mediaPlay,
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: mediaPause,
  });
  // jsdom leaves `currentTime` a plain data property, so recording it needs a
  // real accessor rather than a spy.
  let held = 0;
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get: () => held,
    set: (value: number) => {
      held = value;
      currentTimeSets.push(value);
    },
  });
});

beforeEach(() => {
  latestPlayer = undefined;
  indexChangedHandler = undefined;
  mediaPlay.mockClear();
  mediaPause.mockClear();
  currentTimeSets.length = 0;
  const initialIndex: ILibraryIndex = {
    version: 1,
    roots: [
      {
        id: 'r1',
        path: 'C:\\Media',
        addedAt: 1,
        trackCount: 2,
        karaokeSkipped: 0,
      },
    ],
    tracks: [videoTrack, audioTrack],
  };
  window.electron = {
    ipcRenderer: {
      getLibraryIndex: () =>
        Promise.resolve({ index: initialIndex, wasReset: false }),
      onLibraryScanProgress: () => () => undefined,
      onLibraryTracksAdded: () => () => undefined,
      onLibraryIndexChanged: (handler: (next: ILibraryIndex) => void) => {
        indexChangedHandler = handler;
        return () => undefined;
      },
      libraryTrackBytes: () => Promise.resolve(undefined),
      libraryTrackSignature: () => Promise.resolve(undefined),
      setLibraryTrackNormalization: () => Promise.resolve(false),
      // `LibraryVideoStage` listens for 'window-state-changed' the moment it
      // mounts.
      on: (_channel: string, _func: (...args: unknown[]) => void) => () => {},
    },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  applyDspSettings(DSP_DEFAULTS);
});

const renderHarness = () =>
  render(
    <I18nProvider>
      <LibraryProvider>
        <LibraryPlayerProvider>
          <Harness />
        </LibraryPlayerProvider>
      </LibraryProvider>
    </I18nProvider>,
  );

describe('leaving a video behind (Task 19 fix-round)', () => {
  it('pauses the video element and clears its src the instant the queue moves off it', async () => {
    renderHarness();

    // `LibraryProvider`'s own `getLibraryIndex` call is async; without this
    // the index is still `{ tracks: [] }` when `playTracks` runs below and
    // neither track resolves.
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latestPlayer?.playTracks([videoTrack.id, audioTrack.id], videoTrack.id);
    });

    const videoElement = document.querySelector('video');
    expect(videoElement).not.toBeNull();
    expect(videoElement).toHaveAttribute('src');

    // `pause` is stubbed on the shared `HTMLMediaElement.prototype` above, so
    // the hidden `Audio()` element calls the very same method on its own
    // unconditional `audio.pause()` at the top of every track change — a
    // global call count would pass whether or not the *video* element was
    // ever touched. `jest.spyOn` on an inherited method patches the
    // prototype it actually finds the descriptor on rather than shadowing
    // the instance, so it does not isolate the two elements either — a real
    // own-property override on this one instance, via `defineProperty`
    // rather than `spyOn`, is what actually attributes a call to this
    // element specifically.
    const videoPause = jest.fn();
    Object.defineProperty(videoElement, 'pause', {
      configurable: true,
      value: videoPause,
    });

    // The exact move the brief requires never overlap: the queue's current
    // track stops being the video and becomes the audio track in the same
    // `skip` call.
    act(() => {
      latestPlayer?.skip(1);
    });

    expect(videoPause).toHaveBeenCalled();
    expect(videoElement).not.toHaveAttribute('src');
    // The stage itself is gone too -- confirms `videoTrackId` genuinely
    // moved off the video rather than one stray element happening to get
    // cleaned up while another still renders.
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('the dead end a video with nothing next leaves behind (blocker 1)', () => {
  it('lets Stop clear a video-only queue that reached its own end', async () => {
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    // A queue built from the video alone, exactly what the Videos shelf's
    // own folder-grouped queue looks like once every other track in it has
    // already played.
    act(() => {
      latestPlayer?.playTracks([videoTrack.id], videoTrack.id);
    });
    expect(document.querySelector('video')).not.toBeNull();

    // `repeat` defaults to 'off' and `advanceQueue` holds position at the
    // last track rather than clearing it -- the exact dead end blocker 1
    // describes: every browse view stays gated on `videoTrackId` forever,
    // with nothing in the queue itself that ever unsets it.
    act(() => {
      latestPlayer?.skip(1);
    });
    expect(latestPlayer?.videoTrackId).toBe(videoTrack.id);

    act(() => {
      latestPlayer?.stop();
    });

    expect(latestPlayer?.videoTrackId).toBeUndefined();
    expect(latestPlayer?.track).toBeUndefined();
    expect(latestPlayer?.queue).toBeUndefined();
    // The stage itself unmounts along with the queue clearing -- the tab
    // actually gets back to browsing, not just an id flipping in state.
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('a root removed while its track is playing (blocker 2)', () => {
  it('pauses the hidden audio element and hides the bar even though trackId never changes', async () => {
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latestPlayer?.playTracks([audioTrack.id], audioTrack.id);
    });
    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    // Clears the calls the loader effect above already made on its own
    // unconditional `audio.pause()` at the top of every track change, so
    // the assertion below can only pass if the new, separate effect is what
    // paused it a second time.
    mediaPause.mockClear();

    // `library-root-remove` deletes every track under the removed root and
    // broadcasts the same `library-index-changed` event a rescan does. The
    // queue itself is untouched -- `trackId` still names `audioTrack.id` --
    // only what `trackById` resolves that id to has changed, which is
    // exactly the case the `[trackId]`-keyed loader effect cannot see.
    const emptiedIndex: ILibraryIndex = {
      version: 1,
      roots: [],
      tracks: [videoTrack],
    };
    act(() => {
      indexChangedHandler?.(emptiedIndex);
    });

    // The queue's own `trackIds` never moved -- confirms this really is the
    // "trackId unchanged, track gone" case and not an incidental skip.
    expect(latestPlayer?.queue?.trackIds).toEqual([audioTrack.id]);
    expect(latestPlayer?.track).toBeUndefined();
    expect(mediaPause).toHaveBeenCalled();
  });
});

describe('loading a track', () => {
  it('never assigns a position on the same tick as the source', async () => {
    // This is what made seeking impossible, and it cost a long hunt to find
    // because every layer above it looked right: the bar reported the correct
    // value, `seek` was called with it, and `element.currentTime = 101.7` ran
    // — and the element silently refused it and stayed at zero.
    //
    // Measured against the real thing in the running window, three elements
    // pointed at one file:
    //
    //   src, currentTime = 0, play()  ->  seekable.end = 0,      seek lands at 0.87
    //   src, play()                   ->  seekable.end = 168.88, seek lands at 100.91
    //   src, preload = "metadata"     ->  seekable.end = 168.88, seek lands at 100
    //
    // A position assigned while the element is still at `HAVE_NOTHING` leaves
    // its seekable range empty for the whole of that load, and every later
    // seek is dropped. jsdom has no such behaviour to reproduce, so what is
    // asserted here is the cause rather than the symptom: the loader must not
    // touch `currentTime` at all.
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latestPlayer?.playTracks([audioTrack.id], audioTrack.id);
    });

    expect(currentTimeSets).toEqual([]);

    // The control the assertion above needs: proof the recorder is wired to
    // the property the loader would have used, so an empty list means "the
    // loader did not assign one" rather than "nothing here can see it".
    act(() => {
      latestPlayer?.seek(101_700);
    });
    expect(currentTimeSets).toEqual([101.7]);
  });
});

describe('crossfade transport ownership', () => {
  it('keeps navigation on the working deck until the incoming song is playing', async () => {
    const createdAudio: HTMLAudioElement[] = [];
    const audioConstructor = jest
      .spyOn(window, 'Audio')
      .mockImplementation((source?: string) => {
        const element = document.createElement('audio');
        if (source) {
          element.src = source;
        }
        createdAudio.push(element);
        return element;
      });
    applyDspSettings({
      ...DSP_DEFAULTS,
      normalizer: { ...DSP_DEFAULTS.normalizer, mode: 'off' },
      crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
    });

    try {
      renderHarness();
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        indexChangedHandler?.({
          version: 1,
          roots: [
            {
              id: 'r1',
              path: 'C:\\Media',
              addedAt: 1,
              trackCount: 3,
              karaokeSkipped: 0,
            },
          ],
          tracks: [videoTrack, audioTrack, secondAudioTrack],
        });
      });
      act(() => {
        latestPlayer?.playTracks(
          [audioTrack.id, secondAudioTrack.id],
          audioTrack.id,
        );
      });
      await act(async () => {
        await Promise.resolve();
      });

      const [outgoing, incoming] = createdAudio;
      expect(outgoing).toBeDefined();
      expect(incoming).toBeDefined();
      Object.defineProperty(outgoing, 'paused', {
        configurable: true,
        get: () => false,
      });
      const outgoingPause = jest.fn();
      Object.defineProperty(outgoing, 'pause', {
        configurable: true,
        value: outgoingPause,
      });
      const trackBytes = jest
        .fn<Promise<ArrayBuffer | undefined>, [string]>()
        .mockResolvedValue(new ArrayBuffer(8));
      window.electron.ipcRenderer.libraryTrackBytes = trackBytes;
      const outgoingSeeks: number[] = [];
      const incomingSeeks: number[] = [];
      Object.defineProperty(outgoing, 'currentTime', {
        configurable: true,
        get: () => outgoingSeeks[outgoingSeeks.length - 1] ?? 0,
        set: (value: number) => {
          outgoingSeeks.push(value);
        },
      });
      Object.defineProperty(incoming, 'currentTime', {
        configurable: true,
        get: () => incomingSeeks[incomingSeeks.length - 1] ?? 0,
        set: (value: number) => {
          incomingSeeks.push(value);
        },
      });

      let startIncoming: (() => void) | undefined;
      mediaPlay.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            startIncoming = resolve;
          }),
      );
      act(() => {
        latestPlayer?.skip(1);
      });
      expect(latestPlayer?.track?.id).toBe(secondAudioTrack.id);
      expect(mediaPlay.mock.instances).toContain(incoming);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      // A fast byte-cache read must not replace the source while the incoming
      // deck's first play promise is pending. Chromium rejects that promise as
      // AbortError, which was why Next left the old song playing forever.
      expect(incoming.src).toContain(secondAudioTrack.id);
      expect(incoming.src).not.toMatch(/^blob:/);
      expect(outgoingPause).not.toHaveBeenCalled();

      act(() => {
        latestPlayer?.seek(5_000);
      });
      expect(outgoingSeeks).toEqual([5]);
      expect(incomingSeeks).toEqual([]);

      await act(async () => {
        startIncoming?.();
        await Promise.resolve();
      });
      expect(outgoing.getAttribute('src')).not.toBeNull();
      expect(incoming.getAttribute('src')).not.toBeNull();
      expect(outgoingPause).not.toHaveBeenCalled();
      act(() => {
        latestPlayer?.seek(7_000);
      });
      expect(incomingSeeks).toEqual([7]);
    } finally {
      audioConstructor.mockRestore();
    }
  });

  /**
   * The seek bar during a handoff, which had three writers and no owner.
   *
   * A crossfade runs both elements at once, so for the length of the overlap
   * the outgoing one is still playing a track that is no longer current — and
   * its `timeupdate` kept writing the position. Between the reset to zero on
   * the track change, the outgoing element reporting the middle of the previous
   * song, and the incoming one starting from nothing, the thumb jumped to the
   * start, back out to where the old track was, and to the start again.
   */
  it('does not let the outgoing deck drive the seek bar once the track changed', async () => {
    const createdAudio: HTMLAudioElement[] = [];
    const audioConstructor = jest
      .spyOn(window, 'Audio')
      .mockImplementation((source?: string) => {
        const element = document.createElement('audio');
        if (source) {
          element.src = source;
        }
        createdAudio.push(element);
        return element;
      });
    applyDspSettings({
      ...DSP_DEFAULTS,
      normalizer: { ...DSP_DEFAULTS.normalizer, mode: 'off' },
      crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
    });

    try {
      renderHarness();
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        indexChangedHandler?.({
          version: 1,
          roots: [
            {
              id: 'r1',
              path: 'C:\\Media',
              addedAt: 1,
              trackCount: 3,
              karaokeSkipped: 0,
            },
          ],
          tracks: [videoTrack, audioTrack, secondAudioTrack],
        });
      });
      act(() => {
        latestPlayer?.playTracks(
          [audioTrack.id, secondAudioTrack.id],
          audioTrack.id,
        );
      });
      await act(async () => {
        await Promise.resolve();
      });

      const outgoing = createdAudio[0];
      expect(outgoing).toBeDefined();
      // Playing, so the track change is a crossfade handoff rather than a cut.
      Object.defineProperty(outgoing, 'paused', {
        configurable: true,
        get: () => false,
      });
      let outgoingTime = 0;
      Object.defineProperty(outgoing, 'currentTime', {
        configurable: true,
        get: () => outgoingTime,
        set: (value: number) => {
          outgoingTime = value;
        },
      });

      // The control: while it IS the current track, its ticks must be heard.
      outgoingTime = 42;
      act(() => {
        outgoing.dispatchEvent(new Event('timeupdate'));
      });
      expect(latestPlayer?.positionMs).toBe(42_000);

      act(() => {
        latestPlayer?.skip(1);
      });
      expect(latestPlayer?.track?.id).toBe(secondAudioTrack.id);
      expect(latestPlayer?.positionMs).toBe(0);

      // The overlap: the outgoing element is still playing, still ticking, and
      // still one hundred and twenty seconds into a song nobody is showing.
      outgoingTime = 120;
      act(() => {
        outgoing.dispatchEvent(new Event('timeupdate'));
      });
      expect(latestPlayer?.positionMs).toBe(0);
    } finally {
      audioConstructor.mockRestore();
    }
  });
  it('keeps the outgoing track-level gain until the overlap is finished', async () => {
    jest.useFakeTimers();
    const createdAudio: HTMLAudioElement[] = [];
    const audioConstructor = jest
      .spyOn(window, 'Audio')
      .mockImplementation((source?: string) => {
        const element = document.createElement('audio');
        if (source) {
          element.src = source;
        }
        createdAudio.push(element);
        return element;
      });
    const first = {
      ...audioTrack,
      normalization: {
        version: 2 as const,
        truePeakDbtp: -2,
        integratedLufs: -18,
      },
    };
    const next = {
      ...secondAudioTrack,
      normalization: {
        version: 2 as const,
        truePeakDbtp: -0.5,
        integratedLufs: -8,
      },
    };
    applyDspSettings({
      ...DSP_DEFAULTS,
      crossfade: {
        ...DSP_DEFAULTS.crossfade,
        enabled: true,
        durationMs: 250,
      },
    });

    try {
      renderHarness();
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        indexChangedHandler?.({
          version: 1,
          roots: [
            {
              id: 'r1',
              path: 'C:\\Media',
              addedAt: 1,
              trackCount: 2,
              karaokeSkipped: 0,
            },
          ],
          tracks: [first, next],
        });
        latestPlayer?.playTracks([first.id, next.id], first.id);
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(readDspInputAnalysis().trackId).toBe(first.id);

      const outgoing = createdAudio[0];
      expect(outgoing).toBeDefined();
      Object.defineProperty(outgoing, 'paused', {
        configurable: true,
        get: () => false,
      });
      act(() => {
        latestPlayer?.skip(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(latestPlayer?.track?.id).toBe(next.id);
      expect(readDspInputAnalysis().trackId).toBe(first.id);

      act(() => {
        jest.advanceTimersByTime(301);
      });
      expect(readDspInputAnalysis().trackId).toBe(next.id);
    } finally {
      audioConstructor.mockRestore();
      jest.useRealTimers();
    }
  });
});

describe('Previous button behavior', () => {
  it('restarts after ten seconds, then changes to the previous song', async () => {
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      latestPlayer?.playTracks([videoTrack.id, audioTrack.id], audioTrack.id);
    });
    act(() => {
      latestPlayer?.seek(15_000);
    });

    act(() => {
      latestPlayer?.skip(-1);
    });
    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    expect(latestPlayer?.positionMs).toBe(0);

    act(() => {
      latestPlayer?.skip(-1);
    });
    expect(latestPlayer?.track?.id).toBe(videoTrack.id);
  });
});

describe('the length of the playing track', () => {
  it('is learned once and never unlearned', async () => {
    // `durationchange` does not fire only with the answer: it fires again
    // mid-playback and Chromium reports `Infinity` on some of those. Writing
    // that through as zero collapsed the seek bar in the middle of a song —
    // `NowPlayingBar` clamps both its value and its `max` to
    // `max(1, durationMs)`, so at zero the thumb lands on the far left and
    // the control disables itself. That is what "it goes back to the start
    // when I try to seek" was.
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latestPlayer?.playTracks([videoTrack.id], videoTrack.id);
    });
    const element = document.querySelector('video');
    expect(element).not.toBeNull();

    const setDuration = (value: number) => {
      Object.defineProperty(element as HTMLVideoElement, 'duration', {
        configurable: true,
        get: () => value,
      });
    };

    setDuration(212.5);
    act(() => {
      element?.dispatchEvent(new Event('durationchange'));
    });
    expect(latestPlayer?.durationMs).toBeCloseTo(212_500);

    // The one that used to wipe it.
    setDuration(Number.POSITIVE_INFINITY);
    act(() => {
      element?.dispatchEvent(new Event('durationchange'));
    });
    expect(latestPlayer?.durationMs).toBeCloseTo(212_500);

    // The control: a real, different length still gets through, so this is
    // "ignores nonsense" rather than "ignores everything after the first".
    setDuration(180);
    act(() => {
      element?.dispatchEvent(new Event('durationchange'));
    });
    expect(latestPlayer?.durationMs).toBeCloseTo(180_000);
  });
});

describe('a track whose file will not load (blocker 4)', () => {
  it('surfaces the same unplayable message the codec-unplayable path uses', async () => {
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latestPlayer?.playTracks([videoTrack.id], videoTrack.id);
    });
    expect(latestPlayer?.isUnplayable).toBe(false);

    // The hidden `Audio()` element lives in a ref, never the DOM, so a real
    // 404 from the protocol handler cannot be dispatched at it from here --
    // the video element `LibraryVideoStage` mounts is bound through the
    // exact same `bindMediaEvents` call, so firing `error` on it exercises
    // the identical listener under test.
    const videoElement = document.querySelector('video');
    expect(videoElement).not.toBeNull();
    act(() => {
      videoElement?.dispatchEvent(new Event('error'));
    });

    expect(latestPlayer?.isUnplayable).toBe(true);
    expect(latestPlayer?.isPlaying).toBe(false);
  });
});

/**
 * Coming back to the app must never start making noise.
 *
 * The line between "where you were" and "what you asked for": the last track
 * is cued with its playhead where it was, and it waits for Play.
 */
describe('restoring the last session', () => {
  const seedMemory = (positionMs: number) => {
    window.localStorage.setItem(
      'fluideq.library.playback',
      JSON.stringify({
        trackIds: [audioTrack.id],
        order: [0],
        position: 0,
        repeat: 'off',
        isShuffled: false,
        positionMs,
      }),
    );
  };

  afterEach(() => {
    window.localStorage.removeItem('fluideq.library.playback');
  });

  it('cues the last track without playing it', async () => {
    seedMemory(90_000);
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    expect(mediaPlay).not.toHaveBeenCalled();
  });

  /**
   * The gap this test exists for.
   *
   * `restorablePositionMs` declines to restore a playhead under five seconds,
   * and the loader read that same absence as "this is not a restore" — so a
   * session that ended two seconds into a track fell through to `play()` and
   * the app started playing on its own at launch. Whether to resume a POSITION
   * is a judgement; whether to start playing unasked is not.
   */
  it('still refuses to play when the position was too early to restore', async () => {
    seedMemory(2_000);
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    expect(mediaPlay).not.toHaveBeenCalled();
  });

  /**
   * POSITIVE CONTROL. Without it, both assertions above would pass just as
   * well if nothing in this harness could ever reach `play()`.
   */
  it('POSITIVE CONTROL: a track the user picks does play', async () => {
    renderHarness();
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latestPlayer?.playTracks([audioTrack.id], audioTrack.id);
    });

    expect(mediaPlay).toHaveBeenCalled();
  });
});
