/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the graph does at the edges of its plot: the wave widened to fill a
 * gridless card only where the sound stops short, a band's handle held
 * inside the plot, and the double-click between the pane and the larger
 * views.
 */

import { traceStretch } from '../../../renderer/graph/traceStretch';
import { handleXInPlot } from '../../../renderer/graph/EditablePoint';
import viewAfterPlotDoubleClick from '../../../renderer/graph/plotDoubleClick';

describe('the wave alone on a gridless card', () => {
  const [left, right] = [100, 1100];

  it('is drawn where it is measured when it already covers the plot', () => {
    // Measured from 10 Hz to 24 kHz, past both edges of 20 Hz to 16 kHz:
    // squeezing it in would undo the trim to 16 kHz.
    expect(traceStretch(left, right, 40, 1200)).toEqual({ from: 0, scale: 1 });
  });

  it('widens only its visible part when its top falls short', () => {
    // A 24 kHz output: sound from before the left edge to 12 kHz, at 900 px.
    const { from, scale } = traceStretch(left, right, 40, 900);
    expect(from).toBe(left);
    // The visible 800 px fill the 1000 px plot, starting at the left edge.
    expect(scale).toBeCloseTo(1000 / 800, 9);
    expect(left + (900 - from) * scale).toBeCloseTo(right, 9);
  });

  it('leaves a trace with no visible part alone', () => {
    expect(traceStretch(left, right, 1150, 1300).scale).toBe(1);
  });
});

describe('a band’s handle', () => {
  const range = [50, 1050];

  it('stays where its band is inside the plot', () => {
    expect(handleXInPlot(500, range)).toBe(500);
  });

  it('is held one halo inside an edge the band lies past', () => {
    expect(handleXInPlot(1200, range)).toBe(1038);
    expect(handleXInPlot(-30, range)).toBe(62);
  });

  it('reads a reversed range the same way', () => {
    expect(handleXInPlot(1200, [1050, 50])).toBe(1038);
  });

  it('is left alone on a plot too narrow to hold it', () => {
    expect(handleXInPlot(30, [0, 20])).toBe(30);
  });
});

describe('a double-click on the plot', () => {
  it('fills the screen from the pane, and the window with Ctrl or ⌘', () => {
    expect(viewAfterPlotDoubleClick('normal', false)).toBe('fullscreen');
    expect(viewAfterPlotDoubleClick('normal', true)).toBe('expanded');
  });

  it('comes back to the pane from either larger view', () => {
    expect(viewAfterPlotDoubleClick('fullscreen', false)).toBe('normal');
    expect(viewAfterPlotDoubleClick('fullscreen', true)).toBe('normal');
    expect(viewAfterPlotDoubleClick('expanded', false)).toBe('normal');
    expect(viewAfterPlotDoubleClick('expanded', true)).toBe('normal');
  });
});
