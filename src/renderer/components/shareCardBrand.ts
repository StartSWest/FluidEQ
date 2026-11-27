/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { BRAND_MARK } from 'common/branding';
import {
  WORDMARK_LOGO_LEAD,
  WORDMARK_SHAPE,
} from '../shell/wordmark/WordmarkLetters';
import {
  calmSignal,
  tailOffsets,
  tailOutline,
  tailSignal,
} from '../shell/wordmark/wordmarkTail';
import BRAND_SQUIRCLE from './brandSquircle';
import { alphaOf, hexOf, type IShareCardInks } from './shareCardInks';

/**
 * THE HEADER'S BRAND ON THE SHARE CARD (Ivan, 2026-11-27, direction B
 * "Signature"): the logo as the app icon and "FluidEQ" in the broad pen,
 * drawn from the same geometry the title bar draws (`SignalBrandMark`,
 * `WordmarkLetters`), never a picture of them. The Q's tail runs on across
 * the card as the sound, as it does in the title bar.
 */

/** The header's proportions: a 44px logo and an 8px gap beside a 36px word. */
const LOGO_PER_WORD = 44 / 36;
const GAP_PER_LOGO = 8 / 44;

/** The logo's wave and its length in the 48-unit tile, for the highlight. */
const WAVE_PATH = BRAND_MARK.path;

/**
 * The wave's length in tile units: two cubic swings, each measured as a
 * polyline of 64 steps (to a hundredth of a unit). The highlight's dashes are
 * written against a wave sixty units long (`pathLength`), as the header's
 * are.
 */
const WAVE_LENGTH = (() => {
  const swing = (
    from: readonly number[],
    one: readonly number[],
    two: readonly number[],
    to: readonly number[],
  ) => {
    let length = 0;
    let last = from;
    for (let i = 1; i <= 64; i += 1) {
      const t = i / 64;
      const u = 1 - t;
      const point = [0, 1].map(
        (k) =>
          u * u * u * from[k] +
          3 * u * u * t * one[k] +
          3 * u * t * t * two[k] +
          t * t * t * to[k],
      );
      length += Math.hypot(point[0] - last[0], point[1] - last[1]);
      last = point;
    }
    return length;
  };
  // `M7 24C12.6 10.7 18.3 10.7 24 24S35.4 37.3 41 24`: the S mirrors the
  // first swing's second handle about its end.
  return (
    swing([7, 24], [12.6, 10.7], [18.3, 10.7], [24, 24]) +
    swing([24, 24], [29.7, 37.3], [35.4, 37.3], [41, 24])
  );
})();

