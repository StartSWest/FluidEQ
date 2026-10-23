/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import normalizeSceneWorld from '../../../common/sceneWorldRead';
import worldSamples, {
  MULTISAMPLE_LIMIT,
} from '../../../renderer/graph/world/worldSamples';

/**
 * A world made only of glows and soft sprites says it has no hard edge to
 * smooth, and is then drawn without multisampling: on Intel UHD at 1080p
 * Galaxy's world took 16 ms with four samples and 1.1 without, and
 * Supernova's lost the context. Every other world - every world written
 * before the field existed among them - keeps its four samples.
 */

const BOX = { type: 'mesh', geometry: { kind: 'box' } };

const multisampleOf = (raw: Record<string, unknown>) =>
  normalizeSceneWorld({ nodes: [BOX], ...raw }, [])?.multisample;

describe('what a world says about its edges', () => {
  it('is smoothed when it says nothing, as every world before the field was', () => {
    expect(multisampleOf({})).toBe(true);
  });

  it('is drawn without the samples when it says false', () => {
    expect(multisampleOf({ multisample: false })).toBe(false);
  });

  it('takes nothing but false for false: a word, a zero or a null keeps the samples', () => {
    expect(multisampleOf({ multisample: 'false' })).toBe(true);
    expect(multisampleOf({ multisample: 0 })).toBe(true);
    expect(multisampleOf({ multisample: null })).toBe(true);
    expect(multisampleOf({ multisample: true })).toBe(true);
  });
});

describe('the samples a world is drawn with', () => {
  const smoothed = { multisample: true };
  const glows = { multisample: false };

  it('are four for a world with edges, at an ordinary size', () => {
    expect(worldSamples(smoothed, 1920, 1080, 16)).toBe(4);
  });

  it('are none for a world of glows, at any size', () => {
    expect(worldSamples(glows, 1920, 1080, 16)).toBe(0);
    expect(worldSamples(glows, 640, 360, 16)).toBe(0);
  });

  it('are what the graphics card offers when that is fewer than four', () => {
    expect(worldSamples(smoothed, 1920, 1080, 2)).toBe(2);
    expect(worldSamples(smoothed, 1920, 1080, 0)).toBe(0);
  });

  it('are none past the size at which the world is supersampled instead, and four at it', () => {
    expect(worldSamples(smoothed, 3840, 2160, 16)).toBe(4);
    expect(MULTISAMPLE_LIMIT).toBe(3840 * 2160);
    expect(worldSamples(smoothed, 3840, 2161, 16)).toBe(0);
  });
});
