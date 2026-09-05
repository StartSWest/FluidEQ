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
  volume: number;
  toggle: () => void;
  seek: (positionMs: number) => void;
  setVolume: (value: number) => void;
}): void => {
  const {
    track,
    isPlaying,
    retainWhenHidden,
    publishedPositionMs,
    publishedDurationMs,
    volume,
    toggle,
    seek,
    setVolume,
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
      isPlaying,
      retainWhenHidden: retainWhenHidden || undefined,
      positionMs: publishedPositionMs,
      durationMs: publishedDurationMs,
      toggle,
      seek,
      volume,
      setVolume,
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
    seek,
    volume,
    setVolume,
  ]);

  useEffect(() => () => clearTransportSource('library'), []);
};

export default usePublishedTransport;
