/**
 * @jest-environment node
 */

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The animator makes its sheet with FluidEQ's own tools (Ivan, 2026-11-09:
 * "fix thje animator", after an animator asked twice for a whale's dive
 * answered that it had no way to make a picture once the Studio's agents
 * lost the shell): `pose_sheet` bends a picture of the project into poses,
 * `build_sheet` lays frames of the project into one grid, and both end with
 * art/<name>.png and the animation file pointing at it. What they may read
 * and write is `studioSheetToolsBounds.test.ts`.
 */

jest.mock('electron', () => ({ nativeImage: {} }));

/* eslint-disable import/first -- the mock above must be installed first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readProjectAnimation } from '../../../main/memberScenes/projectAnimations';
import { claudeCodeCommand } from '../../../main/studioChat/chatLaunch';
import { stepOf } from '../../../main/studioChat/chatStream';
import {
  boxOf,
  cellOf,
  createSheetProject,
  DIVE,
  encode,
  picture,
  words,
} from '../../utils/sheetFixtures';
/* eslint-enable import/first */

const sheets = createSheetProject();
const { tool, write, readSheet } = sheets;

beforeEach(sheets.setUp);
afterEach(sheets.tearDown);

const same = (a: Uint8Array, b: Uint8Array) =>
  Buffer.from(a).equals(Buffer.from(b));

