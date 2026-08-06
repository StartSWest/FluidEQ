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
 * Which layers are switched off without being thrown away.
 *
 * The whole of A/B testing: a correction is either an improvement or it is not,
 * and the only way to know is to hear the same passage both ways within a few
 * seconds of itself. Removing the layer and applying it again is not that —
 * Smart EQ takes half a minute to measure, and a voicing you have cleared is a
 * voicing you have to go and find.
 *
 * Off means off in the config and present in the interface: the chip stays,
 * dimmed, and pressing it again writes the same settings back. Nothing is
 * recomputed, because nothing was lost.
 *
 * Held for the session only, and that is a deliberate limit rather than an
 * oversight. FluidEQ reads the Equalizer APO config back as the source of truth
 * when it starts, and a bypassed layer is by definition not in that config —
 * so persisting this would mean two places disagreeing about what is applied,
 * which is the one thing the config-as-truth rule exists to prevent. Comparing
 * two versions of a sound is something done in one sitting anyway.
 */

import { useSyncExternalStore } from 'react';

/** Stashed settings, by the same key the chip uses. */
const stash = new Map<string, unknown>();

const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * A new object per change, never mutated in place.
 *
 * `useSyncExternalStore` compares snapshots by identity and will loop forever
 * on a getter that builds a fresh value every call, so the snapshot is built
 * once per change and handed out unchanged in between.
 */
let snapshot: Readonly<Record<string, unknown>> = {};

const publish = () => {
  snapshot = Object.fromEntries(stash);
  emit();
};

/** Put a layer aside. The value is whatever it takes to apply it again. */
export const bypassLayer = (key: string, settings: unknown) => {
  stash.set(key, settings);
  publish();
};

/** Take it back out, and hand back what was stored. */
export const restoreLayer = (key: string): unknown => {
  const settings = stash.get(key);
  stash.delete(key);
  publish();
  return settings;
};

export const isLayerBypassed = (key: string) => stash.has(key);

/**
 * Forget a bypassed layer without applying it.
 *
 * For the X on the chip: somebody who removes a layer they had switched off
 * means it gone, not restored, and leaving the stash behind would make the next
 * layer under the same key come back wearing the old one's settings.
 */
export const forgetBypassedLayer = (key: string) => {
  if (stash.delete(key)) {
    publish();
  }
};

export const useBypassedLayers = () =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
