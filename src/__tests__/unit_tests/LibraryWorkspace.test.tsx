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
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ILibraryRoot, ILibraryTrack } from '../../common/library/types';
import LibraryWorkspace from '../../renderer/library/LibraryWorkspace';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import {
  LibraryPlayerProvider,
  useLibraryPlayerSession,
} from '../../renderer/library/player/LibraryPlayerContext';
import { I18nProvider } from '../../renderer/utils/I18nContext';
import {
  type ILibraryStoreBridge,
  installIpcRenderer,
  libraryRoot,
  libraryTrack as track,
  openLibraryStoreBridge,
} from '../utils/libraryStoreBridge';

// jsdom's own `HTMLMediaElement.prototype.play` returns `undefined` rather
// than the Promise every real engine (including Electron's Chromium) hands
// back — `KaraokeWorkspace.test.tsx` stubs the same three methods for the
// same reason. Needed here only once a test actually reaches
// `LibraryPlayerContext`/`LibraryVideoStage`'s real `element.play().catch(...)`
// calls.
const mediaPlay = jest.fn().mockResolvedValue(undefined);
const mediaPause = jest.fn();
const toggleFullScreen = jest.fn();

const cancelLibraryScan = jest.fn();

let bridge: ILibraryStoreBridge | undefined;

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
  cancelLibraryScan.mockClear();
  mediaPlay.mockClear();
  mediaPause.mockClear();
  toggleFullScreen.mockClear();
  // Each persisted-mode test below writes to this directly; jsdom's
  // localStorage otherwise survives across `it` blocks in the same file,
  // which would leak one test's stored mode into the next one's "nothing
  // was ever stored" assumption.
  window.localStorage.clear();
});

afterEach(() => {
  // Unmounted before the store closes, so nothing asks a closed store.
  cleanup();
  bridge?.close();
  bridge = undefined;
});

/** What the player is holding, for a test to wait on the click reaching it. */
const PlayerProbe = () => {
  const { track: held, isUnplayable } = useLibraryPlayerSession();
  return (
    <output aria-label="Player">
      {held?.id ?? ''}
      {isUnplayable ? ' unplayable' : ''}
    </output>
  );
};

/**
 * The Library tab over a store holding `roots` and `tracks` — main's own
 * store and questions, so every shelf on screen is what the app would draw.
 */
const renderWorkspace = ({
  roots = [],
  tracks = [],
}: {
  roots?: ILibraryRoot[];
  tracks?: ILibraryTrack[];
} = {}) => {
  const opened = openLibraryStoreBridge({ roots, tracks });
  bridge = opened;
  const addLibraryRoot = jest.fn(() => Promise.resolve(opened.summary()));
  installIpcRenderer({
    ...opened.channels,
    addLibraryRoot,
    cancelLibraryScan,
    // `LibraryVideoStage` listens for 'window-state-changed' the moment a
    // video track opens the stage; nothing here changes the window state.
    on: jest.fn(() => jest.fn()),
  });
  render(
    <I18nProvider>
      <LibraryProvider>
        {/* Nested inside `LibraryProvider` the same way `App.tsx` nests the
            two: the player reads the songs it holds from the library. */}
        <LibraryPlayerProvider>
          <LibraryWorkspace
            isHidden={false}
            isFullScreen={false}
            onToggleFullScreen={toggleFullScreen}
          />
          <PlayerProbe />
        </LibraryPlayerProvider>
      </LibraryProvider>
    </I18nProvider>,
  );
  return { library: opened, addLibraryRoot };
};

const MUSIC = libraryRoot('r1', 'C:\\Music');

