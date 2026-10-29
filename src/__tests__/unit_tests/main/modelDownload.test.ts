/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import type { FileHandle } from 'fs/promises';
import os from 'os';
import path from 'path';
import { saveDownload } from '../../../main/modelDownload';

/**
 * A response body that hands out `chunks` one read at a time, as the network
 * would, and can look at what has been written between reads. The test
 * environment has no `ReadableStream`; the reader is all `saveDownload`
 * touches.
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

/**
 * The temporary file's handle, held in memory, so what the test reads at each
 * request for more is the handle's own account: the bytes every finished
 * write has landed, and whether a write is still in flight.
 *
 * It used to be the real file, statted on every read. That made the case a
 * thousand round trips through Node's thread pool one after another, each
 * waiting for a loaded machine to schedule a worker and then the test again,
 * and in a full run that alone overran Jest's 5 s (2026-10-26). These writes
 * finish on a promise, so they take the same milliseconds on any machine.
 * Closing puts what landed on the real disk, so the rename and everything
 * after it still run for real.
 */
const inMemoryHandle = (file: string) => {
  const landed: Uint8Array[] = [];
  let bytesLanded = 0;
  let inFlight = 0;
  const handle = {
    writeFile: async (data: Uint8Array) => {
      inFlight += 1;
      // A write never finishes inside the call that starts it; the bytes
      // land after it returns, as a real write's do.
      await Promise.resolve();
      landed.push(data);
      bytesLanded += data.length;
      inFlight -= 1;
    },
    close: () => fs.promises.writeFile(file, Buffer.concat(landed)),
  };
  return {
    handle: handle as unknown as FileHandle,
    written: () => ({ bytesLanded, inFlight }),
  };
};

const sha256Of = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

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
  jest.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('saving a model as it downloads', () => {
  it('writes each chunk before asking for the next, and reports each percent rather than each chunk', async () => {
    const target = path.join(dir, 'model.onnx');
    const chunks = chunksOf(1000, 1024);
    const total = 1000 * 1024;
    const partial = inMemoryHandle(`${target}.download`);
    jest.spyOn(fs.promises, 'open').mockImplementation(async (file) => {
      expect(file).toBe(`${target}.download`);
      return partial.handle;
    });
    const reports: number[] = [];
    const saved = await saveDownload({
      body: bodyOf(chunks, (delivered) => {
        // What the file holds each time the network is asked for more: all
        // of it, with no write still going, never a file held in memory
        // until the end.
        expect(partial.written()).toEqual({
          bytesLanded: delivered,
          inFlight: 0,
        });
      }),
      total,
      target,
      onBytes: (received) => reports.push(received),
    });
    expect(saved).toBe(true);
    // Compared by digest: `toEqual` walks a Buffer one element at a time,
    // 6.5 s of CPU for this megabyte.
    expect(sha256Of(fs.readFileSync(target))).toBe(sha256Of(joined(chunks)));
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
    expect(digests).toEqual([sha256Of(joined(chunks))]);
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
