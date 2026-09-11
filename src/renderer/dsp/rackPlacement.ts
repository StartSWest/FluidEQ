/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { TAudioEngine } from '../../common/audioEngine';
import type { IDspSettings } from '../../common/dsp/chain';

/**
 * Where the DSP rack runs — once, or not at all.
 *
 * The rack has two places it can run: the Library player's own engine, on
 * what the Library plays, and the FluidEQ Engine inside Windows' audio
 * service, on everything. Under the FluidEQ Engine both used to run it, so
 * every track the Library played went through the rack twice — the player
 * applied it, and the engine applied it again to the player's output. Bass
 * boosted twice, the maximizer driven twice, and nothing on screen said so.
 *
 * So under the FluidEQ Engine exactly one of them runs it at a time:
 *
 * - **The player, while the Library is playing.** Its track-level stages —
 *   the loudness normalizer, Denoise's measured floor, the LUFS makeup — need
 *   the track's own analysis, which only the player has; it is also the one
 *   that feeds this page's live meters. Starting Library playback pauses the
 *   rest of the machine, so while it plays it is the sound.
 * - **The engine, the rest of the time**, on every output.
 * - **Nowhere, while the engine is off** — FluidEQ switched off, or the
 *   engine not running on the output that is playing. Under the FluidEQ
 *   Engine the rack is part of the engine, and a switch that turned the EQ off
 *   left the rack playing on everything.
 *
 * Under Equalizer APO none of this applies: the rack only ever existed inside
 * the Library player there, and FluidEQ's switch is about APO's EQ.
 */

export interface IRackGate {
  /** Which engine carries the audio; null until one has been chosen. */
  engine: TAudioEngine | null;
  /** FluidEQ's own on/off switch. */
  eqEnabled: boolean;
  /**
   * The FluidEQ Engine is not running on the output being listened to —
   * what the red "isn't running" notice says (`engineTrouble`).
   */
  engineOff: boolean;
  /** The Library player is playing through its own engine right now. */
  libraryAudible: boolean;
}

export const OPEN_GATE: IRackGate = {
  engine: null,
  eqEnabled: true,
  engineOff: false,
  libraryAudible: false,
};

/** Why the rack is off everywhere, or undefined when it is not. */
export type TRackSuspension = 'switched-off' | 'engine-off';

export const rackSuspension = (
  gate: IRackGate,
): TRackSuspension | undefined => {
  if (gate.engine !== 'fluid') {
    return undefined;
  }
  if (!gate.eqEnabled) {
    return 'switched-off';
  }
  return gate.engineOff ? 'engine-off' : undefined;
};

/**
 * Whether the FluidEQ Engine's copy of the rack should run.
 *
 * Not conditioned on the engine being the FluidEQ Engine: main only writes
 * the rack file under it and answers `'not-fluid'` otherwise, and a gate not
 * yet told which engine runs must send what it always sent rather than a rack
 * switched off for no reason.
 */
export const engineRunsRack = (gate: IRackGate): boolean =>
  rackSuspension(gate) === undefined && !gate.libraryAudible;

/** Whether the Library player's copy of the rack should run. */
export const playerRunsRack = (gate: IRackGate): boolean =>
  rackSuspension(gate) === undefined;

/**
 * The settings as one place should run them: as they are where the rack
 * belongs, and switched off at the root everywhere else. Only the root — the
 * stages underneath keep what the page shows, so the rack comes back exactly
 * as it was when its place does.
 */
export const rackFor = (settings: IDspSettings, runs: boolean): IDspSettings =>
  runs || !settings.enabled ? settings : { ...settings, enabled: false };

let gate: IRackGate = OPEN_GATE;
const listeners = new Set<() => void>();

export const readRackGate = (): IRackGate => gate;

/** Changes the gate; true when anything actually moved. */
export const updateRackGate = (patch: Partial<IRackGate>): boolean => {
  const next = { ...gate, ...patch };
  if (
    next.engine === gate.engine &&
    next.eqEnabled === gate.eqEnabled &&
    next.engineOff === gate.engineOff &&
    next.libraryAudible === gate.libraryAudible
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

/** For a test that wants a clean module between cases. */
export const resetRackGate = (): void => {
  gate = OPEN_GATE;
  listeners.clear();
};
