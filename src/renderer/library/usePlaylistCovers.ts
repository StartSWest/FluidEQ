/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type { ILibraryPlaylist } from '../../common/library/playlists';
import { useLibraryTracks } from './useLibraryTracks';

/**
 * Songs looked at, from the top of each playlist, for its cover. The first
 * of them the library can still see gives it; a playlist whose first eight
 * are all on an unplugged drive draws a generated tile, which is what one
 * with no song to show has always drawn.
 */
const LOOKED_AT = 8;

/** The cover each playlist is drawn with, by playlist id. */
const usePlaylistCovers = (
  playlists: readonly ILibraryPlaylist[],
): ReadonlyMap<string, string | undefined> => {
  const ids = useMemo(
    () =>
      playlists.flatMap((playlist) => playlist.trackIds.slice(0, LOOKED_AT)),
    [playlists],
  );
  const lookup = useLibraryTracks(ids);
  return useMemo(
    () =>
      new Map(
        playlists.map((playlist) => [
          playlist.id,
          playlist.trackIds
            .slice(0, LOOKED_AT)
            .map((id) => lookup.get(id))
            .find((track) => track !== undefined && track !== null)?.artId,
        ]),
      ),
    [lookup, playlists],
  );
};

export default usePlaylistCovers;
