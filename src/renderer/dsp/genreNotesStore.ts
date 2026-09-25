/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * Which genre's notes are open, if any, opened from wherever a genre is named.
 *
 * Four places open them — the preset menus' preview, the DSP page's About,
 * the Preset chip on the equaliser and the pins on its graph — and two of
 * those live in menus that close when something in them is pressed, taking
 * any dialog they own with them. So the dialog belongs to one host in
 * `App.tsx` (`GenreNotesHost`), the way the desktop background's dialogs do.
 */
let current: string | undefined;
const listeners = new Set<() => void>();

const show = (chainId: string | undefined) => {
  current = chainId;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Opens a genre's notes by the id its chain is picked under. */
export const openGenreNotes = (chainId: string) => show(chainId);

export const closeGenreNotes = () => show(undefined);

export const useOpenGenreNotes = (): string | undefined =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
