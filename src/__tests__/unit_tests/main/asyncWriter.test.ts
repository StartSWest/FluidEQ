/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

import fs from 'fs';
import os from 'os';
import path from 'path';
import log from 'electron-log';
import {
  flushPendingWrites,
  forgetPath,
  hasUnsettledWrites,
  peekScheduled,
  scheduleWrite,
  scheduleWriteOperation,
} from '../../../main/asyncWriter';
import readTextCached from '../../../main/cachedRead';

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((_resolve) => {
    resolve = _resolve;
  });
  return { promise, resolve };
};

describe('background file writes', () => {
  let directory: string;
  let file: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-writer-'));
    file = path.join(directory, 'profile.txt');
  });

  afterEach(async () => {
    forgetPath(file);
    await flushPendingWrites();
    jest.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('rejects a failed save and retries identical contents after recovery', async () => {
    const failure = new Error('disk unavailable');
    const report = jest.spyOn(log, 'error').mockImplementation(() => undefined);
    const write = jest
      .spyOn(fs.promises, 'writeFile')
      .mockRejectedValueOnce(failure);

    await expect(scheduleWrite(file, 'kept')).rejects.toBe(failure);
    expect(report).toHaveBeenCalled();
    expect(peekScheduled(file)).toBeUndefined();
    await expect(flushPendingWrites()).rejects.toBe(failure);

    await scheduleWrite(file, 'kept');
    expect(write).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(file, 'utf8')).toBe('kept');
    await expect(flushPendingWrites()).resolves.toBeUndefined();
  });

  it('reads external edits after a save and repairs externally replaced contents', async () => {
    await scheduleWrite(file, 'saved');
    expect(readTextCached(file)).toBe('saved');
    fs.writeFileSync(file, 'externally edited');
    expect(readTextCached(file)).toBe('externally edited');

    await scheduleWrite(file, 'saved');
    expect(fs.readFileSync(file, 'utf8')).toBe('saved');
    const write = jest.spyOn(fs.promises, 'writeFile');
    await scheduleWrite(file, 'saved');
    expect(write).not.toHaveBeenCalled();
  });

  // The engine's watcher holds a config file open while it reads it, and a
  // rename cannot replace a file somebody has open. The refused rename used
  // to be the end of that save, so the last position of a drag could be the
  // one that never reached the speakers.
  it('writes in place when a reader holds the file a save would replace', async () => {
    fs.writeFileSync(file, 'the old chain, longer than the new one');
    const blocked = Object.assign(new Error('operation not permitted'), {
      code: 'EPERM',
    });
    jest.spyOn(fs.promises, 'rename').mockRejectedValueOnce(blocked);

    await scheduleWrite(file, 'new chain');

    // Cut to the new length, so nothing of the longer old file survives.
    expect(fs.readFileSync(file, 'utf8')).toBe('new chain');
    // And no temporary file is left in the folder the engine watches.
    expect(fs.readdirSync(directory)).toEqual(['profile.txt']);
  });

  it('lands the save with a real reader holding the file open', async () => {
    fs.writeFileSync(file, 'old');
    const reader = fs.openSync(file, 'r');
    try {
      await scheduleWrite(file, 'saved while being read');
    } finally {
      fs.closeSync(reader);
    }
    expect(fs.readFileSync(file, 'utf8')).toBe('saved while being read');
  });

  // The positive control: only "somebody has it open" falls back. A disk
  // that is full is a failed save and has to stay one.
  it('still fails a save whose rename failed for any other reason', async () => {
    fs.writeFileSync(file, 'kept');
    const full = Object.assign(new Error('no space left on device'), {
      code: 'ENOSPC',
    });
    jest.spyOn(fs.promises, 'rename').mockRejectedValueOnce(full);
    jest.spyOn(log, 'error').mockImplementation(() => undefined);

    await expect(scheduleWrite(file, 'lost')).rejects.toBe(full);
    expect(fs.readFileSync(file, 'utf8')).toBe('kept');
  });

  it('coalesces a drag to its latest value while a write is in flight', async () => {
    const gate = deferred();
    const original = fs.promises.writeFile.bind(fs.promises);
    const write = jest
      .spyOn(fs.promises, 'writeFile')
      .mockImplementationOnce(async (...args) => {
        await gate.promise;
        await original(...args);
      });
    const first = scheduleWrite(file, 'first');
    const middle = scheduleWrite(file, 'middle');
    const last = scheduleWrite(file, 'last');
    expect(peekScheduled(file)).toBe('last');
    expect(hasUnsettledWrites()).toBe(true);
    gate.resolve();
    await Promise.all([first, middle, last]);
    expect(write).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(file, 'utf8')).toBe('last');
    expect(hasUnsettledWrites()).toBe(false);
  });

  it('keeps the complete old configuration visible until its replacement is ready', async () => {
    fs.writeFileSync(file, 'Preamp: -20 dB\n');
    const started = deferred();
    const gate = deferred();
    const original = fs.promises.writeFile.bind(fs.promises);
    jest
      .spyOn(fs.promises, 'writeFile')
      .mockImplementationOnce(async (...args) => {
        await original(args[0], 'Preamp:', 'utf8');
        started.resolve();
        await gate.promise;
        await original(args[0], ' -10 dB\n', 'utf8');
      });
    const saving = scheduleWrite(file, 'Preamp: -10 dB\n');
    await started.promise;
    try {
      expect(fs.readFileSync(file, 'utf8')).toBe('Preamp: -20 dB\n');
    } finally {
      gate.resolve();
      await saving;
    }
    expect(fs.readFileSync(file, 'utf8')).toBe('Preamp: -10 dB\n');
    expect(fs.readdirSync(directory)).toEqual(['profile.txt']);
  });

  it('preserves the previous EQ and cleans up when publishing a save fails', async () => {
    fs.writeFileSync(file, 'Preamp: -20 dB\n');
    const failure = new Error('replacement denied');
    jest.spyOn(log, 'error').mockImplementation(() => undefined);
    jest.spyOn(fs.promises, 'rename').mockRejectedValueOnce(failure);
    await expect(scheduleWrite(file, 'Preamp: -10 dB\n')).rejects.toBe(failure);
    expect(fs.readFileSync(file, 'utf8')).toBe('Preamp: -20 dB\n');
    expect(fs.readdirSync(directory)).toEqual(['profile.txt']);
    await scheduleWrite(file, 'Preamp: -10 dB\n');
    expect(fs.readFileSync(file, 'utf8')).toBe('Preamp: -10 dB\n');
  });

  it('waits for queued config operations at shutdown and keeps only the latest pending edit', async () => {
    const gate = deferred();
    const started = deferred();
    const first = scheduleWriteOperation(directory, async () => {
      started.resolve();
      await gate.promise;
      await scheduleWrite(file, 'first');
    });
    await started.promise;
    const skipped = jest.fn(async () => {
      await scheduleWrite(file, 'middle');
    });
    const middle = scheduleWriteOperation(directory, skipped);
    const last = scheduleWriteOperation(directory, async () => {
      await scheduleWrite(file, 'last');
    });
    let drained = false;
    const shutdown = flushPendingWrites().then(() => {
      drained = true;
      return undefined;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    expect(hasUnsettledWrites()).toBe(true);
    gate.resolve();
    await Promise.all([first, middle, last, shutdown]);
    expect(skipped).not.toHaveBeenCalled();
    expect(fs.readFileSync(file, 'utf8')).toBe('last');
    expect(hasUnsettledWrites()).toBe(false);
  });

  it('finishes other pending saves before reporting a shutdown write failure', async () => {
    const gate = deferred();
    const failure = new Error('config unavailable');
    const report = jest.spyOn(log, 'error').mockImplementation(() => undefined);
    const failed = scheduleWriteOperation(`${directory}-failed`, async () => {
      throw failure;
    });
    const saving = scheduleWriteOperation(directory, async () => {
      await gate.promise;
      await scheduleWrite(file, 'last edit');
    });
    let settled = false;
    const shutdown = flushPendingWrites().catch((error: unknown) => {
      settled = true;
      return error;
    });
    await expect(failed).rejects.toBe(failure);
    expect(report).toHaveBeenCalled();
    expect(settled).toBe(false);
    gate.resolve();
    await saving;
    await expect(shutdown).resolves.toBe(failure);
    expect(fs.readFileSync(file, 'utf8')).toBe('last edit');
    expect(hasUnsettledWrites()).toBe(false);
  });
});
