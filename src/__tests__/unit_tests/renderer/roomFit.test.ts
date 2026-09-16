/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FIT_PAIRS,
  chosenHead,
  nextPair,
  pairsSoFar,
  tallyOf,
} from 'renderer/dsp/roomFit';
import { parseRoomHeadBlock, nearestDirection } from 'common/roomHeadText';

describe('the head fit', () => {
  it('opens with every pairing of the three heads', () => {
    expect(nextPair([])).toEqual({ a: 'small', b: 'medium' });
    expect(nextPair(['a'])).toEqual({ a: 'medium', b: 'large' });
    expect(nextPair(['a', 'b'])).toEqual({ a: 'small', b: 'large' });
  });

  it('replays the two heads with most wins, swapping sides, and stops at five', () => {
    // Large beat medium, large beat small, small beat... no: small lost to
    // medium. Wins: large 2, medium 1, small 0.
    const answers = ['b', 'b', 'b'] as const;
    expect(tallyOf(pairsSoFar(answers), answers)).toEqual({
      small: 0,
      medium: 1,
      large: 2,
    });
    expect(nextPair([...answers])).toEqual({ a: 'medium', b: 'large' });
    expect(nextPair([...answers, 'b'])).toEqual({ a: 'large', b: 'medium' });
    expect(nextPair([...answers, 'b', 'a'])).toBeUndefined();
    expect(pairsSoFar([...answers, 'b', 'a'])).toHaveLength(FIT_PAIRS);
  });

  it('chooses the head with most wins, and the medium one on a tie', () => {
    expect(chosenHead(['b', 'b', 'b', 'b', 'a'])).toBe('large');
    // Every pair "the same": nothing won, the medium head is the answer.
    expect(chosenHead(['same', 'same', 'same', 'same', 'same'])).toBe('medium');
    // Small beat medium, medium beat large, large beat small: one each.
    expect(chosenHead(['a', 'a', 'b', 'same', 'same'])).toBe('medium');
  });

  it('a "same" answer counts for neither head', () => {
    const answers = ['same', 'a'] as const;
    expect(tallyOf(pairsSoFar(answers), answers)).toEqual({
      small: 0,
      medium: 1,
      large: 0,
    });
  });
});

describe('the head file on the app side', () => {
  const block = (rate: number, taps: number) =>
    `rate ${rate} directions 2 taps ${taps}\n` +
    `${Array.from({ length: taps * 2 }, (_u, at) => (at === 0 ? '1' : '0')).join(' ')}\n` +
    `${Array.from({ length: taps * 2 }, (_u, at) => (at === taps ? '0.5' : '0')).join(' ')}\n`;
  const text = `# FluidEQ room head v1 medium\n${block(44100, 4)}${block(48000, 4)}${block(96000, 8)}`;

  it('reads the block for the rate asked for', () => {
    const head = parseRoomHeadBlock(text, 48000);
    expect(head?.directions).toBe(2);
    expect(head?.taps).toBe(4);
    expect(Array.from(head?.left[0] ?? [])).toEqual([1, 0, 0, 0]);
    expect(Array.from(head?.right[1] ?? [])).toEqual([0.5, 0, 0, 0]);
    expect(parseRoomHeadBlock(text, 96000)?.taps).toBe(8);
  });

  it('refuses a rate the file lacks and a short block', () => {
    expect(parseRoomHeadBlock(text, 22050)).toBeUndefined();
    expect(
      parseRoomHeadBlock('rate 48000 directions 2 taps 4\n1 2 3\n', 48000),
    ).toBeUndefined();
  });

  it('finds the ring direction nearest an angle', () => {
    const ring = { directions: 24 };
    expect(nearestDirection(ring, 0)).toBe(0);
    expect(nearestDirection(ring, 90)).toBe(6);
    expect(nearestDirection(ring, -30)).toBe(22);
    expect(nearestDirection(ring, 359)).toBe(0);
  });
});
