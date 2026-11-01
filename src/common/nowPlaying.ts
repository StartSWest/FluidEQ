/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Window to core: what the window's players play — the one thing only the
 * window knows. Sent as `[identity or null, isPlaying, isLibrary]`, whenever
 * any of the three changes; the core's song memory remembers songs by it,
 * and Smart EQ measures one song at a time by it and hears the Library
 * through its own host when `isLibrary`.
 */
const NOW_PLAYING_CHANNEL = 'now-playing';

export default NOW_PLAYING_CHANNEL;
