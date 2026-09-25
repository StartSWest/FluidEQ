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
import { act, cleanup, render } from '@testing-library/react';
import log from 'electron-log/renderer';
import { resetDspDiagnosticsForTests } from '../../renderer/dsp/diagnostics';
import type { ILibraryRoot, ILibraryTrack } from '../../common/library/types';
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
import createFakeLibraryStore, {
  IFakeLibraryStore,
} from '../utils/fakeLibraryStore';

const mediaRoot: ILibraryRoot = {
  id: 'r1',
  path: 'C:\\Media',
  addedAt: 1,
  trackCount: 2,
  karaokeSkipped: 0,
};

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
/** The library as main holds it. The player reads songs from it by id and
 * only once it answers, so every step that hands the player a song it has
 * not read yet is followed by `store.settle()`. */
let store: IFakeLibraryStore;

/** Reads the context so the test can drive it directly, and renders the
 * stage so a real `<video>` element exists to assert on — the same pairing
 * `App.tsx` mounts, `LibraryPlayerProvider` and `LibraryVideoStage` side by
 * side under it. */
const Harness = () => {
  latestPlayer = useLibraryPlayer();
  return (
    <LibraryVideoStage isFullScreen={false} onToggleFullScreen={() => {}} />
  );
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
  mediaPlay.mockClear();
  mediaPause.mockClear();
  currentTimeSets.length = 0;
  // The player writes its queue here as it goes; a case that inherited the
  // previous case's queue would start from a restore nobody set up.
  window.localStorage.removeItem('fluideq.library.playback');
  store = createFakeLibraryStore([mediaRoot], [videoTrack, audioTrack]);
  window.electron = {
    ipcRenderer: {
      ...store.bridge,
      libraryTrackBytes: () => Promise.resolve(undefined),
      libraryTrackSignature: () => Promise.resolve(undefined),
      setLibraryTrackNormalization: () => Promise.resolve(false),
      // `LibraryVideoStage` listens for 'window-state-changed' the moment it
      // mounts.
      on: (_channel: string, _func: (...args: unknown[]) => void) => () => {},
    },
  } as unknown as typeof window.electron;
});

afterEach(async () => {
  await act(async () => {
    cleanup();
    applyDspSettings(DSP_DEFAULTS);
  });
});

/**
 * Mounts the player and lets the library answer what it asks at launch: the
 * summary first, without which no song is looked up at all, and then
 * whatever that answer leads to.
 */
const renderHarness = async () => {
  const view = render(
    <I18nProvider>
      <LibraryProvider>
        <LibraryPlayerProvider>
          <Harness />
        </LibraryPlayerProvider>
      </LibraryProvider>
    </I18nProvider>,
  );
  await store.settle();
  return view;
};

/** Play these, and let the library read the songs the queue now names. */
const playTracks = async (trackIds: readonly string[], startId: string) => {
  act(() => {
    latestPlayer?.playTracks(trackIds, startId);
  });
  await store.settle();
};

/**
 * Every hidden deck the player builds with `new Audio()`, in the order it
 * builds them — installed before the player mounts, which is when it does.
 *
 * jsdom never loads a source, so no deck announces `loadedmetadata` on its
 * own, and that is the event a deck waits for before it plays. A test that
 * needs a deck to get that far has to hold it to speak for it.
 */
const captureDecks = () => {
  const decks: HTMLAudioElement[] = [];
  const audioConstructor = jest
    .spyOn(window, 'Audio')
    .mockImplementation((source?: string) => {
      const element = document.createElement('audio');
      if (source) {
        element.src = source;
      }
      decks.push(element);
      return element;
    });
  return { decks, release: () => audioConstructor.mockRestore() };
};

/** What a real element says once it has read enough of its file to play. */
const announceMetadata = async (decks: readonly HTMLAudioElement[]) => {
  await act(async () => {
    decks.forEach((deck) => deck.dispatchEvent(new Event('loadedmetadata')));
    await Promise.resolve();
  });
};

describe('leaving a video behind (Task 19 fix-round)', () => {
  it('pauses the video element and clears its src the instant the queue moves off it', async () => {
    await renderHarness();
    await playTracks([videoTrack.id, audioTrack.id], videoTrack.id);

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
    // `skip` call. No answer from the library in between — the song after
    // the playhead was read along with the one on it.
    act(() => {
      latestPlayer?.skip(1);
    });

    expect(videoPause).toHaveBeenCalled();
    expect(videoElement).not.toHaveAttribute('src');
    // The stage itself is gone too -- confirms `videoTrackId` genuinely
    // moved off the video rather than one stray element happening to get
    // cleaned up while another still renders.
    expect(document.querySelector('video')).toBeNull();
    await act(async () => Promise.resolve());
  });
});

