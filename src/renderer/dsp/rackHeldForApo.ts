/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which preset's rack is off only because Equalizer APO cannot run it.
 *
 * A rack that is off can be off for two reasons, and a switch back to the
 * FluidEQ Engine must tell them apart: put back the preset APO held off, but
 * never a rack somebody switched off themselves. Kept beside the settings
 * rather than in them, like the stars: nothing that replaces the rack may
 * carry it, and it outlives a restart between the two switches.
 */
const STORAGE_KEY = 'fluideq.dsp.rackHeldForApo.v1';

export const holdRackForApo = (presetId: string): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, presetId);
  } catch {
    // A locked store forgets the hold; the next switch back then leaves the
    // rack off, which is where the listener can see it and turn it on.
  }
};

export const releaseRackHold = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing held can be read back from a store that cannot be reached.
  }
};

export const rackHeldForApo = (): string | undefined => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
