/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ISheetCodec } from '../../main/studioChat/sheetFiles';
import type { IPixels } from '../../main/studioChat/sheetRig';
import { createSheetTools } from '../../main/studioChat/sheetTools';
import type { IMcpTool } from '../../main/studioAgent/mcpProtocol';
import { pngHeader } from './pictureHeaders';

/**
 * A project for the Studio's sheet tools, and a codec that stands in for
 * Electron's decoder: a picture file is a real PNG header (which every
 * bound is checked against) followed by its raw premultiplied pixels.
 */

const HEADER = pngHeader(1, 1).length;

export const encode = (picture: IPixels): Buffer =>
  Buffer.concat([
    Buffer.from(pngHeader(picture.width, picture.height)),
    Buffer.from(picture.data),
  ]);

const decodeBytes = (bytes: Uint8Array): IPixels | undefined => {
  const header = Buffer.from(bytes.subarray(0, HEADER));
  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  const data = new Uint8Array(bytes.subarray(HEADER));
  return data.length === width * height * 4
    ? { data, width, height }
    : undefined;
};

/** Nearest neighbour: the tools' layout, not its smoothness, is under test. */
const resize = (picture: IPixels, width: number, height: number): IPixels => {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(
        picture.width - 1,
        Math.floor((x * picture.width) / width),
      );
      const sy = Math.min(
        picture.height - 1,
        Math.floor((y * picture.height) / height),
      );
      const from = (sy * picture.width + sx) * 4;
      data.set(picture.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { data, width, height };
};

/** A picture `width` by `height`, `ink` where `inside` says, else `ground`. */
export const picture = (
  width: number,
  height: number,
  inside: (x: number, y: number) => boolean,
  ink: readonly [number, number, number],
  ground: readonly [number, number, number, number] = [0, 0, 0, 0],
): IPixels => {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(inside(x, y) ? [...ink, 255] : ground, (y * width + x) * 4);
    }
  }
  return { data, width, height };
};

/** A whale stand-in: a long body and a tail, opaque on transparency. */
export const whale = () =>
  picture(
    200,
    80,
    (x, y) =>
      ((x - 120) / 70) ** 2 + ((y - 40) / 22) ** 2 <= 1 ||
      (x >= 20 && x < 55 && Math.abs(y - 40) <= 6 + (55 - x) / 3),
    [40, 60, 80],
  );

/** A cell of a sheet, as its own pixels. */
export const cellOf = (
  sheet: IPixels,
  columns: number,
  rows: number,
  index: number,
): IPixels => {
  const width = sheet.width / columns;
  const height = sheet.height / rows;
  const left = (index % columns) * width;
  const top = Math.floor(index / columns) * height;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const from = ((top + y) * sheet.width + left) * 4;
    data.set(sheet.data.subarray(from, from + width * 4), y * width * 4);
  }
  return { data, width, height };
};

/** The drawn box of a cell: [left, top, right, bottom]. */
export const boxOf = (cell: IPixels) => {
  let box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < cell.height; y += 1) {
    for (let x = 0; x < cell.width; x += 1) {
      if (cell.data[(y * cell.width + x) * 4 + 3] > 8) {
        box = [
          Math.min(box[0], x),
          Math.min(box[1], y),
          Math.max(box[2], x),
          Math.max(box[3], y),
        ];
      }
    }
  }
  return box;
};

/** What Ivan's animator was asked for: the humpback's dive. */
export const DIVE = {
  name: 'whale-dive',
  from: 'art/whale-rig-cut.png',
  count: 8,
  columns: 4,
  cell: 128,
  zoom: 0.6,
  loop: false,
  keys: [
    { at: 0 },
    { at: 0.5, bend: [20, 10, 0, 0] },
    { at: 1, bend: [-20, -10, 0, 0], turn: 30, y: 0.1 },
  ],
  animation: { fps: 12, loop: false, ground: 'water' },
  // The tests make it again and again on purpose; a first write needs none.
  replace: true,
};

export const words = (result: Awaited<ReturnType<IMcpTool['call']>>) =>
  result.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('\n');

/**
 * A fresh project with the whale in `art/`, a folder outside it, and the
 * tools on it; `setUp` before each test and `tearDown` after. `decode`
 * counts the decodes, so a test can say nothing was decoded.
 */
export const createSheetProject = () => {
  const decode = jest.fn(decodeBytes);
  const codec: ISheetCodec = {
    decode,
    encodePng: encode,
    resize,
    shown: () => Buffer.from('jpeg'),
  };
  const state = {
    project: '',
    outside: '',
    controller: new AbortController(),
    tools: [] as IMcpTool[],
  };
  const write = (relative: string, contents: Uint8Array | string) => {
    const file = path.join(state.project, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  };
  return {
    state,
    decode,
    write,
    tool: (name: string) => {
      const found = state.tools.find((entry) => entry.name === name);
      if (!found) {
        throw new Error(`no ${name}`);
      }
      return found;
    },
    readSheet: (relative: string) => {
      const decoded = decodeBytes(
        new Uint8Array(fs.readFileSync(path.join(state.project, relative))),
      );
      if (!decoded) {
        throw new Error(`${relative} is not a sheet`);
      }
      return decoded;
    },
    /** A new reply: a new Stop signal, and with it a new budget. */
    nextReply: () => {
      state.controller = new AbortController();
    },
    setUp: () => {
      state.project = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-sheet-'));
      state.outside = fs.mkdtempSync(
        path.join(os.tmpdir(), 'fluideq-outside-'),
      );
      state.controller = new AbortController();
      decode.mockClear();
      state.tools = createSheetTools({
        project: () => ({ ok: true, id: 'p1', folder: state.project }),
        signal: () => state.controller.signal,
        codec,
      });
      write('art/whale-rig-cut.png', encode(whale()));
    },
    tearDown: () => {
      fs.rmSync(state.project, { recursive: true, force: true });
      fs.rmSync(state.outside, { recursive: true, force: true });
    },
  };
};
