/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A band kept to one ear leaves its twin on the other, and Both joins them
 * (Ivan, 2026-10-13: "if they wanna move x band on the left we still need
 * same band for the right to be available"). One rule for the main EQ's
 * bands and the DSP rack's.
 */

import { planEarChange, type IEarBand } from '../../../common/bandEars';

const band = (
  key: string,
  frequency: number,
  ear?: IEarBand['ear'],
  type = 'PK',
): IEarBand => ({ key, frequency, type, ...(ear ? { ear } : {}) });

describe('a band kept to one ear', () => {
  it('splits into itself on that ear and a twin on the other', () => {
    expect(planEarChange([band('a', 1000)], ['a'], 'left', 5)).toEqual({
      ears: [{ key: 'a', ear: 'left' }],
      copies: [{ from: 'a', ear: 'right' }],
      removed: [],
    });
  });

  it('keeps its ear without a twin when the rack is full', () => {
    expect(planEarChange([band('a', 1000)], ['a'], 'right', 0)).toEqual({
      ears: [{ key: 'a', ear: 'right' }],
      copies: [],
      removed: [],
    });
  });

  it('joins with its twin on Both, the nearest of its shape on the other ear', () => {
    const rack = [
      band('l', 1000, 'left'),
      // Nearer, but another shape: not its twin.
      band('shelf', 1050, 'right', 'HSC'),
      band('far', 6000, 'right'),
      band('twin', 1200, 'right'),
    ];
    expect(planEarChange(rack, ['l'], 'both', 5)).toEqual({
      ears: [{ key: 'l', ear: 'both' }],
      copies: [],
      removed: ['twin'],
    });
  });

  it('moves its twin the other way when it crosses to the other ear', () => {
    const rack = [band('l', 1000, 'left'), band('r', 1100, 'right')];
    expect(planEarChange(rack, ['l'], 'right', 5).ears).toEqual([
      { key: 'l', ear: 'right' },
      { key: 'r', ear: 'left' },
    ]);
  });

  it('claims each twin once across a selection, and never one asked for', () => {
    // Two left bands, one right: only the nearer finds a twin to join.
    const rack = [
      band('a', 1000, 'left'),
      band('b', 1300, 'left'),
      band('t', 1250, 'right'),
    ];
    expect(planEarChange(rack, ['a', 'b'], 'both', 5).removed).toEqual(['t']);
    // A selected band is not another selected band's twin.
    const pair = [band('l', 1000, 'left'), band('r', 1000, 'right')];
    expect(planEarChange(pair, ['l', 'r'], 'both', 5).removed).toEqual([]);
  });

  it('leaves a band already where it is asked to be alone', () => {
    expect(planEarChange([band('a', 1000, 'left')], ['a'], 'left', 5)).toEqual({
      ears: [],
      copies: [],
      removed: [],
    });
    expect(planEarChange([band('a', 1000)], ['a'], 'both', 5)).toEqual({
      ears: [],
      copies: [],
      removed: [],
    });
  });
});
