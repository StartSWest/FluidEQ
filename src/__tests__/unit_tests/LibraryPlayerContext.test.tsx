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
      onLibraryIndexChanged: (handler: (next: ILibraryIndex) => void) => {
        indexChangedHandler = handler;
        return () => undefined;
      },
      // `LibraryVideoStage` listens for 'window-state-changed' the moment it
      // mounts.
      on: (_channel: string, _func: (...args: unknown[]) => void) => () => {},
    },
  } as unknown as typeof window.electron;
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
