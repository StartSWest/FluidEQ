/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Binary glTF files built byte by byte, as the model check
 * (`worldModelCheck.ts`) reads them: a 12-byte header naming the format, its
 * version and the file's length, then chunks of a length, a type and a body
 * padded to four bytes. Built here rather than kept as files, so every case
 * says in its own test what the file holds — and the images a model embeds,
 * which the check sizes from their own headers, are built the same way.
 */

export const GLB_JSON_CHUNK = 0x4e4f534a;
export const GLB_BIN_CHUNK = 0x004e4942;

const ascii = (text: string) => new TextEncoder().encode(text);

const padTo4 = (length: number) => Math.ceil(length / 4) * 4;

/** One chunk: its body's length, its type, its body. */
export const glbChunk = (type: number, body: Uint8Array): Uint8Array => {
  const chunk = new Uint8Array(8 + body.byteLength);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, body.byteLength, true);
  view.setUint32(4, type, true);
  chunk.set(body, 8);
  return chunk;
};

/**
 * A table of contents as a JSON chunk's body: padded with spaces to four
 * bytes as the format asks, or out to `bytes` when a test wants a big file.
 */
export const jsonChunkBody = (json: unknown, bytes?: number): Uint8Array => {
  const text = ascii(typeof json === 'string' ? json : JSON.stringify(json));
  const body = new Uint8Array(bytes ?? padTo4(text.byteLength)).fill(0x20);
  body.set(text);
  return body;
};

const binChunkBody = (bin: Uint8Array): Uint8Array => {
  const body = new Uint8Array(padTo4(bin.byteLength));
  body.set(bin);
  return body;
};

/**
 * `chunks` under a glTF 2 header whose length field says `length`: the
 * file's own unless a test is lying about it.
 */
export const glbFile = (
  chunks: readonly Uint8Array[],
  length?: number,
): Uint8Array => {
  const total = 12 + chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const file = new Uint8Array(total);
  const view = new DataView(file.buffer);
  file.set(ascii('glTF'), 0);
  view.setUint32(4, 2, true);
  view.setUint32(8, length ?? total, true);
  let at = 12;
  chunks.forEach((chunk) => {
    file.set(chunk, at);
    at += chunk.byteLength;
  });
  return file;
};

export interface IGltfParts {
  json: Record<string, unknown>;
  bin?: Uint8Array;
}

/** The ordinary file: one JSON chunk, and a binary one when there are bytes. */
export const glb = ({ json, bin }: IGltfParts): Uint8Array =>
  glbFile([
    glbChunk(GLB_JSON_CHUNK, jsonChunkBody(json)),
    ...(bin ? [glbChunk(GLB_BIN_CHUNK, binChunkBody(bin))] : []),
  ]);

/** The smallest model three builds: the format's version and one empty scene. */
export const EMPTY_MODEL: IGltfParts = {
  json: { asset: { version: '2.0' }, scenes: [{ nodes: [] }] },
};

/**
 * `parts` laid end to end in one buffer, each on a four-byte boundary, with a
 * buffer view over each.
 */
export const layViews = (parts: readonly Uint8Array[]) => {
  let length = 0;
  const bufferViews = parts.map((part) => {
    const view = { buffer: 0, byteOffset: length, byteLength: part.byteLength };
    length = padTo4(length + part.byteLength);
    return view;
  });
  const bin = new Uint8Array(length);
  parts.forEach((part, i) => bin.set(part, bufferViews[i].byteOffset));
  return { bin, bufferViews, buffers: [{ byteLength: length }] };
};

export interface IEmbeddedImage {
  bytes: Uint8Array;
  mimeType: string;
}

export interface IMeshModelOptions {
  /** Vertices the mesh's POSITION accessor holds (VEC3 floats). */
  vertices?: number;
  /** Indices each primitive draws with (unsigned shorts). */
  indices?: number;
  /** Primitives in the mesh, each drawing the same vertices again. */
  primitives?: number;
  /** Nodes the mesh is placed on, each a root of the one scene. */
  placements?: number;
  images?: readonly IEmbeddedImage[];
}

