/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-denoise-'));
jest.mock('electron', () => ({
  app: { getPath: () => userData },
}));

// eslint-disable-next-line import/first -- the mock must be installed first
import {
  denoiseModelPath,
  downloadDenoiseModel,
  isDenoiseModelPresent,
} from '../../../main/denoiseModel';

/**
 * The download, checked at the boundary that matters: what it refuses.
 *
 * A model whose bytes cannot be identified does not go into the audio path.
 * That is the same rule the Equalizer APO installer follows, and it is the
 * only part of this module worth a test — the happy path is ten megabytes off
 * the network, and asserting that it arrives would be testing GitHub.
 */

const realFetch = global.fetch;

/** A response whose body streams `bytes` in two chunks, as a real one would. */
const respondWith = (bytes: Buffer) => {
  let sent = false;
  return {
    ok: true,
    headers: { get: () => String(bytes.length) },
    body: {
      getReader: () => ({
        read: async () => {
          if (sent) {
            return { done: true, value: undefined };
          }
          sent = true;
          return { done: false, value: new Uint8Array(bytes) };
        },
      }),
    },
  };
};

afterEach(() => {
  global.fetch = realFetch;
  try {
    fs.rmSync(path.dirname(denoiseModelPath()), {
      recursive: true,
      force: true,
    });
  } catch {
    // Nothing was written, which is the outcome most of these assert.
  }
});

describe('downloading the voice model', () => {
  it('refuses bytes whose hash does not match, and writes nothing', async () => {
    global.fetch = jest.fn(async () =>
      respondWith(Buffer.from('not the model')),
    ) as unknown as typeof fetch;

    const ok = await downloadDenoiseModel(() => undefined);

    expect(ok).toBe(false);
    // Not merely "returned false". A rejected file left on disk would be
    // trusted by the next attempt, which is how a corrupt model becomes
    // permanent.
    expect(fs.existsSync(denoiseModelPath())).toBe(false);
    expect(fs.existsSync(`${denoiseModelPath()}.download`)).toBe(false);
  });

  it('reports progress as the bytes arrive', async () => {
    global.fetch = jest.fn(async () =>
      respondWith(Buffer.alloc(2048, 7)),
    ) as unknown as typeof fetch;

    const seen: number[] = [];
    await downloadDenoiseModel(({ received }) => seen.push(received));

    // From the first chunk, not after the whole file: a button that visibly
    // does nothing for ten megabytes reads as broken.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(2048);
  });

  it('survives a network failure without leaving a partial file', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    await expect(downloadDenoiseModel(() => undefined)).resolves.toBe(false);
    expect(fs.existsSync(denoiseModelPath())).toBe(false);
  });

  it('does not consider a wrong-sized file present', () => {
    fs.mkdirSync(path.dirname(denoiseModelPath()), { recursive: true });
    fs.writeFileSync(denoiseModelPath(), Buffer.alloc(64));
    // Size is the cheap half of the check and it runs on every open. A
    // truncated file that looked present would fail at session creation
    // instead, with nothing pointing at the cause.
    expect(isDenoiseModelPresent()).toBe(false);
  });
});