describe('the shared Stop contract', () => {
  it('pauses and rewinds a video without discarding its loaded queue', async () => {
    await renderHarness();

    // A queue built from the video alone, exactly what the Videos shelf's
    // own folder-grouped queue looks like once every other track in it has
    // already played.
    await playTracks([videoTrack.id], videoTrack.id);
    expect(document.querySelector('video')).not.toBeNull();

    // `repeat` defaults to 'off' and `advanceQueue` holds position at the
    // last track. Stop must therefore act on the loaded video in place, just
    // as Karaoke and Online Media do, rather than using queue deletion as a
    // different meaning for the same icon.
    act(() => {
      latestPlayer?.skip(1);
    });
    expect(latestPlayer?.videoTrackId).toBe(videoTrack.id);

    const videoElement = document.querySelector('video');
    expect(videoElement).not.toBeNull();
    const videoPause = jest.fn();
    Object.defineProperty(videoElement, 'pause', {
      configurable: true,
      value: videoPause,
    });
    if (videoElement) {
      videoElement.currentTime = 18;
    }
    currentTimeSets.length = 0;

    act(() => {
      latestPlayer?.stop();
    });

    expect(videoPause).toHaveBeenCalledTimes(1);
    expect(currentTimeSets[currentTimeSets.length - 1]).toBe(0);
    expect(latestPlayer?.isPlaying).toBe(false);
    expect(latestPlayer?.videoTrackId).toBe(videoTrack.id);
    expect(latestPlayer?.track?.id).toBe(videoTrack.id);
    expect(latestPlayer?.queue).toBeDefined();
    expect(document.querySelector('video')).toBe(videoElement);
  });
});

describe('the Back button over a video', () => {
  /**
   * The queue, the track and the playhead all survive; only the picture goes.
   *
   * Stop was the button's first implementation, and Stop rewinds — so the
   * picture stayed up (a stopped video is still the current track) and, once
   * closing was added, the position written on the way out was nought. Both
   * are asserted against here: the stage must leave, the element must be
   * paused and NOT rewound, and the stored position must be the real one.
   */
  it('closes the picture, pauses in place and remembers where it was', async () => {
    window.localStorage.removeItem('fluideq.library.videoPositions');
    const { getByRole } = await renderHarness();
    await playTracks([videoTrack.id, audioTrack.id], videoTrack.id);
    const videoElement = document.querySelector('video');
    expect(videoElement).not.toBeNull();
    if (videoElement) {
      videoElement.currentTime = 131;
    }
    currentTimeSets.length = 0;

    act(() => {
      getByRole('button', { name: 'Back' }).click();
    });

    expect(document.querySelector('video')).toBeNull();
    expect(latestPlayer?.videoTrackId).toBeUndefined();
    expect(latestPlayer?.isPlaying).toBe(false);
    // No rewind: the only write to `currentTime` is the teardown's own, and
    // it must not be a nought before the position was read.
    expect(currentTimeSets).not.toContain(0);
    // The queue is intact — Back is not "throw away what is queued".
    expect(latestPlayer?.track?.id).toBe(videoTrack.id);
    expect(latestPlayer?.queue?.trackIds).toEqual([
      videoTrack.id,
      audioTrack.id,
    ]);
    // And the place it was left is on record, for that video by id.
    const stored = JSON.parse(
      window.localStorage.getItem('fluideq.library.videoPositions') ?? '{}',
    ) as Record<string, number>;
    expect(stored[videoTrack.id]).toBe(131_000);
  });

  it('shows the same video again when it is picked again', async () => {
    const { getByRole } = await renderHarness();
    await playTracks([videoTrack.id], videoTrack.id);
    act(() => {
      getByRole('button', { name: 'Back' }).click();
    });
    expect(document.querySelector('video')).toBeNull();

    // The same id, from the same shelf: closing is remembered by id, and
    // this is the press that used to land on a video still marked closed —
    // no picture, no sound, a row lit up as playing.
    await playTracks([videoTrack.id], videoTrack.id);
    expect(latestPlayer?.videoTrackId).toBe(videoTrack.id);
    expect(document.querySelector('video')).not.toBeNull();
    expect(latestPlayer?.isPlaying).toBe(true);
  });

  it('brings the picture back when the closed video is asked to play', async () => {
    const { getByRole } = await renderHarness();
    await playTracks([videoTrack.id], videoTrack.id);
    act(() => {
      getByRole('button', { name: 'Back' }).click();
    });
    expect(document.querySelector('video')).toBeNull();

    // The transport's play button. With the picture closed there is no
    // element for it to reach, so its ordinary route was a dead press on a
    // track the bar was still showing.
    act(() => {
      latestPlayer?.toggle();
    });
    expect(latestPlayer?.videoTrackId).toBe(videoTrack.id);
    expect(latestPlayer?.isPlaying).toBe(true);
    expect(document.querySelector('video')).not.toBeNull();
  });
});

