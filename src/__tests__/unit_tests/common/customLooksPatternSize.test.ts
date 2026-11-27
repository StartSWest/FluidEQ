/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A pattern's tile size is kept with the look, apart from the picture's
 * (Ivan, 2026-11-27: "a slider to grow the tile"), and a look saved before
 * the slider existed opens with its pattern at the 16 pixels it always drew.
 */

import {
  normalizeCustomLook,
  normalizeTuning,
  type ICustomLook,
} from 'common/customLooks';
import {
  MAX_PATTERN_SIZE,
  MIN_PATTERN_SIZE,
  PATTERN_TILE,
  TEXTURE_TILE,
} from 'common/graphTextures';
import { TILE } from 'renderer/graph/fillTextureTiles';

const saved = (tuning: Record<string, unknown>): ICustomLook | null =>
  normalizeCustomLook({
    id: 'custom:grain',
    name: 'Grain',
    style: 'notes',
    palette: 'auto',
    tuning: { filled: true, texture: 'static', ...tuning },
    colours: [],
  });

describe("a pattern look keeps its pattern's size", () => {
  it('keeps a grown pattern through a save and a load', () => {
    const grown = saved({ patternSize: 48 });
    expect(grown?.tuning.patternSize).toBe(48);
    // Through JSON, as the browser store holds it.
    const reloaded = normalizeCustomLook(JSON.parse(JSON.stringify(grown)));
    expect(reloaded?.tuning.patternSize).toBe(48);
  });

  it('opens a look saved before the slider at the size it always drew', () => {
    const older = saved({});
    expect(older?.tuning.patternSize).toBe(PATTERN_TILE);
    // The size every pattern was drawn at is the tile's own grid, so the
    // default is that drawing exactly.
    expect(PATTERN_TILE).toBe(16);
    expect(TILE).toBe(PATTERN_TILE);
    // The control: a stored size is read, so the default above is the
    // reading of an absent field and not a size thrown away.
    expect(saved({ patternSize: 24 })?.tuning.patternSize).toBe(24);
  });

  it("leaves the picture's size alone, and the picture's leaves it alone", () => {
    const both = saved({ patternSize: 96, textureSize: 320 });
    expect(both?.tuning.patternSize).toBe(96);
    expect(both?.tuning.textureSize).toBe(320);
    expect(saved({ textureSize: 320 })?.tuning.patternSize).toBe(PATTERN_TILE);
    expect(saved({ patternSize: 96 })?.tuning.textureSize).toBe(TEXTURE_TILE);
  });

  it('refuses a size past its ends, and rounds one between pixels', () => {
    expect(normalizeTuning({ patternSize: 1 }, 'notes').patternSize).toBe(
      MIN_PATTERN_SIZE,
    );
    expect(normalizeTuning({ patternSize: 9000 }, 'notes').patternSize).toBe(
      MAX_PATTERN_SIZE,
    );
    expect(normalizeTuning({ patternSize: 20.6 }, 'notes').patternSize).toBe(
      21,
    );
    expect(normalizeTuning({ patternSize: '32' }, 'notes').patternSize).toBe(
      PATTERN_TILE,
    );
  });
});
