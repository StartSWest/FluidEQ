/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A typed number, with a comma read as the decimal point it is in half the
 * languages this app speaks, and a trailing `k` as thousands — the box opens
 * holding the reading, and a frequency reads "12.5k"; undefined for anything
 * that is not a number. Every reading that turns into a box when pressed
 * reads what was typed through this (`KnobView`, the Dynamics values).
 */
const parseTypedNumber = (text: string): number | undefined => {
  const typed = text.trim().replace(',', '.');
  const isThousands = /k$/i.test(typed);
  const digits = isThousands ? typed.slice(0, -1).trim() : typed;
  const number = Number(digits);
  if (digits === '' || !Number.isFinite(number)) {
    return undefined;
  }
  return isThousands ? number * 1_000 : number;
};

export default parseTypedNumber;
