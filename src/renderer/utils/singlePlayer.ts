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
 * Whether one player at a time means the whole machine.
 *
 * Inside the app it is not a question: three players sharing one pair of
 * speakers is a fault, and `playbackOwner` has always allowed exactly one.
 * Outside it depends on the setup, which is why this is a switch and not a
 * rule. A single output — the ordinary case — makes a browser tab over a
 * library song two things at once through one curve, and stopping one of them
 * is what anybody would want. Two outputs makes it somebody deliberately
 * playing different things in different rooms, and stopping either is the app
 * breaking a setup it does not understand.
 *
 * IT LIVES WITH THE OUTPUTS, in "Plays in two places", because that is the
 * card where the second output is chosen and therefore the screen where this
 * question arises at all.
 *
 * Windows does publish enough to answer it without asking: `IMMDeviceEnumerator`
 * to `IAudioSessionManager2` gives the sessions on each endpoint and the
 * process behind each one. It is not reachable from here — no WinRT
 * projection, so it is COM interop in C#, and the process it reports still has
 * to be matched to a media session that publishes only an app id. A switch
 * answers the same question exactly, and the day the detection is worth
 * writing, this is where its answer would go.
 *
 * On by default: it is the behaviour for one output, and one output is what
 * almost every machine has.
 */

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'fluideq.singlePlayer';

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const read = (): boolean => {
  try {
    // Anything but an explicit "off" is on, so a machine with no storage at
    // all still behaves the way the default says.
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
};

let enabled = read();

/** Whether starting a player should silence whatever else is playing. */
export const isSinglePlayerEnabled = (): boolean => enabled;

export const setSinglePlayer = (next: boolean): void => {
  if (next === enabled) {
    return;
  }
  enabled = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
  } catch {
    // Storage can be unavailable. The setting then lasts as long as the
    // window, which is better than refusing to change it at all.
  }
  emit();
};

export const useSinglePlayer = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => enabled,
    () => true,
  );
