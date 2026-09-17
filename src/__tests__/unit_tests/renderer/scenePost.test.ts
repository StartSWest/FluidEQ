/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { needsPresent, presentPlan } from '../../../renderer/graph/scenePost';

const at = (
  drawn: [number, number],
  canvas: [number, number],
  fsr: boolean,
  fxaa: boolean,
) => ({
  drawnWidth: drawn[0],
  drawnHeight: drawn[1],
  canvasWidth: canvas[0],
  canvasHeight: canvas[1],
  fsr,
  fxaa,
});

describe('the finishing chain’s plan', () => {
  it('does nothing when the scene fills its canvas and nothing is asked', () => {
    const options = at([1920, 1080], [1920, 1080], true, false);
    expect(presentPlan(options)).toEqual(['copy']);
    expect(needsPresent(options)).toBe(false);
  });

  it('brings a smaller picture up with FSR, then smooths it if asked', () => {
    expect(presentPlan(at([1280, 720], [1920, 1080], true, false))).toEqual([
      'fsr',
    ]);
    expect(presentPlan(at([1280, 720], [1920, 1080], true, true))).toEqual([
      'fsr',
      'fxaa',
    ]);
  });

  /** The plain scaler is the compositor's stretch: the canvas stays small and nothing runs. */
  it('leaves a smaller picture to the compositor with the plain scaler', () => {
    const plain = at([1280, 720], [1280, 720], false, false);
    expect(needsPresent(plain)).toBe(false);
    // Smoothing still runs, at the small size.
    expect(presentPlan(at([1280, 720], [1280, 720], false, true))).toEqual([
      'fxaa',
    ]);
  });

  it('averages a larger picture down, whatever the scaler, then smooths it', () => {
    expect(presentPlan(at([3840, 2160], [1920, 1080], false, false))).toEqual([
      'downsample',
    ]);
    expect(presentPlan(at([3840, 2160], [1920, 1080], true, true))).toEqual([
      'downsample',
      'fxaa',
    ]);
  });

  it('smooths a picture already at size in one pass', () => {
    const options = at([1920, 1080], [1920, 1080], true, true);
    expect(presentPlan(options)).toEqual(['fxaa']);
    expect(needsPresent(options)).toBe(true);
  });
});
