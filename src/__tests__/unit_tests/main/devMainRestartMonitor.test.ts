/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * electronmon, as `patches/electronmon@2.0.4.patch` leaves it: what restarts
 * `pnpm dev`'s main process when one of its files changes.
 *
 * It asks the app to restart once, with `reset`, and drops every message
 * after that until the app has gone. Two ways that left main running old
 * code with nothing to say so: a file main had loaded coming back after the
 * watcher reported it deleted was treated as a brand-new file, and every
 * change dropped while it waited on an app that never quit was dropped in
 * silence. The watcher and the app are stand-ins; the logic is the real one.
 */

import childProcess from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { PassThrough } from 'stream';

type TElectronmon = (options: {
  cwd: string;
  args: string[];
  electronPath: string;
  logLevel: string;
  patterns: string[];
  stdio: [PassThrough, PassThrough, PassThrough];
}) => Promise<unknown>;

class FakeApp extends EventEmitter {
  /** What reached the app; electronmon wraps `send` itself. */
  readonly sent = jest.fn();

  send = (message: unknown) => this.sent(message);

  readonly kill = jest.fn();

  readonly stdin = new PassThrough();

  readonly stdout = new PassThrough();

  readonly stderr = new PassThrough();
}

const packageDir = path.dirname(require.resolve('electronmon/package.json'));
const root = path.resolve('/fluideq-dev');
const mainFile = path.join(root, 'src', 'main', 'main.ts');
const rendererFile = path.join(root, 'src', 'common', 'windowOnly.ts');
// electronmon's own exit code for "restart me" (`src/signal.js`).
const RESTART_CODE = 37;

const setup = async ({ discoverBeforeReady = false } = {}) => {
  const apps: FakeApp[] = [];
  jest.spyOn(childProcess, 'spawn').mockImplementation((() => {
    const app = new FakeApp();
    apps.push(app);
    return app;
  }) as unknown as typeof childProcess.spawn);
  const watcher = Object.assign(new EventEmitter(), {
    close: () => Promise.resolve(),
  });
  jest.doMock(path.join(packageDir, 'src', 'watch.js'), () => () => watcher);
  let electronmon: TElectronmon | undefined;
  jest.isolateModules(() => {
    electronmon = jest.requireActual<TElectronmon>(packageDir);
  });
  if (!electronmon) {
    throw new Error('electronmon did not load');
  }

  const out = new PassThrough();
  let printed = '';
  out.on('data', (chunk: Buffer) => {
    printed += chunk.toString();
  });
  const running = electronmon({
    cwd: root,
    args: ['dev-main.cjs'],
    electronPath: 'electron',
    logLevel: 'info',
    patterns: [],
    stdio: [new PassThrough(), out, new PassThrough()],
  });
  const discover = () =>
    apps[apps.length - 1].emit('message', { type: 'discover', file: mainFile });
  if (discoverBeforeReady) {
    discover();
    // The watcher's first scan reports every file it finds as added.
    watcher.emit('add', { path: mainFile });
  }
  watcher.emit('ready');
  await running;
  if (!discoverBeforeReady) {
    discover();
  }
  return { apps, watcher, printed: () => printed };
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGHUP');
});

describe("the dev main process's restarter", () => {
  it('restarts main when a file it loaded changes (control)', async () => {
    const { apps, watcher } = await setup();

    watcher.emit('change', { path: mainFile });

    expect(apps[0].sent).toHaveBeenCalledWith('reset');
  });

  it('restarts main when a file it loaded comes back after being deleted', async () => {
    const { apps, watcher } = await setup();

    watcher.emit('unlink', { path: mainFile });
    watcher.emit('add', { path: mainFile });

    expect(apps[0].sent).toHaveBeenCalledWith('reset');
  });

  it('restarts nothing for a new file main has never loaded', async () => {
    const { apps, watcher } = await setup();

    watcher.emit('add', { path: rendererFile });

    expect(apps[0].sent).not.toHaveBeenCalled();
  });

  it("restarts nothing for the watcher's own first scan", async () => {
    const { apps } = await setup({ discoverBeforeReady: true });

    expect(apps[0].sent).not.toHaveBeenCalled();
  });

  it('says so for every change while main has not quit after a restart was asked for', async () => {
    const { apps, watcher, printed } = await setup();
    watcher.emit('change', { path: mainFile });

    watcher.emit('change', { path: mainFile });
    watcher.emit('change', { path: rendererFile });

    expect(apps[0].sent).toHaveBeenCalledTimes(1);
    expect(
      printed().match(/waiting: the app has not quit since its restart/g),
    ).toHaveLength(2);
  });

  it('restarts main again once the app has gone and come back (control)', async () => {
    const { apps, watcher } = await setup();
    watcher.emit('change', { path: mainFile });

    apps[0].emit('exit', RESTART_CODE, null);
    expect(apps).toHaveLength(2);
    watcher.emit('change', { path: mainFile });

    expect(apps[1].sent).toHaveBeenCalledWith('reset');
  });
});
