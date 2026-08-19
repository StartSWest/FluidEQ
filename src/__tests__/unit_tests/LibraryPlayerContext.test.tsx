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

let latestPlayer: ILibraryPlayerContextValue | undefined;

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
});

beforeEach(() => {
  latestPlayer = undefined;
  mediaPlay.mockClear();
  mediaPause.mockClear();
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
      onLibraryIndexChanged: () => () => undefined,
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
