/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the pane under an EQ page's graph opens before anybody moves the
 * divider: tall enough for the band sliders' full first-run track (Ivan,
 * 2026-09-26: "make sure the EQ default height also is enough"). A written
 * 344px was that at 1440x900 and left the tracks at their 72px floor at
 * 2560x1440, where the Tone row is 24px taller. The parts below are the ones
 * measured in the served window at those two sizes.
 */

import {
  bandsPaneNeedOf,
  publishBandsPaneNeed,
} from 'renderer/utils/bandsPaneNeed';
import {
  belowGraphPaneKey,
  getEditorHeight,
  setEditorHeight,
} from 'renderer/utils/paneSizes';

describe('what the bands pane needs', () => {
  it('is the height it opened at where that already gave a full track', () => {
    // 1440x900: the pane 344, the rail 210, a 96px track.
    expect(bandsPaneNeedOf({ pane: 344, overflow: 0, rail: 210 })).toBe(344);
  });

  it('is taller where the Tone row is taller', () => {
    // 2560x1440: the same pane, the Tone at 100 instead of 76, the rail 186.
    expect(bandsPaneNeedOf({ pane: 344, overflow: 0, rail: 186 })).toBe(368);
  });

  it('counts what already overflows the pane', () => {
    expect(bandsPaneNeedOf({ pane: 300, overflow: 22, rail: 186 })).toBe(346);
  });

  // Opened at what it asks for, it asks for the same again, so the pane
  // settles rather than chasing itself.
  it('is a height the pane settles at', () => {
    const everythingElse = 344 - 186;
    const need = bandsPaneNeedOf({ pane: 344, overflow: 0, rail: 186 });
    expect(
      bandsPaneNeedOf({ pane: need, overflow: 0, rail: need - everythingElse }),
    ).toBe(need);
  });
});

describe('the pane under the graph', () => {
  const eq = belowGraphPaneKey('eq');
  const presets = belowGraphPaneKey('eq-presets');

  it('opens at what the bands need until the divider is moved', () => {
    window.localStorage.clear();
    const before = getEditorHeight(eq);
    publishBandsPaneNeed(before + 24);
    expect(getEditorHeight(eq)).toBe(before + 24);
    expect(getEditorHeight(presets)).toBe(before + 24);
  });

  // The control: a divider somebody has moved keeps where they put it.
  it('keeps a height somebody chose', () => {
    setEditorHeight(300, presets);
    publishBandsPaneNeed(400);
    expect(getEditorHeight(presets)).toBe(300);
    expect(getEditorHeight(eq)).toBe(400);
  });
});
