/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { isContinuousMode, TSmartEqMode } from './smartEqMode';

/**
 * Whether the EQ toolbar's Smart EQ pair — the button and its chevron — can
 * be pressed. Both halves read this one answer, so they cannot disagree.
 *
 * They did. The pair was greyed out whenever the live capture was not open,
 * which includes the second after every launch while it is still opening,
 * and the two halves drew "disabled" by two different rules: the button went
 * to a dim outline, the chevron kept its accent fill and only faded. Every
 * launch drew a dark "Target" with a lit chevron stuck to it, then snapped
 * whole a moment later — reported as the button starting in the wrong theme.
 *
 * A continuous mode is a stored setting and its press only flips it; the
 * loop behind it waits for the capture by itself. So it greys out only when
 * the capture has been tried and could not open — not while it is still
 * opening. The one-shot measurement needs the capture at the moment it is
 * pressed, so it keeps that rule — except while it is running, when the same
 * button is its Cancel and must stay pressable whatever the capture does.
 */
export interface ISmartEqPairState {
  mode: TSmartEqMode;
  /** A one-shot measurement is under way; the button is its Cancel. */
  isBalancing: boolean;
  /** The live capture is open. */
  isCaptureActive: boolean;
  /** Why the capture could not open, or empty when it has not failed. */
  captureError: string;
}

const isSmartEqPairDisabled = ({
  mode,
  isBalancing,
  isCaptureActive,
  captureError,
}: ISmartEqPairState): boolean => {
  if (isContinuousMode(mode)) {
    return !isCaptureActive && captureError !== '';
  }
  return !isBalancing && !isCaptureActive;
};

export default isSmartEqPairDisabled;