describe('a root removed while its track is playing (blocker 2)', () => {
  it('pauses the hidden audio element and hides the bar even though trackId never changes', async () => {
    await renderHarness();
    await playTracks([audioTrack.id], audioTrack.id);
    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    // Clears the calls the loader effect above already made on its own
    // unconditional `audio.pause()` at the top of every track change, so
    // the assertion below can only pass if the new, separate effect is what
    // paused it a second time.
    mediaPause.mockClear();

    // `library-root-remove` deletes every track under the removed root and
    // broadcasts the same `library-changed` summary a rescan does; the player
    // asks for its songs again and the store answers that it has none by
    // that id. The queue itself is untouched -- `trackId` still names
    // `audioTrack.id` -- only what that id resolves to has changed, which is
    // exactly the case the `[trackId]`-keyed loader effect cannot see.
    act(() => {
      store.removeRoot(mediaRoot.id);
    });
    await store.settle();

    // The queue's own `trackIds` never moved -- confirms this really is the
    // "trackId unchanged, track gone" case and not an incidental skip.
    expect(latestPlayer?.queue?.trackIds).toEqual([audioTrack.id]);
    expect(latestPlayer?.track).toBeUndefined();
    expect(mediaPause).toHaveBeenCalled();
    await act(async () => Promise.resolve());
  });
});

/**
 * A song the library has not answered for yet is not a song that is gone.
 *
 * The queue moves the moment something is pressed; the songs it names are
 * read from the store a moment later. Taking "not read yet" for "removed"
 * stopped the player on every start, and loading a song nothing is known
 * about yet silenced the deck and never loaded it once the answer landed.
 */
describe('a song the library has not read yet', () => {
  it('keeps the song that is playing until the library has read the next one', async () => {
    const { decks, release } = captureDecks();
    try {
      await renderHarness();
      await playTracks([audioTrack.id], audioTrack.id);
      act(() => {
        store.setTracks([videoTrack, audioTrack, secondAudioTrack]);
      });
      await store.settle();
      mediaPause.mockClear();

      // A new queue, so its song was never read along with the old one.
      act(() => {
        latestPlayer?.playTracks([secondAudioTrack.id], secondAudioTrack.id);
      });
      expect(latestPlayer?.queue?.trackIds).toEqual([secondAudioTrack.id]);
      expect(latestPlayer?.track?.id).toBe(audioTrack.id);
      expect(mediaPause).not.toHaveBeenCalled();
      expect(decks.some((deck) => deck.src.includes(audioTrack.id))).toBe(true);

      // The control: once the library answers, the pressed song is the one
      // loaded — which pauses the deck first, the pause that would have been
      // seen above had the deck changed songs — and the one that starts.
      await store.settle();
      expect(latestPlayer?.track?.id).toBe(secondAudioTrack.id);
      expect(mediaPause).toHaveBeenCalled();
      const incoming = decks.find((deck) =>
        deck.src.includes(secondAudioTrack.id),
      );
      expect(incoming).toBeDefined();
      mediaPlay.mockClear();
      await announceMetadata(decks);
      expect(mediaPlay.mock.instances).toEqual([incoming]);
    } finally {
      release();
    }
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
    await renderHarness();
    await playTracks([audioTrack.id], audioTrack.id);
    expect(latestPlayer?.track?.id).toBe(audioTrack.id);

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
    resetDspDiagnosticsForTests();
    const warning = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
    const { decks: createdAudio, release: releaseDecks } = captureDecks();
    applyDspSettings({
      ...DSP_DEFAULTS,
      normalizer: { ...DSP_DEFAULTS.normalizer, mode: 'off' },
      crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
    });

    try {
      await renderHarness();
      act(() => {
        store.setTracks([videoTrack, audioTrack, secondAudioTrack]);
      });
      await playTracks([audioTrack.id, secondAudioTrack.id], audioTrack.id);
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
      // A deck holds until its source announces itself, which jsdom never does
      // on its own. A real element fires this before it can render a sample.
      await act(async () => {
        incoming.dispatchEvent(new Event('loadedmetadata'));
        await Promise.resolve();
      });
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
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledWith('[dsp:renderer] code=2001', {
        durationMs: 2000,
        curve: 'equalPower',
      });
    } finally {
      warning.mockRestore();
      releaseDecks();
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
    const { decks: createdAudio, release: releaseDecks } = captureDecks();
    applyDspSettings({
      ...DSP_DEFAULTS,
      normalizer: { ...DSP_DEFAULTS.normalizer, mode: 'off' },
      crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
    });

    try {
      await renderHarness();
      act(() => {
        store.setTracks([videoTrack, audioTrack, secondAudioTrack]);
      });
      await playTracks([audioTrack.id, secondAudioTrack.id], audioTrack.id);
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
      releaseDecks();
    }
  });
  it('keeps the outgoing track-level gain until the overlap is finished', async () => {
    resetDspDiagnosticsForTests();
    const warning = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
    jest.useFakeTimers();
    const { decks: createdAudio, release: releaseDecks } = captureDecks();
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
      await renderHarness();
      act(() => {
        store.setTracks([first, next]);
      });
      await playTracks([first.id, next.id], first.id);
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
      await announceMetadata(createdAudio);

      expect(latestPlayer?.track?.id).toBe(next.id);
      expect(readDspInputAnalysis().trackId).toBe(first.id);

      act(() => {
        jest.advanceTimersByTime(301);
      });
      expect(readDspInputAnalysis().trackId).toBe(next.id);
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledWith('[dsp:renderer] code=2001', {
        durationMs: 250,
        curve: 'equalPower',
      });
    } finally {
      warning.mockRestore();
      releaseDecks();
      jest.useRealTimers();
    }
  });
});

