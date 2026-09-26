/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The waves in the pet's eyes are drawn only while there is joy to show them
 * (`SupportPet.scss`), and `has-pet-joy` on the document is what says so. At
 * zero they were fully transparent and scrolled every frame anyway, in the
 * titlebar, for everybody who had never played. With Rainbow mode always on
 * there is always joy, and the class is still what the stylesheet asks.
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

jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioFrame: () => ({ points: [] }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest
    .requireActual('__tests__/utils/fluidEqHookMocks')
    .eqHooksFrom(() => ({ filters: {}, bandCount: 0 })),
}));

const root = document.documentElement;
const hasJoy = () => root.classList.contains('has-pet-joy');

// Reset before rather than after, for the reason `euphoriaGlow.test.tsx`
// gives: Testing Library unmounts last, and a store torn down under a mounted
// component is an un-acted update.
beforeEach(() => {
  window.localStorage.clear();
  resetEuphoriaMode();
  resetRhythmRun();
  root.classList.remove('has-pet-joy', 'is-euphoric');
  root.style.removeProperty('--pet-joy');
});

// Rainbow mode is always on now (Ivan, 2026-09-26), and forced euphoria
// shows the creature's whole face (`EuphoriaGlow.tsx`): the waves are part of
// it from the first frame, run or no run.
it('draws them from the first frame, with no streak', () => {
  render(<EuphoriaGlow />);
  expect(root.style.getPropertyValue('--pet-joy')).toBe('1');
  expect(hasJoy()).toBe(true);
});

it('keeps them when a run ends and when asked to switch off', () => {
  render(<EuphoriaGlow />);
  act(() => {
    setRhythmRun({ score: 1, streak: EUPHORIA_STREAK });
    winEuphoria();
    resetRhythmRun();
  });
  expect(hasJoy()).toBe(true);

  act(() => setEuphoriaEnabled(false));
  expect(hasJoy()).toBe(true);
});

it('takes the class with it when the shell unmounts', () => {
  const view = render(<EuphoriaGlow />);
  act(() => setRhythmRun({ score: 1, streak: 3 }));
  expect(hasJoy()).toBe(true);

  view.unmount();
  expect(hasJoy()).toBe(false);
});
