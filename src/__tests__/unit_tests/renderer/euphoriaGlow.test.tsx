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

import { act, render } from '@testing-library/react';
import { EUPHORIA_STREAK } from 'common/rhythmGame';
import EuphoriaGlow from 'renderer/components/EuphoriaGlow';
import {
  resetEuphoriaMode,
  setEuphoriaEnabled,
  winEuphoria,
} from 'renderer/utils/euphoriaMode';
import { resetRhythmRun, setRhythmRun } from 'renderer/utils/rhythmRun';

// The audio half mounts only while the mode is running, and all it wants is a
// band list and a filter count. Neither has anything to do with the switch.
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioFrame: () => ({ points: [] }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({ filters: {} }),
}));

const isRootEuphoric = () =>
  document.documentElement.classList.contains('is-euphoric');

/**
 * `.is-euphoric` on the document root is what every stylesheet reads, and what
 * the canvases ask before they paint. It is therefore the half of the mode that
 * React cannot clean up for itself, and the half a wrong condition strands.
 */
describe('the euphoria root class', () => {
  // Reset before rather than after. Testing Library unmounts in its own
  // `afterEach`, registered at import and therefore run last — so tearing the
  // stores down here would emit into a component that is still mounted, which
  // is an un-acted update and eight lines of React warning per test.
  beforeEach(() => {
    window.localStorage.clear();
    resetEuphoriaMode();
    resetRhythmRun();
    document.documentElement.classList.remove('is-euphoric');
  });

  it('goes on when a run reaches the ceiling', () => {
    render(<EuphoriaGlow />);
    expect(isRootEuphoric()).toBe(false);

    act(() => {
      setRhythmRun({ score: 1, streak: EUPHORIA_STREAK });
    });
    expect(isRootEuphoric()).toBe(true);
  });

  it('comes off in the same session it was won in', () => {
    // The bug this pins, in the exact state the app is in the first time
    // anybody sees the mode. Winning is what switches it on, and a streak does
    // not reset when somebody stops playing — so at the moment the switch is
    // turned off, the run is still sitting at the ceiling.
    //
    // The class used to be derived from `joy`, which falls back to the streak
    // whenever the switch is off. It therefore stayed on: everything gated on
    // `isEuphoric` in React went quiet and everything gated on `.is-euphoric`
    // in the stylesheets kept painting, which is half a rainbow. Restarting
    // appeared to fix it only because the run lives in memory and the streak
    // was gone.
    render(<EuphoriaGlow />);
    act(() => {
      setRhythmRun({ score: 1, streak: EUPHORIA_STREAK });
      winEuphoria();
    });
    expect(isRootEuphoric()).toBe(true);

    act(() => setEuphoriaEnabled(false));
    expect(isRootEuphoric()).toBe(false);
  });

  it('comes back on when the switch does, with the run long over', () => {
    // The other direction of the same rule: once won, the switch is the only
    // thing that decides, so a streak of nothing must not hold the mode off.
    render(<EuphoriaGlow />);
    act(() => {
      winEuphoria();
      setEuphoriaEnabled(false);
      resetRhythmRun();
    });
    expect(isRootEuphoric()).toBe(false);

    act(() => setEuphoriaEnabled(true));
    expect(isRootEuphoric()).toBe(true);
  });

  it('takes the class with it when the shell unmounts', () => {
    const view = render(<EuphoriaGlow />);
    act(() => {
      setRhythmRun({ score: 1, streak: EUPHORIA_STREAK });
    });
    expect(isRootEuphoric()).toBe(true);

    view.unmount();
    expect(isRootEuphoric()).toBe(false);
  });
});
