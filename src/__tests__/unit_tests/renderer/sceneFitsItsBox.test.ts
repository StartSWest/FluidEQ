/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When a scene is taken off the screen rather than stretched over its box.
 *
 * The case this exists for: the graph's strip is double-clicked into full
 * screen, the box changes shape at once and the worker's picture follows
 * 88ms later, so the browser pulls a scene nine times wider than tall over a
 * box not quite two. Measured in the running window on 2026-09-18.
 */

import { sceneFitsItsBox } from '../../../renderer/graph/sceneWorkerClient';

describe('a scene against the box it is drawn into', () => {
  it('is out of shape going from the graph strip into full screen', () => {
    // The measured pair: the picture still 2016x214, the box already
    // 2560x1316. 4.8 times out of shape.
    expect(sceneFitsItsBox(2016, 214, 2560, 1316)).toBe(false);
  });

  it('is out of shape coming back to the strip, which is the same gesture', () => {
    expect(sceneFitsItsBox(2560, 1440, 2016, 214)).toBe(false);
  });

  it('fits once the worker has caught up', () => {
    // The positive control. Without it every case above passes on a rule that
    // calls everything out of shape and leaves the scene hidden for good.
    expect(sceneFitsItsBox(2560, 1392, 2560, 1392)).toBe(true);
    expect(sceneFitsItsBox(2016, 214, 2016, 214)).toBe(true);
  });

  it('ignores a picture drawn at a different resolution to its box', () => {
    // The cost ladder draws small and the worker brings it back up to the
    // panel's pixels, so this never happens — but if it ever did, a blurrier
    // picture is not a stretched one and must not take the scene away.
    expect(sceneFitsItsBox(1280, 720, 2560, 1440)).toBe(true);
    expect(sceneFitsItsBox(640, 360, 2560, 1440)).toBe(true);
  });

  it('sits still through a pane divider being dragged', () => {
    // A few percent a frame, which is what dragging an edge does. Hiding the
    // scene for each of those would be far worse than the stretch.
    const height = 214;
    [2016, 1990, 1950, 1900, 1860].forEach((width) => {
      expect(sceneFitsItsBox(2016, height, width, height)).toBe(true);
    });
  });

  it('holds at a quarter out of shape, in either direction', () => {
    // Where the line is, said in both axes so a sign error cannot pass.
    expect(sceneFitsItsBox(1000, 1000, 1240, 1000)).toBe(true);
    expect(sceneFitsItsBox(1000, 1000, 1260, 1000)).toBe(false);
    expect(sceneFitsItsBox(1000, 1000, 1000, 1240)).toBe(true);
    expect(sceneFitsItsBox(1000, 1000, 1000, 1260)).toBe(false);
  });

  it('calls anything it cannot measure a fit, never a mismatch', () => {
    // A reading that means "no picture yet" must not leave a scene hidden
    // for the life of the window.
    [
      [0, 0, 100, 100],
      [100, 100, 0, 0],
      [Number.NaN, 100, 100, 100],
      [100, Number.NaN, 100, 100],
      [100, 100, Number.NaN, 100],
      [100, 100, 100, Number.NaN],
      [-100, 100, 100, 100],
    ].forEach(([pw, ph, bw, bh]) => {
      expect(sceneFitsItsBox(pw, ph, bw, bh)).toBe(true);
    });
  });
});
