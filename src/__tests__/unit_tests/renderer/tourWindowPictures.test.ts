/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What's New 2.6 opens on one window drawn white left of a seam and dark
 * right of it (`TourSplitWindow`). It shipped with its dark picture
 * captured from a white window, so the seam moved and nothing changed
 * colour (Ivan, 2026-11-25: "The What's New slider is not turning the right
 * side dark"). Every test that renders the slide sees the image imports as
 * one stub, so the pictures themselves are read here: the dark one must be a
 * dark window across its face, the white one a white window, each the
 * other's control, at the size the slide declares for both.
 */

import { readFileSync } from 'fs';
import path from 'path';
import jpegBlockLevels from '../../utils/jpegBlockLevels';

const picture = (name: string) =>
  jpegBlockLevels(
    readFileSync(path.join(__dirname, '../../../../assets/tour', name)),
  );

/** The share of a picture's 8x8 blocks on one side of a brightness. */
const shareOf = (blocks: number[], isOnSide: (level: number) => boolean) =>
  blocks.filter(isOnSide).length / blocks.length;

describe("What's New 2.6's split window pictures", () => {
  const dark = picture('window-dark.jpg');
  const white = picture('window-white.jpg');

  it('are both the size the slide lays them out at', () => {
    expect([dark.width, dark.height]).toEqual([1920, 1200]);
    expect([white.width, white.height]).toEqual([1920, 1200]);
  });

  it('show a dark window right of the seam', () => {
    // A dark window's lit parts (the curve, the meters, the words) are a
    // few percent of it; the white capture it shipped as was 0% dark.
    expect(shareOf(dark.blocks, (level) => level < 0.4)).toBeGreaterThan(0.9);
  });

  it('show a white window left of the seam', () => {
    expect(shareOf(white.blocks, (level) => level > 0.6)).toBeGreaterThan(0.9);
  });
});
