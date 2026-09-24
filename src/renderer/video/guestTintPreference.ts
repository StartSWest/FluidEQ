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
 * Off until the user turns it on, and that is the point of it rather than a
 * shy default. YouTube's, Twitch's and Suno's terms ask users not to modify the
 * service; the page around a video coloured to match the rest of the window,
 * on the user's own screen because the user asked for it, is a display choice
 * like a browser's dark mode. The same change made to every page by default
 * would be the app deciding to alter somebody else's site.
 */
const setting = createFlagSetting('fluideq.video.matchColours', false);

export const setGuestTintEnabled = (next: boolean) => setting.set(next);

export const useGuestTintEnabled = (): boolean =>
  useSyncExternalStore(setting.subscribe, setting.get, () => false);
