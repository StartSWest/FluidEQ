/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { saveDownload } from '../../../main/modelDownload';

/**
 * A response body that hands out `chunks` one read at a time, as the network
 * would, and can look at the disk between reads. The test environment has no
 * `ReadableStream`; the reader is all `saveDownload` touches.
 */
const bodyOf = (
  chunks: readonly Uint8Array[],
  beforeEachRead: (delivered: number) => void = () => undefined,
  failAt = Number.POSITIVE_INFINITY,
): ReadableStream<Uint8Array> => {
  let next = 0;
  let delivered = 0;
  return {
    getReader: () => ({
      read: async () => {
        beforeEachRead(delivered);
        if (next === failAt) {
          throw new Error('connection reset');
        }
        const value = chunks[next];
        if (value === undefined) {
          return { done: true, value: undefined };
        }
        next += 1;
        delivered += value.length;
        return { done: false, value };
      },
    }),
  } as unknown as ReadableStream<Uint8Array>;
};

const chunksOf = (count: number, size: number): Uint8Array[] =>
  Array.from({ length: count }, (_, index) =>
    new Uint8Array(size).fill(index % 251),
  );

const joined = (chunks: readonly Uint8Array[]) =>
  Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-download-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('saving a model as it downloads', () => {
  it('writes each chunk before asking for the next, and reports each percent rather than each chunk', async () => {
    const target = path.join(dir, 'model.onnx');
    const chunks = chunksOf(1000, 1024);
    const total = 1000 * 1024;
    const onDisk: number[] = [];
    const reports: number[] = [];
    const saved = await saveDownload({
      body: bodyOf(chunks, (delivered) => {
        // What the disk holds each time the network is asked for more: all
        // of it, never a file held in memory until the end.
        const partial = `${target}.download`;
        onDisk.push(fs.existsSync(partial) ? fs.statSync(partial).size : 0);
        expect(onDisk[onDisk.length - 1]).toBe(delivered);
      }),
      total,
      target,
      onBytes: (received) => reports.push(received),
    });
    expect(saved).toBe(true);
    expect(fs.readFileSync(target)).toEqual(joined(chunks));
    expect(fs.existsSync(`${target}.download`)).toBe(false);
    // A thousand chunks, a hundred and one whole percents.
    expect(reports.length).toBeLessThanOrEqual(101);
    expect(reports[reports.length - 1]).toBe(total);
  });

  it('reports every mebibyte of a file that came with no length, and the last count', async () => {
    const target = path.join(dir, 'model.onnx');
    const chunks = chunksOf(81, 64 * 1024);
    const reports: number[] = [];
    await saveDownload({
      body: bodyOf(chunks),
      total: 0,
      target,
      onBytes: (received) => reports.push(received),
    });
    expect(reports[0]).toBe(64 * 1024);
    expect(reports[reports.length - 1]).toBe(81 * 64 * 1024);
    expect(reports.length).toBeLessThanOrEqual(8);
  });

  it('keeps nothing when the bytes are refused', async () => {
    const target = path.join(dir, 'model.onnx');
    const chunks = chunksOf(4, 4096);
    const digests: string[] = [];
    const saved = await saveDownload({
      body: bodyOf(chunks),
      total: 4 * 4096,
      target,
      onBytes: () => undefined,
      accept: (digest) => {
        digests.push(digest);
        return false;
      },
    });
    expect(saved).toBe(false);
    expect(digests).toEqual([
      createHash('sha256').update(joined(chunks)).digest('hex'),
    ]);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('leaves nothing behind when the download fails partway', async () => {
    const target = path.join(dir, 'model.onnx');
    await expect(
      saveDownload({
        body: bodyOf(chunksOf(10, 4096), () => undefined, 5),
        total: 10 * 4096,
        target,
        onBytes: () => undefined,
      }),
    ).rejects.toThrow('connection reset');
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
