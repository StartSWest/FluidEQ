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

/**
 * The window's Library player over the core's real one (`main/
 * libraryPlayer/`), with no native host — every song plays on the window's
 * element, which is what a machine without the host does and what videos
 * always do. The element cases the window's player was held to before the
 * player moved are held here, now driven by the core.
 */
import '@testing-library/jest-dom';
import { act, cleanup, render } from '@testing-library/react';
import log from 'electron-log/renderer';
import { resetDspDiagnosticsForTests } from '../../renderer/dsp/diagnostics';
import type { ILibraryRoot, ILibraryTrack } from '../../common/library/types';
import type { IPlaybackMemory } from '../../common/library/playbackMemory';
import { DSP_DEFAULTS } from '../../common/dsp/chain';
import { applyDspSettings } from '../../renderer/dsp/store';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import {
  ILibraryPlayerContextValue,
  LibraryPlayerProvider,
  useLibraryPlayer,
} from '../../renderer/library/player/LibraryPlayerContext';
import LibraryVideoStage from '../../renderer/library/player/LibraryVideoStage';
import {
  claimPlayback,
  registerPlayer,
  resetPlaybackOwner,
} from '../../renderer/audio/playbackOwner';
import { I18nProvider } from '../../renderer/utils/I18nContext';
import createFakeLibraryStore, {
  IFakeLibraryStore,
} from '../utils/fakeLibraryStore';
import {
  createCorePlayerBridge,
  type ICorePlayerBridge,
} from '../utils/corePlayerBridge';

// The engine's copy of the rack goes nowhere here, as on an Equalizer APO
// machine. None of these cases is about that send.
jest.mock('renderer/utils/audioEngineApi', () => ({
  ...jest.requireActual('renderer/utils/audioEngineApi'),
  setSystemDspChain: jest.fn(() => Promise.resolve('not-fluid')),
}));

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

// jsdom's `play` returns `undefined` rather than a Promise and never moves
// `.paused`, so these record what is asked of the elements instead.
const mediaPlay = jest.fn().mockResolvedValue(undefined);
const mediaPause = jest.fn();
/** Every `currentTime` assignment any media element receives, in order. */
const currentTimeSets: number[] = [];

let latestPlayer: ILibraryPlayerContextValue | undefined;
let store: IFakeLibraryStore;
let tracks: ILibraryTrack[];
let core: ICorePlayerBridge;

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

/** The core behind the window, reading the same songs the window's store has. */
const install = (memory?: IPlaybackMemory) => {
  store = createFakeLibraryStore([mediaRoot], tracks);
  core = createCorePlayerBridge({
    tracks: () => tracks,
    ...(memory ? { memory } : {}),
  });
  window.electron = {
    ipcRenderer: {
      ...store.bridge,
      ...core.bridge,
      libraryTrackBytes: () => Promise.resolve(undefined),
      libraryTrackSignature: () => Promise.resolve(undefined),
      setLibraryTrackNormalization: () => Promise.resolve(false),
    },
  } as unknown as typeof window.electron;
};

beforeEach(() => {
  latestPlayer = undefined;
  mediaPlay.mockClear();
  mediaPause.mockClear();
  currentTimeSets.length = 0;
  resetPlaybackOwner();
  window.localStorage.clear();
  tracks = [videoTrack, audioTrack];
  install();
});

afterEach(async () => {
  await act(async () => {
    cleanup();
    applyDspSettings(DSP_DEFAULTS);
  });
});

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

const playTracks = async (trackIds: readonly string[], startId: string) => {
  act(() => {
    latestPlayer?.playTracks(trackIds, startId);
  });
  await store.settle();
};

/** Every hidden deck the player builds with `new Audio()`, as it builds them. */
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

/** An element the test can say is playing, which jsdom never says itself. */
const markPlaying = (element: HTMLMediaElement | null) => {
  Object.defineProperty(element, 'paused', {
    configurable: true,
    get: () => false,
  });
};

