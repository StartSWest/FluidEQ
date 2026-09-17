/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * Whether this computer is running on its battery, from the browser's own
 * battery status, told by its event — never asked again on a clock.
 *
 * Unknown until the first answer arrives, and false on a desktop with no
 * battery at all, which the API reports as charging with no time to full.
 * Read by the scene runner to hold the display frame rate to sixty on
 * battery, and by the View menu to say so.
 */

interface IBatteryLike extends EventTarget {
  charging: boolean;
}

interface INavigatorWithBattery {
  getBattery?: () => Promise<IBatteryLike>;
}

let onBattery = false;
let watched = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const watch = () => {
  if (watched) {
    return;
  }
  watched = true;
  const { getBattery } = navigator as INavigatorWithBattery;
  if (typeof getBattery !== 'function') {
    return;
  }
  getBattery
    .call(navigator)
    .then((battery) => {
      const read = () => {
        const next = !battery.charging;
        if (next !== onBattery) {
          onBattery = next;
          notify();
        }
      };
      battery.addEventListener('chargingchange', read);
      read();
      return undefined;
    })
    .catch(() => {
      // No battery status here: mains, as far as anything can tell.
    });
};

export const isOnBattery = (): boolean => {
  watch();
  return onBattery;
};

export const subscribeBattery = (listener: () => void): (() => void) => {
  watch();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useOnBattery = (): boolean =>
  useSyncExternalStore(subscribeBattery, isOnBattery);

/** For a test: pretend the machine is on battery, or not, without a browser. */
export const setOnBatteryForTesting = (value: boolean) => {
  watched = true;
  if (value !== onBattery) {
    onBattery = value;
    notify();
  }
};
