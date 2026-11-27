/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The patterns Ivan picked on 2026-11-27 ("add more patterns like bricks"):
 * Bricks, Waves, Honeycomb and Speakers. Each meets its copies at every edge
 * of the tile, at every size the slider gives it, draws in the window's ink,
 * has a stroke spacing to move with the music by, and a name in every
 * language.
 */

import { FILL_TEXTURES, type TFillTexture } from 'common/graphTextures';
import de from 'common/i18n/de/look';
import en from 'common/i18n/en/look';
import es from 'common/i18n/es/look';
import fr from 'common/i18n/fr/look';
import hi from 'common/i18n/hi/look';
import italian from 'common/i18n/it/look';
import ja from 'common/i18n/ja/look';
import ko from 'common/i18n/ko/look';
import pt from 'common/i18n/pt/look';
import ru from 'common/i18n/ru/look';
import zh from 'common/i18n/zh/look';
import zhHant from 'common/i18n/zh-Hant/look';
import {
  PATTERN_SPACING,
  TILE,
  drawTile,
} from 'renderer/graph/fillTextureTiles';

const NEW: TFillTexture[] = ['bricks', 'honeycomb', 'waves', 'speakers'];

type TPoint = [number, number];

/**
 * A context that keeps every straight piece drawn and how many rings, in
 * device pixels, and the ink it was drawn in.
 */
const recording = () => {
  const segments: [TPoint, TPoint][] = [];
  let rings = 0;
  let fills = 0;
  let start: TPoint = [0, 0];
  let at: TPoint = [0, 0];
  const context = {
    strokeStyle: '',
    fillStyle: '',
    lineCap: 'butt',
    lineJoin: 'miter',
    lineWidth: 1,
    globalAlpha: 1,
    beginPath: () => undefined,
    stroke: () => undefined,
    fill: () => {
      fills += 1;
    },
    arc: () => {
      rings += 1;
    },
    rect: () => undefined,
    fillRect: () => undefined,
    moveTo: (x: number, y: number) => {
      start = [x, y];
      at = [x, y];
    },
    lineTo: (x: number, y: number) => {
      segments.push([at, [x, y]]);
      at = [x, y];
    },
    closePath: () => {
      segments.push([at, start]);
      at = start;
    },
  };
  return {
    context: context as unknown as CanvasRenderingContext2D,
    segments,
    rings: () => rings,
    fills: () => fills,
  };
};

/**
 * Where the drawn pieces cross the line `axis` = `at`, read along the other
 * axis and rounded to a hundredth of a pixel: what a neighbouring tile has to
 * continue from.
 */
const crossings = (segments: [TPoint, TPoint][], axis: 0 | 1, at: number) => {
  const other = axis === 0 ? 1 : 0;
  const found = new Set<number>();
  segments.forEach(([a, b]) => {
    const low = Math.min(a[axis], b[axis]);
    const high = Math.max(a[axis], b[axis]);
    if (at < low - 1e-9 || at > high + 1e-9) {
      return;
    }
    if (Math.abs(b[axis] - a[axis]) < 1e-9) {
      return;
    }
    const t = (at - a[axis]) / (b[axis] - a[axis]);
    found.add(Math.round((a[other] + t * (b[other] - a[other])) * 100) / 100);
  });
  return [...found].sort((x, y) => x - y);
};

/** Every line that leaves a tile's edge comes in at the opposite one. */
const seamless = (segments: [TPoint, TPoint][], side: number) =>
  JSON.stringify(crossings(segments, 0, 0)) ===
    JSON.stringify(crossings(segments, 0, side)) &&
  JSON.stringify(crossings(segments, 1, 0)) ===
    JSON.stringify(crossings(segments, 1, side));

describe('the new patterns', () => {
  it('are offered in the editor, before the picture', () => {
    NEW.forEach((texture) => expect(FILL_TEXTURES).toContain(texture));
    expect(FILL_TEXTURES[FILL_TEXTURES.length - 1]).toBe('image');
  });

  it.each(NEW)(
    '%s meets its copies at every edge, at every size',
    (texture) => {
      [16, 32, 40, 96, 128, 256].forEach((side) => {
        const drawn = recording();
        drawTile(drawn.context, texture, side, side / TILE);
        expect(drawn.segments.length + drawn.rings()).toBeGreaterThan(0);
        expect(seamless(drawn.segments, side)).toBe(true);
      });
    },
  );

  it('would see a seam: the check fails on a line that does not continue', () => {
    // The control: a stroke leaving the right edge at another height than it
    // came in at the left.
    expect(
      seamless(
        [
          [
            [0, 4],
            [32, 9],
          ],
        ],
        32,
      ),
    ).toBe(false);
  });

  it.each(NEW)('%s is drawn in the ink it is asked for', (texture) => {
    const white = recording();
    drawTile(white.context, texture, 32, 2, 'white');
    expect(white.context.strokeStyle).toBe('#ffffff');
    const black = recording();
    drawTile(black.context, texture, 32, 2, 'black');
    expect(black.context.strokeStyle).toBe('#000000');
  });

  it('each has a stroke spacing to move with the music by', () => {
    NEW.forEach((texture) => {
      const spacing = PATTERN_SPACING[texture as keyof typeof PATTERN_SPACING];
      expect(spacing).toBeGreaterThan(0);
      expect(spacing).toBeLessThanOrEqual(0.5);
    });
  });

  it('each has a name in every language', () => {
    [de, en, es, fr, hi, italian, ja, ko, pt, ru, zh, zhHant].forEach(
      (dictionary) => {
        NEW.forEach((texture) => {
          const name = (dictionary as Record<string, string | undefined>)[
            `look.texture.${texture}`
          ];
          expect(typeof name).toBe('string');
          expect(name?.trim().length).toBeGreaterThan(0);
        });
      },
    );
  });
});
