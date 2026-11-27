/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createContext, useContext } from 'react';
import type { ISmartEqSettings } from 'common/smartEq';

/**
 * What Smart EQ measured, as its own layer — and a context of its own,
 * apart from the three in `fluidEqContextTypes.ts`.
 *
 * Every other layer changes when somebody picks something. This one changes
 * by itself while the music plays: once a song in a running mode, and while
 * the correction comes in as it is measured (`smartEqLiveApply.ts`) up to
 * twice a second, for as long as the song is listened to. Carried in the
 * layers' context, each of those steps redrew everything that reads a layer
 * or a band — the side bar, the EQ page's bands, the presets, the player's
 * sound — 50 to 80 ms in the dev window, and with the window's root among
 * them through the song memory's host, the whole window (measured
 * 2026-11-27: 1 such redraw a second while a song was measured, long tasks
 * from 7 to 212 ms a second). Here only what draws or reads the Smart layer
 * redraws with it.
 *
 * Undefined means nothing measured, or a correction of 0 dB everywhere —
 * which amounts to the same thing and is stored as the same thing — and it
 * is also what a tree with no equaliser provider reads: a figure or a part
 * of the window mounted on its own has no Smart layer, which is true.
 */
export const FluidEqSmartEqContext = createContext<
  ISmartEqSettings | undefined
>(undefined);

/** The Smart layer as the window holds it — see `FluidEqSmartEqContext`. */
export const useFluidEqSmartEq = (): ISmartEqSettings | undefined =>
  useContext(FluidEqSmartEqContext);
