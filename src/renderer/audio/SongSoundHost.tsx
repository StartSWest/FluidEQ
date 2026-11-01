/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { useNowPlayingIdentity } from './nowPlayingIdentity';
import { usePlaybackOwner } from './playbackOwner';
import reportNowPlaying from './reportNowPlaying';
import {
  followSongMemory,
  reportTick,
  useSongMemoryNeedsClock,
} from './songSoundSession';
import { useTransportSources } from './transportSource';

/**
 * Tells the app's core what the window's players play — for the song memory
 * (`main/songMemory.ts`) and Smart EQ (`main/smartEq/smartEqRunner.ts`),
 * which hears the Library through its own host — and draws nothing. The
 * sound, the output and the switches the core knows for itself.
 *
 * A component of its own beside the notices rather than a hook in the
 * window's root: the players report positions several times a second, a
 * redraw of nothing here and of the whole window there.
 */
const SongSoundHost = () => {
  const { identity, isPlaying } = useNowPlayingIdentity();
  const isLibrary = usePlaybackOwner() === 'library';
  const sources = useTransportSources();
  const needsClock = useSongMemoryNeedsClock();

  useEffect(() => followSongMemory(), []);

  useEffect(() => {
    reportNowPlaying(identity, isPlaying, isLibrary);
  }, [identity, isPlaying, isLibrary]);

  // The clock, only while the core asks for it — a song waiting to settle
  // or paused, on a machine where the core cannot hear the output: every
  // position a player reports is time passing while it plays, the same
  // clock the Smart EQ memory keeps (`useSongEqClock`).
  useEffect(() => {
    if (needsClock) {
      reportTick();
    }
  }, [sources, needsClock]);

  return null;
};

export default SongSoundHost;
