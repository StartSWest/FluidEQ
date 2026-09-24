/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { IPresetTone } from '../../common/dsp/chainWire';
import { samePresetTone } from '../../common/dsp/presetTone';

/**
 * The curve the Preset layer plays after the rack, for both copies of the
 * rack to limit through (`presetTone.ts`).
 *
 * Kept outside React for the reason the rack's settings are (`store.ts`): the
 * window's state is where the curve can be read (`PresetToneFeed`), and the
 * two senders of the rack live elsewhere — the store for the engine's copy,
 * the Library player for its own. Nothing is kept while no preset's curve
 * plays, which is what an absent curve on the wire means.
 */

let tone: IPresetTone | undefined;
const listeners = new Set<() => void>();

export const readPresetTone = (): IPresetTone | undefined => tone;

/** Changes the curve; true when what the wire carries actually moved. */
export const updatePresetTone = (next: IPresetTone | undefined): boolean => {
  if (samePresetTone(tone, next)) {
    return false;
  }
  tone = next;
  listeners.forEach((listener) => listener());
  return true;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePresetTone = (): IPresetTone | undefined =>
  useSyncExternalStore(subscribe, readPresetTone, readPresetTone);

/** For a test that wants a clean module between cases. */
export const resetPresetTone = (): void => {
  tone = undefined;
  listeners.clear();
};