describe('leaving a video behind', () => {
  it('pauses the video element and clears its src the instant the queue moves off it', async () => {
    await renderHarness();
    await playTracks([videoTrack.id, audioTrack.id], videoTrack.id);

    const videoElement = document.querySelector('video');
    expect(videoElement).not.toBeNull();
    expect(videoElement).toHaveAttribute('src');
    // An own-property override on this one instance, so a call is this
    // element's and not the hidden audio deck's.
    const videoPause = jest.fn();
    Object.defineProperty(videoElement, 'pause', {
      configurable: true,
      value: videoPause,
    });

    act(() => {
      latestPlayer?.skip(1);
    });

    expect(videoPause).toHaveBeenCalled();
    expect(videoElement).not.toHaveAttribute('src');
    expect(document.querySelector('video')).toBeNull();
    await act(async () => Promise.resolve());
  });
});

describe('the shared Stop contract', () => {
  it('pauses and rewinds a video without discarding its loaded queue', async () => {
    await renderHarness();
    await playTracks([videoTrack.id], videoTrack.id);
    expect(document.querySelector('video')).not.toBeNull();

    // Next on the last song holds it.
    act(() => {
      latestPlayer?.skip(1);
    });
    expect(latestPlayer?.videoTrackId).toBe(videoTrack.id);

    const videoElement = document.querySelector('video');
    markPlaying(videoElement);
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

    expect(videoPause).toHaveBeenCalled();
    expect(currentTimeSets[currentTimeSets.length - 1]).toBe(0);
    expect(latestPlayer?.isPlaying).toBe(false);
    expect(latestPlayer?.videoTrackId).toBe(videoTrack.id);
    expect(latestPlayer?.track?.id).toBe(videoTrack.id);
    expect(latestPlayer?.queue).toBeDefined();
    expect(document.querySelector('video')).toBe(videoElement);
  });
});

describe('the Back button over a video', () => {
  it('closes the picture, pauses in place and remembers where it was', async () => {
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
    expect(currentTimeSets).not.toContain(0);
    expect(latestPlayer?.track?.id).toBe(videoTrack.id);
    expect(latestPlayer?.queue?.trackIds).toEqual([
      videoTrack.id,
      audioTrack.id,
    ]);
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

    act(() => {
      latestPlayer?.toggle();
    });
    expect(latestPlayer?.videoTrackId).toBe(videoTrack.id);
    expect(latestPlayer?.isPlaying).toBe(true);
    expect(document.querySelector('video')).not.toBeNull();
  });
});

describe('a root removed while its track is playing', () => {
  it('empties the hidden audio element and hides the bar', async () => {
    const { decks, release } = captureDecks();
    try {
      await renderHarness();
      await playTracks([audioTrack.id], audioTrack.id);
      expect(latestPlayer?.track?.id).toBe(audioTrack.id);
      expect(decks.some((deck) => deck.getAttribute('src') !== null)).toBe(
        true,
      );

      // Main deletes the root's songs and tells the core; the queue itself
      // still names the song, which no longer resolves.
      act(() => {
        tracks = [videoTrack];
        store.removeRoot(mediaRoot.id);
        core.player.tracksChanged(undefined);
      });
      await store.settle();

      expect(latestPlayer?.queue?.trackIds).toEqual([audioTrack.id]);
      expect(latestPlayer?.track).toBeUndefined();
      expect(latestPlayer?.isPlaying).toBe(false);
      expect(decks.every((deck) => deck.getAttribute('src') === null)).toBe(
        true,
      );
    } finally {
      release();
    }
  });
});

