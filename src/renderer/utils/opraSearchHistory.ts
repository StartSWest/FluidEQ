/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { useSyncExternalStore } from 'react';
import { rememberSearch } from 'common/searchHistory';

/**
 * Deliberately still the AutoEq-era key.
 *
 * What is stored is the text somebody typed into the model search — "hd 650",
 * "airpods" — which means exactly as much against OPRA's catalogue as it did
 * against AutoEq's. Renaming the key would quietly empty the recent-search list
 * of every existing user in exchange for a tidier string that nobody sees.
 */
export const OPRA_SEARCH_HISTORY_STORAGE_KEY =
  'fluideq.autoEqModelSearchHistory';
export const MAX_OPRA_SEARCH_HISTORY = 20;

const listeners = new Set<() => void>();

const readStored = (): string[] => {
  try {
    const raw = window.localStorage.getItem(OPRA_SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim().length > 0,
      )
      .slice(0, MAX_OPRA_SEARCH_HISTORY);
  } catch {
    return [];
  }
};

let history = readStored();

const publish = (next: string[]) => {
  history = next;
  try {
    window.localStorage.setItem(
      OPRA_SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(history),
    );
  } catch {
    // A restricted renderer may not expose storage. Searching still works;
    // only the next-session shortcut is unavailable.
  }
  listeners.forEach((listener) => listener());
};

export const addOpraSearchToHistory = (term: string) => {
  const next = rememberSearch(history, term).slice(0, MAX_OPRA_SEARCH_HISTORY);
  if (
    next.length === history.length &&
    next.every((entry, index) => entry === history[index])
  ) {
    return;
  }
  publish(next);
};

export const clearOpraSearchHistory = () => {
  if (history.length > 0) {
    publish([]);
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const EMPTY: string[] = [];

export const getOpraSearchHistory = () => history;

export const useOpraSearchHistory = () =>
  useSyncExternalStore(
    subscribe,
    () => history,
    () => EMPTY,
  );
