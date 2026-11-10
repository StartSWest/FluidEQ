/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An import's chosen animations handed to main one after another: each
 * laid into its sheet with its own timing and the speed, ground and loop
 * the member left it on; those left out never sent; the first refusal
 * stopping the rest and saying which. Each rule beside its control.
 */

import { addImport } from '../../../renderer/studio/animations/import/importAdd';
import type { IDecodedImport } from '../../../renderer/studio/animations/import/importDecode';

const mockLaid: number[][] = [];
jest.mock('../../../renderer/studio/animations/import/importSheet', () => ({
  composeSheet: (_decoded: unknown, cells: number[]) => {
    mockLaid.push([...cells]);
    return {
      canvas: {},
      layout: {
        columns: Math.min(cells.length, 16),
        rows: 1,
        cellWidth: 8,
        cellHeight: 8,
      },
      count: cells.length,
    };
  },
  sheetPng: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
}));

const frame = (duration?: number) => ({
  sx: 0,
  sy: 0,
  sw: 8,
  sh: 8,
  rotated: false,
  placed: { x: 0, y: 0, w: 8, h: 8 },
  source: { w: 8, h: 8 },
  ...(duration === undefined ? {} : { duration }),
});

/** Walk: three 100 ms frames. Jump: two, the second shown twice as long. */
const decoded: IDecodedImport = {
  image: { width: 40, height: 8 } as unknown as ImageBitmap,
  frames: [frame(100), frame(100), frame(100), frame(100), frame(200)],
  clips: [
    { name: 'walk', order: [0, 1, 2] },
    { name: 'jump', order: [3, 4] },
  ],
  width: 8,
  height: 8,
  close: () => undefined,
};

let write: jest.Mock;

beforeEach(() => {
  mockLaid.length = 0;
  write = jest.fn(async (request: { name: string }) => ({
    ok: true,
    name: request.name,
  }));
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { importStudioAnimation: write } },
  });
});

const choice = (name: string, change: Record<string, unknown> = {}) => ({
  name,
  include: true,
  loop: true,
  ...change,
});

describe('adding an import', () => {
  it('writes each chosen animation with its own cells and what it was left on', async () => {
    const outcome = await addImport(decoded, [
      choice('hero-walk', { fps: 8, ground: 'ground' }),
      choice('hero-jump', { loop: false }),
    ]);
    expect(outcome).toEqual({ ok: true, added: ['hero-walk', 'hero-jump'] });
    expect(mockLaid).toEqual([
      [0, 1, 2],
      [3, 4, 4],
    ]);
    expect(write.mock.calls.map(([request]) => request)).toEqual([
      expect.objectContaining({
        name: 'hero-walk',
        count: 3,
        columns: 3,
        fps: 8,
        loop: true,
        ground: 'ground',
      }),
      // Its own timing when the member never changed the speed: 10 fps.
      expect.objectContaining({
        name: 'hero-jump',
        count: 3,
        fps: 10,
        loop: false,
      }),
    ]);
  });

  it('never sends one left out', async () => {
    await addImport(decoded, [
      choice('hero-walk', { include: false }),
      choice('hero-jump'),
    ]);
    expect(write.mock.calls.map(([request]) => request.name)).toEqual([
      'hero-jump',
    ]);
  });

  it('stops at the first refusal, saying which and why', async () => {
    write.mockImplementationOnce(async () => ({ ok: false, reason: 'taken' }));
    const outcome = await addImport(decoded, [
      choice('hero-walk'),
      choice('hero-jump'),
    ]);
    expect(outcome).toEqual({
      ok: false,
      added: [],
      name: 'hero-walk',
      reason: 'taken',
    });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('control: those added before a refusal are said to be in', async () => {
    write
      .mockImplementationOnce(async () => ({ ok: true, name: 'hero-walk' }))
      .mockImplementationOnce(async () => ({ ok: false, reason: 'full' }));
    const outcome = await addImport(decoded, [
      choice('hero-walk'),
      choice('hero-jump'),
    ]);
    expect(outcome).toEqual({
      ok: false,
      added: ['hero-walk'],
      name: 'hero-jump',
      reason: 'full',
    });
  });
});
