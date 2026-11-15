/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { MAX_LYRICS_FILE_BYTES } from 'common/library/lyrics';
import {
  checkLyricsImport,
  decodeLyricsBytes,
  isLyricsFileName,
} from 'common/library/lyricsImport';

/**
 * Lyrics a listener brings in, checked before anything is written: text
 * only, no bigger than a lyrics file, with words in it, line ends made one
 * kind, and written as `.lrc` exactly when the Lyrics tab will follow its
 * timing. Every line was written for this test.
 */

const char = (code: number) => String.fromCharCode(code);
const BOM = char(0xfeff);

describe('checking imported lyrics', () => {
  it('keeps timed words as a .lrc and plain words as a .txt', () => {
    expect(
      checkLyricsImport('[00:01.00]Salt on the rope\n[00:04.00]Gulls'),
    ).toEqual({
      ok: true,
      text: '[00:01.00]Salt on the rope\n[00:04.00]Gulls\n',
      extension: '.lrc',
    });
    expect(checkLyricsImport('Salt on the rope\nGulls')).toEqual({
      ok: true,
      text: 'Salt on the rope\nGulls\n',
      extension: '.txt',
    });
  });

  it('writes one kind of line end, no byte-order mark, one final newline', () => {
    const check = checkLyricsImport(
      `${BOM}Salt on the rope\r\nGulls\rHome\r\n\r\n\r\n`,
    );
    expect(check).toEqual({
      ok: true,
      text: 'Salt on the rope\nGulls\nHome\n',
      extension: '.txt',
    });
  });

  it('refuses a binary renamed: a NUL, or a run of control characters', () => {
    expect(checkLyricsImport(`ID3${char(0)}${char(3)}Salt`)).toEqual({
      ok: false,
      reason: 'notText',
    });
    const noise = Array.from({ length: 40 }, (_, index) =>
      char(1 + (index % 7)),
    ).join('');
    expect(checkLyricsImport(`Salt on the rope ${noise}`)).toEqual({
      ok: false,
      reason: 'notText',
    });
  });

  it('lets through a stray control character an editor left', () => {
    const line = 'Salt on the rope, the harbour wall, the long way home';
    expect(checkLyricsImport(`${line}${char(0x1a)}\n${line}`)).toMatchObject({
      ok: true,
    });
  });

  it('refuses more than a lyrics file holds, measured in bytes', () => {
    // Three bytes a character in UTF-8: under the cap in characters, over it
    // in bytes, which is what is written.
    const wide = '歌'.repeat(Math.ceil(MAX_LYRICS_FILE_BYTES / 3) + 1);
    expect(wide.length).toBeLessThan(MAX_LYRICS_FILE_BYTES);
    expect(checkLyricsImport(wide)).toEqual({ ok: false, reason: 'tooBig' });
    expect(
      checkLyricsImport('a'.repeat(MAX_LYRICS_FILE_BYTES - 1)),
    ).toMatchObject({ ok: true });
  });

  it('refuses text with no words in it', () => {
    expect(checkLyricsImport('  \n\r\n\t')).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(checkLyricsImport('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('knows a lyrics file by its extension, any case', () => {
    expect(isLyricsFileName('Song.LRC')).toBe(true);
    expect(isLyricsFileName('Song.txt')).toBe(true);
    expect(isLyricsFileName('Song.mp3')).toBe(false);
    expect(isLyricsFileName('lrc')).toBe(false);
  });
});

describe('reading a lyrics file’s bytes', () => {
  it('reads UTF-8, dropping its byte-order mark', () => {
    const bytes = new TextEncoder().encode(`${BOM}Ça ira, ça ira`);
    expect(decodeLyricsBytes(bytes)).toBe('Ça ira, ça ira');
  });

  it('reads UTF-16 by its mark, either byte order', () => {
    const little = new Uint8Array([0xff, 0xfe, 0x4c, 0x00, 0xe4, 0x00]);
    const big = new Uint8Array([0xfe, 0xff, 0x00, 0x4c, 0x00, 0xe4]);
    expect(decodeLyricsBytes(little)).toBe('Lä');
    expect(decodeLyricsBytes(big)).toBe('Lä');
  });

  it('reads what is not UTF-8 in the Windows code page', () => {
    expect(decodeLyricsBytes(new Uint8Array([0x43, 0x61, 0x66, 0xe9]))).toBe(
      'Café',
    );
  });

  it('leaves a UTF-16 file without its mark full of NULs, which the check refuses', () => {
    const unmarked = new Uint8Array([0x4c, 0x00, 0x61, 0x00, 0x61, 0x00]);
    expect(checkLyricsImport(decodeLyricsBytes(unmarked))).toEqual({
      ok: false,
      reason: 'notText',
    });
  });
});