describe('loading a track', () => {
  it('never assigns a position on the same tick as the source', async () => {
    // An element given a position while still at `HAVE_NOTHING` keeps its
    // seekable range empty for the whole load and refuses every seek after
    // it. jsdom cannot show that, so the cause is what is asserted: no
    // `currentTime` at all while the song loads.
    const { decks, release } = captureDecks();
    try {
      await renderHarness();
      await playTracks([audioTrack.id], audioTrack.id);
      expect(latestPlayer?.track?.id).toBe(audioTrack.id);
      expect(decks.some((deck) => deck.getAttribute('src') !== null)).toBe(
        true,
      );
      expect(currentTimeSets).toEqual([]);

      // The control: the recorder sees the property a seek uses.
      act(() => {
        latestPlayer?.seek(101_700);
      });
      expect(currentTimeSets).toEqual([101.7]);
    } finally {
      release();
    }
  });
});

describe('crossfade on the window’s element', () => {
  const fading = () =>
    applyDspSettings({
      ...DSP_DEFAULTS,
      enabled: true,
      normalizer: { ...DSP_DEFAULTS.normalizer, mode: 'off' },
      crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
    });

  it('keeps navigation on the working deck until the incoming song is playing', async () => {
    resetDspDiagnosticsForTests();
    const warning = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
    const { decks: createdAudio, release: releaseDecks } = captureDecks();
    tracks = [videoTrack, audioTrack, secondAudioTrack];
    install();
    fading();

    try {
      await renderHarness();
      await playTracks([audioTrack.id, secondAudioTrack.id], audioTrack.id);
      await announceMetadata(createdAudio);

      const [outgoing, incoming] = createdAudio;
      expect(outgoing).toBeDefined();
      expect(incoming).toBeDefined();
      markPlaying(outgoing);
      const outgoingPause = jest.fn();
      Object.defineProperty(outgoing, 'pause', {
        configurable: true,
        value: outgoingPause,
      });
      window.electron.ipcRenderer.libraryTrackBytes = jest
        .fn<Promise<ArrayBuffer | undefined>, [string]>()
        .mockResolvedValue(new ArrayBuffer(8));
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
      await act(async () => {
        incoming.dispatchEvent(new Event('loadedmetadata'));
        await Promise.resolve();
      });
      expect(mediaPlay.mock.instances).toContain(incoming);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      // The file's bytes do not replace a source whose first play is still
      // pending: Chromium rejects it, and Next left the old song playing.
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
      expect(warning).toHaveBeenCalledWith('[dsp:renderer] code=2001', {
        durationMs: DSP_DEFAULTS.crossfade.durationMs,
        curve: DSP_DEFAULTS.crossfade.curve,
      });
    } finally {
      warning.mockRestore();
      releaseDecks();
    }
  });

  it('does not let the outgoing deck drive the seek bar once the track changed', async () => {
    const { decks: createdAudio, release: releaseDecks } = captureDecks();
    tracks = [videoTrack, audioTrack, secondAudioTrack];
    install();
    fading();

    try {
      await renderHarness();
      await playTracks([audioTrack.id, secondAudioTrack.id], audioTrack.id);
      await announceMetadata(createdAudio);

      const outgoing = createdAudio[0];
      expect(outgoing).toBeDefined();
      markPlaying(outgoing);
      let outgoingTime = 0;
      Object.defineProperty(outgoing, 'currentTime', {
        configurable: true,
        get: () => outgoingTime,
        set: (value: number) => {
          outgoingTime = value;
        },
      });

      // The control: while it IS the current song, its ticks are heard.
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

      // Still ticking, a hundred and twenty seconds into a song nobody shows.
      outgoingTime = 120;
      act(() => {
        outgoing.dispatchEvent(new Event('timeupdate'));
      });
      expect(latestPlayer?.positionMs).toBe(0);
    } finally {
      releaseDecks();
    }
  });
});

describe('Previous', () => {
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

  it('is not what an early Next does: Next advances', async () => {
    await renderHarness();
    await playTracks([videoTrack.id, audioTrack.id], videoTrack.id);
    act(() => {
      latestPlayer?.skip(1);
    });
    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    await act(async () => Promise.resolve());
  });
});

