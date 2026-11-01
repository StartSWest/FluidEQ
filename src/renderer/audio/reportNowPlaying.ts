/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import NOW_PLAYING_CHANNEL from 'common/nowPlaying';
import type { ISongIdentity } from 'common/songIdentity';

/**
 * What the window's players play, for the core's jobs that follow songs —
 * the song memory, and Smart EQ, which hears the Library through its own
 * host (`common/nowPlaying.ts`). Optional, like every bridge call: a test's
 * partial bridge has none.
 */
const reportNowPlaying = (
  identity: ISongIdentity | undefined,
  isPlaying: boolean,
  isLibrary: boolean,
): void =>
  window.electron?.ipcRenderer?.sendMessage?.(NOW_PLAYING_CHANNEL, [
    identity ?? null,
    isPlaying,
    isLibrary,
  ]);

export default reportNowPlaying;
