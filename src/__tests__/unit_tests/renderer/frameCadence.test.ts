/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createFrameCadence } from '../../../renderer/graph/frameCadence';

describe('the frame cadence', () => {
  it('assumes sixty a second before any frame has been drawn', () => {
    expect(createFrameCadence().intervalMs()).toBeCloseTo(1000 / 60, 3);
  });

  it('reads the display interval from the gaps between frames', () => {
    const cadence = createFrameCadence();
    for (let i = 0; i < 30; i += 1) {
      cadence.note(10 + (i % 3) * 0.1);
    }
    expect(cadence.intervalMs()).toBeCloseTo(10, 0);
  });

  /** A stalled page makes long gaps; the display's beat is the short ones. */
  it('is not fooled by a few stalls of the page', () => {
    const cadence = createFrameCadence();
    for (let i = 0; i < 24; i += 1) {
      cadence.note(i % 4 === 0 ? 120 : 6.94);
    }
    expect(cadence.intervalMs()).toBeCloseTo(6.94, 1);
  });

  it('follows a cap the moment frames arrive at it', () => {
    const cadence = createFrameCadence();
    for (let i = 0; i < 40; i += 1) {
      cadence.note(8.3);
    }
    for (let i = 0; i < 40; i += 1) {
      cadence.note(33.3);
    }
    expect(cadence.intervalMs()).toBeCloseTo(33.3, 0);
  });

  it('clamps nonsense to what a display can do and ignores bad gaps', () => {
    const cadence = createFrameCadence();
    cadence.note(0);
    cadence.note(-5);
    cadence.note(Number.NaN);
    expect(cadence.intervalMs()).toBeCloseTo(1000 / 60, 3);
    for (let i = 0; i < 24; i += 1) {
      cadence.note(0.5);
    }
    expect(cadence.intervalMs()).toBe(4);
    cadence.reset();
    for (let i = 0; i < 24; i += 1) {
      cadence.note(5000);
    }
    expect(cadence.intervalMs()).toBe(100);
  });
});
