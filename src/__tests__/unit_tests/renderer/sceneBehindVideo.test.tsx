/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the Media page stands over the graph's Plus visualizer.
 *
 * Making a site's page see-through is the same kind of change as colouring it,
 * so it waits on the same choice by the user, and it happens only in the
 * video's own full screen, over a Plus scene.
 */

import { act, renderHook } from '@testing-library/react';
import { setGuestTintEnabled } from '../../../renderer/video/guestTintPreference';
import { useSceneBehindVideo } from '../../../renderer/video/VideoSceneBackdrop';

let mockScene: { lookId: string } | null = null;

jest.mock('../../../renderer/utils/graphStyle', () => ({
  ...jest.requireActual('../../../renderer/utils/graphStyle'),
  useSceneLook: () => mockScene,
}));

afterEach(() => {
  mockScene = null;
  act(() => setGuestTintEnabled(false));
});

const behind = (isFullScreen: boolean) =>
  renderHook(() => useSceneBehindVideo(isFullScreen)).result.current;

it('stands the page over the scene only in full screen, over a Plus scene, with matching colours on', () => {
  mockScene = { lookId: 'scene:bloom' };
  act(() => setGuestTintEnabled(true));
  expect(behind(true)).toBe(true);
  // Outside the video's full screen the graph draws the scene itself.
  expect(behind(false)).toBe(false);
});

it("never makes a site's page see-through unless the user turned matching colours on", () => {
  mockScene = { lookId: 'scene:bloom' };
  expect(behind(true)).toBe(false);
});

it('leaves the page alone when the graph shows no Plus scene', () => {
  act(() => setGuestTintEnabled(true));
  expect(behind(true)).toBe(false);
});
