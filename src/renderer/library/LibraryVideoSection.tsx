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

import { useMemo } from 'react';
import { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';

export interface IVideoFolderGroup {
  folder: string;
  tracks: ILibraryTrack[];
}

/**
 * The last path segment before the file name — `C:\V\Live\a.mp4` reports
 * `Live`. Splits on both `\` and `/`: a path arrives as Windows text, but a
 * normaliser that only handled `\` would break the moment anything is
 * written with a forward slash instead.
 *
 * Fewer than two segments (a bare filename, nothing this scanner should ever
 * actually produce) reports the empty string rather than throwing — the
 * caller groups on it like any other folder name instead of crashing on a
 * shape reality is not expected to hand it.
 */
const folderOf = (path: string): string => {
  const segments = path.split(/[\\/]+/).filter((segment) => segment.length > 0);
  return segments.length >= 2 ? segments[segments.length - 2] : '';
};

/**
 * Videos grouped by the folder they live in — the fallback grouping for a
 * kind that carries no album tag to group by. `groupIntoAlbums` keys on
 * `albumKey`; this keys on the folder name for the same reason a video has
 * no `album` field to read in the first place.
 *
 * Only `kind === 'video'` tracks are considered: `tracks` here is the same
 * already-searched, already-sorted list every other browse mode is handed
 * (see `LibraryWorkspace`'s `visibleTracks`), and that list still has audio
 * in it — the filter is this function's job, not its caller's.
 *
 * Returned sorted by folder name, so the shelf renders in a stable order
 * rather than whatever order a `Map` happened to fill during the walk.
 */
export const videoFolderGroups = (
  tracks: readonly ILibraryTrack[],
): IVideoFolderGroup[] => {
  const grouped = new Map<string, ILibraryTrack[]>();
  tracks
    .filter((track) => track.kind === 'video')
    .forEach((track) => {
      const folder = folderOf(track.path);
      const existing = grouped.get(folder);
      if (existing) {
        existing.push(track);
      } else {
        grouped.set(folder, [track]);
      }
    });
  return Array.from(grouped.entries())
    .map(([folder, members]) => ({ folder, tracks: members }))
    .sort((left, right) => left.folder.localeCompare(right.folder));
};

interface ILibraryVideoSectionProps {
  tracks: readonly ILibraryTrack[];
  onPlayTrack: (trackId: string) => void;
}

/**
 * The video section: a shelf of its own rather than folded into the album,
 * artist or song browsing above it — `LibraryWorkspace` routes
 * `browseMode === 'video'` here and never hands that mode to
 * `LibraryListView`, `LibraryGridView` or `LibraryCoverFlow`, so none of
 * them need to know this exists.
 *
 * One heading per folder, a `LibraryCoverArt size="tile"` grid beneath it —
 * the same tile `LibraryGridView` draws for a song, reused rather than
 * redrawn, laid out under a folder heading instead of a flat grid.
 *
 * A track Chromium cannot decode (`isPlayable === false`, see
 * `isLibraryPlayable`) still gets a tile: its thumbnail or generated
 * initials, same as every playable one, rather than a hole in the shelf. A
 * grid tile has no title cell to carry the mark inline the way
 * `LibraryListView`'s row does, so the mark sits on the corner of the art
 * instead — a small badge, not a black rectangle standing in for the video
 * itself.
 */
const LibraryVideoSection = ({
  tracks,
  onPlayTrack,
}: ILibraryVideoSectionProps) => {
  const { t } = useTranslation();

  // Walks the whole track list, so memoised on `tracks` alone — the same
  // split `LibraryGridView`'s `items` memo makes: `onPlayTrack` and `t` are
  // resolved at render time below, never as memo dependencies, since
  // `LibraryWorkspace` hands down a fresh `onPlayTrack` closure every render.
  const groups = useMemo(() => videoFolderGroups(tracks), [tracks]);

  if (groups.length === 0) {
    return (
      <div
        className="library-video-section is-empty"
        aria-label={t('library.videos')}
      >
        <p className="library-video-section__empty">
          {t('library.videos.empty')}
        </p>
      </div>
    );
  }

  return (
    <div className="library-video-section" aria-label={t('library.videos')}>
      {groups.map((group) => (
        <div key={group.folder} className="library-video-section__folder">
          <h3 className="library-video-section__folder-title">
            {group.folder}
          </h3>
          <div className="library-video-section__grid">
            {group.tracks.map((track) => (
              <button
                key={track.id}
                type="button"
                className="library-grid__tile"
                onClick={() => onPlayTrack(track.id)}
              >
                <span className="library-video-section__art">
                  <LibraryCoverArt
                    artId={track.artId}
                    label={track.title}
                    size="tile"
                  />
                  {/* Chromium has no demuxer for this container — marked on
                      the art itself, the one place a grid tile has to put
                      it. See `LibraryListView`'s inline badge for the row
                      equivalent of this same mark. */}
                  {!track.isPlayable && (
                    <span
                      className="library-video-section__unplayable"
                      title={t('library.unplayable')}
                    >
                      <MenuIcon
                        name="clear"
                        className="library-list__badge-icon"
                      />
                    </span>
                  )}
                </span>
                <span className="library-grid__title">{track.title}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LibraryVideoSection;
