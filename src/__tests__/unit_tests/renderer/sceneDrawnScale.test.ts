/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  blurredScale,
  drawnScale,
} from '../../../renderer/graph/sceneBlurScale';

/**
 * Full forces full antialiasing (Ivan, 2026-11-27): with no blur, the frame
 * is drawn at the ladder's own scale, supersample included. Every frame was
 * held to 1 since e8929dd65, because the blur's cap was taken whatever the
 * blur, and two minutes of Best on Ivan's NVIDIA card stayed at 1.00.
 */
describe("a scene frame's drawn scale", () => {
  const noBlur = blurredScale(0, 1.25);

  it('is the supersample the ladder chose when nothing is blurred', () => {
    expect(noBlur).toBe(1);
    expect(drawnScale(2, noBlur)).toBe(2);
    expect(drawnScale(1.6, noBlur)).toBe(1.6);
  });

  it("is the ladder's own when it chose less than the panel", () => {
    expect(drawnScale(0.5, noBlur)).toBe(0.5);
  });

  it('is held to what survives a blur while there is one', () => {
    const cap = blurredScale(6, 1.25);
    expect(cap).toBeLessThan(1);
    expect(drawnScale(2, cap)).toBe(cap);
    // A ladder already under the cap keeps its own, smaller scale.
    expect(drawnScale(cap / 2, cap)).toBe(cap / 2);
  });
});
