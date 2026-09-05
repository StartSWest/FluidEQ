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
