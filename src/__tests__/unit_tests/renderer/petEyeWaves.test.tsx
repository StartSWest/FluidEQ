/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The waves in the pet's eyes are drawn only while there is joy to show them
 * (`SupportPet.scss`), and `has-pet-joy` on the document is what says so. At
 * zero they were fully transparent and scrolled every frame anyway, in the
 * titlebar, for everybody who had never played. Colourful mode is always on
 * since 2026-11-18, so there is always joy, and the class is still what the
 * stylesheet asks.
 */

import { act, render } from '@testing-library/react';
import EuphoriaGlow from 'renderer/components/EuphoriaGlow';
import { resetRhythmRun, setRhythmRun } from 'renderer/utils/rhythmRun';

// With the frame store's hooks (`liveFrameHooks`): the audio half listens to
// the store since 2026-11-16 rather than rendering every frame.
jest.mock('renderer/audio/LiveAudioContext', () => {
  const frame = { points: [], graphPoints: [] };
  return {
    ...jest
      .requireActual<typeof import('../../utils/liveFrameHooks')>(
        '../../utils/liveFrameHooks',
      )
      .liveFrameHooks(() => frame),
    useLiveAudioFrame: () => frame,
  };
});
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
  resetRhythmRun();
  root.classList.remove('has-pet-joy', 'is-euphoric');
  root.style.removeProperty('--pet-joy');
});

it('draws them from the first frame, with no streak', () => {
  render(<EuphoriaGlow />);
  expect(root.style.getPropertyValue('--pet-joy')).toBe('1');
  expect(hasJoy()).toBe(true);
});

it('keeps them when a run ends', () => {
  render(<EuphoriaGlow />);
  act(() => setRhythmRun({ score: 1, streak: 12 }));
  act(() => resetRhythmRun());
  expect(hasJoy()).toBe(true);
});

it('takes the class with it when the shell unmounts', () => {
  const view = render(<EuphoriaGlow />);
  expect(hasJoy()).toBe(true);

  view.unmount();
  expect(hasJoy()).toBe(false);
});
