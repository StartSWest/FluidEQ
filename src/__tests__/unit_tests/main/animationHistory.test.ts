/**
 * @jest-environment node
 */

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every animation keeps its history (Ivan, 2026-11-10: "we keep original
 * imported and any other changes are saved ... a history no more than 20 or
 * so ... but we need to keep original and the current modification at
 * least"): the original for good, up to twenty later sheets, undo, redo and
 * back to the original, the live pair the scene reads rewritten each time,
 * and nothing written outside the project.
 */

jest.mock('electron', () => ({ ipcMain: {}, nativeImage: {} }));

/* eslint-disable import/first -- the mock above must be installed first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { answerHistory } from '../../../main/ipc/studioAnimationHistory';
import {
  MAX_VERSIONS,
  moveHistory,
  readHistory,
  readHistoryVersion,
  readOriginalFile,
  recordSheet,
  renameAnimation,
  type IAnimationPlay,
} from '../../../main/memberScenes/animationHistory';
import { readProjectAnimation } from '../../../main/memberScenes/projectAnimations';
import { pngHeader } from '../../utils/pictureHeaders';
/* eslint-enable import/first */

let project: string;
let outside: string;

/** A PNG the bounds accept, told apart from the others by `mark`. */
const sheet = (mark: number) =>
  new Uint8Array(
    Buffer.concat([Buffer.from(pngHeader(64, 32)), Buffer.from([mark])]),
  );

const play = (fps = 10): IAnimationPlay => ({
  count: 4,
  columns: 4,
  fps,
  loop: true,
  ground: 'sky',
});

/** The live sheet's mark, as the scene would read it. */
const liveMark = async (name = 'whale') => {
  const found = await readProjectAnimation(project, name);
  return found ? found.sheet[found.sheet.length - 1] : undefined;
};

const record = (mark: number, label = `mark ${mark}`, name = 'whale') =>
  recordSheet(project, name, sheet(mark), play(), { label });

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-history-'));
  outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-history-out-'));
});

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

