/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { doesPresetExist } from './flush';

/**
 * What an empty profile is called before anybody names it.
 *
 * The number counts only this output's own profiles, so each output starts
 * again at "Untitled profile 1" — a second output has no reason to open on
 * "Untitled profile 4" because three unrelated ones exist on the speakers.
 */
const UNTITLED_PROFILE_PREFIX = 'Untitled profile';

/** The first "Untitled profile N" free in one output's folder. */
const freeUntitledProfileName = (dir: string): string => {
  let index = 1;
  while (doesPresetExist(`${UNTITLED_PROFILE_PREFIX} ${index}`, dir)) {
    index += 1;
  }
  return `${UNTITLED_PROFILE_PREFIX} ${index}`;
};

export default freeUntitledProfileName;
