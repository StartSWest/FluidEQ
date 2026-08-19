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
  videoFolderGroups,
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
