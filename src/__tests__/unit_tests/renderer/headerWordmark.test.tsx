/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The header's name in the broad pen (Ivan, 2026-11-26): one outline swept
 * by a flat nib, the version as two numbers over the Q, and the song laid on
 * the tail only where the bar already has the room — never under the word,
 * and never by taking width from the meter.
 */

import { render } from '@testing-library/react';
import WordmarkStill from 'renderer/shell/wordmark/WordmarkStill';
import {
  buildWordmark,
  sampleStroke,
} from 'renderer/shell/wordmark/wordmarkPen';
import {
  SONG_MAX_PX,
  SONG_MIN_PX,
  TAIL_FLOURISH_PX,
  isLineClipped,
  shortVersion,
  wordmarkRoom,
} from 'renderer/shell/wordmark/wordmarkRoom';

/** Twice the signed area of a closed polygon given as "x y" pairs. */
const signedArea = (piece: string) => {
  const points = piece
    .replace(/^M|Z$/g, '')
    .split('L')
    .map((pair) => pair.split(' ').map(Number));
  return points.reduce((sum, [x, y], i) => {
    const [nextX, nextY] = points[(i + 1) % points.length];
    return sum + x * nextY - nextX * y;
  }, 0);
};

describe('the pen', () => {
  const shape = buildWordmark();
  // The i's dot is an arc, drawn last; every other piece is a hull.
  const pieces = shape.path
    .split(/(?=M)/)
    .filter((piece) => !piece.includes('a'));

  it('sweeps the whole word into one closed outline', () => {
    expect(pieces.length).toBeGreaterThan(300);
    pieces.forEach((piece) => expect(piece.endsWith('Z')).toBe(true));
    expect(shape.box.width).toBeGreaterThan(shape.box.height * 3);
  });

  // Filled with the default nonzero rule, a piece wound the other way where
  // two overlap would punch a hole through the stroke.
  it('winds every piece the same way, so overlaps fill instead of cancelling', () => {
    const areas = pieces
      .map(signedArea)
      .filter((area) => Math.abs(area) > 1e-6);
    expect(areas.every((area) => area > 0)).toBe(true);
    // The control: the same piece read backwards is wound the other way.
    const reversed = `M${pieces[10]
      .replace(/^M|Z$/g, '')
      .split('L')
      .reverse()
      .join('L')}Z`;
    expect(signedArea(reversed)).toBeLessThan(0);
  });

  it('ends the Q’s tail to the right of the Q, where the sound takes over', () => {
    expect(shape.tailEnd.x).toBeGreaterThan(shape.qShoulder.x);
    expect(shape.tailWidth).toBeGreaterThan(5);
  });

  it('reads the skeleton’s own path commands', () => {
    const line = sampleStroke('M 0 0 L 10 0', 2);
    expect(line[0]).toEqual([0, 0]);
    expect(line[line.length - 1]).toEqual([10, 0]);
    const closed = sampleStroke('M 0 0 L 10 0 L 10 10 Z', 5);
    expect(closed[closed.length - 1]).toEqual([0, 0]);
  });
});

describe('the song on the tail', () => {
  const input = { tailStart: 140, versionRight: 168 };

  it('rides the tail where the bar has room, never wider than its cap', () => {
    const room = wordmarkRoom({ ...input, tabsLeft: 900 });
    expect(room.songLeft).toBe(178);
    expect(room.songWidth).toBe(SONG_MAX_PX);
    // The tail runs on under the whole of it.
    expect(input.tailStart + room.tailLength).toBe(
      (room.songLeft ?? 0) + SONG_MAX_PX,
    );
  });

  it('takes only the room there is before the first tab', () => {
    const room = wordmarkRoom({ ...input, tabsLeft: 178 + 16 + 200 });
    expect(room.songWidth).toBe(200);
  });

  it('is not shown, under the word or anywhere, without that room', () => {
    const tight = wordmarkRoom({
      ...input,
      tabsLeft: 178 + 16 + SONG_MIN_PX - 1,
    });
    expect(tight).toEqual({ tailLength: TAIL_FLOURISH_PX });
    expect(wordmarkRoom({ ...input, tabsLeft: Number.NaN })).toEqual({
      tailLength: TAIL_FLOURISH_PX,
    });
  });

  it('fades a line out only when it truly runs past its box', () => {
    expect(isLineClipped(200, 200)).toBe(false);
    // A pixel of rounding is not a clipped line.
    expect(isLineClipped(201, 200)).toBe(false);
    expect(isLineClipped(240, 200)).toBe(true);
  });
});

describe('the version', () => {
  it('is always two numbers', () => {
    expect(shortVersion('2.6.0')).toBe('v2.6');
    expect(shortVersion('2.10.3')).toBe('v2.10');
    expect(shortVersion('3')).toBe('v3.0');
  });

  it('is nothing without a version', () => {
    expect(shortVersion('')).toBe('');
    expect(shortVersion('dev')).toBe('');
  });
});

describe('the name as a picture', () => {
  it('reads as the product, with its tail at rest', () => {
    const { getByRole, container } = render(<WordmarkStill />);
    expect(getByRole('img', { name: 'FluidEQ' })).toBeTruthy();
    const tail = container.querySelector('.header-wordmark__tail path');
    expect(tail?.getAttribute('d')).toMatch(/^M0\.0 /);
  });
});