describe('the library with nothing in it', () => {
  it('offers the one action that fixes an empty library', async () => {
    const { addLibraryRoot } = renderWorkspace();
    expect(await screen.findByText('No music yet')).toBeInTheDocument();
    // With no roots yet the toolbar row does not render at all, so the
    // empty state's own button is the only "Add folder" on screen -- see
    // `LibraryWorkspace.tsx`'s `roots.length > 0` gate.
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
    const { library } = renderWorkspace();
    await screen.findByText('No music yet');
    act(() => {
      library.sendProgress({
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
    // The grid, chosen: a fresh install opens on Cover Flow, which draws its
    // drill-in under the row rather than in place of the shelf.
    window.localStorage.setItem('fluideq.library.viewMode', 'grid');
    const { library } = renderWorkspace({
      roots: [MUSIC],
      tracks: [track({ title: 'Blue', album: 'Kind', artist: 'Miles' })],
    });

    await userEvent.click(await screen.findByText('Kind'));
    // The drill-in is open — its one filled button is on screen.
    expect(
      await screen.findByRole('button', { name: 'Play' }),
    ).toBeInTheDocument();

    // The folder is removed mid-view and another one's scan lands: the store
    // changes and main announces it, the push `LibraryContext` subscribes to.
    library.store.removeRoot('r1');
    library.store.addRoots([libraryRoot('r2', 'D:\\More')]);
    library.store.upsertTracks(
      [
        track({
          title: 'Other',
          album: 'Bitches',
          artist: 'Miles',
          rootId: 'r2',
          path: 'D:\\More\\Other.mp3',
        }),
      ],
      0,
    );
    act(() => library.announce());

    // Not stuck on "Unknown album" with a dead Play button — back on the
    // grid, which is not empty either: the surviving album's tile is shown.
    expect(await screen.findByText('Bitches')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Play' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Kind')).not.toBeInTheDocument();
  });
});

describe('the search box, wired to the shelf below it', () => {
  it('narrows the shelf to what was typed', async () => {
    // `LibraryToolbar`'s own test proves the box reports what was typed and
    // where it sits in the bar. This is the other half: that what it reports
    // actually reaches the list.
    renderWorkspace({
      roots: [MUSIC],
      tracks: [
        track({ title: 'Blue', album: 'Kind', artist: 'Miles' }),
        track({ title: 'Red', album: 'Scarlet', artist: 'Otis' }),
      ],
    });

    expect(await screen.findByText('Kind')).toBeInTheDocument();
    expect(screen.getByText('Scarlet')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox'), 'scarlet');

    await waitFor(() =>
      expect(screen.queryByText('Kind')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Scarlet')).toBeInTheDocument();
  });

  it('reaches the whole library from inside a folder, the folder first', async () => {
    // Searching while standing in a folder used to answer from that folder
    // alone, which read as a library with almost nothing in it. Now what
    // matched there comes first under its own heading, and everything else
    // after it under another.
    window.localStorage.setItem('fluideq.library.browseMode', 'song');
    window.localStorage.setItem('fluideq.library.viewMode', 'list');
    window.localStorage.setItem('fluideq.library.openFolder', 'C:/Music/Pop');
    renderWorkspace({
      roots: [MUSIC],
      tracks: [
        track({ title: 'Blue Pop', path: 'C:\\Music\\Pop\\blue.mp3' }),
        track({ title: 'Blue Jazz', path: 'C:\\Music\\Jazz\\blue.mp3' }),
        track({ title: 'Red Pop', path: 'C:\\Music\\Pop\\red.mp3' }),
      ],
    });

    // Standing in the folder, the shelf is the folder's songs alone.
    expect(await screen.findByText('Red Pop')).toBeInTheDocument();
    expect(screen.queryByText('Blue Jazz')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('searchbox'), 'blue');

    expect(await screen.findByText('Blue Jazz')).toBeInTheDocument();
    const order = screen
      .getAllByText(/^(In Pop|Everywhere else|Blue Pop|Blue Jazz|Red Pop)$/)
      .map((element) => element.textContent);
    expect(order).toEqual([
      'In Pop',
      'Blue Pop',
      'Everywhere else',
      'Blue Jazz',
    ]);
  });
});

describe('the folded queue chip', () => {
  it('rides in the toolbar row rather than floating under it', async () => {
    // It used to be absolutely placed in the slot the panel opens into, and
    // two rules elsewhere made room for it: a `padding-right` on the
    // drill-in's path row and a 23px drop on every shelf. In the row it
    // needs neither, and this is the assertion that says so — a chip that
    // slid back out of the cluster would leave the shelf sitting under it
    // again with nothing to catch it.
    renderWorkspace({
      roots: [MUSIC],
      tracks: [track({ title: 'Blue', album: 'Kind', artist: 'Miles' })],
    });

    // By pattern, not by exact name: the chip carries its count inside the
    // button, so its accessible name is the label and the number together.
    //
    // The folded panel is mounted too, so it can fold and open on the move,
    // and its header shares the name — but it is inert, which no reader and
    // no keyboard can reach. The chip is the one that can be.
    const chip = await waitFor(() => {
      const reachable = screen
        .getAllByRole('button', { name: /Up next/ })
        .filter((button) => !button.closest('[inert]'));
      expect(reachable).toHaveLength(1);
      return reachable[0];
    });
    expect(
      screen.getByRole('complementary', { name: 'Up next' }),
    ).toHaveAttribute('inert');
    expect(chip.closest('.library-toolbar__tail')).not.toBeNull();
    // Folded, and the chip is what says so — it is drawn in both states, so
    // opening the queue cannot re-lay the cluster out around it.
    expect(chip.getAttribute('aria-expanded')).toBe('false');
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
    renderWorkspace({
      roots: [MUSIC],
      tracks: [track({ title: 'Blue', album: 'Kind', artist: 'Miles' })],
    });

    // No video tracks in this library, so the video shelf's own empty
    // message is what proves the stored mode actually took effect -- an
    // 'album' fallback would show the albums instead, with "Kind" on one.
    expect(
      await screen.findByText('No videos in the folders you have added.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Kind')).not.toBeInTheDocument();
  });

  // No persisted mode had regression coverage before browse mode's did --
  // cheap to close all three gaps in one pass rather than leave the other
  // two exactly as uncovered as browse mode was.
  it('honours a stored view mode and sort too', async () => {
    window.localStorage.setItem('fluideq.library.browseMode', 'song');
    window.localStorage.setItem('fluideq.library.viewMode', 'list');
    window.localStorage.setItem('fluideq.library.sort', 'year');
    renderWorkspace({
      roots: [MUSIC],
      tracks: [
        track({ title: 'Newer', year: 2020 }),
        track({ title: 'Older', year: 1980 }),
      ],
    });

    // 'list', not the default Cover Flow -- only `LibraryListView` draws a
    // `role="table"`.
    expect(await screen.findByRole('table')).toBeInTheDocument();
    // 'year' ascending, not the default 'title' -- Older (1980) sorts ahead
    // of Newer (2020), so it is the first of the two title matches in
    // document order.
    await screen.findByText('Older');
    const titles = screen.getAllByText(/^(Older|Newer)$/);
    expect(titles.map((title) => title.textContent)).toEqual([
      'Older',
      'Newer',
    ]);
  });
});

describe('handing a click off to the player', () => {
  const VIDEOS = libraryRoot('r1', 'C:\\Videos');

  it('loads a clicked video track into the stage, replacing the shelf it was clicked from', async () => {
    window.localStorage.setItem('fluideq.library.browseMode', 'video');
    renderWorkspace({
      roots: [VIDEOS],
      tracks: [
        track({
          id: 'v1',
          title: 'Live at the Roxy',
          kind: 'video',
          path: 'C:\\Videos\\Live\\show.mp4',
        }),
      ],
    });

    await userEvent.click(await screen.findByText('Live at the Roxy'));

    // The stage's own way back is the only thing here with this label, so its
    // presence is proof the click actually reached `playTracks`. It used to
    // be the full-screen button; that went when full screen became the
    // double-click and Ctrl+F, which every video player already answers to.
    expect(
      await screen.findByRole('button', { name: 'Back' }),
    ).toBeInTheDocument();
    // The SHELF is replaced by the picture — see the `!videoTrackId` guard on
    // `LibraryVideoSection` in `LibraryWorkspace`. The toolbar above it is
    // not: browse, view and search stay reachable while a video plays.
    expect(screen.queryByText('Live at the Roxy')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('leaves the shelf in place for a video FluidEQ cannot decode, instead of opening a broken stage', async () => {
    // `videoTrackId` used to key on `kind === 'video'` alone, so an
    // unplayable container still opened `LibraryVideoStage` and asked a
    // `<video>` to load a file Chromium has no demuxer for. Gating it on
    // `isPlayable` too keeps the stage closed here, the same as it would for
    // any other unplayable click.
    window.localStorage.setItem('fluideq.library.browseMode', 'video');
    renderWorkspace({
      roots: [VIDEOS],
      tracks: [
        track({
          id: 'v1',
          title: 'Old Camcorder Tape',
          kind: 'video',
          isPlayable: false,
          path: 'C:\\Videos\\Live\\tape.avi',
        }),
      ],
    });

    await userEvent.click(await screen.findByText('Old Camcorder Tape'));

    // The click reached the player, which took the song and called it
    // unplayable — so the absence below is the stage staying closed, not
    // the stage not having been asked yet.
    await waitFor(() =>
      expect(screen.getByLabelText('Player')).toHaveTextContent(
        'v1 unplayable',
      ),
    );
    expect(
      screen.queryByRole('button', { name: 'Back' }),
    ).not.toBeInTheDocument();
    // The shelf is still the thing on screen -- a click on an unplayable
    // track is not a silent no-op, it just does not open a stage that would
    // only ever show a black box.
    expect(screen.getByText('Old Camcorder Tape')).toBeInTheDocument();
  });
});
