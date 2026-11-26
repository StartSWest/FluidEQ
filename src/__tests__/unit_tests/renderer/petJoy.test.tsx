/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Colourful mode is always on since 2026-11-18, so the root carries full joy
 * for good (`--pet-joy`, which lifts the Support dialog's hop). The waves in
 * the pet's eyes no longer read it: they follow a loud chorus
 * (`petChoreography.ts`).
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
const hasJoy = () => root.style.getPropertyValue('--pet-joy') === '1';

// Reset before rather than after, for the reason `euphoriaGlow.test.tsx`
// gives: Testing Library unmounts last, and a store torn down under a mounted
// component is an un-acted update.
beforeEach(() => {
  window.localStorage.clear();
  resetRhythmRun();
  root.classList.remove('is-euphoric');
  root.style.removeProperty('--pet-joy');
});

it('carries full joy from the first frame, with no streak', () => {
  render(<EuphoriaGlow />);
  expect(hasJoy()).toBe(true);
  expect(root.classList.contains('is-euphoric')).toBe(true);
});

it('keeps them when a run ends', () => {
  render(<EuphoriaGlow />);
  act(() => setRhythmRun({ score: 1, streak: 12 }));
  act(() => resetRhythmRun());
  expect(hasJoy()).toBe(true);
});

it('takes the joy with it when the shell unmounts', () => {
  const view = render(<EuphoriaGlow />);
  expect(hasJoy()).toBe(true);

  view.unmount();
  expect(hasJoy()).toBe(false);
});
