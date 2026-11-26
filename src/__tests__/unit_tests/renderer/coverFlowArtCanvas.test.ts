/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { loadCoverFlowArt } from '../../../renderer/library/coverFlow/coverFlowArt';

/**
 * Every canvas a Cover Flow picture is painted on is one kept in memory
 * (`willReadFrequently`). Each cover's light is read back from one, and a
 * canvas on the graphics card answers that read with a synchronous round
 * trip to the GPU process: turning the row through 300 albums spent 27.9 s
 * of 37.7 s of the main thread there (2026-11-26, Ivan: "the cover art
 * scroll seems slow and slows down the app while scrolling").
 */

type TContextCall = { kind: string; options: unknown };

/** A 2D context that paints nothing and reads back transparent black. */
const fakeContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D =>
  new Proxy(
    {},
    {
      get: (store: Record<string | symbol, unknown>, key) => {
        if (key in store) {
          return store[key];
        }
        if (key === 'canvas') {
          return canvas;
        }
        if (key === 'createLinearGradient') {
          return () => ({ addColorStop: () => undefined });
        }
        if (key === 'getImageData') {
          return (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4),
          });
        }
        return () => undefined;
      },
      set: (store: Record<string | symbol, unknown>, key, value) => {
        store[key] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;

describe('Cover Flow picture canvases', () => {
  let calls: TContextCall[];
  let getContext: jest.SpyInstance;
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = {
    ImageBitmap: globals.ImageBitmap,
    createImageBitmap: globals.createImageBitmap,
    Path2D: globals.Path2D,
  };

  beforeEach(() => {
    calls = [];
    const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
    getContext = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function getFakeContext(
        this: HTMLCanvasElement,
        kind: string,
        options?: unknown,
      ) {
        calls.push({ kind, options });
        const held = contexts.get(this) ?? fakeContext(this);
        contexts.set(this, held);
        return held as unknown as RenderingContext;
      } as unknown as HTMLCanvasElement['getContext']);
    // jsdom has none of these; the painter only needs them to exist.
    globals.ImageBitmap = function ImageBitmapStandIn() {};
    globals.createImageBitmap = jest.fn(async () => ({
      close: () => undefined,
    }));
    globals.Path2D = function Path2DStandIn() {};
  });

  afterEach(() => {
    getContext.mockRestore();
    Object.assign(globals, saved);
  });

  const colours = { folderTop: '#334', folderBottom: '#223' };

  it.each([
    ['a record with no picture', { isFolder: false, isPending: false }],
    ['a folder with no picture', { isFolder: true, isPending: false }],
    ['a record whose songs are unread', { isFolder: false, isPending: true }],
  ])('paints %s on canvases kept in memory', async (_name, kind) => {
    await loadCoverFlowArt(
      { artId: undefined, label: 'Night Bus', ...kind },
      'far',
      colours,
    );
    // The painter did paint: the rule below is about real calls.
    expect(calls.length).toBeGreaterThan(2);
    calls.forEach((call) => {
      expect(call.kind).toBe('2d');
      expect(call.options).toEqual({ willReadFrequently: true });
    });
  });
});