describe('an animator asked for a sheet', () => {
  it('ends with art/<name>.png and the animation pointing at it, beside one that had no tool', async () => {
    // The control: what Ivan's animator left - a placeholder the Animations
    // tab cannot play, because no sheet exists to name.
    write(
      'animations/whale-dive.json',
      JSON.stringify({ sheet: 'art/whale-dive.png', count: 1 }),
    );
    const { project } = sheets.state;
    expect(await readProjectAnimation(project, 'whale-dive')).toBeUndefined();

    const result = await tool('pose_sheet').call(DIVE);
    expect(result.isError).toBeUndefined();
    const found = await readProjectAnimation(project, 'whale-dive');
    expect(found?.animation).toMatchObject({
      sheet: 'art/whale-dive.png',
      count: 8,
      columns: 4,
      fps: 12,
      loop: false,
      ground: 'water',
    });
    const sheet = readSheet('art/whale-dive.png');
    expect([sheet.width, sheet.height]).toEqual([512, 256]);
    expect(words(result)).toContain('look_at_animation("whale-dive")');
  });

  it('bends the picture through the keys, and with no bend draws the same frame every time', async () => {
    await tool('pose_sheet').call({ ...DIVE, keys: [{ at: 0 }] });
    const still = readSheet('art/whale-dive.png');
    const first = cellOf(still, 4, 2, 0);
    [1, 2, 3, 4, 5, 6, 7].forEach((index) => {
      expect(same(cellOf(still, 4, 2, index).data, first.data)).toBe(true);
    });
    await tool('pose_sheet').call(DIVE);
    const moving = readSheet('art/whale-dive.png');
    expect(same(cellOf(moving, 4, 2, 0).data, first.data)).toBe(true);
    expect(same(cellOf(moving, 4, 2, 4).data, first.data)).toBe(false);
    // The last key turns it nose-down: its drawing reaches lower than at rest.
    expect(boxOf(cellOf(moving, 4, 2, 7))[3]).toBeGreaterThan(
      boxOf(first)[3] + 5,
    );
  });

  it('turns the whole a quarter turn, its box with it', async () => {
    await tool('pose_sheet').call({
      ...DIVE,
      count: 2,
      columns: 2,
      keys: [{ at: 0 }, { at: 1, turn: 90 }],
    });
    const sheet = readSheet('art/whale-dive.png');
    const [l0, t0, r0, b0] = boxOf(cellOf(sheet, 2, 1, 0));
    const [l1, t1, r1, b1] = boxOf(cellOf(sheet, 2, 1, 1));
    expect(Math.abs(r1 - l1 - (b0 - t0))).toBeLessThanOrEqual(3);
    expect(Math.abs(b1 - t1 - (r0 - l0))).toBeLessThanOrEqual(3);
  });

  it('lays a grid the member brought on flat green into one sheet, keyed and on one baseline', async () => {
    // Four frames of a block standing at different heights in its cell.
    const lifts = [0, 6, 2, 9];
    const raw = picture(
      160,
      40,
      (x, y) => {
        const cell = Math.floor(x / 40);
        const local = x - cell * 40;
        return (
          local >= 12 &&
          local < 28 &&
          y >= 10 - lifts[cell] &&
          y < 30 - lifts[cell]
        );
      },
      [200, 40, 40],
      [0, 255, 0, 255],
    );
    write('art/block-raw.png', encode(raw));
    const frames = [{ from: 'art/block-raw.png', columns: 4, rows: 1 }];
    const bottomsOf = () => {
      const sheet = readSheet('art/block-hop.png');
      return [0, 1, 2, 3].map((index) => boxOf(cellOf(sheet, 4, 1, index))[3]);
    };
    const kept = await tool('build_sheet').call({
      name: 'block-hop',
      frames,
      columns: 4,
      align: 'keep',
    });
    expect(kept.isError).toBeUndefined();
    expect(new Set(bottomsOf()).size).toBeGreaterThan(1);

    await tool('build_sheet').call({
      name: 'block-hop',
      frames,
      columns: 4,
      animation: { fps: 8 },
    });
    expect(new Set(bottomsOf()).size).toBe(1);
    // The green is gone: the corner of every cell is clear.
    expect(readSheet('art/block-hop.png').data[3]).toBe(0);
    expect(
      (await readProjectAnimation(sheets.state.project, 'block-hop'))?.animation
        .count,
    ).toBe(4);
  });

  it('mends one frame by building the animation again with that frame replaced', async () => {
    await tool('pose_sheet').call(DIVE);
    write(
      'art/fix.png',
      encode(
        picture(
          64,
          64,
          (x, y) => x > 20 && x < 44 && y > 20 && y < 44,
          [255, 255, 255],
        ),
      ),
    );
    const frames = [
      ...[1, 2, 3, 4, 5, 6].map((frame) => ({
        animation: 'whale-dive',
        frame,
      })),
      { from: 'art/fix.png' },
      { animation: 'whale-dive', frame: 8 },
    ];
    const result = await tool('build_sheet').call({
      name: 'whale-dive',
      frames,
      columns: 4,
      cell: 128,
      align: 'centre',
      animation: { fps: 12, loop: false, ground: 'water' },
    });
    expect(result.isError).toBeUndefined();
    expect(words(result)).toContain('art/fix.png');
    expect(
      (await readProjectAnimation(sheets.state.project, 'whale-dive'))
        ?.animation.count,
    ).toBe(8);
  });
});

describe("the chat's launch", () => {
  // The shell is the member's again, under their own settings and the
  // chat's card (Ivan, 2026-11-10: "quita esa mierda").
  it('offers the sheet tools beside the shell', () => {
    const own = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-own-'));
    try {
      const { args } = claudeCodeCommand({
        own,
        folder: sheets.state.project,
        executable: 'claude',
        brief: 'brief',
        tools: undefined,
        model: 'default',
        effort: 'default',
        sessionId: undefined,
      });
      const tools = args[args.indexOf('--tools') + 1].split(',');
      expect(tools).toContain('Bash');
      expect(args).toContain('mcp__fluideq__pose_sheet');
      expect(args).toContain('mcp__fluideq__build_sheet');
      expect(args).not.toContain('--disallowedTools');
    } finally {
      fs.rmSync(own, { recursive: true, force: true });
    }
  });

  it('shows each sheet tool as making the frames of its animation', () => {
    expect(
      stepOf('s1', 'mcp__fluideq__pose_sheet', { name: 'whale-dive' }),
    ).toMatchObject({ kind: 'sheet', file: 'whale-dive' });
    expect(
      stepOf('s2', 'mcp__fluideq__build_sheet', { name: 'wolf-walk' }).kind,
    ).toBe('sheet');
  });
});
