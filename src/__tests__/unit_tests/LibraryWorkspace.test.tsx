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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ILibraryIndex,
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../common/library/types';
import LibraryWorkspace from '../../renderer/library/LibraryWorkspace';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import { LibraryPlayerProvider } from '../../renderer/library/player/LibraryPlayerContext';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const track = (over: Partial<ILibraryTrack>): ILibraryTrack => ({
  id: over.title ?? 'id',
  rootId: 'r1',
  path: 'C:\\Music\\a.mp3',
  kind: 'audio',
  isPlayable: true,
  title: 'Untitled',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

// jsdom's own `HTMLMediaElement.prototype.play` returns `undefined` rather
// than the Promise every real engine (including Electron's Chromium) hands
// back — `KaraokeWorkspace.test.tsx` stubs the same three methods for the
// same reason. Needed here only once a test actually reaches
// `LibraryPlayerContext`/`LibraryVideoStage`'s real `element.play().catch(...)`
// calls, which nothing in this file did before Task 19 wired `playTracks` in.
const mediaPlay = jest.fn().mockResolvedValue(undefined);
const mediaPause = jest.fn();

const addLibraryRoot = jest.fn(() =>
  Promise.resolve({ version: 1, roots: [], tracks: [] }),
);
const cancelLibraryScan = jest.fn();

// Captured so a test can simulate a live scan by calling it directly, the
// way `onLibraryIndexChanged` already is not exercised because nothing here
// needs to.
let progressListener: ((progress: ILibraryScanProgress) => void) | undefined;
// Captured the same way, for the one test that simulates the index changing
// out from under an open drill-in.
let indexListener: ((index: ILibraryIndex) => void) | undefined;
// Reassigned by a test before calling `renderWorkspace()`, read by the
// `getLibraryIndex` mock at render time — the empty-library shape every
// other test in this file still gets by not touching it.
let initialIndex: ILibraryIndex = { version: 1, roots: [], tracks: [] };

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
  addLibraryRoot.mockClear();
  cancelLibraryScan.mockClear();
  mediaPlay.mockClear();
  mediaPause.mockClear();
  progressListener = undefined;
  indexListener = undefined;
  initialIndex = { version: 1, roots: [], tracks: [] };
  // Each persisted-mode test below writes to this directly; jsdom's
  // localStorage otherwise survives across `it` blocks in the same file,
  // which would leak one test's stored mode into the next one's "nothing
  // was ever stored" assumption.
  window.localStorage.clear();
  window.electron = {
    ipcRenderer: {
      getLibraryIndex: () =>
        Promise.resolve({
          index: initialIndex,
          wasReset: false,
        }),
      addLibraryRoot,
      cancelLibraryScan,
      onLibraryScanProgress: (
        callback: (progress: ILibraryScanProgress) => void,
      ) => {
        progressListener = callback;
        return () => {
          progressListener = undefined;
        };
      },
      onLibraryTracksAdded: () => () => {},
      onLibraryIndexChanged: (callback: (index: ILibraryIndex) => void) => {
        indexListener = callback;
        return () => {
          indexListener = undefined;
        };
      },
      // `LibraryVideoStage` (Task 19) listens for 'window-state-changed' the
      // moment a video track opens the stage — same shape App.test.tsx's own
      // mock already uses for the same preload method.
      on: (_channel: string, _func: (...args: unknown[]) => void) => () => {},
    },
  } as unknown as typeof window.electron;
});

const renderWorkspace = () =>
  render(
    <I18nProvider>
      <LibraryProvider>
        {/* `LibraryWorkspace` now calls `useLibraryPlayer` itself (Task 19) to
            hand every view's click a real `playTracks` — nested inside
            `LibraryProvider` the same way `App.tsx` nests the two, since
            `LibraryPlayerProvider` resolves a track id against the index
            `LibraryProvider` holds. */}
        <LibraryPlayerProvider>
          <LibraryWorkspace isHidden={false} />
        </LibraryPlayerProvider>
      </LibraryProvider>
    </I18nProvider>,
  );