/**
 * One indexed mesh — a triangle unless told otherwise — placed on
 * `placements` nodes, with `images` embedded after its geometry. Accessor 0
 * is its positions, accessor 1 its indices, buffer view 2 onwards the images.
 */
export const meshModel = ({
  vertices = 3,
  indices = 3,
  primitives = 1,
  placements = 1,
  images = [],
}: IMeshModelOptions = {}): Required<IGltfParts> => {
  const { bin, bufferViews, buffers } = layViews([
    new Uint8Array(vertices * 12),
    new Uint8Array(indices * 2),
    ...images.map((image) => image.bytes),
  ]);
  const nodes = Array.from({ length: placements }, (_, i) => i);
  return {
    json: {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes }],
      nodes: nodes.map(() => ({ mesh: 0 })),
      meshes: [
        {
          primitives: Array.from({ length: primitives }, () => ({
            attributes: { POSITION: 0 },
            indices: 1,
          })),
        },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: vertices, type: 'VEC3' },
        { bufferView: 1, componentType: 5123, count: indices, type: 'SCALAR' },
      ],
      bufferViews,
      buffers,
      ...(images.length === 0
        ? {}
        : {
            images: images.map((image, i) => ({
              bufferView: 2 + i,
              mimeType: image.mimeType,
            })),
          }),
    },
    bin,
  };
};

/** A model's bytes as a world carries them: base64. */
export const modelData = (bytes: Uint8Array): string =>
  Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
    'base64',
  );

/** A PNG's signature and its IHDR chunk, which is all a size is read from. */
export const pngHeader = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(33);
  const view = new DataView(bytes.buffer);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  view.setUint32(8, 13);
  bytes.set(ascii('IHDR'), 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  // Eight bits a channel, RGBA.
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
};

/**
 * A JPEG's start, a JFIF segment a reader has to step over by its length,
 * and a baseline frame header (SOF0) giving the size.
 */
export const jpegHeader = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array([
    // Start of image; APP0, 16 bytes long, "JFIF".
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    // SOF0, 17 bytes long, eight bits: height and width at 25 and 27.
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x00, 0x00, 0x00, 0x03, 0x01, 0x22,
    0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    // End of image.
    0xff, 0xd9,
  ]);
  const view = new DataView(bytes.buffer);
  view.setUint16(25, height);
  view.setUint16(27, width);
  return bytes;
};

const riff = (length: number, chunk: string) => {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  bytes.set(ascii('RIFF'), 0);
  view.setUint32(4, length - 8, true);
  bytes.set(ascii(`WEBP${chunk}`), 8);
  return { bytes, view };
};

/** An extended WebP (VP8X): its canvas, 24 bits a side, less one. */
export const webpExtendedHeader = (width: number, height: number) => {
  const { bytes, view } = riff(30, 'VP8X');
  view.setUint32(16, 10, true);
  [
    [24, width - 1],
    [27, height - 1],
  ].forEach(([at, side]) => {
    bytes[at] = side % 0x100;
    bytes[at + 1] = Math.floor(side / 0x100) % 0x100;
    bytes[at + 2] = Math.floor(side / 0x10000) % 0x100;
  });
  return bytes;
};

/**
 * A lossless WebP (VP8L) of `size` bytes: its signature byte and the two
 * 14-bit sides, less one. The container's own length is honest, which the
 * pack's artwork reader checks.
 */
export const webpLosslessHeader = (
  width: number,
  height: number,
  size = 30,
): Uint8Array => {
  const { bytes, view } = riff(Math.max(30, size), 'VP8L');
  view.setUint32(16, bytes.byteLength - 20, true);
  bytes[20] = 0x2f;
  view.setUint32(21, width - 1 + (height - 1) * 0x4000, true);
  return bytes;
};
