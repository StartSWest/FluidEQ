/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The base64 check every scene, pack and cover goes through. It replaced a
 * regular expression that threw a RangeError on a 3D model of the size a
 * scene may carry: it must answer exactly as that expression did, and answer
 * at any size.
 */
import isBase64 from 'common/base64';

// The expression it replaces, as the reference for short strings.
const REFERENCE = /^[A-Za-z0-9+/]+={0,2}$/;

describe('isBase64', () => {
  it('answers as the expression it replaced', () => {
    const samples = [
      '',
      '=',
      '==',
      '===',
      'A',
      'A=',
      'A==',
      'A===',
      '=A',
      'AB=C',
      'QUJD',
      'QUI=',
      'QQ==',
      'a+/9',
      'a b',
      'ab\n',
      'abc-',
      'abc_',
      'Ä',
      '😀',
    ];
    samples.forEach((sample) => {
      expect([sample, isBase64(sample)]).toEqual([
        sample,
        REFERENCE.test(sample),
      ]);
    });
  });

  it('agrees with it on every short string of a small alphabet', () => {
    // Every string up to five characters over letters that each take a
    // different path: a letter, the two symbols, the padding, and one that
    // does not belong.
    const letters = ['A', '+', '/', '=', '-'];
    let strings = [''];
    for (let length = 1; length <= 5; length += 1) {
      strings = strings.flatMap((s) => letters.map((letter) => s + letter));
      strings.forEach((s) =>
        expect([s, isBase64(s)]).toEqual([s, REFERENCE.test(s)]),
      );
    }
  });

  it('refuses what is not a string', () => {
    [undefined, null, 42, {}, ['QUJD']].forEach((value) =>
      expect(isBase64(value)).toBe(false),
    );
  });

  it('answers on text far past the size that broke the expression', () => {
    // 64 million characters: the largest model a scene may carry is some
    // 8.4 million, and a signed pack's payload is longer.
    const huge = 'QUJD'.repeat(16 * 1024 * 1024);
    expect(isBase64(huge)).toBe(true);
    expect(isBase64(`${huge}==`)).toBe(true);
    expect(isBase64(`${huge.slice(0, -1)}-`)).toBe(false);
  });
});