describe("an animation's history", () => {
  it('keeps the first sheet as the original and writes the live pair the scene reads', async () => {
    const first = await record(1, 'Import');
    expect(first.ok).toBe(true);
    expect(await liveMark()).toBe(1);
    expect(readHistory(project, 'whale')).toMatchObject({
      current: 'original',
      canUndo: false,
      canRedo: false,
      versions: [{ id: 'original', label: 'Import' }],
    });
    expect(
      JSON.parse(
        fs.readFileSync(path.join(project, 'animations/whale.json'), 'utf8'),
      ).sheet,
    ).toBe('art/whale.png');
  });

  it('undoes and redoes through every version and the original, and no further', async () => {
    await record(1);
    await record(2);
    await record(3);
    expect(await liveMark()).toBe(3);
    await moveHistory(project, 'whale', 'undo');
    expect(await liveMark()).toBe(2);
    await moveHistory(project, 'whale', 'undo');
    expect(await liveMark()).toBe(1);
    const past = await moveHistory(project, 'whale', 'undo');
    expect(past.ok).toBe(false);
    await moveHistory(project, 'whale', 'redo');
    await moveHistory(project, 'whale', 'redo');
    expect(await liveMark()).toBe(3);
    expect((await moveHistory(project, 'whale', 'redo')).ok).toBe(false);
    await moveHistory(project, 'whale', 'original');
    expect(await liveMark()).toBe(1);
  });

  it('lets go of what an undo stepped back from when something new is recorded', async () => {
    await record(1);
    await record(2);
    await record(3);
    await moveHistory(project, 'whale', 'undo');
    await record(4);
    const list = readHistory(project, 'whale');
    expect(list?.versions.map((entry) => entry.label)).toEqual([
      'mark 1',
      'mark 2',
      'mark 4',
    ]);
    expect(list?.canRedo).toBe(false);
  });

  it(`keeps at most ${MAX_VERSIONS} versions, the oldest let go and never the original`, async () => {
    await record(0, 'Import');
    for (let mark = 1; mark <= MAX_VERSIONS + 5; mark += 1) {
      // eslint-disable-next-line no-await-in-loop -- one version after another, as the member makes them
      await record(mark);
    }
    const list = readHistory(project, 'whale');
    expect(list?.versions).toHaveLength(MAX_VERSIONS + 1);
    expect(list?.versions[0]).toMatchObject({
      id: 'original',
      label: 'Import',
    });
    expect(list?.versions[1].label).toBe('mark 6');
    expect(
      fs.readdirSync(path.join(project, 'animation-history/whale')).sort(),
    ).toHaveLength(MAX_VERSIONS + 2);
    await moveHistory(project, 'whale', 'original');
    expect(await liveMark()).toBe(0);
  });

  it('keeps a change made around the history before an undo, and adds nothing when there was none', async () => {
    await record(1);
    await record(2);
    // The control: nothing changed, so an undo only steps back.
    await moveHistory(project, 'whale', 'undo');
    await moveHistory(project, 'whale', 'redo');
    expect(readHistory(project, 'whale')?.versions).toHaveLength(2);
    // The agent edits the file by hand: 10 frames a second become 6.
    fs.writeFileSync(
      path.join(project, 'animations/whale.json'),
      JSON.stringify({ sheet: 'art/whale.png', ...play(6) }),
    );
    await moveHistory(project, 'whale', 'undo');
    const list = readHistory(project, 'whale');
    expect(list?.versions.map((entry) => entry.label)).toEqual([
      'mark 1',
      'mark 2',
      'Changed outside the history',
    ]);
    expect((await readProjectAnimation(project, 'whale'))?.animation.fps).toBe(
      10,
    );
    await moveHistory(project, 'whale', 'redo');
    expect((await readProjectAnimation(project, 'whale'))?.animation.fps).toBe(
      6,
    );
  });

  it('keeps an animation made before the history as its original', async () => {
    fs.mkdirSync(path.join(project, 'art'));
    fs.mkdirSync(path.join(project, 'animations'));
    fs.writeFileSync(path.join(project, 'art/whale.png'), sheet(9));
    fs.writeFileSync(
      path.join(project, 'animations/whale.json'),
      JSON.stringify({ sheet: 'art/whale.png', ...play() }),
    );
    await record(1);
    expect(await liveMark()).toBe(1);
    await moveHistory(project, 'whale', 'original');
    expect(await liveMark()).toBe(9);
    expect(readHistory(project, 'whale')?.versions[0].label).toBe(
      'Before the history',
    );
  });

  it("keeps the member's files as they came with the original, and only proper ones", async () => {
    const gif = new Uint8Array(Buffer.from('GIF89a the chibi'));
    const kept = await recordSheet(project, 'chibi', sheet(1), play(), {
      label: 'Import',
      original: [{ name: 'chibi.gif', bytes: gif }],
    });
    expect(kept.ok).toBe(true);
    expect(
      readOriginalFile(project, 'chibi', 'chibi.gif')?.equals(Buffer.from(gif)),
    ).toBe(true);
    expect(readHistoryVersion(project, 'chibi', 'original')?.files).toEqual([
      'chibi.gif',
    ]);
    // A second original is refused: there is one, kept for good.
    expect(
      (
        await recordSheet(project, 'chibi', sheet(2), play(), {
          label: 'Again',
          original: [{ name: 'other.gif', bytes: gif }],
        })
      ).ok,
    ).toBe(false);
    const refused = await Promise.all(
      ['../escape.gif', 'a/b.png', 'notes.exe', '.hidden.png'].map((name) =>
        recordSheet(project, 'fox', sheet(1), play(), {
          label: 'Import',
          original: [{ name, bytes: gif }],
        }),
      ),
    );
    expect(refused.every((outcome) => !outcome.ok)).toBe(true);
    expect(fs.existsSync(path.join(project, 'animation-history/fox'))).toBe(
      false,
    );
  });

  it('deletes the live pair and keeps the history, and brings it back', async () => {
    await record(1);
    await record(2);
    await moveHistory(project, 'whale', 'delete');
    expect(await readProjectAnimation(project, 'whale')).toBeUndefined();
    expect(readHistory(project, 'whale')?.deleted).toBe(true);
    expect((await moveHistory(project, 'whale', 'undo')).ok).toBe(false);
    await moveHistory(project, 'whale', 'bring-back');
    expect(await liveMark()).toBe(2);
  });

  it('renames the picture, the file and the history together, never onto a used name', async () => {
    await record(1);
    await record(2);
    await record(3, 'x', 'fox');
    expect((await renameAnimation(project, 'whale', 'fox')).ok).toBe(false);
    const renamed = await renameAnimation(project, 'whale', 'orca');
    expect(renamed.ok).toBe(true);
    expect(await liveMark('orca')).toBe(2);
    expect(await readProjectAnimation(project, 'whale')).toBeUndefined();
    expect(fs.existsSync(path.join(project, 'animation-history/whale'))).toBe(
      false,
    );
    await moveHistory(project, 'orca', 'undo');
    expect(await liveMark('orca')).toBe(1);
    // The control: the other animation is as it was.
    expect(await liveMark('fox')).toBe(3);
  });

  it('does not bring a deleted animation back over a name used since', async () => {
    await record(1);
    await moveHistory(project, 'whale', 'delete');
    await record(5, 'Someone new', 'whale-two');
    fs.writeFileSync(path.join(project, 'art/whale.png'), sheet(7));
    const back = await moveHistory(project, 'whale', 'bring-back');
    expect(back).toMatchObject({ ok: false, code: 'taken' });
    expect(
      fs.readFileSync(path.join(project, 'art/whale.png')).slice(-1)[0],
    ).toBe(7);
  });

  it('deletes an animation made by hand undoably, and never a picture that only shares its name', async () => {
    fs.mkdirSync(path.join(project, 'art'));
    fs.mkdirSync(path.join(project, 'animations'));
    fs.writeFileSync(path.join(project, 'art/whale.png'), sheet(8));
    fs.writeFileSync(path.join(project, 'art/whale-sheet.png'), sheet(9));
    fs.writeFileSync(
      path.join(project, 'animations/whale.json'),
      JSON.stringify({ sheet: 'art/whale-sheet.png', ...play() }),
    );
    expect((await moveHistory(project, 'whale', 'delete')).ok).toBe(true);
    expect(fs.existsSync(path.join(project, 'animations/whale.json'))).toBe(
      false,
    );
    expect(
      fs.readFileSync(path.join(project, 'art/whale.png')).slice(-1)[0],
    ).toBe(8);
    fs.unlinkSync(path.join(project, 'art/whale.png'));
    await moveHistory(project, 'whale', 'bring-back');
    expect(await liveMark()).toBe(9);
  });

  it('runs calls on one animation one after another', async () => {
    await record(1);
    await Promise.all([record(2), record(3), record(4)]);
    expect(
      readHistory(project, 'whale')?.versions.map((entry) => entry.label),
    ).toEqual(['mark 1', 'mark 2', 'mark 3', 'mark 4']);
    expect(await liveMark()).toBe(4);
  });
});

