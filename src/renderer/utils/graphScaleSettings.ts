/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  DEFAULT_GRAPH_TILT,
  isGraphTilt,
  type TGraphTilt,
} from 'common/graphAnalysis';
import {
  DEFAULT_GRAPH_FREQUENCY_RANGE,
  isGraphFrequencyRange,
  type TGraphFrequencyRange,
} from '../graph/graphFrequencyRanges';
import { VIEW_KEYS, readStored, writeStored } from './graphStorage';

/**
 * The graph's scale: which frequencies the plot spans, and how far the
 * analyser's spectrum is tipped up toward the treble. Both in the View menu,
 * side by side (Ivan, 2026-11-16: "in the new graph frequency modes show the
 * slopes too, because we have that pretty hidden inside the graph's look
 * settings").
 *
 * One value each for the whole window, never one per view like the grid: a
 * scale is how a measurement is read, and a reading that changed its axis on
 * the way into full screen would be read wrong. The orientation is flat for
 * the same reason (`graphWaveOrientation.ts`).
 *
 * The slope used to belong to each look's tuning, set in the look designer,
 * so it changed whenever the look did and was found by nobody. A look saved
 * with one is read without it.
 */

const createFlatChoice = <T>(
  key: string,
  parse: (raw: string) => T | undefined,
  fallback: T,
) => {
  const stored = readStored(key);
  let value: T = (stored === null ? undefined : parse(stored)) ?? fallback;
  const listeners = new Set<() => void>();
  const get = () => value;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const set = (next: T) => {
    if (next === value) {
      return;
    }
    value = next;
    writeStored(key, String(next));
    listeners.forEach((listener) => listener());
  };
  const use = () => useSyncExternalStore(subscribe, get, () => fallback);
  return { get, set, use };
};

const frequencyRange = createFlatChoice<TGraphFrequencyRange>(
  VIEW_KEYS.frequencyRange,
  (raw) => (isGraphFrequencyRange(raw) ? raw : undefined),
  DEFAULT_GRAPH_FREQUENCY_RANGE,
);

const analyserSlope = createFlatChoice<TGraphTilt>(
  VIEW_KEYS.analyserSlope,
  (raw) => {
    const parsed = Number(raw);
    return isGraphTilt(parsed) ? parsed : undefined;
  },
  DEFAULT_GRAPH_TILT,
);

export const useGraphFrequencyRange = frequencyRange.use;
export const setGraphFrequencyRange = frequencyRange.set;

export const useGraphAnalyserSlope = analyserSlope.use;
export const setGraphAnalyserSlope = analyserSlope.set;
/** Read on every frame the analyser draws, outside React. */
export const getGraphAnalyserSlope = analyserSlope.get;