const runAcross = (
  context: CanvasRenderingContext2D,
  colours: readonly string[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  colours.forEach((colour, index) =>
    gradient.addColorStop(index / (colours.length - 1), colour),
  );
  return gradient;
};

/**
 * The logo, `size` px square with its top left at x, y: the squircle with the
 * app icon's own dark face (the card is always dark), the colour rising from
 * its depth, the light across its top, the edge and the wave in the accent's
 * run, the wave's own glow and its highlight.
 */
export const drawBrandLogo = (
  context: CanvasRenderingContext2D,
  inks: IShareCardInks,
  x: number,
  y: number,
  size: number,
) => {
  const tile = new Path2D(BRAND_SQUIRCLE);
  const wave = new Path2D(WAVE_PATH);
  const logo = inks.logo.map(hexOf);
  context.save();
  context.translate(x, y);
  context.scale(size / 48, size / 48);
  context.fillStyle = runAcross(
    context,
    ['#16212e', '#0b1119', '#04070b'],
    7.2,
    2.4,
    40.8,
    45.6,
  );
  context.fill(tile);
  context.save();
  context.clip(tile);
  const depth = context.createRadialGradient(24, 28.8, 0, 24, 28.8, 24);
  depth.addColorStop(0, alphaOf(inks.logo[2], 0.22));
  depth.addColorStop(0.6, alphaOf(inks.logo[2], 0.05));
  depth.addColorStop(1, alphaOf(inks.logo[2], 0));
  context.fillStyle = depth;
  context.fillRect(0, 0, 48, 48);
  const sheen = context.createLinearGradient(0, 0, 0, 24);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = sheen;
  context.fillRect(0, 0, 48, 24);
  context.restore();

  context.strokeStyle = runAcross(
    context,
    [logo[0], logo[2], logo[4]],
    0,
    0,
    48,
    48,
  );
  context.lineWidth = 1.9;
  context.stroke(tile);

  context.lineCap = 'round';
  context.lineWidth = 6.4;
  context.strokeStyle = runAcross(context, logo, 7, 0, 41, 0);
  // The wave's own light, as the header's `drop-shadow(0 0 2px)` on it: the
  // stroke blurred under itself, inside the tile.
  context.save();
  context.filter = `blur(${(2 * size) / 48}px)`;
  context.globalAlpha = 0.7;
  context.stroke(wave);
  context.restore();
  context.stroke(wave);

  const unit = WAVE_LENGTH / 60;
  context.translate(0, -1.6);
  context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  context.lineWidth = 1.3;
  context.setLineDash([0, 5 * unit, 22 * unit, 60 * unit]);
  context.stroke(wave);
  context.restore();
};

/**
 * A run of music for the tail to carry, the same for the same score: a few
 * swings of a bass, a voice and a hat, so no two scores draw one line.
 */
const waveformFor = (seed: number): number[] =>
  Array.from({ length: 1024 }, (_, i) => {
    const t = i / 1024;
    return (
      Math.sin(t * 13.1 + seed) * 0.34 +
      Math.sin(t * 29.7 + seed * 2.3) * 0.2 +
      Math.sin(t * 61 + seed * 0.7) * 0.08
    );
  });

export interface IBrandPlacement {
  x: number;
  y: number;
  /** The word's height, px; the logo and the gap follow the header's. */
  wordHeight: number;
  /** How far the Q's tail runs on, px. */
  tailLength: number;
  /** How far the music moves the tail from its line, px. */
  sway: number;
  /** Picks the music the tail carries. */
  seed: number;
}

/**
 * The logo, the name and the tail, the logo's top left at x, y. The name's
 * gradient starts at the logo's left edge, as the header's does
 * (`WORDMARK_LOGO_LEAD`), so the first letter picks up where the logo
 * leaves off.
 */
export const drawBrand = (
  context: CanvasRenderingContext2D,
  inks: IShareCardInks,
  placement: IBrandPlacement,
) => {
  const { x, y, wordHeight, tailLength, sway, seed } = placement;
  const { box, tailEnd, tailWidth, path } = WORDMARK_SHAPE;
  const logoSize = wordHeight * LOGO_PER_WORD;
  const gap = logoSize * GAP_PER_LOGO;
  drawBrandLogo(context, inks, x, y, logoSize);

  const scale = wordHeight / box.height;
  const wordLeft = x + logoSize + gap;
  const wordTop = y + (logoSize - wordHeight) / 2;
  context.save();
  context.translate(wordLeft - box.x * scale, wordTop - box.y * scale);
  context.scale(scale, scale);
  context.fillStyle = runAcross(
    context,
    [hexOf(inks.start), hexOf(inks.accent), hexOf(inks.active)],
    box.x - WORDMARK_LOGO_LEAD,
    0,
    tailEnd.x,
    0,
  );
  context.fill(new Path2D(path));
  context.restore();

  // The tail: the word's last colour, thinning as it becomes the sound and
  // running out to a point (`wordmarkTail.ts`).
  const signal = calmSignal(tailSignal(waveformFor(seed)), 12);
  const outline = tailOutline(
    tailOffsets(signal, sway),
    tailLength,
    0,
    tailWidth * scale,
  );
  context.save();
  context.translate(
    wordLeft + (tailEnd.x - box.x) * scale,
    wordTop + (tailEnd.y - box.y) * scale,
  );
  const ink = context.createLinearGradient(0, 0, tailLength, 0);
  ink.addColorStop(0, hexOf(inks.active));
  ink.addColorStop(0.75, hexOf(inks.active));
  ink.addColorStop(1, alphaOf(inks.active, 0));
  context.fillStyle = ink;
  context.fill(new Path2D(outline));
  context.restore();
};

/** Where the Q's tail leaves the word drawn `wordHeight` px tall at `x`. */
export const tailStartFor = (x: number, wordHeight: number): number => {
  const { box, tailEnd } = WORDMARK_SHAPE;
  const logoSize = wordHeight * LOGO_PER_WORD;
  return (
    x +
    logoSize +
    logoSize * GAP_PER_LOGO +
    (tailEnd.x - box.x) * (wordHeight / box.height)
  );
};
