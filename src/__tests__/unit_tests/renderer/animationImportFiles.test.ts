/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What an animation import is, from the files' bytes, never their names
 * (Ivan, 2026-11-09: "import all animation styles, standard ones like
 * sheets and other that most used"): a still sheet, a sheet with its atlas
 * JSON, an animated GIF, APNG or WebP, or a numbered sequence; and the name
 * the animation is given. Each rule beside its control.
 */

import {
  animationNameFrom,
  gifSize,
  importKindOf,
  isAnimatedWebp,
  isApng,
  MAX_IMPORT_FILE_BYTES,
} from '../../../renderer/studio/animations/import/importFiles';
import { pngHeader, webpHeader } from '../../utils/pictureHeaders';

const chunk = (type: string, data: number[]) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return [...length, ...Buffer.from(type, 'ascii'), ...data, 0, 0, 0, 0];
};
const png = (...chunks: number[][]) =>
  new Uint8Array([...pngHeader(64, 32), ...chunks.flat()]);
const APNG = png(chunk('acTL', [0, 0, 0, 4, 0, 0, 0, 0]), chunk('IDAT', [1]));
const STILL_PNG = png(chunk('IDAT', [1]));
const GIF = new Uint8Array([
  ...Buffer.from('GIF89a', 'ascii'),
  0x40,
  0x01,
  0xf0,
  0x00,
  0,
  0,
  0,
]);
const animatedWebp = () => {
  const bytes = webpHeader(64, 64);
  // VP8X's flags, nothing else set: the animation bit.
  bytes[20] = 0x02;
  return bytes;
};
const file = (name: string, bytes: Uint8Array) => ({ name, bytes });
const json = (name: string) =>
  file(name, new Uint8Array(Buffer.from('{"frames":{}}')));

describe('an animated picture is told by its bytes', () => {
  it('an APNG by the acTL chunk before its image data', () => {
    expect(isApng(APNG)).toBe(true);
  });

  it('control: acTL written inside another chunk is not one, nor after the image', () => {
    const inText = png(
      chunk('tEXt', [...Buffer.from('acTL', 'ascii')]),
      chunk('IDAT', [1]),
    );
    const late = png(chunk('IDAT', [1]), chunk('acTL', [0, 0, 0, 4]));
    expect(isApng(inText)).toBe(false);
    expect(isApng(late)).toBe(false);
    expect(isApng(STILL_PNG)).toBe(false);
  });

  it('an animated WebP by its header’s flag', () => {
    expect(isAnimatedWebp(animatedWebp())).toBe(true);
    expect(isAnimatedWebp(webpHeader(64, 64))).toBe(false);
  });

  it('reads a GIF’s canvas, little-endian', () => {
    expect(gifSize(GIF)).toEqual([320, 240]);
    expect(gifSize(STILL_PNG)).toBeNull();
  });
});

describe('the kind of an import', () => {
  it('one still picture is a sheet to cut by its grid', () => {
    expect(importKindOf([file('walk.png', STILL_PNG)])).toMatchObject({
      kind: 'grid',
    });
  });

  it('one animated picture is decoded with its timing, as what it is', () => {
    expect(importKindOf([file('spin.gif', GIF)])).toMatchObject({
      kind: 'animated',
      type: 'image/gif',
    });
    expect(importKindOf([file('spin.png', APNG)])).toMatchObject({
      kind: 'animated',
      type: 'image/png',
    });
    expect(importKindOf([file('spin.webp', animatedWebp())])).toMatchObject({
      kind: 'animated',
      type: 'image/webp',
    });
  });

  it('an Aseprite file by its magic number, even when its size reads as a brace', () => {
    const ase = new Uint8Array(200);
    // The file's size, first: 0x7b is "{", which a JSON opens with.
    ase.set([0x7b, 0, 0, 0, 0xe0, 0xa5]);
    expect(importKindOf([file('hero.aseprite', ase)])).toMatchObject({
      kind: 'aseprite',
    });
  });

  it('control: the same bytes without the magic number are no picture', () => {
    const notAse = new Uint8Array(200);
    notAse.set([0x7b, 0, 0, 0, 0, 0]);
    expect(importKindOf([file('hero.bin', notAse)])).toEqual({
      refused: 'mixed',
    });
  });

  it('a picture with a JSON is a sheet cut by its atlas, in either order', () => {
    expect(
      importKindOf([json('hero.json'), file('hero.png', STILL_PNG)]),
    ).toMatchObject({ kind: 'atlas', picture: { name: 'hero.png' } });
  });

  it('several pictures are a sequence, in the order a person numbers them', () => {
    const kind = importKindOf(
      ['walk_10.png', 'walk_2.png', 'walk_1.png'].map((name) =>
        file(name, STILL_PNG),
      ),
    );
    expect(kind).toMatchObject({
      kind: 'sequence',
      pictures: [
        { name: 'walk_1.png' },
        { name: 'walk_2.png' },
        { name: 'walk_10.png' },
      ],
    });
  });

  it('refuses files of more than one animation, or a JSON with no one picture', () => {
    expect(
      importKindOf([
        json('a.json'),
        file('a.png', STILL_PNG),
        file('b.png', STILL_PNG),
      ]),
    ).toEqual({ refused: 'mixed' });
    expect(
      importKindOf([file('a.png', STILL_PNG), file('b.gif', GIF)]),
    ).toEqual({ refused: 'mixed' });
  });

  it('refuses what is no picture it reads, and names it', () => {
    expect(
      importKindOf([
        file(
          'notes.txt',
          new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
        ),
      ]),
    ).toEqual({ refused: 'unreadable', file: 'notes.txt' });
  });

  it('refuses a picture past its size and more frames than an animation holds', () => {
    const huge = new Uint8Array(MAX_IMPORT_FILE_BYTES + 1);
    huge.set(STILL_PNG);
    expect(importKindOf([file('huge.png', huge)])).toEqual({
      refused: 'too-large',
      file: 'huge.png',
    });
    expect(
      importKindOf(
        Array.from({ length: 257 }, (_, at) => file(`f${at}.png`, STILL_PNG)),
      ),
    ).toEqual({ refused: 'too-many', most: 256 });
  });

  it('control: exactly as many frames as an animation holds are taken', () => {
    expect(
      importKindOf(
        Array.from({ length: 256 }, (_, at) => file(`f${at}.png`, STILL_PNG)),
      ),
    ).toMatchObject({ kind: 'sequence' });
  });

  it('refuses nothing chosen', () => {
    expect(importKindOf([])).toEqual({ refused: 'nothing' });
  });
});

describe('the animation’s name', () => {
  it('is the file’s, in the scene’s form', () => {
    expect(animationNameFrom('Whale Dive (final).PNG', new Set())).toBe(
      'whale-dive-final',
    );
  });

  it('starts with a letter, and is never longer than a name may be', () => {
    expect(animationNameFrom('01_run.gif', new Set())).toBe('animation-01-run');
    const long = animationNameFrom(`${'a'.repeat(80)}.png`, new Set());
    expect(long.length).toBeLessThanOrEqual(40);
    expect(/^[a-z][a-z0-9-]{0,39}$/.test(long)).toBe(true);
  });

  it('is kept apart from the names taken by a number', () => {
    expect(animationNameFrom('walk.png', new Set(['walk', 'walk-2']))).toBe(
      'walk-3',
    );
  });

  it('control: a name nobody has is kept as it is', () => {
    expect(animationNameFrom('walk.png', new Set(['run']))).toBe('walk');
  });
});
