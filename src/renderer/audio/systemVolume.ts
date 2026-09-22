/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useSyncExternalStore } from 'react';
import {
  ISystemVolume,
  SYSTEM_VOLUME_CHANGED,
  SYSTEM_VOLUME_CHANNEL,
} from 'common/systemVolume';

/**
 * The system volume, as main hears it from Windows (`main/systemVolume.ts`).
 *
 * `undefined` until the first answer, `null` when there is no output to
 * control. Main runs the helper behind it only while something here is
 * watching, and every reader shares the one watch.
 */
let volume: ISystemVolume | null | undefined;
const listeners = new Set<() => void>();
let watchers = 0;
let stopListening: (() => void) | undefined;

const notify = () => listeners.forEach((listener) => listener());

const isVolume = (value: unknown): value is ISystemVolume =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ISystemVolume).level === 'number' &&
  typeof (value as ISystemVolume).isMuted === 'boolean';

const ask = (args: unknown[]) => {
  const bridge = window.electron?.ipcRenderer;
  if (typeof bridge?.sendMessage === 'function') {
    bridge.sendMessage(SYSTEM_VOLUME_CHANNEL, args);
  }
};

const startWatching = () => {
  const bridge = window.electron?.ipcRenderer;
  // No bridge that can carry the answer — a page outside Electron, or a test
  // with a bridge that has only the calls it exercises — is a machine whose
  // volume cannot be read: say so, rather than throw from inside a render.
  if (
    typeof bridge?.on !== 'function' ||
    typeof bridge.sendMessage !== 'function'
  ) {
    volume = null;
    notify();
    return;
  }
  stopListening = bridge.on(SYSTEM_VOLUME_CHANGED, (...args: unknown[]) => {
    volume = isVolume(args[0]) ? args[0] : null;
    notify();
  });
  ask(['watch', true]);
};

const stopWatching = () => {
  ask(['watch', false]);
  stopListening?.();
  stopListening = undefined;
  volume = undefined;
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The system volume while `isWanted`, followed as it changes anywhere. */
export const useSystemVolume = (isWanted: boolean) => {
  useEffect(() => {
    if (!isWanted) {
      return undefined;
    }
    watchers += 1;
    if (watchers === 1) {
      startWatching();
    }
    return () => {
      watchers -= 1;
      if (watchers === 0) {
        stopWatching();
      }
    };
  }, [isWanted]);
  return useSyncExternalStore(subscribe, () => volume);
};

/**
 * Set the level. Drawn at once, so a slider being dragged does not wait on
 * Windows; Windows' own answer follows and is what stays.
 */
export const setSystemVolume = (level: number) => {
  if (volume) {
    volume = { ...volume, level };
    notify();
  }
  ask(['set', level]);
};

export const setSystemMute = (isMuted: boolean) => ask(['mute', isMuted]);

/**
 * THE ONE FADER IN THIS APP, and it is the computer's.
 *
 * Every player FluidEQ has — the Library, the Media tab's page, karaoke,
 * another machine's audio — plays at full level, and the fader drawn beside
 * any of them moves the system volume (Ivan, 2026-09-22: "we never control
 * file volume in the Library, always 100%, and then we control the system
 * volume"). There used to be a level of the app's own under the system's,
 * remembered per launch, and two faders for one sound is one too many: the
 * app's sat under the taskbar's, so a quiet song was quiet twice and nobody
 * could say from which.
 *
 * `level` and `isMuted` are what Windows reports; both are `undefined` until
 * the helper answers and `isAvailable` is false where there is no helper to
 * ask (any platform but Windows), in which case a bar draws no fader at all
 * rather than one that moves nothing. Muting restores to the level muted
 * from, which is Windows' own behaviour for its mute.
 */
export const useSystemFader = () => {
  const reading = useSystemVolume(true);
  return {
    isAvailable: reading !== null,
    level: reading?.level,
    isMuted: reading?.isMuted ?? false,
    setLevel: setSystemVolume,
    toggleMute: () => setSystemMute(!(reading?.isMuted ?? false)),
  };
};
