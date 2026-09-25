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
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ILibraryTrack } from '../../common/library/types';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import LibraryVideoSection, {
  IVideoShelfMetrics,
  videoRowWindowFor,
  videoRunsOf,
  videoShelfOffsets,
  videoShelfRows,
} from '../../renderer/library/LibraryVideoSection';
import { shelfQueryFor } from '../../renderer/library/libraryShelfQuery';
import { I18nProvider } from '../../renderer/utils/I18nContext';
import LibraryListOf from '../utils/LibraryListOf';
import {
  type ILibraryStoreBridge,
  installIpcRenderer,
  libraryRoot,
  libraryTrack,
  openLibraryStoreBridge,
} from '../utils/libraryStoreBridge';

const video = (path: string, title: string): ILibraryTrack =>
  libraryTrack({ title, path, kind: 'video', rootId: 'r' });

/** Round numbers, so an arithmetic slip reads as one rather than as rounding. */
const METRICS: IVideoShelfMetrics = {
  headerHeight: 40,
  tileHeight: 200,
  gap: 10,
  columns: 3,
};

/** One folder of `count` videos: its heading at row 0, the videos after. */
const oneFolderOf = (count: number) => videoRunsOf([0], count + 1);

describe('the video shelf as windowable rows', () => {
  it('finds each folder run from where its heading stands', () => {
    // Headings at rows 0 and 5 of seven: four videos under the first, one
    // under the second, and nothing counted twice or dropped at the end.
    expect(videoRunsOf([0, 5], 7)).toEqual([
      { heading: 0, first: 1, count: 4 },
      { heading: 5, first: 6, count: 1 },
    ]);
  });

  it('puts a heading in front of each folder and splits its videos by column', () => {
    const rows = videoShelfRows(videoRunsOf([0, 5], 7), 3);

    expect(rows.map((row) => row.kind)).toEqual([
      'header',
      'tiles',
      'tiles',
      'header',
      'tiles',
    ]);
    // Four videos across three columns is a full row and a remainder, never a
    // dropped one.
    expect(rows[1].kind === 'tiles' && rows[1].count).toBe(3);
    expect(rows[2].kind === 'tiles' && rows[2].count).toBe(1);
    expect(rows[4].kind === 'tiles' && rows[4].first).toBe(6);
  });

  it('keys a row by its folder, so one folder never reuses another row', () => {
    const rows = videoShelfRows(videoRunsOf([0, 2], 4), 3);

    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    // The first row of tiles in each folder: the same place in its run, and
    // still a key of its own.
    expect(rows[1].key).not.toBe(rows[3].key);
  });

  it('survives a column count of zero rather than looping for ever', () => {
    const rows = videoShelfRows(oneFolderOf(1), 0);

    expect(rows).toHaveLength(2);
  });

  it('measures each row at its own height, headings being shorter than tiles', () => {
    const rows = videoShelfRows(oneFolderOf(1), 3);

    // Heading 40 + gap 10, then tiles 200 + gap 10. One entry longer than the
    // rows, so the end of the last one needs no special case.
    expect(videoShelfOffsets(rows, METRICS)).toEqual([0, 50, 260]);
  });

  it('mounts everything when the whole shelf fits inside the overscan', () => {
    const rows = videoShelfRows(oneFolderOf(3), 3);
    const offsets = videoShelfOffsets(rows, METRICS);

    expect(
      videoRowWindowFor({
        scrollTop: 0,
        paneHeight: 600,
        screenHeight: 1000,
        offsets,
      }),
    ).toEqual({ start: 0, end: rows.length });
  });

  it('drops the rows scrolled far above it', () => {
    // 400 rows of tiles at a pitch of 210.
    const rows = videoShelfRows(oneFolderOf(1_200), 3);
    const offsets = videoShelfOffsets(rows, METRICS);

    const shown = videoRowWindowFor({
      scrollTop: 40_000,
      paneHeight: 600,
      screenHeight: 1_000,
      offsets,
    });

    // Three viewports of overscan above 40,000px is 1,800px, so nothing within
    // about row 181 is dropped -- and everything well above it is.
    expect(shown.start).toBeGreaterThan(150);
    expect(shown.end).toBeLessThan(rows.length);
    expect(shown.end - shown.start).toBeLessThanOrEqual(400);
  });

  it('believes the screen over a scroll container taller than one', () => {
    const rows = videoShelfRows(oneFolderOf(3_000), 3);
    const offsets = videoShelfOffsets(rows, METRICS);

    // The fault `rowWindowFor` documents: a pane that stopped being
    // constrained reports the height of its own content, and seven viewports
    // of that is the whole library mounted at once.
    const shown = videoRowWindowFor({
      scrollTop: 0,
      paneHeight: 647_542,
      screenHeight: 1_000,
      offsets,
    });

    expect(shown.end - shown.start).toBeLessThanOrEqual(400);
  });
});

