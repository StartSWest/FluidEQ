/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Smart EQ's measurement modes: the one-off and the three that keep running.
 * The window remembers which one is chosen (`renderer/utils/smartEqMode.ts`);
 * the core runs it (`main/smartEq/smartEqRunner.ts`).
 */
export type TSmartEqMode = 'smart' | 'detail' | 'balance' | 'target';

/** The three that keep running, so callers can ask "is this a continuous one". */
export const CONTINUOUS_MODES: TSmartEqMode[] = ['detail', 'balance', 'target'];

export const isContinuousMode = (mode: TSmartEqMode) => mode !== 'smart';

/** Every mode, in the order the menus list them: the one-off first. */
export const SMART_EQ_MODES: readonly TSmartEqMode[] = [
  'smart',
  ...CONTINUOUS_MODES,
];

/**
 * A stored mode, or the one-off for anything that is not one.
 *
 * 'continuous' is what the single continuous mode was called before there
 * were three; it is the one that fits a line to the record, which is now
 * 'detail'. The one-off is the safe answer to anything else: it does
 * something once and stops.
 */
export const parseSmartEqMode = (stored: unknown): TSmartEqMode => {
  if (stored === 'continuous') {
    return 'detail';
  }
  return CONTINUOUS_MODES.includes(stored as TSmartEqMode)
    ? (stored as TSmartEqMode)
    : 'smart';
};
