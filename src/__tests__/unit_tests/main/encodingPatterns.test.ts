/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The positive control for `typecheck:encoding`.
 *
 * The script can only ever say "unmangled", so without this a version whose
 * patterns match nothing reads exactly like a clean tree -- which is how the
 * first version missed every em-dash. Each signature is held to the bytes a
 * real round-trip produced, and to prose that must NOT trip it.
 */
import {
  C1_CONTROL,
  CP1252_MANGLED,
  MANGLED_PAIR,
  isMangledLine,
} from '../../../../.erb/scripts/encodingPatterns';

/** UTF-8 bytes decoded as Latin-1 -- `Get-Content -Raw` on a .NET without CP1252. */
const asLatin1 = (text: string): string =>
  Buffer.from(text, 'utf8').toString('latin1');

/**
 * UTF-8 bytes decoded as CP1252 -- Windows PowerShell 5.1 on this machine.
 *
 * Node has no CP1252 decoder, so the table is the twenty-seven printable
 * replacements Microsoft assigns to 80-9F; the five undefined positions stay
 * as the control codes, which is also what .NET returns for them.
 */
const asCp1252 = (text: string): string => {
  const table: Record<number, string> = {
    0x80: '€',
    0x82: '‚',
    0x83: 'ƒ',
    0x84: '„',
    0x85: '…',
    0x86: '†',
    0x87: '‡',
    0x88: 'ˆ',
    0x89: '‰',
    0x8a: 'Š',
    0x8b: '‹',
    0x8c: 'Œ',
    0x8e: 'Ž',
    0x91: '‘',
    0x92: '’',
    0x93: '“',
    0x94: '”',
    0x95: '•',
    0x96: '–',
    0x97: '—',
    0x98: '˜',
    0x99: '™',
    0x9a: 'š',
    0x9b: '›',
    0x9c: 'œ',
    0x9e: 'ž',
    0x9f: 'Ÿ',
  };
  return Array.from(Buffer.from(text, 'utf8'))
    .map((byte) => table[byte] ?? String.fromCharCode(byte))
    .join('');
};

describe('encoding signatures', () => {
  it('reads the fixtures the way the two decoders do', () => {
    // Measured from a real `Get-Content | Set-Content -Encoding utf8` on
    // 2026-09-10: the em-dash came back as C3 A2 E2 82 AC E2 80 9D.
    expect(asCp1252('—')).toBe('\u00e2\u20ac\u201d');
    expect(asLatin1('—')).toBe('\u00e2\u0080\u0094');
  });

  it('C1_CONTROL catches a Latin-1 mangled em-dash and nothing printable', () => {
    expect(C1_CONTROL.test(asLatin1('a — b'))).toBe(true);
    expect(C1_CONTROL.test(asCp1252('a — b'))).toBe(false);
    expect(C1_CONTROL.test('a — b')).toBe(false);
  });

  it('MANGLED_PAIR catches a mangled middle dot and not accented prose', () => {
    expect(MANGLED_PAIR.test(asLatin1('A·B'))).toBe(true);
    expect(MANGLED_PAIR.test(asCp1252('A·B'))).toBe(true);
    expect(MANGLED_PAIR.test('Âge et café')).toBe(false);
  });

  it('CP1252_MANGLED catches what Windows PowerShell makes of UTF-8', () => {
    expect(CP1252_MANGLED.test(asCp1252('a — b'))).toBe(true);
    expect(CP1252_MANGLED.test(asCp1252('Windows’ files'))).toBe(true);
    expect(CP1252_MANGLED.test(asCp1252('wait…'))).toBe(true);
    expect(CP1252_MANGLED.test(asCp1252('Êole'))).toBe(true);
    expect(CP1252_MANGLED.test(asCp1252('“quoted”'))).toBe(true);
    expect(CP1252_MANGLED.test(asCp1252('🎵'))).toBe(true);
  });

  it('CP1252_MANGLED leaves accented prose and real punctuation alone', () => {
    [
      "l'âme et la pâte",
      'Âge, Ão Paulo, à côté',
      'naïve café été',
      'a real — dash and ‘curly’ “quotes” …',
      'prices €5 and â€ alone',
      'ð alone, and ðŸ with one tail',
    ].forEach((line) => {
      expect(CP1252_MANGLED.test(line)).toBe(false);
    });
  });

  it('isMangledLine is the union, so no signature can be dropped silently', () => {
    expect(isMangledLine(asLatin1('—'))).toBe(true);
    expect(isMangledLine(asLatin1('·'))).toBe(true);
    expect(isMangledLine(asCp1252('—'))).toBe(true);
    expect(isMangledLine('plain ASCII and é')).toBe(false);
  });
});
