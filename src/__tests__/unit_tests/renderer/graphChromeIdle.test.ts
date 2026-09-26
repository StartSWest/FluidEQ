/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph's strip of controls over a Plus visualizer: held on screen in the
 * ordinary view, where fading out and back over a moving picture read as
 * buttons appearing and disappearing by themselves (2026-09-26), and faded
 * as before everywhere else.
 */

import { renderHook } from '@testing-library/react';
import {
  useIsGraphChromeHeld,
  useIsGraphChromeIdle,
} from '../../../renderer/graph/graphChromeIdle';

const state = { idle: false, fullScreen: false, scene: false };

jest.mock('../../../renderer/utils/idleChrome', () => ({
  useIsChromeIdle: () => state.idle,
}));
jest.mock('../../../renderer/utils/graphViewSettings', () => ({
  useGraphFullScreen: () => state.fullScreen,
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSceneLook: () => (state.scene ? { lookId: 'crystal' } : undefined),
}));

const read = () => ({
  idle: renderHook(() => useIsGraphChromeIdle()).result.current,
  held: renderHook(() => useIsGraphChromeHeld()).result.current,
});

describe('the graph chrome over a Plus visualizer', () => {
  beforeEach(() => {
    Object.assign(state, { idle: true, fullScreen: false, scene: false });
  });

  it('fades on a still pointer with no scene, as it always has', () => {
    // The control: the window's stillness does reach the strip.
    expect(read()).toEqual({ idle: true, held: false });
  });

  it('stays on screen, shaded, under a scene in the ordinary view', () => {
    state.scene = true;

    expect(read()).toEqual({ idle: false, held: true });
  });

  it('still fades under a scene in full screen, with no shade', () => {
    state.scene = true;
    state.fullScreen = true;

    expect(read()).toEqual({ idle: true, held: false });
  });

  it('shows with the pointer moving, whatever is drawn', () => {
    state.idle = false;
    state.scene = true;
    state.fullScreen = true;

    expect(read().idle).toBe(false);
  });
});