describe('videos in the library', () => {
  let bridge: ILibraryStoreBridge | undefined;

  afterEach(() => {
    // Unmounted before the store closes, so nothing asks a closed store.
    cleanup();
    bridge?.close();
    bridge = undefined;
  });

  /** The Videos shelf, asked for exactly as the workspace asks for it. */
  const VIDEO_SHELF = shelfQueryFor({
    browseMode: 'video',
    viewMode: 'grid',
    folderPath: undefined,
    search: '',
    sort: 'title',
    direction: 'asc',
    isTree: false,
    hasRoots: true,
    folderLevel: undefined,
  });

  const showShelf = (
    tracks: ILibraryTrack[],
    onPlayTrack: (trackId: string) => void = jest.fn(),
  ) => {
    const opened = openLibraryStoreBridge({
      roots: [libraryRoot('r', 'C:\\V')],
      tracks,
    });
    bridge = opened;
    installIpcRenderer(opened.channels);
    render(
      <I18nProvider>
        <LibraryProvider>
          <LibraryListOf query={VIDEO_SHELF}>
            {(list) => (
              <LibraryVideoSection list={list} onPlayTrack={onPlayTrack} />
            )}
          </LibraryListOf>
        </LibraryProvider>
      </I18nProvider>,
    );
  };

  /** Each folder heading on the shelf, with the titles drawn under it. */
  const shelfByFolder = (): Record<string, string[]> => {
    const shelf: Record<string, string[]> = {};
    let folder = '';
    Array.from(
      screen
        .getByLabelText('Videos')
        .querySelectorAll(
          '.library-video-section__folder-title, .library-grid__title',
        ),
    ).forEach((element) => {
      const text = element.textContent ?? '';
      if (element.classList.contains('library-video-section__folder-title')) {
        folder = text;
        shelf[folder] = [];
      } else if (text.trim() !== '') {
        shelf[folder]?.push(text);
      }
    });
    return shelf;
  };

  it('groups by the folder they live in, since they have no album', async () => {
    showShelf([
      video('C:\\V\\Live\\a.mp4', 'Alpha'),
      video('C:\\V\\Live\\b.mp4', 'Bravo'),
      video('C:\\V\\Clips\\c.mp4', 'Coda'),
    ]);
    await screen.findByText('Coda');
    expect(shelfByFolder()).toEqual({
      Clips: ['Coda'],
      Live: ['Alpha', 'Bravo'],
    });
  });

  it('says so plainly when there are none', async () => {
    showShelf([]);
    expect(
      await screen.findByText('No videos in the folders you have added.'),
    ).toBeInTheDocument();
  });

  it('splits on a forward slash too, not just a Windows backslash', async () => {
    // The hazard the brief calls out by name: a normaliser that only
    // handles `\` breaks the moment anything is written with `/`.
    showShelf([
      video('C:/V/Live/a.mp4', 'Alpha'),
      video('C:\\V\\Live\\b.mp4', 'Bravo'),
    ]);
    await screen.findByText('Bravo');
    expect(shelfByFolder()).toEqual({ Live: ['Alpha', 'Bravo'] });
  });

  it('leaves audio tracks off the shelf', async () => {
    showShelf([
      video('C:\\V\\Live\\a.mp4', 'Alpha'),
      { ...video('C:\\V\\Live\\b.mp3', 'Bravo'), kind: 'audio' },
    ]);
    await screen.findByText('Alpha');
    expect(shelfByFolder()).toEqual({ Live: ['Alpha'] });
  });

  it('shows a tile per video, grouped under its folder heading', async () => {
    showShelf([
      video('C:\\V\\Live\\alpha.mp4', 'Alpha'),
      video('C:\\V\\Clips\\coda.mp4', 'Coda'),
    ]);
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Coda')).toBeInTheDocument();
    const live = screen.getByRole('heading', { name: 'Live' });
    const clips = screen.getByRole('heading', { name: 'Clips' });
    // Each tile sits in the grid right after its own folder's heading.
    expect(
      within(live.nextElementSibling as HTMLElement).getByText('Alpha'),
    ).toBeInTheDocument();
    expect(
      within(clips.nextElementSibling as HTMLElement).getByText('Coda'),
    ).toBeInTheDocument();
  });

  it('plays a tile on click', async () => {
    const onPlayTrack = jest.fn();
    showShelf([video('C:\\V\\Live\\alpha.mp4', 'Alpha')], onPlayTrack);
    await userEvent.click(await screen.findByText('Alpha'));
    expect(onPlayTrack).toHaveBeenCalledWith('Alpha');
  });

  it('marks a video it cannot play instead of leaving a hole in the grid', async () => {
    showShelf([{ ...video('C:\\V\\Live\\old.wmv', 'Old'), isPlayable: false }]);
    // The tile itself is still there — a track FluidEQ cannot play still gets
    // a place on the shelf, just marked rather than hidden.
    expect(await screen.findByText('Old')).toBeInTheDocument();
    expect(
      screen.getByTitle('FluidEQ cannot play this format'),
    ).toBeInTheDocument();
  });
});
