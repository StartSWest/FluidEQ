/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph's strip of controls, and the shades that come with it, fade on
 * the window's stillness whatever is drawn: a Plus visualizer no longer holds
 * them on screen, so with the options away the scene is whole to its top
 * edge (2026-09-27: "only appear when graph options is shown and disappear
 * when hidden, so we see full plus viz to the top").
 */

import '@testing-library/jest-dom';
import { render, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import useIsGraphChromeIdle from '../../../renderer/graph/graphChromeIdle';
import HeadSceneShade from '../../../renderer/graph/HeadSceneShade';

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

const read = () => renderHook(() => useIsGraphChromeIdle()).result.current;

describe('the graph chrome, over any look', () => {
  beforeEach(() => {
    Object.assign(state, { idle: true, fullScreen: false, scene: false });
  });

  it('fades on a still pointer with no scene, as it always has', () => {
    expect(read()).toBe(true);
  });

  it('fades on a still pointer under a scene in the ordinary view too', () => {
    state.scene = true;

    expect(read()).toBe(true);
  });

  it('fades under a scene in full screen', () => {
    state.scene = true;
    state.fullScreen = true;

    expect(read()).toBe(true);
  });

  it('shows with the pointer moving, whatever is drawn', () => {
    // The control: the same rule answers "shown" when the window is not
    // still, so the three fades above are the stillness, not a stuck answer.
    state.idle = false;
    state.scene = true;

    expect(read()).toBe(false);
  });
});

/*
 * The EQ head's shade over a scene is the options' shade carried up to the
 * top of the window, so it has to leave with them: there with the options,
 * faded with them, never left behind as a dark band over the picture.
 */
describe("the EQ head's shade", () => {
  const shade = () => {
    const { container } = render(createElement(HeadSceneShade));
    return container.querySelector('.center-head__shade');
  };

  beforeEach(() => {
    Object.assign(state, { idle: false, fullScreen: false, scene: true });
  });

  it('is there while the options are', () => {
    expect(shade()).not.toHaveClass('is-idle');
  });

  it('fades with them over a scene, in the ordinary view and full screen', () => {
    state.idle = true;
    expect(shade()).toHaveClass('is-idle');

    state.fullScreen = true;
    expect(shade()).toHaveClass('is-idle');
  });

  it('is never read aloud', () => {
    expect(shade()).toHaveAttribute('aria-hidden', 'true');
  });
});
