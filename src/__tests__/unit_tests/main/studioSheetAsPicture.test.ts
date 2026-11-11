/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  adoptPackedSheets,
  sheetIn,
} from '../../../main/studioChat/sheetAsPicture';
import { pngHeader } from '../../utils/pictureHeaders';

/**
 * A sheet of animation frames packed as a plain picture (Ivan, 2026-11-11:
 * "the agent create a full animation sheet as a pic instead of as an
 * animation"): told from a picture, made the animation it is, and said so.
 */

interface IBlob {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A clear picture with opaque boxes drawn on it. */
const picture = (width: number, height: number, blobs: IBlob[]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  blobs.forEach((blob) => {
    for (let { y } = blob; y < blob.y + blob.height; y += 1) {
      for (let { x } = blob; x < blob.x + blob.width; x += 1) {
        data.fill(255, (y * width + x) * 4, (y * width + x) * 4 + 4);
      }
    }
  });
  return { width, height, data };
};

/** Four poses of one bird, 64 to a cell, each a little different. */
const BIRD_SHEET = picture(256, 64, [
  { x: 12, y: 16, width: 40, height: 30 },
  { x: 76, y: 14, width: 42, height: 34 },
  { x: 140, y: 18, width: 38, height: 28 },
  { x: 204, y: 16, width: 40, height: 32 },
]);

describe('telling a sheet of frames from a picture', () => {
  it('knows a row of poses of one thing', () => {
    expect(sheetIn(BIRD_SHEET)).toEqual({ columns: 4, rows: 1 });
  });

  it('leaves one thing, two things, and things of different sizes alone', () => {
    // A rock.
    expect(
      sheetIn(picture(128, 128, [{ x: 20, y: 30, width: 90, height: 70 }])),
    ).toBeUndefined();
    // Two trees: two of a thing are two things.
    expect(
      sheetIn(
        picture(128, 64, [
          { x: 8, y: 8, width: 44, height: 48 },
          { x: 72, y: 8, width: 44, height: 48 },
        ]),
      ),
    ).toBeUndefined();
    // A bush, a tree and a pebble that happen to stand apart.
    expect(
      sheetIn(
        picture(192, 64, [
          { x: 8, y: 30, width: 44, height: 26 },
          { x: 70, y: 2, width: 50, height: 60 },
          { x: 150, y: 50, width: 10, height: 8 },
        ]),
      ),
    ).toBeUndefined();
    // Three things as wide as each other, evenly apart, and nothing alike
    // in height: a hedge, a tower and a step. The gaps alone say "grid".
    const uneven = picture(192, 64, [
      { x: 10, y: 34, width: 44, height: 24 },
      { x: 74, y: 2, width: 44, height: 60 },
      { x: 138, y: 54, width: 44, height: 6 },
    ]);
    expect(sheetIn(uneven)).toBeUndefined();
    // The control: the same three at one height are frames.
    expect(
      sheetIn(
        picture(192, 64, [
          { x: 10, y: 20, width: 44, height: 30 },
          { x: 74, y: 18, width: 44, height: 32 },
          { x: 138, y: 22, width: 44, height: 28 },
        ]),
      ),
    ).toEqual({ columns: 3, rows: 1 });
  });
});

describe('a sheet packed as a plain picture', () => {
  const folders: string[] = [];
  afterEach(() => {
    folders
      .splice(0)
      .forEach((folder) => fs.rmSync(folder, { recursive: true, force: true }));
  });

  const projectWith = (pictures: string[]) => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-sheet-'));
    folders.push(folder);
    fs.writeFileSync(path.join(folder, 'pack.json'), '{"id":"reef"}');
    fs.mkdirSync(path.join(folder, 'art'));
    pictures.forEach((name) =>
      fs.writeFileSync(
        path.join(folder, 'art', `${name}.png`),
        pngHeader(256, 64),
      ),
    );
    return folder;
  };

  const animationOf = (folder: string, name: string) => {
    const file = path.join(folder, 'animations', `${name}.json`);
    return fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>)
      : undefined;
  };

  it('is made the animation of its name, and the chat is told firmly', async () => {
    const folder = projectWith(['bird-fly']);
    const notes = await adoptPackedSheets(
      folder,
      ['art/bird-fly.png'],
      () => BIRD_SHEET,
    );
    expect(notes).toHaveLength(1);
    expect(animationOf(folder, 'bird-fly')).toMatchObject({
      sheet: 'art/bird-fly.png',
      count: 4,
      columns: 4,
      loop: true,
    });
    expect(notes[0]).toContain(
      'art/bird-fly.png is a sheet of animation frames',
    );
    expect(notes[0]).toContain('NEVER saved as a picture and packed');
    expect(notes[0]).toContain('build_sheet');
  });

  it('leaves a picture that is not a sheet, and one already an animation', async () => {
    const folder = projectWith(['rock', 'bird-fly']);
    // The rock is one thing.
    const rock = await adoptPackedSheets(folder, ['art/rock.png'], () =>
      picture(256, 64, [{ x: 30, y: 8, width: 190, height: 50 }]),
    );
    expect(rock).toEqual([]);
    expect(animationOf(folder, 'rock')).toBeUndefined();
    // The bird is a sheet: adopted once…
    const first = await adoptPackedSheets(
      folder,
      ['art/bird-fly.png'],
      () => BIRD_SHEET,
    );
    expect(first).toHaveLength(1);
    // …and packed again it is an animation already: nothing to say, and
    // what the chat set since is not written over.
    const file = path.join(folder, 'animations', 'bird-fly.json');
    const set = { ...animationOf(folder, 'bird-fly'), fps: 24 };
    fs.writeFileSync(file, JSON.stringify(set));
    const again = await adoptPackedSheets(
      folder,
      ['art/bird-fly.png'],
      () => BIRD_SHEET,
    );
    expect(again).toEqual([]);
    expect(animationOf(folder, 'bird-fly')).toMatchObject({ fps: 24 });
  });
});
