/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Reading what the FluidEQ Engine writes about each output. The text below is
 * the engine's own, as `native/system-apo/tests/status_test.cpp` pins it: a
 * field one side names differently fails as "the engine is not running" on a
 * machine where it is.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IEngineHealth } from 'common/engineHealth';
import {
  createEngineHealthMonitor,
  isProcessAlive,
  parseEngineStatus,
  readEngineHealth,
} from 'main/engineHealth';

const ENGINE_TEXT =
  '{"version":1,"endpoint":"{947B0242-A1CF-4483-A44E-B72DA462C901}",' +
  '"pid":4242,"locked":true,"processing":true,"owner":true,' +
  '"reason":"","problems":[],"at":"2026-09-11T12:00:00.000Z"}\r\n';

const status = (fields: Record<string, unknown>) =>
  `${JSON.stringify({
    version: 1,
    endpoint: '{AAAA}',
    pid: 7,
    locked: true,
    processing: true,
    owner: true,
    reason: '',
    problems: [],
    at: 't',
    ...fields,
  })}\r\n`;

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-engine-health-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  jest.restoreAllMocks();
});

describe('parseEngineStatus', () => {
  it('reads the phase fallback written by the native engine', () => {
    expect(
      parseEngineStatus(status({ problems: ['eq-phase'] }))?.problems,
    ).toEqual(['eq-phase']);
    expect(parseEngineStatus(status({ problems: [] }))?.problems).toEqual([]);
  });
  it('reads the text the engine writes', () => {
    expect(parseEngineStatus(ENGINE_TEXT)).toEqual({
      endpoint: '{947B0242-A1CF-4483-A44E-B72DA462C901}',
      pid: 4242,
      locked: true,
      processing: true,
      owner: true,
      problems: [],
    });
  });

  it('reads the finished song the engine writes', () => {
    // `a_finished_song` in status_test.cpp, byte for byte.
    const text =
      '{"version":1,"endpoint":"{AAAA}","pid":7,"locked":true,' +
      '"processing":true,"owner":true,"reason":"","problems":[],' +
      '"lastSong":{"id":"00000000000a11ce","level":-11.84,' +
      '"peak":-0.63,"seconds":184.25},"at":"t"}\r\n';
    expect(parseEngineStatus(text)?.lastSong).toEqual({
      id: '00000000000a11ce',
      levelLufs: -11.84,
      peakDb: -0.63,
      seconds: 184.25,
    });
    // Positive control for the field being optional.
    expect(parseEngineStatus(ENGINE_TEXT)).not.toHaveProperty('lastSong');
  });

  it.each([
    [
      'an id that is not sixteen hex digits',
      { id: 'a11ce', level: -12, peak: -1, seconds: 60 },
    ],
    [
      'an upper-case id the engine never writes',
      { id: '00000000000A11CE', level: -12, peak: -1, seconds: 60 },
    ],
    [
      'a level that is not a number',
      { id: '00000000000a11ce', level: '-12', peak: -1, seconds: 60 },
    ],
    ['no seconds', { id: '00000000000a11ce', level: -12, peak: -1 }],
  ])(
    'drops a finished song with %s, and keeps the status',
    (_label, lastSong) => {
      const parsed = parseEngineStatus(status({ lastSong }));
      expect(parsed?.locked).toBe(true);
      expect(parsed).not.toHaveProperty('lastSong');
    },
  );

  it('keeps problem codes it does not know, for an engine newer than the app', () => {
    expect(
      parseEngineStatus(
        status({ problems: ['convolution', 'from-the-future'] }),
      )?.problems,
    ).toEqual(['convolution', 'from-the-future']);
  });

  it('ignores fields it does not know', () => {
    expect(parseEngineStatus(status({ extra: 1 }))?.locked).toBe(true);
  });

  it.each([
    ['not JSON', 'status'],
    ['an array', '[]'],
    ['another version', status({ version: 2 })],
    ['no owner field, from before it existed', status({ owner: undefined })],
    ['a pid that is not a whole number', status({ pid: 1.5 })],
    ['a problem that is not a string', status({ problems: [3] })],
    ['a lock that is not a boolean', status({ locked: 'yes' })],
  ])('refuses %s', (_label, text) => {
    expect(parseEngineStatus(text)).toBeUndefined();
  });

  it('spells every endpoint the same way', () => {
    expect(parseEngineStatus(status({ endpoint: '{abcd-ef}' }))?.endpoint).toBe(
      '{ABCD-EF}',
    );
  });
});

describe('isProcessAlive', () => {
  it('finds this process', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('counts a process it may not open as alive', () => {
    // The engine's audio process runs as LOCAL SERVICE: Windows refuses to
    // let this user open it, which is not the same as it being gone.
    jest.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('denied'), { code: 'EPERM' });
    });
    expect(isProcessAlive(1234)).toBe(true);
  });

  it('counts a process that is not there as gone', () => {
    jest.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
    });
    expect(isProcessAlive(1234)).toBe(false);
  });

  it('never asks about pids that cannot be a process', () => {
    const kill = jest.spyOn(process, 'kill');
    expect(isProcessAlive(0)).toBe(false);
    expect(isProcessAlive(-1)).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });
});

