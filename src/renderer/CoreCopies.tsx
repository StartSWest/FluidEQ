/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { DSP_PRESETS_CHANGED } from './dsp/favouriteDspPresets';
import { readUserDspPresets } from './dsp/userDspPresets';
import {
  GAME_PROFILES_CHANGED,
  readGameProfiles,
  readGamesEnabled,
} from './games/gameProfiles';

/**
 * The window's lists, handed whole to the app's core: the game profiles and
 * the Games page's switch, and the saved chains (`common/coreCopies.ts`).
 *
 * This window is where they are made and changed. The core keeps a copy so a
 * game's sound can be put on with the window minimised or not open at all:
 * once at launch, which also hands over everything kept before the core kept
 * anything, and again on every change, from this window or another.
 * Renders nothing.
 */
export default function CoreCopies() {
  useEffect(() => {
    // Optional, like every bridge call: a test's partial bridge has none.
    const api = window.electron?.ipcRenderer;
    const sendGames = () =>
      api?.keepGamesForCore?.({
        enabled: readGamesEnabled(),
        profiles: readGameProfiles(),
      });
    const sendPresets = () =>
      api?.keepDspPresetsForCore?.(readUserDspPresets());
    const sendBoth = () => {
      sendGames();
      sendPresets();
    };
    sendBoth();
    window.addEventListener(GAME_PROFILES_CHANGED, sendGames);
    window.addEventListener(DSP_PRESETS_CHANGED, sendPresets);
    window.addEventListener('storage', sendBoth);
    return () => {
      window.removeEventListener(GAME_PROFILES_CHANGED, sendGames);
      window.removeEventListener(DSP_PRESETS_CHANGED, sendPresets);
      window.removeEventListener('storage', sendBoth);
    };
  }, []);
  return null;
}
