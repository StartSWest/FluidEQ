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
  normalizeCustomLook,
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

/**
 * The look being built but not yet saved.
 *
 * Kept because losing it is worse than the thing not keeping it avoids. The
 * original reasoning was that an unsaved draft outliving a restart is a look
 * somebody cannot find in the picker and cannot get rid of — but that only
 * bites if the draft comes back on its own, and it does not: it is read when
 * the panel is opened, and both ways of leaving the panel clear it. Save keeps
 * the look properly; Close is an explicit discard.
 *
 * What is left is exactly the case worth surviving — a reload, a crash, a
 * restart in the middle of mixing a ramp — where the alternative is doing it
 * all again from memory.
 */
const DRAFT_KEY = 'fluideq.lookDraft';

export const readLookDraft = (): ICustomLook | null => {
  try {
    const stored = window.localStorage.getItem(DRAFT_KEY);
    // Through the same validation a saved look gets. It was written by a build
    // that may not be this one, and a draft is no more trustworthy than the
    // list.
    return stored ? normalizeCustomLook(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
};

export const writeLookDraft = (look: ICustomLook): void => {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(look));
  } catch {
    // Not worth failing a slider drag over.
  }
};

export const clearLookDraft = (): void => {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do; the next open validates whatever is there anyway.
  }
};
