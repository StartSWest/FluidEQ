/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { useNowPlayingIdentity } from '../audio/nowPlayingIdentity';
import { heardSongs } from './heardSongs';

/**
 * Tells the songs this window hears (`heardSongs.ts`) which one the players
 * say is playing, so a playlist's songs are kept apart and a paused one
 * stays whole. Mounted once, at the root; renders nothing.
 */
export default function HeardSongNames() {
  const key = useNowPlayingIdentity().identity?.key;
  useEffect(() => {
    heardSongs.playing(key);
  }, [key]);
  return null;
}
