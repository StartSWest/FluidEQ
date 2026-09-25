/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The grid under the player's visualizer deck: shown for a measuring view in
 * two columns while the graph's grid switch is on, and each scale only where
 * it names what the view draws.
 */

import type { GraphStyle } from 'common/graphStyles';
import { playerPaperFor } from '../../../../renderer/player/paperRules';

const ON = { isTrace: true, isFull: false, isGridHidden: false };

describe("the player's grid", () => {
  it('rules both scales under the spectrum views, clear of the strip', () => {
    (['analyzer', 'compare', 'rta', 'average', 'waterfall'] as const).forEach(
      (style) => {
        const paper = playerPaperFor(style, ON);
        expect(paper.frequency).toBe(true);
        expect(paper.level).toBe(true);
        // The strip of controls stands 8px down and 26px tall: the level
        // scale's top number sat under Auto before the plot moved below it.
        expect(paper.padding.top).toBeGreaterThanOrEqual(34);
        expect(paper.padding.bottom).toBeGreaterThan(0);
        expect(paper.padding.right).toBeGreaterThan(0);
      },
    );
  });

  it('names only the scale a view actually has', () => {
    // Time runs up the spectrogram; loudness is its colour.
    expect(playerPaperFor('spectrogram', ON)).toMatchObject({
      frequency: true,
      level: false,
    });
    // Five named columns, evenly apart: not where their frequencies fall.
    expect(playerPaperFor('energy', ON)).toMatchObject({
      frequency: false,
      level: true,
    });
    // Meters, a scope of samples against time, correlation over time.
    (['loudness', 'scope', 'phase'] as const).forEach((style) => {
      expect(playerPaperFor(style, ON)).toMatchObject({
        frequency: false,
        level: false,
        padding: { left: 0, top: 0, right: 0, bottom: 0 },
      });
    });
  });

  it('leaves every picture its whole surface', () => {
    const bare = { frequency: false, level: false };
    // The scenes are pictures, not instruments.
    (['terrace', 'bubbles', 'invaders'] as GraphStyle[]).forEach((style) => {
      expect(playerPaperFor(style, ON)).toMatchObject(bare);
    });
    // A Plus scene plays in the deck instead of the trace.
    expect(playerPaperFor('analyzer', { ...ON, isTrace: false })).toMatchObject(
      bare,
    );
    // Full screen is the picture alone.
    expect(playerPaperFor('analyzer', { ...ON, isFull: true })).toMatchObject(
      bare,
    );
    // Ctrl+G, the graph's own switch, took it away.
    expect(
      playerPaperFor('analyzer', { ...ON, isGridHidden: true }),
    ).toMatchObject(bare);
  });

  it('hands back the same padding for the same answer', () => {
    // The deck's scales are memoised on this object: a new one each render
    // rebuilt them every frame.
    expect(playerPaperFor('analyzer', ON).padding).toBe(
      playerPaperFor('rta', ON).padding,
    );
  });
});
