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
import { RAINBOW_TOKENS } from 'renderer/utils/rainbowPalette';
import { resetRhythmRun, setRhythmRun } from 'renderer/utils/rhythmRun';

// The audio half mounts only while the mode is running, and all it wants is a
// band list and a band count. Neither has anything to do with the switch.
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioFrame: () => ({ points: [], graphPoints: [] }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest
    .requireActual('__tests__/utils/fluidEqHookMocks')
    .eqHooksFrom(() => ({ filters: {}, bandCount: 0 })),
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

  // On by default (Ivan, 2026-09-26), with nothing to unlock.
  it('is on from the first frame, with no run at all', () => {
    render(<EuphoriaGlow />);
    expect(isRootEuphoric()).toBe(true);
  });

  it('comes off with the switch and back on with it, the run long over', () => {
    render(<EuphoriaGlow />);
    act(() => {
      setRhythmRun({ score: 1, streak: EUPHORIA_STREAK });
      winEuphoria();
    });
    act(() => setEuphoriaEnabled(false));
    // Still at the ceiling, and off: the switch decides, not the run.
    expect(isRootEuphoric()).toBe(false);
    act(() => {
      resetRhythmRun();
      setEuphoriaEnabled(true);
    });
    expect(isRootEuphoric()).toBe(true);
  });

  // The arrival's burst is for the way in, and a window that opens already in
  // the mode has not arrived anywhere: starting from "off" put the burst over
  // every launch.
  it('opens without the arrival burst', () => {
    const view = render(<EuphoriaGlow />);
    // The control: this is the state the burst used to fire in.
    expect(isRootEuphoric()).toBe(true);
    expect(view.container.querySelector('.euphoria-burst')).toBeNull();
  });

  // Each blade one stop of the palette in use, in turn — the window's Tint or
  // the visualizer's colours — where they were spaced round the whole colour
  // wheel (Ivan, 2026-10-25: "not use those fixed rainbow colors").
  it('lights the switch-on flash in the palette in use, stop by stop', () => {
    act(() => setEuphoriaEnabled(false));
    const view = render(<EuphoriaGlow />);
    act(() => setEuphoriaEnabled(true));
    const blades = [
      ...view.container.querySelectorAll<HTMLElement>('.euphoria-burst__blade'),
    ];
    expect(blades.length).toBeGreaterThan(RAINBOW_TOKENS.length);
    blades.forEach((blade, index) => {
      expect(blade.style.getPropertyValue('--euphoria-blade-colour')).toBe(
        `var(${RAINBOW_TOKENS[index % RAINBOW_TOKENS.length]})`,
      );
      expect(blade.style.getPropertyValue('--euphoria-blade-hue')).toBe('');
    });
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
