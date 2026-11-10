/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PICTURE_BOUNDS, SHEET_BOUNDS } from 'common/pictureBounds';
import { MAX_ANIMATION_FRAMES } from 'common/studioAnimation';
import { tagOrder } from './importAtlas';

/**
 * An Aseprite file (.ase, .aseprite) read as its published specification
 * lays it out (aseprite.org/docs/ase-file-specs): a 128-byte header, then
 * each frame's chunks - its layers, its cels (zlib-compressed pixels, or a
 * link to another frame's), its tags and its palette. Each frame is the
 * visible layers composited bottom to top, a hidden group hiding what is in
 * it; tags become animations as in Aseprite's own JSON export.
 *
 * Read in the window, where the import's other formats are, with the
 * browser's own zlib (`DecompressionStream`). Every size the file states is
 * checked before anything is made of that size, and every cel must inflate
 * to exactly the bytes its size says, so a file cannot ask for more memory
 * than it describes.
 *
 * Every layer is composited as Normal, the blend mode almost every sprite
 * uses; a group's own opacity and blend mode, tilemap layers and reference
 * layers are not drawn.
 */

export interface IAsepriteFile {
  width: number;
  height: number;
  /** Milliseconds each frame is shown; undefined where the file gives none. */
  durations: Array<number | undefined>;
  /** Its tags, in Aseprite's playing order. */
  tags: Array<{ name: string; order: number[] }>;
  /** Frame `index` with every visible layer composited, as RGBA. */
  frame(index: number): Uint8ClampedArray<ArrayBuffer>;
}

export type TAsepriteRefusal = 'unreadable' | 'too-many' | 'too-large';

/** Inflates zlib data to exactly `expected` bytes, or nothing. */
export type TInflate = (
  data: Uint8Array,
  expected: number,
) => Promise<Uint8Array | undefined>;

const HEADER_BYTES = 128;
const FILE_MAGIC = 0xa5e0;
const FRAME_MAGIC = 0xf1fa;
/** Past this many pixels across every frame, compositing them is not done. */
const MOST_COMPOSED = SHEET_BOUNDS.pixels * 4;

const CHUNK_OLD_PALETTE = 0x0004;
const CHUNK_OLD_PALETTE_64 = 0x0011;
const CHUNK_LAYER = 0x2004;
const CHUNK_CEL = 0x2005;
const CHUNK_TAGS = 0x2018;
const CHUNK_PALETTE = 0x2019;

const LAYER_VISIBLE = 1;
const LAYER_BACKGROUND = 8;
const LAYER_REFERENCE = 64;
const LAYER_IMAGE = 0;
const HEADER_LAYER_OPACITY = 1;

const CEL_RAW = 0;
const CEL_LINKED = 1;
const CEL_COMPRESSED = 2;

const DIRECTIONS = ['forward', 'reverse', 'pingpong', 'pingpong_reverse'];

/** Whether `flags` has the bit worth `bit` (a power of two) set. */
const hasFlag = (flags: number, bit: number) =>
  Math.floor(flags / bit) % 2 === 1;

export const isAseprite = (bytes: Uint8Array) =>
  bytes.length >= HEADER_BYTES &&
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
    4,
    true,
  ) === FILE_MAGIC;

/** Inflated by the browser's zlib, stopped the moment it runs past. */
export const inflateExact: TInflate = async (data, expected) => {
  const reader = new Blob([data.slice()])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
    .getReader();
  const out = new Uint8Array(expected);
  let at = 0;
  try {
    for (;;) {
      // eslint-disable-next-line no-await-in-loop -- a stream is read a piece at a time
      const { done, value } = await reader.read();
      if (done) {
        return at === expected ? out : undefined;
      }
      if (at + value.length > expected) {
        await reader.cancel();
        return undefined;
      }
      out.set(value, at);
      at += value.length;
    }
  } catch {
    return undefined;
  }
};

/** A little-endian reader that throws past its end, never reads past it. */
const readerOf = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const need = (at: number, length: number) => {
    if (at < 0 || at + length > bytes.length) {
      throw new RangeError('past the end of the file');
    }
  };
  return {
    u8: (at: number) => {
      need(at, 1);
      return view.getUint8(at);
    },
    u16: (at: number) => {
      need(at, 2);
      return view.getUint16(at, true);
    },
    i16: (at: number) => {
      need(at, 2);
      return view.getInt16(at, true);
    },
    u32: (at: number) => {
      need(at, 4);
      return view.getUint32(at, true);
    },
    bytes: (at: number, length: number) => {
      need(at, length);
      return bytes.subarray(at, at + length);
    },
    text: (at: number) => {
      need(at, 2);
      const length = view.getUint16(at, true);
      need(at + 2, length);
      return {
        value: new TextDecoder().decode(
          bytes.subarray(at + 2, at + 2 + length),
        ),
        end: at + 2 + length,
      };
    },
  };
};

interface ILayer {
  flags: number;
  type: number;
  level: number;
  opacity: number;
  /** The group it is in, by index; -1 at the top. */
  parent: number;
}

