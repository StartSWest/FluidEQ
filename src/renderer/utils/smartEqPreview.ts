/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

/**
 * Smart correction's life for one song: measure, settle, hold (Ivan,
 * 2026-11-20, Direction D of the curve mockup).
 *
 * - `listening`: the tap is open and the curve is forming on the graph from
 *   every checkpoint, written nowhere. The last song's correction keeps
 *   playing.
 * - `settling`: everything the record will give has been heard; waiting on
 *   the estimate to stand still (`CONVERGENCE_HOLDS`).
 * - `held`: written once, the tap closed, nothing measured until the next
 *   song or a press of Measure again.
 * - `idle`: nothing running.
 */
export type TSmartEqPhase = 'idle' | 'listening' | 'settling' | 'held';

/** What the hold did with what it heard. */
export type TSmartEqHeldOutcome = 'written' | 'unchanged' | 'short';

/** One range as the forming curve is drawn from it. */
export interface ISmartEqPreviewRegion {
  label: string;
  lowFrequency: number;
  highFrequency: number;
  centreFrequency: number;
  /** 0..1: how near the range's dust has gathered onto the line. */
  confidence: number;
  isCovered: boolean;
  /** The range's level now and its typical level, for the bars' tint. */
  liveDb: number;
  typicalDb: number;
}

export interface ISmartEqPreview {
  phase: TSmartEqPhase;
  /** Music heard of this song, holds included, for "Listening · 3 s". */
  heardMs: number;
  isSilent: boolean;
  /**
   * The correction as it stands, by band id, at the layer's strength — what
   * would be written now. Absent until the measurement can support a curve
   * at all (a four-octave trusted span), when the dust waits around 0 dB.
   */
  gains?: Readonly<Record<string, number>>;
  /** Low to high, for the dust, the foot's bars and the panel's bar. */
  regions: readonly ISmartEqPreviewRegion[];
  meanCoverage: number;
  /** Ranges the held record never reached, which the hold left alone. */
  missing: readonly string[];
  /** Counted up at every hold, so the graph plays its arrival once each. */
  holdId: number;
  outcome?: TSmartEqHeldOutcome;
}

// Every optional field named, at undefined: `publishSmartEqPreview` merges,
// and a field this left out would carry the last song's curve into the next.
const IDLE: ISmartEqPreview = {
  phase: 'idle',
  heardMs: 0,
  isSilent: false,
  gains: undefined,
  outcome: undefined,
  regions: [],
  meanCoverage: 0,
  missing: [],
  holdId: 0,
};

let preview: ISmartEqPreview = IDLE;
const listeners = new Set<() => void>();

export const getSmartEqPreview = (): ISmartEqPreview => preview;

export const subscribeSmartEqPreview = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const publishSmartEqPreview = (next: Partial<ISmartEqPreview>) => {
  preview = { ...preview, ...next };
  listeners.forEach((listener) => listener());
};

/** A new song, a new session or Measure again: nothing heard yet. */
export const startSmartEqPreview = () =>
  publishSmartEqPreview({
    ...IDLE,
    phase: 'listening',
    holdId: preview.holdId,
  });

export const endSmartEqPreview = () => {
  if (preview.phase === 'idle') {
    return;
  }
  publishSmartEqPreview({ ...IDLE, holdId: preview.holdId });
};

export const useSmartEqPreview = (): ISmartEqPreview =>
  useSyncExternalStore(
    subscribeSmartEqPreview,
    getSmartEqPreview,
    getSmartEqPreview,
  );

/**
 * The phase alone, for what only needs to know whether a measurement is
 * running: re-renders at a change of phase, not twice a second.
 */
export const useSmartEqPhase = (): TSmartEqPhase =>
  useSyncExternalStore(
    subscribeSmartEqPreview,
    () => preview.phase,
    () => preview.phase,
  );

/* --- Measure again --- */

let remeasures = 0;
const remeasureListeners = new Set<() => void>();

/** The held song heard again from nothing, on a new tap. */
export const requestSmartEqRemeasure = () => {
  remeasures += 1;
  remeasureListeners.forEach((listener) => listener());
};

export const useSmartEqRemeasures = (): number =>
  useSyncExternalStore(
    (listener: () => void) => {
      remeasureListeners.add(listener);
      return () => {
        remeasureListeners.delete(listener);
      };
    },
    () => remeasures,
    () => 0,
  );
