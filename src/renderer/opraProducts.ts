/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IOpraProduct } from 'common/constants';
import { OPRA_UPDATED_EVENT } from './components/OpraLibraryStatus';
import { getOpraProductList } from './utils/equalizerApi';

/**
 * The OPRA library's products, read once for the window rather than once per
 * visit.
 *
 * The picker asked main for the whole index — 6,229 products and every
 * curve's name, about 2.1 MB over IPC — each time Presets was opened, and
 * again each time the applied headset changed, for a list that changes only
 * when the library on disk is replaced. That happens two ways, and both are
 * heard here whether or not the picker is on screen, because a list kept
 * across visits that missed one would show the library as it was before:
 * the update button in the page heading (`OPRA_UPDATED_EVENT`) and the sync
 * at launch (`databases-synced`).
 */

let known: IOpraProduct[] | undefined;
let asking: Promise<IOpraProduct[]> | undefined;
/**
 * Bumped when the library is replaced, so an answer read before that cannot
 * be kept after it.
 */
let generation = 0;
let stopListening: (() => void) | undefined;
const listeners = new Set<() => void>();

const forget = () => {
  generation += 1;
  known = undefined;
  asking = undefined;
  listeners.forEach((listener) => listener());
};

const listenForReplacement = () => {
  if (stopListening) {
    return;
  }
  window.addEventListener(OPRA_UPDATED_EVENT, forget);
  const stopSync = window.electron?.ipcRenderer.on('databases-synced', forget);
  stopListening = () => {
    window.removeEventListener(OPRA_UPDATED_EVENT, forget);
    stopSync?.();
  };
};

/** The products this window has already read, if it has. */
export const knownOpraProducts = (): IOpraProduct[] | undefined => known;

/**
 * One read from main. A failure is the caller's to report; here it only
 * clears the way for the next visit to ask again.
 */
const readProducts = async (askedIn: number): Promise<IOpraProduct[]> => {
  try {
    const products = await getOpraProductList();
    if (askedIn === generation) {
      known = products;
    }
    return products;
  } finally {
    if (askedIn === generation) {
      asking = undefined;
    }
  }
};

/**
 * The products, from main only when this window does not hold them yet.
 * Callers asking while a read is on its way share it.
 */
export const loadOpraProducts = (): Promise<IOpraProduct[]> => {
  listenForReplacement();
  if (known) {
    return Promise.resolve(known);
  }
  asking ??= readProducts(generation);
  return asking;
};

/** Told when the library on disk has been replaced and the list dropped. */
export const subscribeOpraProducts = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** For a test that wants a window that has read nothing and heard nothing. */
export const resetOpraProducts = (): void => {
  stopListening?.();
  stopListening = undefined;
  generation += 1;
  known = undefined;
  asking = undefined;
};
