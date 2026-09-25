/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Telling the rest of the app what this player is doing.
 *
 * Published into the same register as karaoke's and the Media tab's so one rule
 * can decide between them — see `pickTransportOwner`. What the library gets
 * when it wins is NOT this: `NowPlayingBar` draws from the player's own context
 * directly, because the library has cover art, a format readout, shuffle and
 * repeat, and none of those fit a shape the other two could honestly fill in.
 *
 * So this is the small, common description every source can answer with, and
 * it is cleared the moment there is no track — a register entry for a player
 * with nothing loaded would win the arbitration and then have nothing to show.
 */
import { useEffect } from 'react';
import { buildSongIdentity } from 'common/songIdentity';
import { libraryMediaUrl } from '../../../common/library/mediaUrl';
import { ILibraryTrack } from '../../../common/library/types';
import {
  clearTransportSource,
  setTransportSource,
} from '../../audio/transportSource';

const usePublishedTransport = (options: {
  track: ILibraryTrack | undefined;
  isPlaying: boolean;
  retainWhenHidden: boolean;
  /** The clock of whichever engine is playing. */
  publishedPositionMs: number;
  publishedDurationMs: number;
  toggle: () => void;
  skip: (direction: 1 | -1) => void;
  isUnplayable: boolean;
  seek: (positionMs: number) => void;
}): void => {
  const {
    track,
    isPlaying,
    retainWhenHidden,
    publishedPositionMs,
    publishedDurationMs,
    toggle,
    skip,
    isUnplayable,
    seek,
  } = options;

  /**
   * The library's claim on the bar at the foot of the window.
   *
   * Published in the same register as karaoke's and the Media tab's, so one
   * rule can decide between them — see `pickTransportOwner`. What the library
   * gets when it wins is not this: `NowPlayingBar` draws it from this context
   * directly, because the library has cover art, a format readout, shuffle and
   * repeat, and none of those fit a shape the other two could honestly fill in.
   */
  useEffect(() => {
    if (!track) {
      clearTransportSource('library');
      return;
    }
    setTransportSource({
      owner: 'library',
      title: track.title,
      subtitle: track.artist,
      // The library's own bar draws its cover from the track; this is for
      // everything that reads the register instead — the amp without the
      // Library's deck, and the last-played bar that stands in once the
      // queue is gone (`lastShown`), for which a URL outlives the page.
      ...(track.artId === undefined
        ? {}
        : { artworkUrl: libraryMediaUrl('art', track.artId) }),
      isPlaying,
      retainWhenHidden: retainWhenHidden || undefined,
      positionMs: publishedPositionMs,
      durationMs: publishedDurationMs,
      toggle,
      canToggle: !isUnplayable,
      previous: () => skip(-1),
      next: () => skip(1),
      seek,
      identity: buildSongIdentity(
        'library',
        track.id,
        track.title,
        track.artist,
      ),
    });
  }, [
    track,
    isPlaying,
    retainWhenHidden,
    publishedPositionMs,
    publishedDurationMs,
    toggle,
    skip,
    isUnplayable,
    seek,
  ]);

  useEffect(() => () => clearTransportSource('library'), []);
};

export default usePublishedTransport;
