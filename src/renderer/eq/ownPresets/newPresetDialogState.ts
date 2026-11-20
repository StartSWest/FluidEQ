/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * Whether New preset's dialog is up. Two things open it — the word among the
 * Preset tab's tools and the tile at the head of Yours — from two subtrees,
 * and one dialog answers both (`EqPageView`).
 */
type TListener = () => void;
const listeners = new Set<TListener>();
let isOpen = false;

const set = (next: boolean) => {
  if (isOpen !== next) {
    isOpen = next;
    listeners.forEach((listener) => listener());
  }
};

export const openNewPresetDialog = () => set(true);
export const closeNewPresetDialog = () => set(false);

const subscribe = (listener: TListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const read = () => isOpen;

export const useNewPresetDialogOpen = (): boolean =>
  useSyncExternalStore(subscribe, read, read);
