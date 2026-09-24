/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TAudioEngine } from '../audioEngine';
import { engineAtLeast } from '../engineHealth';
import type { TTrebleDesign } from '../filterDesign';

/**
 * The first FluidEQ Engine that plays the rack EQ's Treble choice
 * (`IEqSettings.treble`; `native/system-apo/src/engine.rc`).
 *
 * The choice rides a slot every engine decodes and none before this one
 * reads, so an older engine plays the cookbook whatever the page says: the
 * page offers the choice, and draws Precise, only where it is heard. The
 * Library player's host is built with the app and always reads it.
 */
export const ENGINE_RACK_TREBLE_SINCE: readonly [number, number] = [1, 16];

export const engineTakesRackTreble = (
  dllVersion: string | undefined,
): boolean => engineAtLeast(dllVersion, ENGINE_RACK_TREBLE_SINCE);

/** Where the rack runs, as far as its Treble choice is concerned. */
export interface IRackTrebleContext {
  /** The engine chosen; null until one has been. */
  engine: TAudioEngine | null;
  /** The Library player is playing through its own host right now. */
  libraryAudible: boolean;
  /** The installed FluidEQ Engine's binary version, when known. */
  dllVersion: string | undefined;
}

/**
 * Whether the FluidEQ Engine's copy of the rack cannot play the choice.
 *
 * Only a FluidEQ Engine older than `ENGINE_RACK_TREBLE_SINCE`: under
 * Equalizer APO the rack lives in the Library player alone, and before an
 * engine is known there is nothing to say it cannot.
 */
export const rackTrebleNeedsEngineUpdate = ({
  engine,
  dllVersion,
}: IRackTrebleContext): boolean =>
  engine === 'fluid' &&
  dllVersion !== undefined &&
  !engineTakesRackTreble(dllVersion);

/**
 * Whether the rack's EQ plays its bands analog-matched right now: its choice
 * is Precise and whatever runs the rack reads it — the Library player's
 * host whenever the Library plays, and the engine otherwise.
 */
export const rackPlaysMatched = (
  treble: TTrebleDesign,
  context: IRackTrebleContext,
): boolean =>
  treble === 'precise' &&
  (context.libraryAudible || !rackTrebleNeedsEngineUpdate(context));
