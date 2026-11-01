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
 * Where a window from before the core kept it wrote down which preset's rack
 * Equalizer APO held off. The core keeps that now (`main/presetPicks.ts`).
 */
const OLD_RACK_HOLD_KEY = 'fluideq.dsp.rackHeldForApo.v1';

type TCoreCopiesBridge = Window['electron']['ipcRenderer'] | undefined;

/**
 * The hold from before, handed to the core once and forgotten here, so a
 * switch to the FluidEQ Engine after an update still puts back the rack it
 * held off. Read and removed before it is sent: a store that will not give
 * it up would hand an old hold over at every launch, over the core's own.
 */
const handOverRackHold = (api: TCoreCopiesBridge): void => {
  if (!api?.handRackHoldToCore) {
    return;
  }
  let held: string | null;
  try {
    held = window.localStorage.getItem(OLD_RACK_HOLD_KEY);
    window.localStorage.removeItem(OLD_RACK_HOLD_KEY);
  } catch {
    // A store that cannot be read holds nothing to hand over.
    return;
  }
  if (held) {
    api.handRackHoldToCore(held);
  }
};

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
    handOverRackHold(api);
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
