/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { parseEqText } from 'common/apoText';
import { FilterTypeEnum, type IFilter } from 'common/constants';
import { curveTextOf, eqCurveText } from 'common/curveText';
import { readCurveText, type IMyCurve } from 'common/myCurves';
import {
  fromCurveStore,
  isCurveListPayload,
  readStoredCurve,
  toCurveStore,
} from 'common/myCurvesFile';

const TEXT = 'Preamp: -3 dB\nFilter 1: ON PK Fc 100 Hz Gain 3 dB Q 1';

const curve = (over: Partial<IMyCurve> = {}): IMyCurve => ({
  id: 'c1',
  name: 'Warm',
  text: TEXT,
  source: 'file',
  ears: 'both',
  addedAt: 1_790_000_000_000,
  ...over,
});

describe('the file main keeps My curves in', () => {
  it('reads back exactly what it wrote', () => {
    const list = [curve(), curve({ id: 'c2', name: 'Left', ears: 'left' })];
    expect(fromCurveStore(toCurveStore(list))).toEqual(list);
  });

  it('is nothing at all when damaged or from a newer FluidEQ, never an empty list', () => {
    expect(fromCurveStore('{not json')).toBeUndefined();
    expect(
      fromCurveStore(JSON.stringify({ version: 2, curves: [] })),
    ).toBeUndefined();
    expect(fromCurveStore(JSON.stringify({ version: 1 }))).toBeUndefined();
    expect(fromCurveStore(JSON.stringify({ version: 1, curves: [] }))).toEqual(
      [],
    );
  });

  it('leaves out an entry that holds no curve, and a second entry under the same id', () => {
    const contents = JSON.stringify({
      version: 1,
      curves: [curve(), curve({ text: 'no curve', id: 'c9' }), curve()],
    });
    expect(fromCurveStore(contents)).toEqual([curve()]);
  });
});

describe('a list the window sends', () => {
  it('is kept only when every entry is a curve exactly as it would be read back', () => {
    expect(isCurveListPayload([curve(), curve({ id: 'c2' })])).toBe(true);
    expect(isCurveListPayload([])).toBe(true);
  });

  it.each([
    ['not a list', { curves: [] }],
    ['an entry with no curve', [curve({ text: 'rm -rf /' })]],
    ['two entries under one id', [curve(), curve()]],
    ['a name that would be tidied', [curve({ name: '  Warm  ' })]],
    ['a source nobody wrote', [{ ...curve(), source: 'web' }]],
    ['an empty id', [curve({ id: '' })]],
    [
      'more than the list holds',
      Array.from({ length: 501 }, (_, index) => curve({ id: `c${index}` })),
    ],
  ])('is refused whole for %s', (_what, payload) => {
    expect(isCurveListPayload(payload)).toBe(false);
  });

  it('reads one kept curve with an unknown source or ear as a file for both ears', () => {
    expect(
      readStoredCurve({ ...curve(), source: 'web', ears: 'middle' }),
    ).toMatchObject({ source: 'file', ears: 'both' });
  });
});

describe('bands written as a curve', () => {
  const band = (id: string, over: Partial<IFilter>): IFilter => ({
    id,
    frequency: 1000,
    gain: 0,
    quality: 1,
    type: FilterTypeEnum.PK,
    ...over,
  });

  it('reads back as the same bands, low to high, the switched-off ones left out', () => {
    const text = curveTextOf({
      preAmp: -4.25,
      filters: {
        b: band('b', { frequency: 8000, gain: -2.5, quality: 0.707 }),
        a: band('a', { frequency: 80, gain: 4, type: FilterTypeEnum.LSC }),
        c: band('c', { frequency: 30, type: FilterTypeEnum.HPQ, quality: 0.7 }),
        off: band('off', { frequency: 500, gain: 6, isEnabled: false }),
      },
    });
    expect(text).toBe(
      [
        'Preamp: -4.25 dB',
        'Filter 1: ON HPQ Fc 30 Hz Q 0.7',
        'Filter 2: ON LSC Fc 80 Hz Gain 4 dB Q 1',
        'Filter 3: ON PK Fc 8000 Hz Gain -2.5 dB Q 0.71',
      ].join('\n'),
    );
    const read = readCurveText(text);
    expect(
      Object.values(read?.filters ?? {}).map(({ type, frequency, gain }) => [
        type,
        frequency,
        gain,
      ]),
    ).toEqual([
      ['HPQ', 30, 0],
      ['LSC', 80, 4],
      ['PK', 8000, -2.5],
    ]);
  });

  it('keeps a published GraphicEQ as its points, not the bands projected from them', () => {
    const text = curveTextOf({
      preAmp: 0,
      filters: { a: band('a', { gain: 9 }) },
      graphicEq: [
        { frequency: 20, gain: -1 },
        { frequency: 1000, gain: 2.5 },
      ],
    });
    expect(text).toBe('Preamp: 0 dB\nGraphicEQ: 20 -1; 1000 2.5');
    expect(readCurveText(text)?.graphicEq).toHaveLength(2);
  });

  it('takes your EQ for the ears asked: flat bands left out, one-ear bands counted when both are asked', () => {
    const filters = {
      a: band('a', { frequency: 100, gain: 3 }),
      flat: band('flat', { frequency: 1000 }),
      l: band('l', { frequency: 2000, gain: -1, channel: 'left' }),
      r: band('r', { frequency: 3000, gain: 2, channel: 'right' }),
    };
    expect(eqCurveText(0, filters, 'both')).toMatchObject({
      leftOut: 2,
      bands: 1,
    });
    const left = eqCurveText(0, filters, 'left');
    expect(left).toMatchObject({ leftOut: 0, bands: 2 });
    expect(left.text).toContain('Fc 2000 Hz');
    expect(left.text).not.toContain('Fc 3000 Hz');
    expect(left.text).not.toContain('Fc 1000 Hz');
  });
});

describe('the lines a curve text could not use', () => {
  it('are named by number, with blank lines, comments and bands switched off left alone', () => {
    const parsed = parseEqText(
      [
        'Preamp: -2 dB',
        '',
        '# a comment',
        'Channel: L',
        'Filter 1: ON PK Fc 100 Hz Gain 2 dB Q 1',
        'Filter 2: OFF PK Fc 200 Hz Gain 2 dB Q 1',
        'Filter 3: ON XYZ Fc 300 Hz Gain 2 dB Q 1',
        'nonsense',
      ].join('\n'),
    );
    expect(parsed.unreadLines).toEqual([4, 7, 8]);
    expect(parsed.unsupported).toBe(1);
  });
});