describe('the length of the playing track', () => {
  it('is learned once and never unlearned', async () => {
    // Chromium reports `Infinity` on some `durationchange`s mid-playback;
    // written through as nought it collapsed the seek bar mid-song.
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

    setDuration(Number.POSITIVE_INFINITY);
    act(() => {
      element?.dispatchEvent(new Event('durationchange'));
    });
    expect(latestPlayer?.durationMs).toBeCloseTo(212_500);

    // The control: a real, different length still gets through.
    setDuration(180);
    act(() => {
      element?.dispatchEvent(new Event('durationchange'));
    });
    expect(latestPlayer?.durationMs).toBeCloseTo(180_000);
  });
});

describe('a track whose file will not load', () => {
  it('says it cannot be played, and stops', async () => {
    await renderHarness();
    await playTracks([videoTrack.id], videoTrack.id);
    expect(latestPlayer?.isUnplayable).toBe(false);
    const videoElement = document.querySelector('video');
    act(() => {
      videoElement?.dispatchEvent(new Event('error'));
    });
    expect(latestPlayer?.isUnplayable).toBe(true);
    expect(latestPlayer?.isPlaying).toBe(false);
  });
});

describe('restoring the last session', () => {
  const memoryAt = (positionMs: number): IPlaybackMemory => ({
    trackIds: [audioTrack.id],
    order: [0],
    position: 0,
    repeat: 'off',
    isShuffled: false,
    positionMs,
  });

  let decks: HTMLAudioElement[] = [];
  let releaseDecks: () => void = () => undefined;
  beforeEach(() => {
    ({ decks, release: releaseDecks } = captureDecks());
  });
  afterEach(() => {
    releaseDecks();
  });

  it('cues the last track where it was without playing it', async () => {
    install(memoryAt(90_000));
    await renderHarness();
    await announceMetadata(decks);
    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    expect(mediaPlay).not.toHaveBeenCalled();
    expect(currentTimeSets).toContain(90);
  });

  it('still refuses to play when the position was too early to restore', async () => {
    install(memoryAt(2_000));
    await renderHarness();
    await announceMetadata(decks);
    expect(latestPlayer?.track?.id).toBe(audioTrack.id);
    expect(mediaPlay).not.toHaveBeenCalled();
  });

  it('POSITIVE CONTROL: a track the user picks does play', async () => {
    await renderHarness();
    expect(latestPlayer?.queue).toBeUndefined();
    await playTracks([audioTrack.id], audioTrack.id);
    await announceMetadata(decks);
    expect(mediaPlay).toHaveBeenCalled();
  });
});

describe('the window’s part beside the core', () => {
  it('hands its old copy of the session to the core once, and forgets it', async () => {
    window.localStorage.setItem(
      'fluideq.library.playback',
      '{"trackIds":["a1"]}',
    );
    window.localStorage.setItem('fluideq.library.keepPlaying', 'off');
    await renderHarness();
    const legacy = core.sent.filter(
      ({ channel }) => channel === 'library-player-legacy',
    );
    expect(legacy).toHaveLength(1);
    expect(legacy[0]?.args[0]).toEqual({
      memory: { trackIds: ['a1'] },
      keepPlaying: 'off',
    });
    expect(window.localStorage.getItem('fluideq.library.playback')).toBeNull();
    expect(
      window.localStorage.getItem('fluideq.library.keepPlaying'),
    ).toBeNull();
  });

  it('hands the rack over, and says when the player is put away', async () => {
    const view = await renderHarness();
    expect(
      core.sent.some(({ channel }) => channel === 'library-player-rack'),
    ).toBe(true);
    view.unmount();
    expect(core.sent[core.sent.length - 1]?.channel).toBe(
      'library-player-away',
    );
  });

  it('stops the other players when the Library starts, and pauses in the core when one starts', async () => {
    const stopMedia = jest.fn();
    registerPlayer('media', stopMedia);
    await renderHarness();
    await playTracks([audioTrack.id], audioTrack.id);
    expect(stopMedia).toHaveBeenCalled();
    act(() => {
      claimPlayback('media');
    });
    expect(latestPlayer?.isPlaying).toBe(false);
  });
});
