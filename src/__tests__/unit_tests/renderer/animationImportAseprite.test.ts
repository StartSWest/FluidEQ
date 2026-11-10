/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Aseprite files read as the published specification lays them out
 * (`importAseprite.ts`): visible layers composited bottom to top, a hidden
 * group hiding what it holds, linked cels, z-index, the three colour
 * depths, tags as animations, frame durations; every size checked before
 * anything is made of it, and a cel that inflates to anything but its size
 * refused. The files are built here byte by byte. Run under Node, whose
 * Blob and DecompressionStream are the browser's own. Each rule beside its
 * control.
 */

import zlib from 'zlib';
import {
  inflateExact,
  isAseprite,
  readAseprite,
  type TInflate,
} from '../../../renderer/studio/animations/import/importAseprite';

const u8 = (value: number) => Buffer.from([value]);
const u16 = (value: number) => {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
};
const i16 = (value: number) => {
  const bytes = Buffer.alloc(2);
  bytes.writeInt16LE(value);
  return bytes;
};
const u32 = (value: number) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
};
const text = (value: string) =>
  Buffer.concat([u16(Buffer.byteLength(value)), Buffer.from(value)]);
const zeros = (count: number) => Buffer.alloc(count);

const chunk = (type: number, data: Buffer) =>
  Buffer.concat([u32(data.length + 6), u16(type), data]);

interface ILayerSpec {
  visible?: boolean;
  group?: boolean;
  level?: number;
  opacity?: number;
  background?: boolean;
  reference?: boolean;
}
const layer = ({
  visible = true,
  group = false,
  level = 0,
  opacity = 255,
  background = false,
  reference = false,
}: ILayerSpec) =>
  chunk(
    0x2004,
    Buffer.concat([
      u16((visible ? 1 : 0) + (background ? 8 : 0) + (reference ? 64 : 0)),
      u16(group ? 1 : 0),
      u16(level),
      u16(0),
      u16(0),
      u16(0),
      u8(opacity),
      zeros(3),
      text('layer'),
    ]),
  );

interface ICelSpec {
  layer: number;
  x?: number;
  y?: number;
  opacity?: number;
  z?: number;
  width: number;
  height: number;
  pixels: number[];
  raw?: boolean;
}
const cel = ({
  layer: index,
  x = 0,
  y = 0,
  opacity = 255,
  z = 0,
  width,
  height,
  pixels,
  raw = false,
}: ICelSpec) =>
  chunk(
    0x2005,
    Buffer.concat([
      u16(index),
      i16(x),
      i16(y),
      u8(opacity),
      u16(raw ? 0 : 2),
      i16(z),
      zeros(5),
      u16(width),
      u16(height),
      raw ? Buffer.from(pixels) : zlib.deflateSync(Buffer.from(pixels)),
    ]),
  );
const linked = (index: number, frame: number) =>
  chunk(
    0x2005,
    Buffer.concat([
      u16(index),
      i16(0),
      i16(0),
      u8(255),
      u16(1),
      i16(0),
      zeros(5),
      u16(frame),
    ]),
  );
const tags = (
  list: Array<{ from: number; to: number; direction: number; name: string }>,
) =>
  chunk(
    0x2018,
    Buffer.concat([
      u16(list.length),
      zeros(8),
      ...list.map(({ from, to, direction, name }) =>
        Buffer.concat([
          u16(from),
          u16(to),
          u8(direction),
          u16(0),
          zeros(6),
          zeros(3),
          zeros(1),
          text(name),
        ]),
      ),
    ]),
  );
const palette = (colours: number[][]) =>
  chunk(
    0x2019,
    Buffer.concat([
      u32(colours.length),
      u32(0),
      u32(colours.length - 1),
      zeros(8),
      ...colours.map(([r, g, b, a]) =>
        Buffer.concat([u16(0), u8(r), u8(g), u8(b), u8(a)]),
      ),
    ]),
  );

const frame = (chunks: Buffer[], duration = 100) => {
  const body = Buffer.concat(chunks);
  return Buffer.concat([
    u32(body.length + 16),
    u16(0xf1fa),
    u16(chunks.length),
    u16(duration),
    zeros(2),
    u32(0),
    body,
  ]);
};

const file = ({
  frames,
  width = 2,
  height = 2,
  depth = 32,
  transparent = 0,
  count = frames.length,
}: {
  frames: Buffer[];
  width?: number;
  height?: number;
  depth?: number;
  transparent?: number;
  count?: number;
}) => {
  const header = zeros(128);
  header.writeUInt16LE(0xa5e0, 4);
  header.writeUInt16LE(count, 6);
  header.writeUInt16LE(width, 8);
  header.writeUInt16LE(height, 10);
  header.writeUInt16LE(depth, 12);
  // Layer opacity is valid.
  header.writeUInt32LE(1, 14);
  header.writeUInt8(transparent, 28);
  const body = Buffer.concat([header, ...frames]);
  body.writeUInt32LE(body.length, 0);
  return new Uint8Array(body);
};

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const GREEN = [0, 255, 0, 255];
const all = (colour: number[], count = 4) =>
  Array.from({ length: count }, () => colour).flat();

