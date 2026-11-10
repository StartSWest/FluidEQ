/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The atlas JSON a sprite tool writes beside its sheet, read into frames
 * and animations: TexturePacker's and Phaser's hash and array, Phaser 3's
 * multi-atlas, and Aseprite's export with its durations and tags; trimmed
 * and turned frames kept as they sat. Each rule beside its control.
 */

import {
  MAX_ATLAS_FRAMES,
  readAtlas,
} from '../../../renderer/studio/animations/import/importAtlas';

const cell = (x: number, extra: Record<string, unknown> = {}) => ({
  frame: { x, y: 0, w: 32, h: 48 },
  rotated: false,
  trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 },
  sourceSize: { w: 32, h: 48 },
  ...extra,
});

describe('an atlas’s frames', () => {
  it('are read from a hash, in its order', () => {
    const atlas = readAtlas(
      JSON.stringify({ frames: { 'a.png': cell(0), 'b.png': cell(32) } }),
    );
    expect(atlas?.frames.map(({ name, frame }) => [name, frame.x])).toEqual([
      ['a.png', 0],
      ['b.png', 32],
    ]);
  });

  it('are read from an array, and from a multi-atlas’s first texture', () => {
    const array = readAtlas(
      JSON.stringify({
        frames: [
          { filename: 'a', ...cell(0) },
          { filename: 'b', ...cell(32) },
        ],
      }),
    );
    const multi = readAtlas(
      JSON.stringify({
        textures: [
          { image: 'sheet.png', frames: [{ filename: 'a', ...cell(0) }] },
        ],
      }),
    );
    expect(array?.frames).toHaveLength(2);
    expect(multi?.frames.map(({ name }) => name)).toEqual(['a']);
  });

  it('keep where a trimmed frame sat on its canvas', () => {
    const atlas = readAtlas(
      JSON.stringify({
        frames: {
          a: cell(0, {
            trimmed: true,
            frame: { x: 0, y: 0, w: 20, h: 30 },
            spriteSourceSize: { x: 6, y: 10, w: 20, h: 30 },
            sourceSize: { w: 32, h: 48 },
          }),
        },
      }),
    );
    expect(atlas?.frames[0]).toMatchObject({
      placed: { x: 6, y: 10, w: 20, h: 30 },
      source: { w: 32, h: 48 },
    });
  });

  it('take a turned frame’s canvas the other way round', () => {
    const atlas = readAtlas(
      JSON.stringify({
        frames: {
          a: {
            frame: { x: 0, y: 0, w: 48, h: 32 },
            rotated: true,
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 },
          },
        },
      }),
    );
    expect(atlas?.frames[0]).toMatchObject({
      rotated: true,
      source: { w: 32, h: 48 },
      placed: { x: 0, y: 0, w: 32, h: 48 },
    });
  });

  it('control: a placement past its own canvas is taken as the whole frame', () => {
    const atlas = readAtlas(
      JSON.stringify({
        frames: {
          a: cell(0, { spriteSourceSize: { x: 30, y: 0, w: 32, h: 48 } }),
        },
      }),
    );
    expect(atlas?.frames[0].placed).toEqual({ x: 0, y: 0, w: 32, h: 48 });
  });

  it('carry the duration Aseprite gives each', () => {
    const atlas = readAtlas(
      JSON.stringify({ frames: [cell(0, { duration: 120 }), cell(32)] }),
    );
    expect(atlas?.frames.map(({ duration }) => duration)).toEqual([
      120,
      undefined,
    ]);
  });
});

describe('an atlas’s animations', () => {
  const six = Array.from({ length: 6 }, (_, at) => cell(at * 32));

  it('are its tags, played as each says', () => {
    const atlas = readAtlas(
      JSON.stringify({
        frames: six,
        meta: {
          frameTags: [
            { name: 'walk', from: 0, to: 2, direction: 'forward' },
            { name: 'back', from: 0, to: 2, direction: 'reverse' },
            { name: 'bob', from: 3, to: 5, direction: 'pingpong' },
          ],
        },
      }),
    );
    expect(atlas?.animations).toEqual([
      { name: 'walk', order: [0, 1, 2] },
      { name: 'back', order: [2, 1, 0] },
      // There and back, the ends not twice in a row when it loops.
      { name: 'bob', order: [3, 4, 5, 4] },
    ]);
  });

  it('control: a tag past the frames is left out', () => {
    const atlas = readAtlas(
      JSON.stringify({
        frames: six,
        meta: { frameTags: [{ name: 'gone', from: 4, to: 9 }] },
      }),
    );
    expect(atlas?.animations).toEqual([
      { name: '', order: [0, 1, 2, 3, 4, 5] },
    ]);
  });

  it('are the names’ stems when frames are numbered, each in number order', () => {
    const atlas = readAtlas(
      JSON.stringify({
        frames: {
          'run_02.png': cell(0),
          'walk_01.png': cell(32),
          'run_01.png': cell(64),
          'walk_02.png': cell(96),
        },
      }),
    );
    expect(atlas?.animations).toEqual([
      { name: 'run', order: [2, 0] },
      { name: 'walk', order: [1, 3] },
    ]);
  });

  it('control: one stem, or names without numbers, are one animation', () => {
    const one = readAtlas(
      JSON.stringify({
        frames: { 'walk_2.png': cell(0), 'walk_1.png': cell(32) },
      }),
    );
    const plain = readAtlas(
      JSON.stringify({ frames: { idle: cell(0), jump: cell(32) } }),
    );
    expect(one?.animations).toEqual([{ name: '', order: [0, 1] }]);
    expect(plain?.animations).toEqual([{ name: '', order: [0, 1] }]);
  });
});

describe('what is not an atlas', () => {
  it('is refused: no JSON, no frames, a frame without its place', () => {
    expect(readAtlas('{ not json')).toBeUndefined();
    expect(readAtlas(JSON.stringify({ frames: {} }))).toBeUndefined();
    expect(
      readAtlas(JSON.stringify({ frames: { a: { frame: { x: 0, y: 0 } } } })),
    ).toBeUndefined();
  });

  it('is refused past the most frames an atlas may name', () => {
    const many = Array.from({ length: MAX_ATLAS_FRAMES + 1 }, () => cell(0));
    expect(readAtlas(JSON.stringify({ frames: many }))).toBeUndefined();
  });

  it('control: as many frames as an atlas may name are read', () => {
    const many = Array.from({ length: MAX_ATLAS_FRAMES }, () => cell(0));
    expect(readAtlas(JSON.stringify({ frames: many }))?.frames).toHaveLength(
      MAX_ATLAS_FRAMES,
    );
  });
});
