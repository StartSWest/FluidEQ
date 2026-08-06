/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Whether the ad blocker's switch is in the interface at all.
 *
 * At the root rather than inside the player, because the two ends are in
 * different places and only one of them is always there. The chord is pressed
 * on the support dialog; the switch it reveals lives in the video tab's bar —
 * and the player is not mounted until the video tab has been opened once, so a
 * flag held there would not exist at the moment it was set.
 *
 * So the flag is here, and the player reads it whenever it does mount. Nothing
 * has to be kept alive to hold an answer.
 *
 * The same shape as `euphoriaMode`: a module-level value, a set of listeners
 * and a `useSyncExternalStore` hook, so that a component reading it re-renders
 * when it moves.
 */

import { useSyncExternalStore } from 'react';
import {
  VIDEO_AD_BLOCK_REVEAL_STORAGE_KEY,
  VIDEO_AD_BLOCK_STORAGE_KEY,
} from '../../common/videoAdBlock';

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

let revealed = false;
try {
  revealed =
    window.localStorage.getItem(VIDEO_AD_BLOCK_REVEAL_STORAGE_KEY) === 'true';
} catch {
  // Storage can be unavailable. The switch is then simply not offered, which
  // is the safe direction to fail in.
}

export const isAdBlockRevealed = () => revealed;

/**
 * The chord was pressed. On becomes off and off becomes on.
 *
 * Persisted immediately, so the answer survives a restart either way — this is
 * a decision about what the app offers rather than a mood, and having to find
 * it again every morning would make it useless.
 *
 * Putting it away switches the blocker off as well, here rather than only in
 * the player: the player may not be mounted to be told, and the rule has to
 * hold either way. Out of sight is off, the advertising comes back, and the
 * switch is off again when it next appears — hiding a control that carries on
 * working would be the one behaviour this whole design exists to avoid.
 */
export const toggleAdBlockRevealed = () => {
  revealed = !revealed;
  try {
    window.localStorage.setItem(
      VIDEO_AD_BLOCK_REVEAL_STORAGE_KEY,
      String(revealed),
    );
    if (!revealed) {
      window.localStorage.setItem(VIDEO_AD_BLOCK_STORAGE_KEY, 'false');
    }
  } catch {
    // Right for this run at least, and the chord still works next time.
  }
  emit();
};

/** Whether the switch should be on show. */
export const useIsAdBlockRevealed = () =>
  useSyncExternalStore(
    subscribe,
    () => revealed,
    () => false,
  );
