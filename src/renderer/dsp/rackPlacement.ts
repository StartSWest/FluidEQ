/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's copy of where the rack runs (`common/dsp/rackPlacement.ts`
 * holds the rule): what the DSP page and the store read.
 */
import { useSyncExternalStore } from 'react';
import { IRackGate, OPEN_GATE } from '../../common/dsp/rackPlacement';

export {
  OPEN_GATE,
  engineOwnsRack,
  engineRunsRack,
  playerRunsRack,
  rackFor,
  rackSuspension,
} from '../../common/dsp/rackPlacement';
export type {
  IRackGate,
  TRackSuspension,
} from '../../common/dsp/rackPlacement';

let gate: IRackGate = OPEN_GATE;
const listeners = new Set<() => void>();

export const readRackGate = (): IRackGate => gate;

/** Changes the gate; true when anything actually moved. */
export const updateRackGate = (patch: Partial<IRackGate>): boolean => {
  const next = { ...gate, ...patch };
  if (
    next.engine === gate.engine &&
    next.eqEnabled === gate.eqEnabled &&
    next.eqLoaded === gate.eqLoaded &&
    next.engineOff === gate.engineOff &&
    next.libraryAudible === gate.libraryAudible &&
    next.librarySourceReady === gate.librarySourceReady &&
    next.sendingRawAudio === gate.sendingRawAudio
  ) {
    return false;
  }
  gate = next;
  listeners.forEach((listener) => listener());
  return true;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useRackGate = (): IRackGate =>
  useSyncExternalStore(subscribe, readRackGate, readRackGate);

/**
 * For a test that wants a clean module between cases, optionally from a state
 * the rest of the app would already have reached — FluidEQ's switch read.
 */
export const resetRackGate = (initial: Partial<IRackGate> = {}): void => {
  gate = { ...OPEN_GATE, ...initial };
  listeners.clear();
};
