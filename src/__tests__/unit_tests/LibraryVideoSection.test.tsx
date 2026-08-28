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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ILibraryTrack } from '../../common/library/types';
import LibraryVideoSection, {
  IVideoShelfMetrics,
  videoFolderGroups,
  videoRowWindowFor,
  videoShelfOffsets,
  videoShelfRows,
} from '../../renderer/library/LibraryVideoSection';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const video = (path: string, title: string): ILibraryTrack => ({
  id: title,
  rootId: 'r',
  path,
  kind: 'video',
  isPlayable: true,
  title,
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
});

const manyVideos = (count: number): ILibraryTrack[] => {
  const list: ILibraryTrack[] = [];
  for (let n = 0; n < count; n += 1) {
    list.push(video(`C:\\V\\Live\\${n}.mp4`, `L${n}`));
  }
  return list;
};

/** Round numbers, so an arithmetic slip reads as one rather than as rounding. */
const METRICS: IVideoShelfMetrics = {
  headerHeight: 40,
  tileHeight: 200,
  gap: 10,
  columns: 3,
};

describe('the video shelf as windowable rows', () => {
  it('puts a heading in front of each folder and splits its videos by column', () => {
    const rows = videoShelfRows(
      [
        {
          folder: 'Live',
          tracks: [1, 2, 3, 4].map((n) =>
            video(`C:\\V\\Live\\${n}.mp4`, `L${n}`),
          ),
        },
        { folder: 'Clips', tracks: [video('C:\\V\\Clips\\c.mp4', 'C')] },
      ],
      3,
    );

    expect(rows.map((row) => row.kind)).toEqual([
      'header',
      'tiles',
      'tiles',
      'header',
      'tiles',
    ]);
    // Four videos across three columns is a full row and a remainder, never a
    // dropped one.
    expect(rows[1].kind === 'tiles' && rows[1].tracks).toHaveLength(3);
    expect(rows[2].kind === 'tiles' && rows[2].tracks).toHaveLength(1);
  });

  it('keys a row by its folder, so one folder never reuses another row', () => {
    const rows = videoShelfRows(
      [
        { folder: 'Live', tracks: [video('C:\\V\\Live\\a.mp4', 'A')] },
        { folder: 'Clips', tracks: [video('C:\\V\\Clips\\b.mp4', 'B')] },
      ],
      3,
    );

    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows[1].key).toContain('Live');
    expect(rows[3].key).toContain('Clips');
  });

  it('survives a column count of zero rather than looping for ever', () => {
    const rows = videoShelfRows(
      [{ folder: 'Live', tracks: [video('C:\\V\\Live\\a.mp4', 'A')] }],
      0,
    );

    expect(rows).toHaveLength(2);
  });

  it('measures each row at its own height, headings being shorter than tiles', () => {
    const rows = videoShelfRows(
      [{ folder: 'Live', tracks: [video('C:\\V\\Live\\a.mp4', 'A')] }],
      3,
    );

    // Heading 40 + gap 10, then tiles 200 + gap 10. One entry longer than the
    // rows, so the end of the last one needs no special case.
    expect(videoShelfOffsets(rows, METRICS)).toEqual([0, 50, 260]);
  });

  it('mounts everything when the whole shelf fits inside the overscan', () => {
    const rows = videoShelfRows(
      [
        {
          folder: 'Live',
          tracks: [1, 2, 3].map((n) => video(`C:\\V\\Live\\${n}.mp4`, `L${n}`)),
        },
      ],
      3,
    );
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
    const rows = videoShelfRows(
      [
        {
          folder: 'Live',
          tracks: manyVideos(1_200),
        },
      ],
      3,
    );
    const offsets = videoShelfOffsets(rows, METRICS);

    const window = videoRowWindowFor({
      scrollTop: 40_000,
      paneHeight: 600,
      screenHeight: 1_000,
      offsets,
    });

    // Three viewports of overscan above 40,000px is 1,800px, so nothing within
    // about row 181 is dropped -- and everything well above it is.
    expect(window.start).toBeGreaterThan(150);
    expect(window.end).toBeLessThan(rows.length);
    expect(window.end - window.start).toBeLessThanOrEqual(400);
  });

  it('believes the screen over a scroll container taller than one', () => {
    const rows = videoShelfRows(
      [
        {
          folder: 'Live',
          tracks: manyVideos(3_000),
        },
      ],
      3,
    );
    const offsets = videoShelfOffsets(rows, METRICS);

    // The fault `rowWindowFor` documents: a pane that stopped being
    // constrained reports the height of its own content, and seven viewports
    // of that is the whole library mounted at once.
    const window = videoRowWindowFor({
      scrollTop: 0,
      paneHeight: 647_542,
      screenHeight: 1_000,
      offsets,
    });

    expect(window.end - window.start).toBeLessThanOrEqual(400);
  });
});

