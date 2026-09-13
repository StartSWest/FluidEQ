/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readProject,
  writeStarterProject,
} from '../../../main/memberScenes/project';
import type { TSettingsWrite } from '../../../main/memberScenes/projectSettings';
import { writeProjectSettings } from '../../../main/memberScenes/projectSettings';
import {
  queueSettingsWrite,
  waitForSettingsWrites,
} from '../../../main/memberScenes/settingsWrites';

/**
 * A save the test finishes when it chooses — before or after the queue has
 * started it, since its outcome exists from the start.
 */
const deferredSave = () => {
  let finish: (outcome: TSettingsWrite) => void = () => undefined;
  const outcome = new Promise<TSettingsWrite>((resolve) => {
    finish = resolve;
  });
  const started = jest.fn();
  const write = () => {
    started();
    return outcome;
  };
  return { write, started, finish: (value: TSettingsWrite) => finish(value) };
};

describe('saving a scene’s settings into its folder', () => {
  let folder: string;

  beforeEach(async () => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-settings-'));
    await writeStarterProject(folder, { id: 'my-scene', name: 'My scene' });
    const file = path.join(folder, 'pack.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    manifest.params = [
      { id: 'speed', names: { en: 'Speed' }, min: 0, max: 5, value: 1 },
      { id: 'size', names: { en: 'Size' }, min: 0, max: 5, value: 1 },
    ];
    fs.writeFileSync(file, JSON.stringify(manifest));
  });

  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

  it('reads the final settings for Add/export without losing overlapping slider saves', async () => {
    const response = {
      sensitivity: 2,
      threshold: 0.1,
      attack: 20,
      release: 100,
    };
    const first = writeProjectSettings(folder, {
      params: { speed: 2 },
      response,
    });
    const second = writeProjectSettings(folder, { params: { size: 4 } });
    // All consumers use this reader, including Add and export. Do not await
    // the writes first.
    const build = await readProject(folder);
    await expect(first).resolves.toBe('written');
    await expect(second).resolves.toBe('written');
    expect(build).toMatchObject({
      ok: true,
      pack: {
        response,
        params: [
          { id: 'speed', value: 2 },
          { id: 'size', value: 4 },
        ],
      },
    });
  });

  it('reads the manifest as it is after a save that failed, not as a missing file', async () => {
    const save = deferredSave();
    const queued = queueSettingsWrite(folder, save.write);
    const build = readProject(folder);
    save.finish('failed');
    await expect(queued).resolves.toBe('failed');
    await expect(build).resolves.toMatchObject({
      ok: true,
      pack: {
        params: [
          { id: 'speed', value: 1 },
          { id: 'size', value: 1 },
        ],
      },
    });
  });
});

describe('the settings save queue', () => {
  it('starts a save only once the one before it for the folder has settled', async () => {
    const first = deferredSave();
    const second = deferredSave();
    const done = [
      queueSettingsWrite('A', first.write),
      queueSettingsWrite('A', second.write),
    ];
    await Promise.resolve();
    expect(first.started).toHaveBeenCalledTimes(1);
    expect(second.started).not.toHaveBeenCalled();
    first.finish('failed');
    await done[0];
    await Promise.resolve();
    // A failed save does not hold up the next one.
    expect(second.started).toHaveBeenCalledTimes(1);
    second.finish('written');
    await expect(done[1]).resolves.toBe('written');
  });

  it('keeps a reader waiting until every queued save has settled', async () => {
    const first = deferredSave();
    const second = deferredSave();
    const queued = [
      queueSettingsWrite('B', first.write),
      queueSettingsWrite('B', second.write),
    ];
    let waited = false;
    const reader = (async () => {
      await waitForSettingsWrites('B');
      waited = true;
    })();
    first.finish('written');
    await queued[0];
    await Promise.resolve();
    expect(waited).toBe(false);
    second.finish('failed');
    await reader;
    expect(waited).toBe(true);
  });

  it('lets a reader through at once when nothing is queued, and folders apart', async () => {
    const other = deferredSave();
    const queued = queueSettingsWrite('C', other.write);
    // The control: 'C' is held, 'D' is not.
    await expect(waitForSettingsWrites('D')).resolves.toBeUndefined();
    other.finish('unchanged');
    await queued;
    await expect(waitForSettingsWrites('C')).resolves.toBeUndefined();
  });
});
