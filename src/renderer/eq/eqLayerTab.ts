/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from '../utils/graphStyle';

/**
 * The EQ page's three tabs under its graph (Ivan, 2026-11-16, "One pane,
 * inset cards": "EQ page: graph, divider, then three tabs"): the bands, the
 * preset, the Tone. One page per tab, all of them the same sound; which one
 * is open is remembered between visits and launches.
 */
export type TEqLayerTab = 'bands' | 'preset' | 'tone';

export const EQ_LAYER_TABS: readonly TEqLayerTab[] = [
  'bands',
  'preset',
  'tone',
];

const TAB_KEY = 'fluideq.eqLayerTab';

const isLayerTab = (value: string | null): value is TEqLayerTab =>
  EQ_LAYER_TABS.some((tab) => tab === value);

const readTab = (): TEqLayerTab => {
  const stored = readStored(TAB_KEY);
  return isLayerTab(stored) ? stored : 'bands';
};

let tab: TEqLayerTab = readTab();
const tabListeners = new Set<() => void>();

const subscribeTab = (listener: () => void) => {
  tabListeners.add(listener);
  return () => {
    tabListeners.delete(listener);
  };
};

export const setEqLayerTab = (next: TEqLayerTab) => {
  if (next === tab) {
    return;
  }
  tab = next;
  writeStored(TAB_KEY, next);
  tabListeners.forEach((listener) => listener());
};

const readTabNow = () => tab;
const serverTab = (): TEqLayerTab => 'bands';

export const useEqLayerTab = () =>
  useSyncExternalStore(subscribeTab, readTabNow, serverTab);

/**
 * What the Preset tab's search field holds. The field stands in the tab
 * row's tools and the list it narrows in the tab's own page, so the two
 * share it here. Not remembered: a search is a question asked now.
 */
let presetQuery = '';
const queryListeners = new Set<() => void>();

const subscribeQuery = (listener: () => void) => {
  queryListeners.add(listener);
  return () => {
    queryListeners.delete(listener);
  };
};

export const setEqPresetQuery = (next: string) => {
  if (next === presetQuery) {
    return;
  }
  presetQuery = next;
  queryListeners.forEach((listener) => listener());
};

const readQueryNow = () => presetQuery;
const serverQuery = () => '';

export const useEqPresetQuery = () =>
  useSyncExternalStore(subscribeQuery, readQueryNow, serverQuery);