describe('readEngineHealth', () => {
  it('reads every output, and only the status files', async () => {
    fs.writeFileSync(
      path.join(root, 'status-{BBBB}.json'),
      status({ endpoint: '{BBBB}' }),
    );
    fs.writeFileSync(
      path.join(root, 'status-{AAAA}.json'),
      status({ problems: ['dsp-rack'] }),
    );
    // Beside them in the real root: the log, a temporary a write left, and
    // the configuration folder.
    fs.writeFileSync(path.join(root, 'engine.log'), 'log');
    fs.writeFileSync(path.join(root, 'status-{CCCC}.json.99.tmp'), status({}));
    fs.mkdirSync(path.join(root, 'config'));

    const health = await readEngineHealth(root, () => true);

    expect(health.outputs.map((output) => output.endpoint)).toEqual([
      '{AAAA}',
      '{BBBB}',
    ]);
    expect(health.outputs[0].problems).toEqual(['dsp-rack']);
  });

  it('takes the lock back from an audio process that is gone', async () => {
    fs.writeFileSync(
      path.join(root, 'status-{AAAA}.json'),
      status({ pid: 11 }),
    );
    fs.writeFileSync(
      path.join(root, 'status-{BBBB}.json'),
      status({ endpoint: '{BBBB}', pid: 22 }),
    );

    const health = await readEngineHealth(root, (pid) => pid === 22);

    // Positive control beside it: the live one keeps its lock.
    expect(health.outputs).toEqual([
      expect.objectContaining({ endpoint: '{AAAA}', locked: false }),
      expect.objectContaining({ endpoint: '{BBBB}', locked: true }),
    ]);
  });

  it('answers nothing for a machine that never had the engine', async () => {
    await expect(
      readEngineHealth(path.join(root, 'missing'), () => true),
    ).resolves.toEqual({ outputs: [] });
  });

  it('skips a file it cannot parse rather than failing the rest', async () => {
    fs.writeFileSync(path.join(root, 'status-{AAAA}.json'), 'garbage');
    fs.writeFileSync(
      path.join(root, 'status-{BBBB}.json'),
      status({ endpoint: '{BBBB}' }),
    );

    const health = await readEngineHealth(root, () => true);

    expect(health.outputs.map((output) => output.endpoint)).toEqual(['{BBBB}']);
  });
});

describe('createEngineHealthMonitor', () => {
  it('shares one waiting read between requests that arrive together', async () => {
    const monitor = createEngineHealthMonitor(
      root,
      () => undefined,
      () => true,
    );
    const first = monitor.read();
    const second = monitor.read();
    expect(second).toBe(first);
    await first;
    // Once one has started, the next request gets a read of its own.
    expect(monitor.read()).not.toBe(first);
    monitor.close();
  });

  it('tells the listener only when what the engine says changes', async () => {
    const heard: IEngineHealth[] = [];
    const monitor = createEngineHealthMonitor(
      root,
      (health) => heard.push(health),
      () => true,
    );
    fs.writeFileSync(path.join(root, 'status-{AAAA}.json'), status({}));

    await monitor.read();
    await monitor.read();

    expect(heard).toHaveLength(1);
    monitor.close();
  });

  it('follows a status the engine renames into place', async () => {
    let resolveChange: (health: IEngineHealth) => void = () => undefined;
    const changed = new Promise<IEngineHealth>((resolve) => {
      resolveChange = resolve;
    });
    const monitor = createEngineHealthMonitor(
      root,
      (health) => {
        if (health.outputs.length > 0) {
          resolveChange(health);
        }
      },
      () => true,
    );
    await monitor.read();

    // The engine's own way of writing: aside, then renamed over.
    const aside = path.join(root, 'status-{AAAA}.json.7.tmp');
    fs.writeFileSync(aside, status({ problems: ['unwatched'] }));
    fs.renameSync(aside, path.join(root, 'status-{AAAA}.json'));

    const health = await changed;
    expect(health.outputs[0]).toEqual(
      expect.objectContaining({ endpoint: '{AAAA}', problems: ['unwatched'] }),
    );
    monitor.close();
  });

  it('starts watching a root that appears after the first read', async () => {
    const late = path.join(root, 'engine');
    let resolveChange: () => void = () => undefined;
    const changed = new Promise<void>((resolve) => {
      resolveChange = resolve;
    });
    const monitor = createEngineHealthMonitor(
      late,
      (health) => {
        if (health.outputs.length > 0) {
          resolveChange();
        }
      },
      () => true,
    );
    await expect(monitor.read()).resolves.toEqual({ outputs: [] });

    fs.mkdirSync(late);
    await monitor.read(); // The window asks again; now there is a root.
    fs.writeFileSync(path.join(late, 'status-{AAAA}.json'), status({}));

    await changed;
    monitor.close();
  });
});
