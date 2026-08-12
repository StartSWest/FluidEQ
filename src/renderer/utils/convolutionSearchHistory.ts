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

export const CONVOLUTION_SEARCH_HISTORY_STORAGE_KEY =
  'fluideq.convolutionSearchHistory';
export const MAX_CONVOLUTION_SEARCH_HISTORY = 20;

const listeners = new Set<() => void>();

const readStored = (): string[] => {
  try {
    const raw = window.localStorage.getItem(
      CONVOLUTION_SEARCH_HISTORY_STORAGE_KEY,
    );
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
      .slice(0, MAX_CONVOLUTION_SEARCH_HISTORY);
  } catch {
    return [];
  }
};

let history = readStored();

const publish = (next: string[]) => {
  history = next;
  try {
    window.localStorage.setItem(
      CONVOLUTION_SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(history),
    );
  } catch {
    // Searching remains available when persistent renderer storage is not.
  }
  listeners.forEach((listener) => listener());
};

export const addConvolutionSearchToHistory = (term: string) => {
  const next = rememberSearch(history, term).slice(
    0,
    MAX_CONVOLUTION_SEARCH_HISTORY,
  );
  if (
    next.length === history.length &&
    next.every((entry, index) => entry === history[index])
  ) {
    return;
  }
  publish(next);
};

export const clearConvolutionSearchHistory = () => {
  if (history.length > 0) {
    publish([]);
  }
};

export const getConvolutionSearchHistory = () => history;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const EMPTY: string[] = [];

export const useConvolutionSearchHistory = () =>
  useSyncExternalStore(
    subscribe,
    () => history,
    () => EMPTY,
  );
