/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { screen } from '@testing-library/react';

/**
 * The open song's name as the Karaoke shows it: in the stage's own bar,
 * after "Karaoke ›" (`KaraokeStageToolbar`). Since the K1 mockup
 * (2026-11-16) that is the only place it is written; the song's title block
 * above the lyrics, a heading, and its "Audio only" source badge are gone.
 */
const SONG_TITLE = '.view-bar__crumb strong';

export const findSongTitle = (name: string) =>
  screen.findByText(name, { selector: SONG_TITLE });

export const querySongTitle = (name: string) =>
  screen.queryByText(name, { selector: SONG_TITLE });
