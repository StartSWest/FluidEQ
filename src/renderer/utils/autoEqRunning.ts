/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useContinuousEq } from './continuousEq';
import { useFluidEqContext } from './FluidEqContext';
import { isContinuousMode, useSmartEqMode } from './smartEqMode';

/**
 * Whether one of the automatic modes is chosen, switched on, and free to run.
 *
 * All three are load-bearing and all three are the user's own switches: which
 * mode the button is, whether it has been pressed, and whether the Smart layer
 * is bypassed from the chips on the other side of the screen. The loop in
 * `SmartEqEngine` stands down for any of them.
 *
 * Deliberately NOT including the other two conditions that loop also waits on
 * — live output being up, and a one-shot measurement being in flight. Those
 * come and go by themselves, and anything that turns a feature off when they
 * dip would turn it off in the middle of a song for reasons nobody did.
 *
 * One definition rather than a copy per caller, because the copies were the
 * bug: the song-save switch was rendered unconditionally and so offered a save
 * with no automatic measurement behind it — and nothing but that measurement
 * ever writes the layer a save is made of.
 */
export const useIsAutoEqRunning = (): boolean => {
  const { bypassed } = useFluidEqContext();
  const smartEqMode = useSmartEqMode();
  const isContinuousOn = useContinuousEq();
  return (
    isContinuousMode(smartEqMode) &&
    isContinuousOn &&
    !bypassed.includes('smart')
  );
};
