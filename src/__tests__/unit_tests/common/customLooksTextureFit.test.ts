/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How a look's picture lies — once over the whole plot, or tiled at a size —
 * is kept with the look, and a look saved before the choice existed opens
 * exactly as it drew: tiled, 192 pixels tall.
 */

import {
  normalizeCustomLook,
  normalizeTuning,
  type ICustomLook,
} from 'common/customLooks';
import {
  MAX_TEXTURE_SIZE,
  MIN_TEXTURE_SIZE,
  TEXTURE_TILE,
} from 'common/graphTextures';

const picture = `data:image/webp;base64,${'A'.repeat(64)}`;

const saved = (tuning: Record<string, unknown>): ICustomLook | null =>
  normalizeCustomLook({
    id: 'custom:fit',
    name: 'Fit',
    style: 'notes',
    palette: 'auto',
    tuning: {
      filled: true,
      texture: 'image',
      textureImage: picture,
      ...tuning,
    },
    colours: [],
  });

describe('a picture look keeps its fit', () => {
  it('keeps a whole picture and a tile size through a save and a load', () => {
    const whole = saved({ textureFit: 'cover', textureSize: 96 });
    expect(whole?.tuning.textureFit).toBe('cover');
    expect(whole?.tuning.textureSize).toBe(96);
    // Through JSON, as the browser store holds it.
    const reloaded = normalizeCustomLook(JSON.parse(JSON.stringify(whole)));
    expect(reloaded?.tuning.textureFit).toBe('cover');
    expect(reloaded?.tuning.textureSize).toBe(96);
    expect(reloaded?.tuning.textureImage).toBe(picture);
  });

  it('opens a look saved before the choice tiled at the size it always had', () => {
    const older = saved({});
    expect(older?.tuning.textureFit).toBe('tile');
    expect(older?.tuning.textureSize).toBe(TEXTURE_TILE);
    expect(TEXTURE_TILE).toBe(192);
    // The control: the same look given a fit keeps it, so the default above
    // is the reading of an absent field and not a fit thrown away.
    expect(saved({ textureFit: 'cover' })?.tuning.textureFit).toBe('cover');
  });

  it('refuses a fit it does not have and a size past its ends', () => {
    expect(normalizeTuning({ textureFit: 'stretch' }, 'notes').textureFit).toBe(
      'tile',
    );
    expect(normalizeTuning({ textureFit: 2 }, 'notes').textureFit).toBe('tile');
    expect(normalizeTuning({ textureSize: 4 }, 'notes').textureSize).toBe(
      MIN_TEXTURE_SIZE,
    );
    expect(normalizeTuning({ textureSize: 9000 }, 'notes').textureSize).toBe(
      MAX_TEXTURE_SIZE,
    );
    expect(normalizeTuning({ textureSize: 100.6 }, 'notes').textureSize).toBe(
      101,
    );
    expect(
      normalizeTuning({ textureSize: Number.NaN }, 'notes').textureSize,
    ).toBe(TEXTURE_TILE);
  });
});