/** Node's zlib, inflating to exactly the size or nothing, as the window's. */
const inflate: TInflate = async (data, expected) => {
  try {
    const out = zlib.inflateSync(Buffer.from(data));
    return out.length === expected ? new Uint8Array(out) : undefined;
  } catch {
    return undefined;
  }
};

const read = async (bytes: Uint8Array) => {
  const result = await readAseprite(bytes, inflate);
  if (typeof result === 'string') {
    throw new Error(`refused: ${result}`);
  }
  return result;
};
const pixel = (rgba: Uint8ClampedArray, at: number) =>
  Array.from(rgba.subarray(at * 4, at * 4 + 4));

describe('an Aseprite file’s frames', () => {
  it('are its visible layers, bottom to top', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            layer({ visible: false }),
            layer({}),
            cel({ layer: 0, width: 2, height: 2, pixels: all(RED) }),
            cel({ layer: 1, width: 2, height: 2, pixels: all(GREEN) }),
            cel({ layer: 2, width: 1, height: 1, pixels: BLUE }),
          ]),
        ],
      }),
    );
    // Blue over red at the corner; the hidden green nowhere.
    expect(pixel(ase.frame(0), 0)).toEqual(BLUE);
    expect(pixel(ase.frame(0), 3)).toEqual(RED);
  });

  it('control: the same layer shown is drawn', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            layer({}),
            cel({ layer: 0, width: 2, height: 2, pixels: all(RED) }),
            cel({ layer: 1, width: 2, height: 2, pixels: all(GREEN) }),
          ]),
        ],
      }),
    );
    expect(pixel(ase.frame(0), 3)).toEqual(GREEN);
  });

  it('hide what a hidden group holds', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            layer({ group: true, visible: false }),
            layer({ level: 1 }),
            cel({ layer: 0, width: 2, height: 2, pixels: all(RED) }),
            cel({ layer: 2, width: 2, height: 2, pixels: all(GREEN) }),
          ]),
        ],
      }),
    );
    expect(pixel(ase.frame(0), 0)).toEqual(RED);
  });

  it('control: a shown group shows what it holds', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            layer({ group: true }),
            layer({ level: 1 }),
            cel({ layer: 0, width: 2, height: 2, pixels: all(RED) }),
            cel({ layer: 2, width: 2, height: 2, pixels: all(GREEN) }),
          ]),
        ],
      }),
    );
    expect(pixel(ase.frame(0), 0)).toEqual(GREEN);
  });

  it('leave out a reference layer, shown or not', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            layer({ reference: true }),
            cel({ layer: 0, width: 1, height: 1, pixels: RED }),
            cel({ layer: 1, width: 1, height: 1, pixels: GREEN }),
          ]),
        ],
      }),
    );
    expect(pixel(ase.frame(0), 0)).toEqual(RED);
  });

  it('blend a half-opaque cel over what is under it', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            layer({ opacity: 128 }),
            cel({ layer: 0, width: 1, height: 1, pixels: RED }),
            cel({ layer: 1, width: 1, height: 1, pixels: BLUE }),
          ]),
        ],
      }),
    );
    const [r, g, b, a] = pixel(ase.frame(0), 0);
    expect(r).toBeGreaterThan(120);
    expect(r).toBeLessThan(135);
    expect(b).toBeGreaterThan(120);
    expect([g, a]).toEqual([0, 255]);
  });

  it('follow a linked cel to the frame it shows', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            cel({ layer: 0, width: 2, height: 2, pixels: all(RED) }),
          ]),
          frame([linked(0, 0)], 200),
        ],
      }),
    );
    expect(pixel(ase.frame(1), 3)).toEqual(RED);
    expect(ase.durations).toEqual([100, 200]);
  });

  it('take a cel’s z-index into the order', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            layer({}),
            cel({ layer: 0, width: 1, height: 1, pixels: RED }),
            // Moved one down: under the red.
            cel({ layer: 1, width: 1, height: 1, pixels: BLUE, z: -1 }),
          ]),
        ],
      }),
    );
    expect(pixel(ase.frame(0), 0)).toEqual(RED);
  });

  it('clip a cel that reaches past the canvas', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            cel({
              layer: 0,
              x: -1,
              y: 1,
              width: 2,
              height: 2,
              pixels: all(RED),
            }),
          ]),
        ],
      }),
    );
    expect(pixel(ase.frame(0), 2)).toEqual(RED);
    expect(pixel(ase.frame(0), 0)).toEqual([0, 0, 0, 0]);
    // The column off the left edge never wraps into the row above.
    expect(pixel(ase.frame(0), 1)).toEqual([0, 0, 0, 0]);
  });

  it('read a raw cel as well as a compressed one', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            cel({ layer: 0, width: 1, height: 1, pixels: GREEN, raw: true }),
          ]),
        ],
      }),
    );
    expect(pixel(ase.frame(0), 0)).toEqual(GREEN);
  });
});

