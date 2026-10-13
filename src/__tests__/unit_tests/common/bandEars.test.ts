/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A band plays on both ears or as a left + right pair the two ears move
 * apart, and Both joins a pair in its middle (Ivan, 2026-10-13: "lets do both
 * and left + right", "if they choose both then it joins the mid"). One rule
 * for the main EQ's bands and the DSP rack's.
 */

import {
  earChoiceOf,
  planEarChange,
  type IEarBand,
} from '../../../common/bandEars';

const band = (
  key: string,
  frequency: number,
  ear?: IEarBand['ear'],
  type = 'PK',
  gain = 0,
  quality = 1,
): IEarBand => ({
  key,
  frequency,
  gain,
  quality,
  type,
  ...(ear ? { ear } : {}),
});

describe('left + right', () => {
  it('splits a band into itself on the left and the same band on the right', () => {
    expect(planEarChange([band('a', 1000)], ['a'], 'split', 5)).toEqual({
      ears: [{ key: 'a', ear: 'left' }],
      copies: [{ from: 'a', ear: 'right' }],
      removed: [],
    });
  });

  it('stays on both ears when there is no room for the right half', () => {
    expect(planEarChange([band('a', 1000)], ['a'], 'split', 0)).toEqual({
      ears: [],
      copies: [],
      removed: [],
    });
  });

  it('leaves a band already in a pair as it is', () => {
    expect(planEarChange([band('a', 1000, 'left')], ['a'], 'split', 5)).toEqual(
      { ears: [], copies: [], removed: [] },
    );
  });
});

describe('both ears', () => {
  it('joins a pair in its middle: halfway in frequency, the average gain and width', () => {
    const rack = [
      band('l', 1000, 'left', 'PK', 6, 1),
      // Nearer, but another shape: not its twin.
      band('shelf', 1050, 'right', 'HSC'),
      band('far', 6000, 'right'),
      band('twin', 4000, 'right', 'PK', -2, 2),
    ];
    expect(planEarChange(rack, ['l'], 'both', 5)).toEqual({
      ears: [
        {
          key: 'l',
          ear: 'both',
          middle: { frequency: 2000, gain: 2, quality: 1.5 },
        },
      ],
      copies: [],
      removed: ['twin'],
    });
  });

  it('joins a pair once when both halves are selected', () => {
    const pair = [band('l', 1000, 'left'), band('r', 1000, 'right')];
    const plan = planEarChange(pair, ['l', 'r'], 'both', 5);
    expect(plan.removed).toEqual(['r']);
    expect(plan.ears.map((one) => one.key)).toEqual(['l']);
  });

  it('puts a half with no twin back on both ears as it is', () => {
    expect(planEarChange([band('a', 1000, 'left')], ['a'], 'both', 5)).toEqual({
      ears: [{ key: 'a', ear: 'both' }],
      copies: [],
      removed: [],
    });
  });

  it('leaves a band already on both ears alone', () => {
    expect(planEarChange([band('a', 1000)], ['a'], 'both', 5)).toEqual({
      ears: [],
      copies: [],
      removed: [],
    });
  });
});

describe('what the menu ticks', () => {
  it('ticks both ears, the pair, or nothing over a mixed selection', () => {
    expect(earChoiceOf([{}])).toBe('both');
    expect(earChoiceOf([{ channel: 'left' }, { channel: 'right' }])).toBe(
      'split',
    );
    expect(earChoiceOf([{}, { channel: 'left' }])).toBeUndefined();
  });
});
