/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  CURVE_LIST_FORMAT,
  CURVE_NAME_MAX,
  cleanCurveName,
  curveFileNames,
  fromCurveListFile,
  planCurveImport,
  readCurveText,
  toCurveListFile,
  uniqueCurveName,
  type IMyCurve,
} from 'common/myCurves';

const HD600 = `Preamp: -9.9 dB
Filter 1: ON PK Fc 58 Hz Gain 3.2 dB Q 2.000
Filter 2: ON PK Fc 4300 Hz Gain 10.6 dB Q 1.200`;

const curve = (over: Partial<IMyCurve> = {}): IMyCurve => ({
  id: 'c1',
  name: 'HD 600 · Harman',
  text: HD600,
  source: 'squiglink',
  ears: 'both',
  addedAt: 1_790_000_000_000,
  ...over,
});

describe('a curve', () => {
  it('is its ParametricEQ text, read as the correction layer reads it', () => {
    const parsed = readCurveText(HD600);
    expect(parsed?.preAmp).toBe(-9.9);
    expect(Object.keys(parsed?.filters ?? {})).toHaveLength(2);
    expect(readCurveText('just words')).toBeUndefined();
    expect(readCurveText('')).toBeUndefined();
  });

  it('keeps a correction past a slider’s ±20 dB, as published curves need', () => {
    const parsed = readCurveText('Filter 1: ON PK Fc 30 Hz Gain -26 dB Q 1');
    expect(Object.values(parsed?.filters ?? {})[0].gain).toBe(-26);
  });

  it('is named tidily: trimmed, single-spaced, never past the limit', () => {
    expect(cleanCurveName('  HD   600  ')).toBe('HD 600');
    expect(cleanCurveName('x'.repeat(200))).toHaveLength(CURVE_NAME_MAX);
  });

  it('gets the next free number when the name is taken, whatever its case', () => {
    expect(uniqueCurveName('Warm', [])).toBe('Warm');
    expect(uniqueCurveName('Warm', ['warm'])).toBe('Warm (2)');
    expect(uniqueCurveName('Warm', ['Warm', 'Warm (2)'])).toBe('Warm (3)');
    expect(
      uniqueCurveName('y'.repeat(CURVE_NAME_MAX), ['y'.repeat(CURVE_NAME_MAX)]),
    ).toHaveLength(CURVE_NAME_MAX);
  });
});

describe('the list file', () => {
  it('reads back whole what it wrote: names, curves, sources, ears and dates', () => {
    const list = [
      curve(),
      curve({ id: 'c2', name: 'Left fix', ears: 'left', source: 'file' }),
    ];
    const reading = fromCurveListFile(toCurveListFile(list));
    expect(reading?.skipped).toBe(0);
    expect(reading?.curves).toEqual(
      list.map(({ name, text, source, ears, addedAt }) => ({
        name,
        text,
        source,
        ears,
        addedAt,
      })),
    );
  });

  it('is nothing at all when it is not a curve list, never an empty one', () => {
    expect(
      fromCurveListFile('{"format":"something-else","curves":[]}'),
    ).toBeUndefined();
    expect(
      fromCurveListFile(
        JSON.stringify({ format: CURVE_LIST_FORMAT, version: 2, curves: [] }),
      ),
    ).toBeUndefined();
    expect(fromCurveListFile('not json')).toBeUndefined();
  });

  it('leaves out, and counts, an entry that holds no curve', () => {
    const reading = fromCurveListFile(
      JSON.stringify({
        format: CURVE_LIST_FORMAT,
        version: 1,
        curves: [
          { name: 'Good', text: HD600, source: 'squiglink', ears: 'right' },
          { name: 'Empty', text: 'nothing here' },
          { name: '   ', text: HD600 },
          'a string',
        ],
      }),
    );
    expect(reading?.curves.map((entry) => entry.name)).toEqual(['Good']);
    expect(reading?.curves[0].ears).toBe('right');
    expect(reading?.skipped).toBe(3);
  });

  it('reads an unknown source or ear as a file for both ears', () => {
    const reading = fromCurveListFile(
      JSON.stringify({
        format: CURVE_LIST_FORMAT,
        version: 1,
        curves: [{ name: 'Odd', text: HD600, source: 'web', ears: 'middle' }],
      }),
    );
    expect(reading?.curves[0]).toMatchObject({ source: 'file', ears: 'both' });
  });
});

describe('a folder of .txt files', () => {
  it('names each file after its curve, without characters no file system takes, and never twice', () => {
    expect(
      curveFileNames([
        curve({ name: 'HD 600 / Harman: "2018"?' }),
        curve({ name: 'Warm' }),
        curve({ name: 'warm' }),
        curve({ name: '...' }),
      ]),
    ).toEqual([
      'HD 600 Harman 2018.txt',
      'Warm.txt',
      'warm (2).txt',
      'Curve.txt',
    ]);
  });
});

describe('planning an import', () => {
  it('marks every incoming name already kept, without case, with the kept curve', () => {
    const plan = planCurveImport(
      [
        { name: 'hd 600 · harman', text: HD600, source: 'file', ears: 'both' },
        { name: 'Brand new', text: HD600, source: 'file', ears: 'both' },
      ],
      [curve()],
    );
    expect(plan[0].clashesWith).toBe('c1');
    expect(plan[1].clashesWith).toBeUndefined();
  });
});