describe('the library with nothing in it', () => {
  it('offers the one action that fixes an empty library', async () => {
    renderWorkspace();
    expect(await screen.findByText('No music yet')).toBeInTheDocument();
    // With no roots yet the toolbar row does not render at all, so the
    // empty state's own button is the only "Add folder" on screen -- see
    // `LibraryWorkspace.tsx`'s `index.roots.length > 0` gate.
    const add = screen.getByRole('button', { name: 'Add folder' });
    await userEvent.click(add);
    expect(addLibraryRoot).toHaveBeenCalled();
  });

  it('gives the suggested action the loud style and nothing else', async () => {
    renderWorkspace();
    const add = await screen.findByRole('button', { name: 'Add folder' });
    expect(add.className).toContain('button');
    expect(add.className).not.toContain('subtle');
  });
});

describe('a scan in progress', () => {
  it('lets Stop reach the real cancel channel', async () => {
    // The class of defect this project's rules are written about: a Stop
    // button that looks like it works but never reaches the scan it is
    // supposed to interrupt. `LibraryToolbar.test.tsx` only proves
    // `LibraryScanProgress` calls whatever `onCancel` prop it was given --
    // this proves `LibraryWorkspace` wires that prop all the way through
    // `useLibrary().cancelScan` to the actual IPC channel.
    renderWorkspace();
    await screen.findByText('No music yet');
    act(() => {
      progressListener?.({
        rootId: 'r1',
        seen: 3,
        parsed: 1,
        karaokeSkipped: 0,
        current: 'a.mp3',
        isDone: false,
      });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(cancelLibraryScan).toHaveBeenCalled();
  });
});

describe('a drill-in whose album disappears underneath it', () => {
  it('closes on its own and returns to the grid, rather than sitting on a blank screen', async () => {
    // Default browse mode is 'album', default view mode is 'grid' (both
    // `LibraryWorkspace`'s own fallbacks), so nothing here needs to click
    // through the toolbar first.
    initialIndex = {
      version: 1,
      roots: [
        {
          id: 'r1',
          path: 'C:\\Music',
          addedAt: 1,
          trackCount: 1,
          karaokeSkipped: 0,
        },
      ],
      tracks: [track({ title: 'Blue', album: 'Kind', artist: 'Miles' })],
    };
    renderWorkspace();

    await userEvent.click(await screen.findByText('Kind'));
    // The drill-in is open — its one filled button is on screen.
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();

    // The folder is removed mid-view: the same `onLibraryIndexChanged` push
    // `LibraryContext` already subscribes to, now carrying an index with no
    // trace of the album that was open.
    act(() => {
      indexListener?.({
        version: 1,
        roots: [],
        tracks: [track({ title: 'Other', album: 'Bitches', artist: 'Miles' })],
      });
    });

    // Not stuck on "Unknown album" with a dead Play button — back on the
    // grid, which is not empty either: the surviving album's tile is shown.
    expect(
      screen.queryByRole('button', { name: 'Play' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText('Bitches')).toBeInTheDocument();
  });
});

describe('a browse mode remembered from last time', () => {
  it('honours a stored "video" mode instead of falling back to the default', async () => {
    // The exact hazard widening `TLibraryBrowseMode` created: a value that
    // is not in `LibraryWorkspace`'s own `BROWSE_MODES` list is rejected by
    // `readPersistedMode` and silently replaced with the 'album' fallback.
    // If a future refactor ever drops 'video' from that list again, this is
    // the test that has to catch it.
    window.localStorage.setItem('fluideq.library.browseMode', 'video');
    initialIndex = {
      version: 1,
      roots: [
        {
          id: 'r1',
          path: 'C:\\Music',
          addedAt: 1,
          trackCount: 1,
          karaokeSkipped: 0,
        },
      ],
      tracks: [track({ title: 'Blue', album: 'Kind', artist: 'Miles' })],
    };
    renderWorkspace();

    // No video tracks in this index, so the video shelf's own empty message
    // is what proves the stored mode actually took effect -- an 'album'
    // fallback would show the grid instead, with "Kind" as a tile.
    expect(
      await screen.findByText('No videos in the folders you have added.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Kind')).not.toBeInTheDocument();
  });

  // No persisted mode had regression coverage before this task touched the
  // mechanism, not just browse mode -- cheap to close all three gaps in one
  // pass rather than leave the other two exactly as uncovered as browse mode
  // was.
  it('honours a stored view mode and sort too', async () => {
    window.localStorage.setItem('fluideq.library.browseMode', 'song');
    window.localStorage.setItem('fluideq.library.viewMode', 'list');
    window.localStorage.setItem('fluideq.library.sort', 'year');
    initialIndex = {
      version: 1,
      roots: [
        {
          id: 'r1',
          path: 'C:\\Music',
          addedAt: 1,
          trackCount: 2,
          karaokeSkipped: 0,
        },
      ],
      tracks: [
        track({ title: 'Newer', year: 2020 }),
        track({ title: 'Older', year: 1980 }),
      ],
    };
    renderWorkspace();

    // 'list', not the default 'grid' -- only `LibraryListView` draws a
    // `role="table"`.
    expect(await screen.findByRole('table')).toBeInTheDocument();
    // 'year' ascending, not the default 'title' -- Older (1980) sorts ahead
    // of Newer (2020), so it is the first of the two title matches in
    // document order.
    const titles = screen.getAllByText(/^(Older|Newer)$/);
    expect(titles.map((title) => title.textContent)).toEqual([
      'Older',
      'Newer',
    ]);
  });
});

describe('handing a click off to the player (Task 19)', () => {
  it('loads a clicked video track into the stage, replacing the shelf it was clicked from', async () => {
    window.localStorage.setItem('fluideq.library.browseMode', 'video');
    initialIndex = {
      version: 1,
      roots: [
        {
          id: 'r1',
          path: 'C:\\Videos',
          addedAt: 1,
          trackCount: 1,
          karaokeSkipped: 0,
        },
      ],
      tracks: [
        track({
          id: 'v1',
          title: 'Live at the Roxy',
          kind: 'video',
          path: 'C:\\Videos\\Live\\show.mp4',
        }),
      ],
    };
    renderWorkspace();

    await userEvent.click(await screen.findByText('Live at the Roxy'));

    // The stage's own fullscreen control is the only thing here with this
    // label, so its presence is proof `handlePlayTrack` actually reached
    // `playTracks` rather than staying the inert stub it was before this
    // task.
    expect(
      await screen.findByRole('button', { name: 'Full screen' }),
    ).toBeInTheDocument();
    // Replaced, not layered underneath — see the `!videoTrackId` guard on
    // `LibraryVideoSection` in `LibraryWorkspace`.
    expect(screen.queryByText('Live at the Roxy')).not.toBeInTheDocument();
  });

  it('leaves the shelf in place for a video FluidEQ cannot decode, instead of opening a broken stage', async () => {
    // The exact gap Task 19 closed in `LibraryPlayerContext`: `videoTrackId`
    // used to key on `kind === 'video'` alone, so an unplayable container
    // still opened `LibraryVideoStage` and asked a `<video>` to load a file
    // Chromium has no demuxer for. Gating it on `isPlayable` too keeps the
    // stage closed here, the same as it would for any other unplayable
    // click.
    window.localStorage.setItem('fluideq.library.browseMode', 'video');
    initialIndex = {
      version: 1,
      roots: [
        {
          id: 'r1',
          path: 'C:\\Videos',
          addedAt: 1,
          trackCount: 1,
          karaokeSkipped: 0,
        },
      ],
      tracks: [
        track({
          id: 'v1',
          title: 'Old Camcorder Tape',
          kind: 'video',
          isPlayable: false,
          path: 'C:\\Videos\\Live\\tape.avi',
        }),
      ],
    };
    renderWorkspace();

    await userEvent.click(await screen.findByText('Old Camcorder Tape'));

    expect(
      screen.queryByRole('button', { name: 'Full screen' }),
    ).not.toBeInTheDocument();
    // The shelf is still the thing on screen -- a click on an unplayable
    // track is not a silent no-op, it just does not open a stage that would
    // only ever show a black box.
    expect(screen.getByText('Old Camcorder Tape')).toBeInTheDocument();
  });
});