describe('an Aseprite file’s colours', () => {
  it('are a palette’s, its transparent entry empty on a layer', async () => {
    const ase = await read(
      file({
        depth: 8,
        transparent: 0,
        frames: [
          frame([
            palette([[0, 0, 0, 255], RED]),
            layer({}),
            cel({ layer: 0, width: 2, height: 1, pixels: [1, 0] }),
          ]),
        ],
      }),
    );
    expect(pixel(ase.frame(0), 0)).toEqual(RED);
    expect(pixel(ase.frame(0), 1)).toEqual([0, 0, 0, 0]);
  });

  it('control: the transparent entry is drawn on the background layer', async () => {
    const ase = await read(
      file({
        depth: 8,
        frames: [
          frame([
            palette([[0, 0, 0, 255], RED]),
            layer({ background: true }),
            cel({ layer: 0, width: 1, height: 1, pixels: [0] }),
          ]),
        ],
      }),
    );
    expect(pixel(ase.frame(0), 0)).toEqual([0, 0, 0, 255]);
  });

  it('are grey and alpha in a grayscale file', async () => {
    const ase = await read(
      file({
        depth: 16,
        frames: [
          frame([
            layer({}),
            cel({ layer: 0, width: 1, height: 1, pixels: [200, 128] }),
          ]),
        ],
      }),
    );
    // Half-opaque grey over nothing stays half-opaque grey.
    expect(pixel(ase.frame(0), 0)).toEqual([200, 200, 200, 128]);
  });
});

describe('an Aseprite file’s tags', () => {
  it('are its animations, played as Aseprite plays them', async () => {
    const ase = await read(
      file({
        frames: [
          frame([
            layer({}),
            tags([
              { from: 0, to: 2, direction: 0, name: 'walk' },
              { from: 0, to: 2, direction: 2, name: 'bob' },
              { from: 1, to: 9, direction: 0, name: 'gone' },
            ]),
          ]),
          frame([]),
          frame([]),
        ],
      }),
    );
    expect(ase.tags).toEqual([
      { name: 'walk', order: [0, 1, 2] },
      { name: 'bob', order: [0, 1, 2, 1] },
    ]);
  });
});

describe('what an Aseprite file may not do', () => {
  const one = (options: Partial<Parameters<typeof file>[0]> = {}) =>
    file({ frames: [frame([layer({})])], ...options });

  it('is refused past the frames an animation holds', async () => {
    expect(await readAseprite(one({ count: 257 }), inflate)).toBe('too-many');
  });

  it('is refused for a canvas past the sides and pixels allowed', async () => {
    expect(await readAseprite(one({ width: 20000, height: 2 }), inflate)).toBe(
      'too-large',
    );
    expect(
      await readAseprite(
        one({ count: 200, width: 4000, height: 4000 }),
        inflate,
      ),
    ).toBe('too-large');
  });

  it('is refused when a cel inflates to more or less than its size', async () => {
    const lying = file({
      frames: [
        frame([
          layer({}),
          cel({ layer: 0, width: 2, height: 2, pixels: all(RED, 5) }),
        ]),
      ],
    });
    expect(await readAseprite(lying, inflate)).toBe('unreadable');
  });

  it('is refused when a raw cel says more pixels than its chunk holds', async () => {
    const raw = cel({ layer: 0, width: 2, height: 2, pixels: RED, raw: true });
    expect(
      await readAseprite(file({ frames: [frame([layer({}), raw])] }), inflate),
    ).toBe('unreadable');
  });

  it('is refused when it ends early, or a frame is not one', async () => {
    const whole = one();
    expect(
      await readAseprite(whole.subarray(0, whole.length - 3), inflate),
    ).toBe('unreadable');
    const broken = new Uint8Array(whole);
    broken[132] = 0;
    expect(await readAseprite(broken, inflate)).toBe('unreadable');
  });

  it('control: the same file whole is read', async () => {
    expect(typeof (await readAseprite(one(), inflate))).toBe('object');
  });

  it('is told by its magic number, not its name', () => {
    expect(isAseprite(one())).toBe(true);
    expect(isAseprite(new Uint8Array(200))).toBe(false);
  });
});

describe('the window’s inflating', () => {
  const packed = new Uint8Array(zlib.deflateSync(Buffer.alloc(1000, 7)));

  it('gives the bytes when they are exactly the size', async () => {
    expect((await inflateExact(packed, 1000))?.length).toBe(1000);
  });

  it('stops and gives nothing when they run past the size', async () => {
    expect(await inflateExact(packed, 999)).toBeUndefined();
  });

  it('gives nothing when they fall short of the size', async () => {
    expect(await inflateExact(packed, 1001)).toBeUndefined();
  });

  it('gives nothing for bytes that are no zlib', async () => {
    expect(await inflateExact(new Uint8Array([1, 2, 3, 4]), 4)).toBeUndefined();
  });
});
