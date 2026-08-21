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

import { useSyncExternalStore } from 'react';

/**
 * The space the bar keeps for whichever tab is driving it.
 *
 * One wrapper for the whole app, and the controls inside it change with the
 * tab — a karaoke transport has mix faders, jumps and a pitch tone, and
 * reducing it to a play button on the way into a shared bar would take those
 * away from the one tab that has them.
 *
 * The tab renders its own controls into this node with a portal. The obvious
 * alternative — putting the rendered element into the transport description —
 * cannot work: the element is new on every render, so publishing it notifies
 * the bar, which re-renders the app, which rebuilds the element, which
 * publishes again. This way the element stays where it is built and only the
 * DOM node it lands in travels.
 */
let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

/** The bar's own ref callback. */
export const setTransportSlot = (element: HTMLElement | null): void => {
  if (slot === element) {
    return;
  }
  slot = element;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Where to portal a tab's transport, or nothing while the bar is not
 * offering the space — which is every tab that is not driving it. */
export const useTransportSlot = (): HTMLElement | null =>
  useSyncExternalStore(
    subscribe,
    () => slot,
    () => null,
  );