interface ICel {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  z: number;
  /** Pixels in the file's depth, once inflated. */
  pixels?: Uint8Array;
  /** Still compressed, inflated after the file is read. */
  compressed?: Uint8Array;
  /** A linked cel: the frame whose cel on this layer it shows. */
  linkedFrame?: number;
}

/** The file read, or why not. */
export const readAseprite = async (
  bytes: Uint8Array,
  inflate: TInflate = inflateExact,
): Promise<IAsepriteFile | TAsepriteRefusal> => {
  if (!isAseprite(bytes)) {
    return 'unreadable';
  }
  const read = readerOf(bytes);
  const frameCount = read.u16(6);
  const width = read.u16(8);
  const height = read.u16(10);
  const depth = read.u16(12);
  const headerFlags = read.u32(14);
  const transparentIndex = read.u8(28);
  const bytesPerPixel = { 32: 4, 16: 2, 8: 1 }[depth];
  if (!bytesPerPixel || frameCount < 1 || width < 1 || height < 1) {
    return 'unreadable';
  }
  if (frameCount > MAX_ANIMATION_FRAMES) {
    return 'too-many';
  }
  if (
    width > PICTURE_BOUNDS.side ||
    height > PICTURE_BOUNDS.side ||
    width * height > PICTURE_BOUNDS.pixels ||
    frameCount * width * height > MOST_COMPOSED
  ) {
    return 'too-large';
  }

  const palette: number[][] = Array.from({ length: 256 }, () => [0, 0, 0, 0]);
  const layers: ILayer[] = [];
  const groups: number[] = [];
  const cels = new Map<string, ICel>();
  const durations: Array<number | undefined> = [];
  const tags: Array<{ name: string; order: number[] }> = [];
  let celPixels = 0;

  try {
    let frameAt = HEADER_BYTES;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const frameBytes = read.u32(frameAt);
      if (read.u16(frameAt + 4) !== FRAME_MAGIC || frameBytes < 16) {
        return 'unreadable';
      }
      const oldCount = read.u16(frameAt + 6);
      const duration = read.u16(frameAt + 8);
      const newCount = read.u32(frameAt + 12);
      const chunkCount =
        oldCount === 0xffff || newCount > 0 ? newCount : oldCount;
      durations.push(duration > 0 ? duration : undefined);
      const frameEnd = frameAt + frameBytes;
      read.bytes(frameAt, frameBytes);
      let at = frameAt + 16;
      for (let chunk = 0; chunk < chunkCount; chunk += 1) {
        const size = read.u32(at);
        const type = read.u16(at + 4);
        const data = at + 6;
        const end = at + size;
        if (size < 6 || end > frameEnd) {
          return 'unreadable';
        }
        if (type === CHUNK_LAYER) {
          const level = read.u16(data + 4);
          groups[level] = layers.length;
          layers.push({
            flags: read.u16(data),
            type: read.u16(data + 2),
            level,
            opacity: hasFlag(headerFlags, HEADER_LAYER_OPACITY)
              ? read.u8(data + 12)
              : 255,
            parent: level > 0 ? (groups[level - 1] ?? -1) : -1,
          });
        } else if (type === CHUNK_CEL) {
          const layer = read.u16(data);
          const kind = read.u16(data + 7);
          const cel: ICel = {
            x: read.i16(data + 2),
            y: read.i16(data + 4),
            width: 0,
            height: 0,
            opacity: read.u8(data + 6),
            z: read.i16(data + 9),
          };
          if (kind === CEL_LINKED) {
            cel.linkedFrame = read.u16(data + 16);
          } else if (kind === CEL_RAW || kind === CEL_COMPRESSED) {
            cel.width = read.u16(data + 16);
            cel.height = read.u16(data + 18);
            celPixels += cel.width * cel.height;
            if (
              cel.width * cel.height > PICTURE_BOUNDS.pixels ||
              celPixels > MOST_COMPOSED
            ) {
              return 'too-large';
            }
            const body = read.bytes(data + 20, end - (data + 20));
            if (kind === CEL_RAW) {
              const length = cel.width * cel.height * bytesPerPixel;
              // A raw cel's pixels lie inside its own chunk.
              if (length > body.length) {
                return 'unreadable';
              }
              cel.pixels = body.subarray(0, length);
            } else {
              cel.compressed = body;
            }
          }
          if (kind <= CEL_COMPRESSED) {
            cels.set(`${frame}:${layer}`, cel);
          }
        } else if (type === CHUNK_TAGS) {
          const count = read.u16(data);
          let tagAt = data + 10;
          for (let tag = 0; tag < count; tag += 1) {
            const from = read.u16(tagAt);
            const to = read.u16(tagAt + 2);
            const direction = DIRECTIONS[read.u8(tagAt + 4)] ?? 'forward';
            const name = read.text(tagAt + 17);
            if (from <= to && to < frameCount) {
              tags.push({
                name: name.value,
                order: tagOrder(from, to, direction),
              });
            }
            tagAt = name.end;
          }
        } else if (type === CHUNK_PALETTE) {
          const first = read.u32(data + 4);
          const last = read.u32(data + 8);
          let entryAt = data + 20;
          for (let index = first; index <= last && index < 256; index += 1) {
            const flags = read.u16(entryAt);
            palette[index] = [
              read.u8(entryAt + 2),
              read.u8(entryAt + 3),
              read.u8(entryAt + 4),
              read.u8(entryAt + 5),
            ];
            entryAt += 6;
            // The entry has a name, which is skipped.
            if (hasFlag(flags, 1)) {
              entryAt = read.text(entryAt).end;
            }
          }
        } else if (
          type === CHUNK_OLD_PALETTE ||
          type === CHUNK_OLD_PALETTE_64
        ) {
          const scale = type === CHUNK_OLD_PALETTE_64 ? 255 / 63 : 1;
          const packets = read.u16(data);
          let packetAt = data + 2;
          let index = 0;
          for (let packet = 0; packet < packets; packet += 1) {
            index += read.u8(packetAt);
            const colours = read.u8(packetAt + 1) || 256;
            packetAt += 2;
            for (let colour = 0; colour < colours && index < 256; colour += 1) {
              palette[index] = [
                Math.round(read.u8(packetAt) * scale),
                Math.round(read.u8(packetAt + 1) * scale),
                Math.round(read.u8(packetAt + 2) * scale),
                255,
              ];
              packetAt += 3;
              index += 1;
            }
          }
        }
        at = end;
      }
      frameAt = frameEnd;
    }
  } catch {
    return 'unreadable';
  }

  // Every compressed cel inflated to exactly its size, or the file refused.
  const entries = [...cels.values()];
  for (let at = 0; at < entries.length; at += 1) {
    const cel = entries[at];
    if (cel.compressed) {
      // eslint-disable-next-line no-await-in-loop -- one cel inflated at a time
      const pixels = await inflate(
        cel.compressed,
        cel.width * cel.height * bytesPerPixel,
      );
      if (!pixels) {
        return 'unreadable';
      }
      cel.pixels = pixels;
      cel.compressed = undefined;
    }
  }

  const shown = (index: number): boolean => {
    const layer = layers[index];
    return (
      layer !== undefined &&
      hasFlag(layer.flags, LAYER_VISIBLE) &&
      (layer.parent < 0 || shown(layer.parent))
    );
  };
  const drawn = layers.flatMap((layer, index) =>
    layer.type === LAYER_IMAGE &&
    !hasFlag(layer.flags, LAYER_REFERENCE) &&
    shown(index)
      ? [index]
      : [],
  );

  /** A pixel of a cel as RGBA, from the file's depth. */
  const colourOf = (cel: ICel, at: number, background: boolean): number[] => {
    const pixels = cel.pixels ?? new Uint8Array(0);
    if (bytesPerPixel === 4) {
      return [
        pixels[at * 4],
        pixels[at * 4 + 1],
        pixels[at * 4 + 2],
        pixels[at * 4 + 3],
      ];
    }
    if (bytesPerPixel === 2) {
      const value = pixels[at * 2];
      return [value, value, value, pixels[at * 2 + 1]];
    }
    const index = pixels[at];
    return !background && index === transparentIndex
      ? [0, 0, 0, 0]
      : palette[index];
  };

  const frameOf = (index: number): Uint8ClampedArray<ArrayBuffer> => {
    const out = new Uint8ClampedArray(width * height * 4);
    const placed = drawn.flatMap((layer) => {
      let cel = cels.get(`${index}:${layer}`);
      if (cel?.linkedFrame !== undefined) {
        cel = cels.get(`${cel.linkedFrame}:${layer}`);
      }
      return cel?.pixels ? [{ layer, cel }] : [];
    });
    // Aseprite's own order: a cel's layer moved by its z-index, ties broken
    // by the z-index itself.
    placed.sort(
      (a, b) => a.layer + a.cel.z - (b.layer + b.cel.z) || a.cel.z - b.cel.z,
    );
    placed.forEach(({ layer, cel }) => {
      const { opacity, flags } = layers[layer];
      const background = hasFlag(flags, LAYER_BACKGROUND);
      const strength = (cel.opacity / 255) * (opacity / 255);
      for (let y = 0; y < cel.height; y += 1) {
        const py = cel.y + y;
        if (py >= 0 && py < height) {
          for (let x = 0; x < cel.width; x += 1) {
            const px = cel.x + x;
            if (px >= 0 && px < width) {
              const [r, g, b, a] = colourOf(cel, y * cel.width + x, background);
              const alpha = (a / 255) * strength;
              if (alpha > 0) {
                const o = (py * width + px) * 4;
                const under = out[o + 3] / 255;
                const total = alpha + under * (1 - alpha);
                out[o] = (r * alpha + out[o] * under * (1 - alpha)) / total;
                out[o + 1] =
                  (g * alpha + out[o + 1] * under * (1 - alpha)) / total;
                out[o + 2] =
                  (b * alpha + out[o + 2] * under * (1 - alpha)) / total;
                out[o + 3] = total * 255;
              }
            }
          }
        }
      }
    });
    return out;
  };

  return { width, height, durations, tags, frame: frameOf };
};
