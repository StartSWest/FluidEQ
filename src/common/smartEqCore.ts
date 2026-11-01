/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IBalanceRegionReport } from './autoBalanceCapture';
import { type ISmartEqSettings, MAX_GAIN } from './constants';
import { type TPresenceOffsets, parsePresenceOffsets } from './presenceLines';
import { SMART_EQ_MAX_BOOST_DB } from './smartEqContinuous';
import { type TSmartEqMode, parseSmartEqMode } from './smartEqMode';

/**
 * Smart EQ between the window and the app's core, which measures and writes
 * (`main/smartEq/smartEqRunner.ts`): what the window shows of it, and the
 * settings the window keeps and hands over.
 */
export const SMART_EQ_CHANNEL = {
  /** Window to core: start the one-shot, or cancel the one running. */
  run: 'smart-eq-run',
  /** Window to core: cancel the one-shot running, if any. */
  cancel: 'smart-eq-cancel',
  /** Window to core: the state now, answered on `state`. */
  ask: 'smart-eq-ask',
  /** Window to core: an `ISmartEqCoreSettings`, whenever one changes. */
  settings: 'smart-eq-settings',
  /** Core to window: an `ISmartEqRunState`, whenever it changes. */
  state: 'smart-eq-state',
  /** Core to window: a sentence for the status bubble, said once. */
  remark: 'smart-eq-remark',
  /** Core to window: what the graph draws of the measurement running. */
  view: 'smart-eq-view',
  /** Core to window: an `ISmartEqWrote`, after the layer was written. */
  wrote: 'smart-eq-wrote',
} as const;

export interface ISmartEqRunState {
  /** Whether the one-shot is in progress, which is what the button says. */
  isRunning: boolean;
  /** What a running mode is still waiting to hear; empty when none runs. */
  listeningFor: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** What the core says is running, as the window receives it. */
export const isSmartEqRunState = (value: unknown): value is ISmartEqRunState =>
  isRecord(value) &&
  typeof value.isRunning === 'boolean' &&
  typeof value.listeningFor === 'string';

/**
 * A layer the core wrote: a one-shot's answer, which the graph reveals a
 * band at a time from where the layer was, or a running mode's refinement,
 * whose moved ranges it lights.
 */
export interface ISmartEqWrote {
  kind: 'measured' | 'refined';
  layer: ISmartEqSettings | undefined;
  from: ISmartEqSettings | undefined;
  moved: IBalanceRegionReport[];
}

/** A layer the core wrote, as the window receives it. */
export const isSmartEqWrote = (value: unknown): value is ISmartEqWrote =>
  isRecord(value) &&
  (value.kind === 'measured' || value.kind === 'refined') &&
  (value.layer === undefined || isRecord(value.layer)) &&
  (value.from === undefined || isRecord(value.from)) &&
  Array.isArray(value.moved);

/**
 * How far Smart EQ may move any band, in either direction — one number for
 * both, chosen by whoever is listening (see `correctionLimit.ts` for why it
 * is symmetric). Six is the default and is what the old asymmetric pair
 * allowed upward, so nothing gets louder by default. Twenty is the most
 * Equalizer APO will build from a single band.
 */
export const MIN_CORRECTION_LIMIT_DB = 1;
export const MAX_CORRECTION_LIMIT_DB = MAX_GAIN;
export const DEFAULT_CORRECTION_LIMIT_DB = SMART_EQ_MAX_BOOST_DB;

export const clampCorrectionLimit = (db: number) =>
  Math.max(MIN_CORRECTION_LIMIT_DB, Math.min(MAX_CORRECTION_LIMIT_DB, db));

/** What the window keeps that the core measures and writes by. */
export interface ISmartEqCoreSettings {
  mode: TSmartEqMode;
  /** Whether a running mode keeps measuring — off, nothing runs. */
  continuous: boolean;
  limitDb: number;
  presenceOffsets: TPresenceOffsets;
}

export const DEFAULT_SMART_EQ_SETTINGS: ISmartEqCoreSettings = {
  mode: 'smart',
  continuous: false,
  limitDb: DEFAULT_CORRECTION_LIMIT_DB,
  presenceOffsets: {},
};

/**
 * The settings as the window sent them or a file kept them, with the
 * defaults for anything that is not one. Off is the safe direction for the
 * switch: it is a mode in which the sound changes without anybody touching
 * anything.
 */
export const parseSmartEqCoreSettings = (
  raw: unknown,
): ISmartEqCoreSettings => {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_SMART_EQ_SETTINGS;
  }
  const { mode, continuous, limitDb, presenceOffsets } = raw as Record<
    string,
    unknown
  >;
  return {
    mode: parseSmartEqMode(mode),
    continuous: continuous === true,
    limitDb:
      typeof limitDb === 'number' && Number.isFinite(limitDb) && limitDb > 0
        ? clampCorrectionLimit(limitDb)
        : DEFAULT_CORRECTION_LIMIT_DB,
    presenceOffsets: parsePresenceOffsets(presenceOffsets),
  };
};
