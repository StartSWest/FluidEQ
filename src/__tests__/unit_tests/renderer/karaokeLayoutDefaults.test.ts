/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Karaoke pitch strip opens near its tallest, every note row readable
 * (Ivan, 2026-11-18, after a reset left it at 128px: "when resetting the app
 * it needs to restore the pitch lane height to a nice height, it is too
 * compressed; like the picture is fine" - his strip at 360). 340px in a
 * window and 360 in full screen, the strip's top; a strip already dragged
 * keeps its height, and Reset all settings brings the defaults back.
 */

import {
  karaokeLayoutStorageKey,
  karaokePitchHeightPercent,
  readKaraokeLayout,
  writeKaraokeLayout,
} from 'renderer/karaoke/karaokeLayout';
import { resetSettings } from 'renderer/utils/settingsReset';

afterEach(() => window.localStorage.clear());

describe('the Karaoke pitch strip’s height', () => {
  it('opens near its tallest in a window and at its tallest in full screen', () => {
    expect(readKaraokeLayout('normal').pitchHeight).toBe(340);
    expect(readKaraokeLayout('fullscreen').pitchHeight).toBe(360);
    // Its handle reads where that stands in the strip's range.
    expect(Math.round(karaokePitchHeightPercent(340))).toBe(93);
    expect(karaokePitchHeightPercent(360)).toBe(100);
  });

  it('keeps a height the strip was dragged to', () => {
    writeKaraokeLayout('normal', {
      playlistShare: 0.2,
      playlistCollapsed: false,
      pitchHeight: 180,
    });
    expect(readKaraokeLayout('normal').pitchHeight).toBe(180);
    // The other view keeps its own.
    expect(readKaraokeLayout('fullscreen').pitchHeight).toBe(360);
  });

  it('holds a stored height inside the strip’s range', () => {
    window.localStorage.setItem(
      karaokeLayoutStorageKey('normal'),
      JSON.stringify({ pitchHeight: 9_000 }),
    );
    expect(readKaraokeLayout('normal').pitchHeight).toBe(360);
    window.localStorage.setItem(
      karaokeLayoutStorageKey('normal'),
      JSON.stringify({ pitchHeight: 10 }),
    );
    expect(readKaraokeLayout('normal').pitchHeight).toBe(56);
  });

  it('comes back to the defaults after Reset all settings', () => {
    writeKaraokeLayout('normal', {
      playlistShare: 0.3,
      playlistCollapsed: true,
      pitchHeight: 128,
    });
    // The control: what was dragged is what is read before the reset.
    expect(readKaraokeLayout('normal').pitchHeight).toBe(128);
    resetSettings(window.localStorage);
    expect(readKaraokeLayout('normal').pitchHeight).toBe(340);
    expect(readKaraokeLayout('normal').playlistCollapsed).toBe(false);
  });
});
