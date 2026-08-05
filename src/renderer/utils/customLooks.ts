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

import { useSyncExternalStore } from 'react';
import {
  ICustomLook,
  MAX_CUSTOM_LOOKS,
  parseCustomLooks,
  serializeCustomLooks,
} from 'common/customLooks';

/**
 * The looks the user has made, held outside React.
 *
 * The same shape as the graph-style store beside it and for the same reason:
 * the panel that edits these sits in the graph's header and the thing that
 * draws them is a `Line` three components down, so a prop would have to be
 * threaded through every curve on the chart to reach one of them.
 *
 * In local storage rather than through the main process, because that is where
 * every other presentation preference already lives — the selected look, the
 * meter's style, whether the what's-new dialog has been seen. These are not
 * part of the EQ and have no business in the config the audio engine reads;
 * losing them costs somebody a few minutes with the sliders, which is the right
 * price for not adding an IPC round trip to a setting the graph reads at
 * startup.
 */
const STORAGE_KEY = 'fluideq-custom-looks';

let looks: readonly ICustomLook[] = [];

try {
  looks = parseCustomLooks(window.localStorage.getItem(STORAGE_KEY));
} catch {
  // Storage can be unavailable, and the built-in looks are a complete app.
}

const listeners = new Set<() => void>();

const persist = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeCustomLooks(looks));
  } catch {
    // Out of quota or no storage at all. The look still works for this
    // session, which is better than refusing to apply it.
  }
};

const publish = (next: readonly ICustomLook[]) => {
  looks = next;
  persist();
  listeners.forEach((listener) => listener());
};

export const getCustomLooks = (): readonly ICustomLook[] => looks;

export const getCustomLook = (id: string): ICustomLook | undefined =>
  looks.find((look) => look.id === id);

/**
 * Whether there is room for another.
 *
 * Asked by the panel so the save button can be disabled with a reason, rather
 * than accepting the click and silently keeping the list at fifty.
 */
export const isCustomLookListFull = (): boolean =>
  looks.length >= MAX_CUSTOM_LOOKS;

/**
 * Add a look, or replace the one with the same id.
 *
 * Replacing in place rather than removing and appending, so editing a look
 * leaves it where it was in the picker. A saved edit that sends the entry to
 * the bottom of a list of fifty is how somebody concludes their look was lost
 * and makes a second one.
 */
export const saveCustomLook = (look: ICustomLook): void => {
  const index = looks.findIndex((entry) => entry.id === look.id);
  if (index >= 0) {
    const next = looks.slice();
    next[index] = look;
    publish(next);
    return;
  }
  if (isCustomLookListFull()) {
    return;
  }
  publish([...looks, look]);
};

export const deleteCustomLook = (id: string): void => {
  const next = looks.filter((look) => look.id !== id);
  if (next.length !== looks.length) {
    publish(next);
  }
};

export const subscribeCustomLooks = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Frozen and shared, so the empty case is not a new array on every snapshot.
 *
 * `useSyncExternalStore` compares snapshots by identity, and a server snapshot
 * that mints `[]` each time it is asked is an infinite render.
 */
const NO_LOOKS: readonly ICustomLook[] = [];

export const useCustomLooks = (): readonly ICustomLook[] =>
  useSyncExternalStore(subscribeCustomLooks, getCustomLooks, () => NO_LOOKS);
