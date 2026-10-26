/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The ruled paper under a measuring view in the amp's top panel: the main
 * graph's own rules, faint, with no numbers and no gutter (Ivan, 2026-10-25:
 * "the real graph lines but subtle and no paddings", "no numbers"), shown
 * while the graph's grid switch is on and each set only where it names what
 * the view draws.
 */

import type { GraphStyle } from 'common/graphStyles';
import { playerPaperFor } from '../../../../renderer/player/paperRules';

// Full screen asks the same question: a measuring view on the whole screen
// keeps its grid (Ivan, 2026-09-24: "the grid also in fullscreen for those
// meter ones"), so nothing here depends on it.
const ON = { isTrace: true, isGridHidden: false };

describe('the amp’s grid', () => {
  it('rules both scales under the spectrum views', () => {
    (['analyzer', 'compare', 'rta', 'average', 'waterfall'] as const).forEach(
      (style) => {
        expect(playerPaperFor(style, ON)).toEqual({
          frequency: true,
          level: true,
        });
      },
    );
  });

  it('rules only the scale a view actually has', () => {
    // Time runs up the spectrogram; loudness is its colour.
    expect(playerPaperFor('spectrogram', ON)).toEqual({
      frequency: true,
      level: false,
    });
    // Five named columns, evenly apart: not where their frequencies fall.
    expect(playerPaperFor('energy', ON)).toEqual({
      frequency: false,
      level: true,
    });
    // Meters, a scope of samples against time, correlation over time.
    (['loudness', 'scope', 'phase'] as const).forEach((style) => {
      expect(playerPaperFor(style, ON)).toEqual({
        frequency: false,
        level: false,
      });
    });
  });

  it('leaves every picture its whole surface', () => {
    const bare = { frequency: false, level: false };
    // The scenes are pictures, not instruments.
    (['terrace', 'bubbles', 'invaders'] as GraphStyle[]).forEach((style) => {
      expect(playerPaperFor(style, ON)).toEqual(bare);
    });
    // A Plus scene plays in the panel instead of the trace.
    expect(playerPaperFor('analyzer', { ...ON, isTrace: false })).toEqual(bare);
    // Ctrl+G, the graph's own switch, took it away.
    expect(playerPaperFor('analyzer', { ...ON, isGridHidden: true })).toEqual(
      bare,
    );
  });

  it('hands back the same answer for the same rules', () => {
    // The panel's rules are memoised on this object: a new one each render
    // drew them again every frame.
    expect(playerPaperFor('analyzer', ON)).toBe(playerPaperFor('rta', ON));
  });
});
