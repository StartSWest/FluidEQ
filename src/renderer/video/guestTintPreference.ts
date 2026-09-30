/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { createFlagSetting } from '../utils/graphStorage';

/**
 * Whether the Media sites are shown in the interface's colours
 * (`guestTint.ts`).
 *
 * On in a new install (Ivan, 2026-09-29: "color pages in online media also
 * default on"). It was off until the user turned it on, on the reading that
 * YouTube's, Twitch's and Suno's terms ask users not to modify the service
 * and a page coloured by default is the app altering somebody else's site
 * rather than the user choosing a display, like a browser's dark mode; the
 * default is his to set, and he set it. Anybody who turned it off keeps it
 * off.
 */
const setting = createFlagSetting('fluideq.video.matchColours', true);

export const setGuestTintEnabled = (next: boolean) => setting.set(next);

export const useGuestTintEnabled = (): boolean =>
  useSyncExternalStore(setting.subscribe, setting.get, () => true);
