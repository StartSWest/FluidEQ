/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which of AutoEq's two impulse files a download fetches.
 *
 * The catalogue fetched the 48 kHz file whatever the output ran at, so a
 * 44.1 kHz output under Equalizer APO played none of it, and the FluidEQ
 * Engine converted it once more than it needed to. The file now follows the
 * rate Windows runs the output at.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-catalog-'));

jest.mock('electron', () => ({
  app: { getPath: () => userData },
}));

// Imports come after jest.mock on purpose: the module reads `app` when a
// catalogue is first loaded, so it has to see the mocked one.
// eslint-disable-next-line import/first
import {
  catalogRateFor,
  downloadConvolution,
} from '../../../main/convolutionCatalog';

const MODEL = 'Razer Kraken V4 Pro';
const INDEX = `- [${MODEL}](./oratory1990/over-ear/Razer%20Kraken%20V4%20Pro) by oratory1990\n`;

/** A mono 16-bit impulse at `rate`: one full-scale sample, then silence. */
const impulseWav = (rate: number): Buffer => {
  const frames = 64;
  const data = Buffer.alloc(frames * 2);
  data.writeInt16LE(32767, 0);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

const answer = (status: number, body?: Buffer | string) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => (typeof body === 'string' ? body : ''),
    arrayBuffer: async () => {
      const bytes = typeof body === 'string' ? Buffer.from(body) : body;
      return bytes
        ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
        : new ArrayBuffer(0);
    },
  }) as unknown as Response;

/** Serves the index, and a WAV for each rate in `published`. */
const serve = (published: number[]) =>
  jest.fn(async (url: string) => {
    if (url.endsWith('INDEX.md')) {
      return answer(200, INDEX);
    }
    const rate = /minimum%20phase%20(\d+)Hz\.wav$/.exec(url);
    if (rate) {
      const hz = Number(rate[1]);
      return published.includes(hz) ? answer(200, impulseWav(hz)) : answer(404);
    }
    return answer(404);
  });

const entryId = `oratory1990/over-ear/Razer%20Kraken%20V4%20Pro|${encodeURIComponent(MODEL)}`;

describe('the impulse file a download picks', () => {
  const originalFetch = global.fetch;
  let configDir: string;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-ir-'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  afterAll(() => {
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('follows the output’s rate family', () => {
    expect(catalogRateFor(44100)).toBe(44100);
    expect(catalogRateFor(88200)).toBe(44100);
    expect(catalogRateFor(176400)).toBe(44100);
    expect(catalogRateFor(48000)).toBe(48000);
    expect(catalogRateFor(96000)).toBe(48000);
    expect(catalogRateFor(192000)).toBe(48000);
    // Windows did not say: the file every download used to be.
    expect(catalogRateFor(undefined)).toBe(48000);
    expect(catalogRateFor(null)).toBe(48000);
    expect(catalogRateFor(0)).toBe(48000);
  });

  it('downloads the 44.1 kHz file for an output at 44.1 kHz', async () => {
    const fetchMock = serve([44100, 48000]);
    global.fetch = fetchMock as unknown as typeof fetch;

    const profile = await downloadConvolution(entryId, configDir, 44100);

    const wavUrls = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => url.endsWith('.wav'));
    expect(wavUrls).toHaveLength(1);
    expect(wavUrls[0]).toMatch(/44100Hz\.wav$/);
    expect(profile.name).toContain('44.1 kHz');
    expect(fs.existsSync(path.join(configDir, profile.fileName ?? ''))).toBe(
      true,
    );
  });

  it('falls back to 48 kHz when a model has no 44.1 kHz file', async () => {
    const fetchMock = serve([48000]);
    global.fetch = fetchMock as unknown as typeof fetch;

    const profile = await downloadConvolution(entryId, configDir, 44100);

    const wavUrls = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => url.endsWith('.wav'));
    expect(wavUrls.map((url) => /%20(\d+)Hz\.wav$/.exec(url)?.[1])).toEqual([
      '44100',
      '48000',
    ]);
    expect(profile.name).toContain('48 kHz');
  });

  // Positive control: a 48 kHz output takes the 48 kHz file straight away.
  it('downloads the 48 kHz file for an output at 48 or 96 kHz', async () => {
    const fetchMock = serve([44100, 48000]);
    global.fetch = fetchMock as unknown as typeof fetch;

    await downloadConvolution(entryId, configDir, 96000);

    const wavUrls = fetchMock.mock.calls
      .map(([url]) => url)
      .filter((url) => url.endsWith('.wav'));
    expect(wavUrls).toHaveLength(1);
    expect(wavUrls[0]).toMatch(/48000Hz\.wav$/);
  });
});
