/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An imported animation written into the open project
 * (`studioAnimationImport.ts`): as `build_sheet` writes one, a PNG sheet
 * and its JSON; only a PNG that divides into its cells, a name that is a
 * name, numbers an animation may have; never over anything already there,
 * never past the animations a scene holds, never with no project open.
 * Each rule beside its control.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import {
  checkedImport,
  registerStudioAnimationImport,
} from '../../../main/ipc/studioAnimationImport';
import { jpegHeader, pngHeader, webpHeader } from '../../utils/pictureHeaders';
/* eslint-enable import/first */

let project: string;
let stop: () => void;

const request = (change: Record<string, unknown> = {}) => ({
  name: 'whale-dive',
  // Eight 64 x 48 cells, one row.
  sheet: pngHeader(512, 48),
  count: 8,
  columns: 8,
  fps: 12,
  loop: true,
  ground: 'water',
  ...change,
});

const send = async (raw: unknown) =>
  (await handlers.get('studio-animation-import')?.({}, raw)) as {
    ok: boolean;
    reason?: string;
    name?: string;
  };

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-anim-import-'));
  stop = registerStudioAnimationImport({
    mayEdit: () => true,
    activeFolder: () => project,
  });
});

afterEach(() => {
  stop();
  fs.rmSync(project, { recursive: true, force: true });
});

describe('an import’s request', () => {
  it('is taken when every part is what a sheet may be', () => {
    expect(checkedImport(request())).toMatchObject({
      name: 'whale-dive',
      count: 8,
    });
  });

  it('is refused for a sheet that is no PNG, or does not divide into its cells', () => {
    expect(
      checkedImport(request({ sheet: webpHeader(512, 48) })),
    ).toBeUndefined();
    expect(
      checkedImport(request({ sheet: pngHeader(500, 48) })),
    ).toBeUndefined();
    // Two rows of four would need a height that halves.
    expect(
      checkedImport(request({ sheet: pngHeader(256, 49), columns: 4 })),
    ).toBeUndefined();
  });

  it('control: a sheet of two even rows is taken', () => {
    expect(
      checkedImport(request({ sheet: pngHeader(256, 96), columns: 4 })),
    ).toBeDefined();
  });

  it('is refused for a name that is a path, and numbers out of range', () => {
    [
      { name: '../escape' },
      { name: 'Whale' },
      { count: 0 },
      { count: 257 },
      { columns: 9 },
      { fps: 0 },
      { fps: 61 },
      { fps: 12.5 },
      { loop: 'yes' },
      { ground: 'lava' },
    ].forEach((change) => {
      expect(checkedImport(request(change))).toBeUndefined();
    });
  });
});

describe('a hostile sheet', () => {
  it('is refused when its header says it decodes past what a sheet may be', async () => {
    // 20000 x 48: past SHEET_BOUNDS' side, and divisible into its 8 cells.
    expect(await send(request({ sheet: pngHeader(20000, 48) }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(fs.existsSync(path.join(project, 'art'))).toBe(false);
  });

  it('control: the largest side a sheet may have is written', async () => {
    expect(await send(request({ sheet: pngHeader(8192, 48) }))).toEqual({
      ok: true,
      name: 'whale-dive',
    });
  });

  it('is refused when it is another kind of picture named as a sheet', async () => {
    expect(await send(request({ sheet: jpegHeader(512, 48) }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('writes nothing through an art folder that is a link out of the project', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-outside-'));
    try {
      fs.symlinkSync(outside, path.join(project, 'art'), 'junction');
      expect(await send(request())).toEqual({ ok: false, reason: 'failed' });
      expect(fs.readdirSync(outside)).toEqual([]);
      expect(
        fs.existsSync(path.join(project, 'animations', 'whale-dive.json')),
      ).toBe(false);
    } finally {
      fs.rmSync(path.join(project, 'art'), { force: true, recursive: false });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe('an import written', () => {
  it('is the sheet and its animation, as build_sheet writes them', async () => {
    expect(await send(request())).toEqual({ ok: true, name: 'whale-dive' });
    const sheet = fs.readFileSync(path.join(project, 'art', 'whale-dive.png'));
    expect(Array.from(sheet)).toEqual(Array.from(pngHeader(512, 48)));
    const animation = JSON.parse(
      fs.readFileSync(
        path.join(project, 'animations', 'whale-dive.json'),
        'utf8',
      ),
    );
    expect(animation).toEqual({
      sheet: 'art/whale-dive.png',
      count: 8,
      columns: 8,
      fps: 12,
      loop: true,
      ground: 'water',
    });
  });

  it('never replaces what is already there', async () => {
    fs.mkdirSync(path.join(project, 'art'));
    fs.writeFileSync(path.join(project, 'art', 'whale-dive.png'), 'mine');
    expect(await send(request())).toEqual({ ok: false, reason: 'taken' });
    expect(
      fs.readFileSync(path.join(project, 'art', 'whale-dive.png'), 'utf8'),
    ).toBe('mine');
  });

  it('never goes past the animations a scene holds', async () => {
    fs.mkdirSync(path.join(project, 'animations'));
    for (let at = 0; at < 32; at += 1) {
      fs.writeFileSync(path.join(project, 'animations', `a${at}.json`), '{}');
    }
    expect(await send(request())).toEqual({ ok: false, reason: 'full' });
  });

  it('control: one under the most is written', async () => {
    fs.mkdirSync(path.join(project, 'animations'));
    for (let at = 0; at < 31; at += 1) {
      fs.writeFileSync(path.join(project, 'animations', `a${at}.json`), '{}');
    }
    expect(await send(request())).toEqual({ ok: true, name: 'whale-dive' });
  });

  it('is refused as invalid, writing nothing', async () => {
    expect(await send(request({ name: '../escape' }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(fs.existsSync(path.join(project, 'art'))).toBe(false);
  });

  it('is refused with no project open, or one the member may not work on', async () => {
    stop();
    stop = registerStudioAnimationImport({
      mayEdit: () => false,
      activeFolder: () => project,
    });
    expect(await send(request())).toEqual({ ok: false, reason: 'closed' });
    stop();
    stop = registerStudioAnimationImport({
      mayEdit: () => true,
      activeFolder: () => undefined,
    });
    expect(await send(request())).toEqual({ ok: false, reason: 'closed' });
  });
});
