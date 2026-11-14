/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every helper FluidEQ starts, with Windows refusing it outright: `spawn` and
 * `execFile` throwing synchronously, as the lighting helper's did in 2.5.2 and
 * closed the app five seconds into every launch. Each starter must take it as
 * the helper being off — one line in the log, no throw out of the call, no
 * callback from inside it — and FluidEQ goes on.
 */

import { EventEmitter } from 'events';

const REFUSED = Object.assign(new Error('spawn UNKNOWN'), { code: 'UNKNOWN' });
const mockMode = { refuse: true };
const mockLog = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };

/** A child that started and says nothing, for the controls. */
const quietChild = () =>
  Object.assign(new EventEmitter(), {
    pid: 4242,
    stdout: Object.assign(new EventEmitter(), { setEncoding: () => undefined }),
    stderr: new EventEmitter(),
    stdin: Object.assign(new EventEmitter(), {
      write: jest.fn(),
      end: jest.fn(),
      destroyed: false,
    }),
    kill: jest.fn(),
  });

jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    if (mockMode.refuse) {
      throw REFUSED;
    }
    return quietChild();
  }),
  execFile: jest.fn(() => {
    if (mockMode.refuse) {
      throw REFUSED;
    }
    return quietChild();
  }),
}));
jest.mock('electron-log', () => ({ __esModule: true, default: mockLog }));
jest.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '', getAppPath: () => '' },
}));

// eslint-disable-next-line import/first -- the mocks above stand in for Windows and the log
import { startHelper } from '../../../main/helperSpawn';
// eslint-disable-next-line import/first
import { createGameWatch } from '../../../main/gameWatch';
// eslint-disable-next-line import/first
import { createProcessMeter } from '../../../main/processMeter';
// eslint-disable-next-line import/first
import { createSystemVolumeWatch } from '../../../main/systemVolume';
// eslint-disable-next-line import/first
import { startWallpaperHost } from '../../../main/wallpaper/nativeHost';
// eslint-disable-next-line import/first
import { runEngineSetup } from '../../../main/engineSetup';

const here = () => 'C:/FluidEQ/resources/helper.exe';
const handle = Buffer.alloc(8);

const startLines = () =>
  mockLog.error.mock.calls
    .map(([line]) => String(line))
    .filter((line) => line.includes('could not start'));

beforeEach(() => {
  mockMode.refuse = true;
  Object.values(mockLog).forEach((fn) => fn.mockClear());
});

describe('a helper Windows refuses to start', () => {
  it('is one line in the log, in the start-failure shape, and no throw', () => {
    expect(
      startHelper('Lighting helper', () => {
        throw REFUSED;
      }),
    ).toBeUndefined();
    expect(mockLog.error.mock.calls).toEqual([
      [
        'Lighting helper: could not start (spawn UNKNOWN); it stays off until FluidEQ starts again.',
      ],
    ]);
  });

  it('hands back the process when it starts (the control)', () => {
    const child = quietChild();
    expect(startHelper('Lighting helper', () => child)).toBe(child);
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  it('leaves the game watcher off, its list empty', async () => {
    const watch = createGameWatch(jest.fn(), jest.fn(), here);
    expect(() => watch.start()).not.toThrow();
    expect(watch.isWatching()).toBe(false);
    await expect(watch.running()).resolves.toEqual([]);
    // A list asked for is asked for again: one line each time, said so.
    expect(startLines()).toEqual([
      'Game watcher: could not start (spawn UNKNOWN); it is tried again the next time it is needed.',
      'Game watcher: could not start (spawn UNKNOWN); it is tried again the next time it is needed.',
    ]);
  });

  it('runs the game watcher when Windows lets it (the control)', () => {
    mockMode.refuse = false;
    const watch = createGameWatch(jest.fn(), jest.fn(), here);
    watch.start();
    expect(watch.isWatching()).toBe(true);
    watch.stop();
  });

  it('leaves the process meter answering with nothing', async () => {
    const meter = createProcessMeter(here);
    await expect(meter.read([1, 2])).resolves.toBeUndefined();
    expect(startLines()).toHaveLength(1);
  });

  it('leaves the volume slider with no level, as with no helper', () => {
    const onChange = jest.fn();
    const watch = createSystemVolumeWatch(onChange, here);
    expect(() => watch.start()).not.toThrow();
    expect(onChange).toHaveBeenCalledWith(null);
    expect(startLines()).toHaveLength(1);
  });

  it('fails the desktop host after its start returns, never from inside it', async () => {
    const onEvent = jest.fn();
    const host = startWallpaperHost('C:/x.exe', handle, onEvent, jest.fn());
    // Nothing from inside the call: the 2.5.2 crash was a callback reading
    // a value its own start had not finished assigning.
    expect(onEvent).not.toHaveBeenCalled();
    expect(() => host.setVisible(true)).not.toThrow();
    await Promise.resolve();
    expect(onEvent).toHaveBeenCalledWith('error');
  });

  it('says nothing for a desktop host stopped before its failure lands', async () => {
    const onEvent = jest.fn();
    startWallpaperHost('C:/x.exe', handle, onEvent, jest.fn()).stop();
    await Promise.resolve();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('answers an engine setup command with a failure, never a rejection', async () => {
    await expect(runEngineSetup('detach', [], 'C:/setup.exe')).resolves.toEqual(
      {
        ok: false,
        declined: false,
        error: 'The setup helper could not be started.',
        endpoints: [],
      },
    );
    expect(startLines()).toEqual([
      'FluidEQ Engine Setup: could not start (spawn UNKNOWN); this engine command reports a failure.',
    ]);
  });
});
