/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Notes left for the EQ's three tone dials by whatever is about to act.
 *
 * The dials hold the tone and the curve follows from them, so two things have
 * to reach them from elsewhere on the page — and both are stated rather than
 * worked out from the bands, because every attempt to work them out was wrong
 * about something that looked identical from the rack alone.
 *
 * A rack REBUILT has the three values written onto it again: without that,
 * changing the band count leaves fifteen gains spread over thirty-one
 * frequencies with the gaps at zero, measured 6.7 dB away from the tone the
 * dials still claimed. Inferring it from the band count changing was wrong,
 * because a profile loading its own bands changes the count as surely as the
 * layout menu does, and writing a shelf over somebody's profile is the one
 * thing this page may not do.
 *
 * A rack CLEARED puts the dials back to zero, because a curve of nothing
 * carries no tone. Inferring that from every gain being zero was wrong too:
 * switching between the FluidEQ Engine and Equalizer APO empties the rack for
 * a moment while the new one loads, the dials read that as Clear EQ, and the
 * curve came back with all three of them sitting at 0.0 — reported as exactly
 * that.
 *
 * Each is read once and cleared, because each describes one action and not a
 * mode.
 */
let rebuilding = false;
let clearing = false;

/** Said by whatever is about to rebuild the rack, before it does. */
export const askToneReapply = (): void => {
  rebuilding = true;
};

/** Read by the tone controls when a rack they have not seen arrives. */
export const takeToneReapply = (): boolean => {
  const asked = rebuilding;
  rebuilding = false;
  return asked;
};

/** Said by Clear EQ, before it clears. */
export const askToneClear = (): void => {
  clearing = true;
};

/** Read by the tone controls when the rack they are holding changes. */
export const takeToneClear = (): boolean => {
  const asked = clearing;
  clearing = false;
  return asked;
};