describe('Previous button behavior', () => {
  it('restarts after ten seconds, then changes to the previous song', async () => {
    await renderHarness();
    await playTracks([videoTrack.id, audioTrack.id], audioTrack.id);
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

  /**
   * NEXT IS NOT PREVIOUS, AND THE FIRST SECOND IS WHERE THAT WENT WRONG.
   *
   * Restarting the track instead of leaving it is Previous's rule, and it is
   * correctly gated on `direction === -1`. What was not gated was settling the
   * crossfade: only Previous did that, and the first second of a track is
   * exactly when a fade from the change before is still running.
   *
   * So Next pressed early advanced the queue while an overlap still owned both
   * decks, and the handoff completed against a queue that had already moved —
   * heard as the track starting over rather than the next one playing.
   *
   * Pressed twice in a row with no time in between, Next must land two tracks
   * on, never back on the one it started from.
   */
  /**
   * WHAT THIS PINS, AND WHAT IT DOES NOT.
   *
   * It pins the asymmetry: at position zero, Previous restarts and Next
   * advances. That is the rule the report was about — "next on the first second
   * makes the sound start; that feature is only for prev".
   *
   * It does NOT reproduce the mechanism. The fix is that Next now settles an
   * in-flight crossfade before advancing, and this harness has no live overlap
   * to settle, so it would pass without that change. The collision needs two
   * real decks mid-fade and is a listening test, not a jsdom one. Said plainly
   * here rather than left for someone to assume this covers it.
   */
  it('advances on an early Next where Previous would restart', async () => {
    await renderHarness();
    await playTracks([videoTrack.id, audioTrack.id], videoTrack.id);
    expect(latestPlayer?.track?.id).toBe(videoTrack.id);

    // Position zero, which is where Previous's restart rule lives. Next has no
    // business honouring it.
    act(() => {
      latestPlayer?.skip(1);
    });
    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    expect(latestPlayer?.track?.id).not.toBe(videoTrack.id);
    await act(async () => Promise.resolve());
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
    await renderHarness();
    await playTracks([videoTrack.id], videoTrack.id);
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
    await renderHarness();
    await playTracks([videoTrack.id], videoTrack.id);
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

  // Each case mounts with its decks held, and every deck announces what it
  // holds before anything is asserted: a deck that never heard from its file
  // never plays either, so without that the three cases below would agree
  // for a reason none of them is about.
  let decks: HTMLAudioElement[] = [];
  let releaseDecks: () => void = () => undefined;
  beforeEach(() => {
    ({ decks, release: releaseDecks } = captureDecks());
  });
  afterEach(() => {
    releaseDecks();
  });

  it('cues the last track without playing it', async () => {
    seedMemory(90_000);
    await renderHarness();
    await announceMetadata(decks);

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
    await renderHarness();
    await announceMetadata(decks);

    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    expect(mediaPlay).not.toHaveBeenCalled();
  });

  /**
   * POSITIVE CONTROL. Without it, both assertions above would pass just as
   * well if nothing in this harness could ever reach `play()`.
   *
   * Through the loader, from nothing cued. It used to pass through a leak
   * instead: the case before it wrote its queue back to storage as it
   * unmounted, this one restored that queue cued, and the press then took
   * the "already cued" shortcut straight to `play()`.
   */
  it('POSITIVE CONTROL: a track the user picks does play', async () => {
    await renderHarness();
    expect(latestPlayer?.queue).toBeUndefined();
    await playTracks([audioTrack.id], audioTrack.id);
    await announceMetadata(decks);

    expect(mediaPlay).toHaveBeenCalled();
  });
});
