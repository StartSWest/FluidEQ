/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSongEqSessionHost } from './songEqSession';

/**
 * The Smart EQ song memory's recorder, for the life of the window: a
 * recording must not end because somebody switched tabs, so it is mounted at
 * the window's root rather than inside the EQ page.
 *
 * A component of its own that draws nothing, and not a hook of the root's.
 * The recorder hears every change of the Smart layer — while a song is
 * measured, the correction coming in step by step, up to twice a second — and
 * as the root's own hook each of those redrew the whole window: 1 redraw a
 * second of 50 to 80 ms in the dev window while a song was measured
 * (2026-11-27). Here a change redraws this, which is nothing.
 */
const SongEqSessionHost = () => {
  useSongEqSessionHost();
  return null;
};

export default SongEqSessionHost;
