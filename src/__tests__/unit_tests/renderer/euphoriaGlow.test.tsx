/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `.is-euphoric` on the document root is what every stylesheet reads, and
 * what the canvases ask before they paint. Colourful mode is always on since
 * 2026-11-18 (`euphoriaMode.ts`): the root carries the look for good, with
 * the creature at full joy, and nothing the rhythm game does reaches it.
 * It is the half of the look React cannot clean up for itself, so the shell
 * unmounting has to take it away.
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
const isRootEuphoric = () => root.classList.contains('is-euphoric');

// Reset before rather than after: Testing Library unmounts in its own
// `afterEach`, registered at import and therefore run last, and a store torn
// down under a mounted component is an un-acted update.
beforeEach(() => {
  window.localStorage.clear();
  resetRhythmRun();
  root.classList.remove('is-euphoric', 'has-pet-joy');
  root.style.removeProperty('--pet-joy');
});

describe('the Colourful look on the root', () => {
  it('is on from the first frame, with no run at all', () => {
    render(<EuphoriaGlow />);
    expect(isRootEuphoric()).toBe(true);
    // `has-pet-joy` went with the SVG pet on 2026-11-26: nothing reads it,
    // and the fur pet takes her joy from the music, not from the root.
    expect(root.classList.contains('has-pet-joy')).toBe(false);
    expect(root.style.getPropertyValue('--pet-joy')).toBe('1');
  });

  it('forgets the switch older versions kept, so an "off" left behind is gone', () => {
    window.localStorage.setItem('fluideq-euphoria-enabled', 'false');
    window.localStorage.setItem('fluideq-rainbow', 'false');
    render(<EuphoriaGlow />);
    expect(window.localStorage.getItem('fluideq-euphoria-enabled')).toBeNull();
    expect(window.localStorage.getItem('fluideq-rainbow')).toBeNull();
    // And the look is on regardless of what was stored.
    expect(isRootEuphoric()).toBe(true);
  });

  it('stays on through a run of the rhythm game and after it', () => {
    render(<EuphoriaGlow />);
    act(() => setRhythmRun({ score: 3, streak: 12 }));
    expect(isRootEuphoric()).toBe(true);
    act(() => resetRhythmRun());
    expect(isRootEuphoric()).toBe(true);
    expect(root.style.getPropertyValue('--pet-joy')).toBe('1');
  });

  it('takes the class with it when the shell unmounts', () => {
    const view = render(<EuphoriaGlow />);
    expect(isRootEuphoric()).toBe(true);
    view.unmount();
    expect(isRootEuphoric()).toBe(false);
    expect(root.classList.contains('has-pet-joy')).toBe(false);
    expect(root.style.getPropertyValue('--pet-joy')).toBe('');
  });
});