describe('the history keeps to the project', () => {
  it('writes nothing through a history folder that is a junction out of it', async () => {
    fs.symlinkSync(
      outside,
      path.join(project, 'animation-history'),
      'junction',
    );
    expect((await record(1)).ok).toBe(false);
    expect(fs.readdirSync(outside)).toEqual([]);
    expect(fs.existsSync(path.join(project, 'art/whale.png'))).toBe(false);
  });

  it('takes only an animation name, never a path', async () => {
    const outcomes = await Promise.all(
      ['../whale', 'a/b', 'Whale', ''].map((name) => record(1, 'x', name)),
    );
    expect(outcomes.every((outcome) => !outcome.ok)).toBe(true);
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it('refuses a sheet that is not a PNG within the bounds', async () => {
    const notPng = new Uint8Array(Buffer.from('not a picture'));
    expect(
      (await recordSheet(project, 'whale', notPng, play(), { label: 'x' })).ok,
    ).toBe(false);
    const bomb = new Uint8Array(pngHeader(40000, 40000));
    expect(
      (await recordSheet(project, 'whale', bomb, play(), { label: 'x' })).ok,
    ).toBe(false);
    // The control: a proper sheet is kept.
    expect((await record(1)).ok).toBe(true);
  });
});

describe("the Animations tab's requests", () => {
  it('lists, records and moves by name, and refuses anything else', async () => {
    expect(
      await answerHistory(project, { action: 'list', name: 'whale' }),
    ).toEqual({
      ok: true,
      history: undefined,
    });
    const recorded = await answerHistory(project, {
      action: 'record',
      name: 'whale',
      sheet: sheet(1),
      ...play(),
      label: 'Removed the background',
    });
    expect(recorded).toMatchObject({
      ok: true,
      history: { current: 'original' },
    });
    await answerHistory(project, {
      action: 'record',
      name: 'whale',
      sheet: sheet(2),
      ...play(),
      label: 'Twice the size',
    });
    expect(
      await answerHistory(project, { action: 'undo', name: 'whale' }),
    ).toMatchObject({ ok: true, history: { current: 'original' } });
    expect(
      await answerHistory(project, {
        action: 'read',
        name: 'whale',
        id: 'original',
      }),
    ).toMatchObject({ ok: true, play: { count: 4 } });
    expect(
      await answerHistory(project, {
        action: 'record',
        name: 'whale',
        sheet: 'x',
      }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
    expect(
      await answerHistory(project, { action: 'list', name: '../x' }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
    expect(
      await answerHistory(project, { action: 'format', name: 'whale' }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
  });
});
