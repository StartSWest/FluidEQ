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
 * - **The player for legacy Library playback.** An installed engine without
 *   source-analysis readiness keeps the same player processing. An engine
 *   that explicitly acknowledges the prepared source can own Library DSP on
 *   each output instead. That choice is made with the transport stopped;
 *   a status arriving during a song cannot move its rack mid-passage.
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
   * FluidEQ's switch has been read from what was saved. Until then
   * `eqEnabled` is only the default, and a launch that sent the engine a
   * rack on that default played the rack for a moment on a machine whose
   * FluidEQ was saved off.
   */
  eqLoaded: boolean;
  /**
   * The FluidEQ Engine is not running on the output being listened to —
   * what the red "isn't running" notice says (`engineTrouble`).
   */
  engineOff: boolean;
  /** The Library player is playing through its own engine right now. */
  libraryAudible: boolean;
  /** Latched only at a stopped transport boundary after native capability. */
  librarySourceReady?: boolean;
  /**
   * This computer's sound is going to another computer (Share Audio). Main
   * then holds the Library player untouched, because the capture for the
   * network hears the player's output and the other computer applies its own
   * rack; the FluidEQ Engine's copy is never in that capture — Windows hands a
   * process loopback the mix before the endpoint's effects.
   */
  sendingRawAudio?: boolean;
}

export const OPEN_GATE: IRackGate = {
  engine: null,
  eqEnabled: true,
  eqLoaded: false,
  engineOff: false,
  libraryAudible: false,
};

/** Why the rack is off everywhere, or undefined when it is not. */
export type TRackSuspension = 'switched-off' | 'engine-off' | 'sharing-raw';

/**
 * Sending no longer switches the rack off under the FluidEQ Engine. It used
 * to, everywhere, so a computer sharing its sound could not hear its own DSP
 * at all — "when sending DSP can't be enabled and that's wrong" (Ivan,
 * 2026-10-02). Only the Library player has to be untouched while this
 * computer sends, and under the FluidEQ Engine the engine takes the rack over
 * for it (`engineRunsRack`). Under Equalizer APO the player is the only place
 * a rack runs, so there sending still suspends it.
 */
export const rackSuspension = (
  gate: IRackGate,
): TRackSuspension | undefined => {
  if (gate.engine !== 'fluid') {
    return gate.sendingRawAudio ? 'sharing-raw' : undefined;
  }
  if (!gate.eqEnabled) {
    return 'switched-off';
  }
  return gate.engineOff ? 'engine-off' : undefined;
};

/**
 * Whether the FluidEQ Engine's copy of the rack should run.
 *
 * FluidEQ's switch counts here whichever engine the window believes runs.
 * Main writes the engine's file only under the FluidEQ Engine and answers
 * `'not-fluid'` otherwise, so under Equalizer APO this copy goes nowhere —
 * but a window whose engine status never arrived must not take that as
 * leave to send a rack FluidEQ is switched off for. And nothing runs before
 * the switch has been read at all.
 */
export const engineRunsRack = (gate: IRackGate): boolean =>
  gate.eqLoaded &&
  gate.eqEnabled &&
  !gate.engineOff &&
  // While this computer sends, the Library player plays untouched and the
  // engine runs the rack over it too: still exactly one place.
  (!gate.libraryAudible ||
    gate.sendingRawAudio === true ||
    gate.librarySourceReady === true);

/** Whether the Library player's copy of the rack should run. */
export const playerRunsRack = (gate: IRackGate): boolean =>
  rackSuspension(gate) === undefined &&
  gate.sendingRawAudio !== true &&
  !(gate.engine === 'fluid' && gate.librarySourceReady === true);

/** Whether the FluidEQ Engine's copy is the one playing, so its meters are
 * the page's. */
export const engineOwnsRack = (gate: IRackGate): boolean =>
  gate.engine === 'fluid' &&
  (!gate.libraryAudible ||
    gate.sendingRawAudio === true ||
    gate.librarySourceReady === true);

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
