/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The cover a song belongs to on the shelf being browsed: its album, artist,
 * first genre, folder, or the song itself. One rule for the playing mark,
 * for where Surprise me's pick is shown, and for where Cover Flow's spin
 * lands, so the three never point at different covers.
 */
import { trackGenreIds } from '../../common/library/genres';
import {
  albumKey,
  artistKey,
  trackFolderPath,
} from '../../common/library/grouping';
import type {
  ILibraryTrack,
  TLibraryBrowseMode,
} from '../../common/library/types';

const shelfItemOf = (
  browseMode: TLibraryBrowseMode,
  track: ILibraryTrack,
): string => {
  switch (browseMode) {
    case 'album':
      return albumKey(track);
    case 'artist':
      return artistKey(track);
    case 'genre':
      return trackGenreIds(track)[0] ?? track.id;
    case 'folder':
      return trackFolderPath(track.path);
    default:
      return track.id;
  }
};

export default shelfItemOf;
