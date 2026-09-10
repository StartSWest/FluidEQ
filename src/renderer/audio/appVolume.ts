/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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
 * How loud this app is. One number, for every player it owns.
 *
 * There is one fader in FluidEQ and it means the same thing on every tab: the
 * library's queue, the karaoke session, the Media tab's page and a LAN sender
 * being listened to all read this. They used to keep a level each — the library
 * under its own key, karaoke under another, the Media tab a hard-coded 1 — and
 * the bar at the foot of the window drew whichever one the open tab happened to
 * publish. So the bar said 100% while a page played at a third of that, and the
 * first drag of the fader jumped the sound to full scale.
 *
 * Whole percent, deliberately. The faders are `step={0.01}` and the Media tab's
 * page is told a level through its own player API, which takes whole percent —
 * quantising here is what lets a level survive that round trip unchanged, so
 * the page reporting its own level back cannot nudge the number the user set.
 */
import { useSyncExternalStore } from 'react';

const VOLUME_KEY = 'fluideq.player.volume';

/**
 * Where the library alone used to keep it.
 *
 * Read once, if the shared key has nothing, so nobody's remembered level is
 * lost to this becoming app-wide. Never written again.
 */
const LEGACY_LIBRARY_VOLUME_KEY = 'fluideq.library.volume';

/**
 * Where the fader sits when nothing has been stored.
 *
 * Unity, because that is what a fresh `HTMLAudioElement` already opens at — so
 * a first run behaves exactly as it did before any of this existed.
 */
export const DEFAULT_VOLUME = 1;

/** 0 to 1, in whole percent. See the note at the top about the round trip. */
export const clampAppVolume = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_VOLUME;
  }
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
};

const readStored = (key: string): number | undefined => {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) {
      return undefined;
    }
    const value = Number.parseFloat(stored);
    return Number.isFinite(value) && value >= 0 && value <= 1
      ? clampAppVolume(value)
      : undefined;
  } catch {
    // A private or locked storage area is not a reason to refuse to play.
    return undefined;
  }
};

/**
 * The stored level, or unity.
 *
 * Exported because it is needed before any React tree exists: an audio element
 * is built at unity and turned down afterwards is briefly at unity, and
 * somebody who left the fader at 17% would get a burst of full-scale audio on
 * launch — the opposite of what remembering it is for.
 */
export const readAppVolume = (): number =>
  readStored(VOLUME_KEY) ??
  readStored(LEGACY_LIBRARY_VOLUME_KEY) ??
  DEFAULT_VOLUME;

let volume = readAppVolume();
const listeners = new Set<() => void>();

/** The level right now, for code that cannot subscribe. */
export const getAppVolume = (): number => volume;

/**
 * Move the fader. Audible at once, and not written to disk.
 *
 * The split from `commitAppVolume` is what keeps a drag smooth: a `step={0.01}`
 * slider fires a hundred times across its travel, and a hundred synchronous
 * writes to local storage during a gesture is work nobody asked for.
 */
export const setAppVolume = (next: number): void => {
  // Nothing, rather than unity. A missing stored value falls back to full
  // scale because that is where a fresh element sits; a garbage value arriving
  // at the SETTER is a different thing, and answering it with full volume
  // would be the app shouting at somebody who moved a fader.
  if (!Number.isFinite(next)) {
    return;
  }
  const level = clampAppVolume(next);
  if (level === volume) {
    return;
  }
  volume = level;
  listeners.forEach((listener) => listener());
};

/** Remember it. Called when a gesture ends, not while it runs. */
export const commitAppVolume = (): void => {
  try {
    window.localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    // Same as reading: it simply will not be there next time.
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The level, for a component that has to redraw when it moves. */
export const useAppVolume = (): number =>
  useSyncExternalStore(subscribe, getAppVolume, getAppVolume);