describe('videos in the library', () => {
  it('groups by the folder they live in, since they have no album', () => {
    const groups = videoFolderGroups([
      video('C:\\V\\Live\\a.mp4', 'A'),
      video('C:\\V\\Live\\b.mp4', 'B'),
      video('C:\\V\\Clips\\c.mp4', 'C'),
    ]);
    expect(groups.map((entry) => entry.folder).sort()).toEqual([
      'Clips',
      'Live',
    ]);
  });

  it('says so plainly when there are none', () => {
    render(
      <I18nProvider>
        <LibraryVideoSection tracks={[]} onPlayTrack={jest.fn()} />
      </I18nProvider>,
    );
    expect(
      screen.getByText('No videos in the folders you have added.'),
    ).toBeInTheDocument();
  });

  it('splits on a forward slash too, not just a Windows backslash', () => {
    // The hazard the brief calls out by name: a normaliser that only
    // handles `\` breaks the moment anything is written with `/`.
    const groups = videoFolderGroups([
      { ...video('C:/V/Live/a.mp4', 'A') },
      { ...video('C:\\V\\Live\\b.mp4', 'B') },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].folder).toBe('Live');
    expect(groups[0].tracks.map((track) => track.id).sort()).toEqual([
      'A',
      'B',
    ]);
  });

  it('leaves audio tracks off the shelf', () => {
    const groups = videoFolderGroups([
      video('C:\\V\\Live\\a.mp4', 'A'),
      { ...video('C:\\V\\Live\\b.mp3', 'B'), kind: 'audio' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].tracks.map((track) => track.id)).toEqual(['A']);
  });

  it('shows a tile per video, grouped under its folder heading', () => {
    render(
      <I18nProvider>
        <LibraryVideoSection
          tracks={[
            video('C:\\V\\Live\\alpha.mp4', 'Alpha'),
            video('C:\\V\\Clips\\coda.mp4', 'Coda'),
          ]}
          onPlayTrack={jest.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Clips')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Coda')).toBeInTheDocument();
  });

  it('plays a tile on click', async () => {
    const onPlayTrack = jest.fn();
    render(
      <I18nProvider>
        <LibraryVideoSection
          tracks={[video('C:\\V\\Live\\alpha.mp4', 'Alpha')]}
          onPlayTrack={onPlayTrack}
        />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByText('Alpha'));
    expect(onPlayTrack).toHaveBeenCalledWith('Alpha');
  });

  it('marks a video it cannot play instead of leaving a hole in the grid', () => {
    render(
      <I18nProvider>
        <LibraryVideoSection
          tracks={[
            { ...video('C:\\V\\Live\\old.wmv', 'Old'), isPlayable: false },
          ]}
          onPlayTrack={jest.fn()}
        />
      </I18nProvider>,
    );
    // The tile itself is still there — a track FluidEQ cannot play still gets
    // a place on the shelf, just marked rather than hidden.
    expect(screen.getByText('Old')).toBeInTheDocument();
    expect(
      screen.getByTitle('FluidEQ cannot play this format'),
    ).toBeInTheDocument();
  });
});
