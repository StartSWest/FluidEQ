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
 * 2560x1440, where the Tone row is 24px taller, so the need is measured.
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

// The need is for an 80px track since 2026-11-16 (it was 96), the rail that
// gives it 194px (the track is the rail less 114).
describe('what the bands pane needs', () => {
  it('is the height it opened at where that already gave the track', () => {
    // 1440x900: the pane 344, the rail 194, an 80px track.
    expect(bandsPaneNeedOf({ pane: 344, overflow: 0, rail: 194 })).toBe(344);
  });

  it('is taller where the Tone row is taller', () => {
    // The same pane with the Tone 24px taller, as at 2560x1440: the rail 170.
    expect(bandsPaneNeedOf({ pane: 344, overflow: 0, rail: 170 })).toBe(368);
  });

  it('counts what already overflows the pane', () => {
    expect(bandsPaneNeedOf({ pane: 300, overflow: 22, rail: 170 })).toBe(346);
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

  // The control: a divider somebody has moved keeps where they put it, as
  // long as that is no lower than the bands need (2026-11-17: a share saved
  // lower opens at the need).
  it('keeps a height somebody chose', () => {
    publishBandsPaneNeed(300);
    setEditorHeight(360, presets);
    publishBandsPaneNeed(320);
    expect(getEditorHeight(presets)).toBe(360);
    expect(getEditorHeight(eq)).toBe(320);
  });

  it('opens no lower than the bands need, however low it was put', () => {
    publishBandsPaneNeed(300);
    setEditorHeight(200, presets);
    expect(getEditorHeight(presets)).toBe(300);
  });

  // The page keeps the golden ratio's share of a tall window (2026-11-16),
  // the bands' need wins where it is more, and the pane opens tall enough
  // for a ceiling-length track (340px, 260 more than the need's 80) where
  // that stays within half the room (2026-11-17).
  it('opens for a ceiling-length track, within half a tall page and never under the golden ratio', () => {
    const { innerHeight } = window;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1400,
    });
    window.dispatchEvent(new Event('resize'));
    try {
      // Nothing laid out here, so the room is the window less the chrome's
      // 200px: 1200; its 38.2% is 458, its half 600.
      publishBandsPaneNeed(300);
      expect(getEditorHeight(eq)).toBe(560);
      publishBandsPaneNeed(500);
      expect(getEditorHeight(eq)).toBe(600);
      publishBandsPaneNeed(100);
      expect(getEditorHeight(eq)).toBe(458);
      publishBandsPaneNeed(720);
      expect(getEditorHeight(eq)).toBe(720);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: innerHeight,
      });
      window.dispatchEvent(new Event('resize'));
    }
  });
});
