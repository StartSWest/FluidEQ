/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createOutputFormats } from '../../../main/outputFormat';

const DEVICE = '{0.0.0.00000000}.{AAAA}';

describe('an output’s format for the Room', () => {
  let userData: string;
  let calls: string[][];
  let answers: Record<string, unknown>[];
  const run = async (args: string[]) => {
    calls.push(args);
    const next = answers.shift();
    if (!next) {
      throw new Error('no answer scripted');
    }
    return next;
  };

  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-formats-'));
    calls = [];
    answers = [];
  });

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true });
  });

  it('reads the format and whether the driver takes 7.1, and says nothing is remembered', async () => {
    answers.push({
      ok: true,
      channels: 2,
      sampleRate: 48000,
      bitsPerSample: 24,
      takesEightChannels: true,
      format: 'AAAA',
    });
    const formats = createOutputFormats(userData, run);
    await expect(formats.read(DEVICE)).resolves.toEqual({
      channels: 2,
      sampleRate: 48000,
      bitsPerSample: 24,
      takesEightChannels: true,
      restorable: false,
    });
    expect(calls).toEqual([['-DeviceId', DEVICE]]);
  });

  it('sets 7.1, remembers the first "before" for Undo, and puts it back', async () => {
    const formats = createOutputFormats(userData, run);
    answers.push({ ok: true, channels: 8, previous: 'BEFORE' });
    await expect(formats.setSevenOne(DEVICE)).resolves.toEqual({
      ok: true,
      channels: 8,
    });
    expect(calls[0]).toEqual(['-DeviceId', DEVICE, '-SetChannels', '8']);
    // Remembered on disk, so an Undo after a restart still knows.
    const memory = JSON.parse(
      fs.readFileSync(path.join(userData, 'output-formats.json'), 'utf8'),
    );
    expect(memory[DEVICE].previous).toBe('BEFORE');

    // A second press keeps the original "before", not the 7.1 it now has.
    answers.push({ ok: true, channels: 8, previous: 'SEVEN' });
    await formats.setSevenOne(DEVICE);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(userData, 'output-formats.json'), 'utf8'),
      )[DEVICE].previous,
    ).toBe('BEFORE');

    answers.push({ ok: true, channels: 2, takesEightChannels: true });
    await expect(formats.read(DEVICE)).resolves.toEqual(
      expect.objectContaining({ restorable: true }),
    );

    answers.push({ ok: true, channels: 2 });
    await expect(formats.restore(DEVICE)).resolves.toEqual({
      ok: true,
      channels: 2,
    });
    expect(calls[calls.length - 1]).toEqual([
      '-DeviceId',
      DEVICE,
      '-Restore',
      'BEFORE',
    ]);
    expect(
      DEVICE in
        JSON.parse(
          fs.readFileSync(path.join(userData, 'output-formats.json'), 'utf8'),
        ),
    ).toBe(false);
  });

  it('reports a driver that takes no 7.1 as a refusal, remembering nothing', async () => {
    const formats = createOutputFormats(userData, run);
    answers.push({ ok: false, error: 'the driver takes no 7.1 format' });
    await expect(formats.setSevenOne(DEVICE)).resolves.toEqual({
      ok: false,
      error: 'the driver takes no 7.1 format',
    });
    expect(fs.existsSync(path.join(userData, 'output-formats.json'))).toBe(
      false,
    );
    await expect(formats.restore(DEVICE)).resolves.toEqual({
      ok: false,
      error: 'nothing remembered for this output',
    });
  });
});
