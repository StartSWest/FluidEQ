/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The watcher electronmon restarts `pnpm dev`'s main process from — watchboy
 * as `patches/watchboy@0.4.3.patch` leaves it — told about the checkout the
 * way Windows tells it.
 *
 * On 2026-11-26 main ran the code from 15:00 until 19:27 through two landings
 * that changed its files, while the window hot-reloaded the new code: main
 * refused what the new window sent. No quit was ever asked for. The landings
 * rewrote twenty files at once, Windows' change buffer overflowed and was
 * reported as one change with no name, and the watcher reported nothing; the
 * files it was told about by name it then mostly dropped for being older than
 * the newest file it had seen. `fs.watch` is replaced here so each of those
 * reports can be made exactly; the files are real.
 */

import { EventEmitter, once } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';

type TWatchCallback = (type: string, name: string | null) => void;

interface IWatchboyEvent {
  path: string;
}

type TWatchboy = (
  patterns: string[],
  options: { cwd: string },
) => EventEmitter & { close(): void };

const watchboyPath = require.resolve('watchboy', {
  paths: [path.dirname(require.resolve('electronmon/package.json'))],
});

// electronmon's own patterns, then FluidEQ's from package.json.
const PATTERNS = [
  '**/*',
  '!node_modules',
  '!node_modules/**/*',
  '!.*',
  '!**/*.map',
  '!**/**',
  'src/main/**',
  'src/common/**',
];

const realPlatform = process.platform;
const realReaddir = fs.readdir;
let root = '';
let rootCallback: TWatchCallback | undefined;
/** Run once, from inside the next directory listing's own callback. */
let duringNextListing: (() => void) | undefined;

beforeAll(() => {
  // The recursive single watcher is the Windows shape, on any machine.
  Object.defineProperty(process, 'platform', { value: 'win32' });
  jest.spyOn(fs, 'watch').mockImplementation(((
    _dir: string,
    _options: unknown,
    callback: TWatchCallback,
  ) => {
    rootCallback = callback;
    const handle = new EventEmitter();
    return Object.assign(handle, { close: () => undefined });
  }) as unknown as typeof fs.watch);
  // Read at load by watchboy (`pify(fs.readdir)`), so installed first.
  // watchboy always passes options; anything else goes straight through.
  jest.spyOn(fs, 'readdir').mockImplementation(((
    dir: string,
    options: unknown,
    callback: unknown,
  ) => {
    if (typeof callback !== 'function') {
      return (realReaddir as (...args: unknown[]) => void)(dir, options);
    }
    return realReaddir(
      dir,
      options as { withFileTypes: true },
      (error, entries) => {
        callback(error, entries);
        const hook = duringNextListing;
        duringNextListing = undefined;
        hook?.();
      },
    );
  }) as unknown as typeof fs.readdir);
});

afterAll(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform });
  jest.restoreAllMocks();
});

let watcher: (EventEmitter & { close(): void }) | undefined;

const write = (relative: string, text: string, mtimeOffsetMs = 0) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  // Every write lands on its own whole second, so the comparison is never
  // decided by the file system's timestamp resolution.
  const at = new Date(Math.round((Date.now() + mtimeOffsetMs) / 1000) * 1000);
  fs.utimesSync(file, at, at);
  return file;
};

const start = async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-watch-'));
  ['a', 'b', 'c', 'quiet'].forEach((name) =>
    write(`src/main/${name}.ts`, `export const ${name} = 1;\n`, -60_000),
  );
  write('src/common/i18n/en/autoEq.ts', 'export default {};\n', -60_000);
  let watchboy: TWatchboy | undefined;
  jest.isolateModules(() => {
    watchboy = jest.requireActual<TWatchboy>(watchboyPath);
  });
  if (!watchboy) {
    throw new Error('watchboy did not load');
  }
  const started = watchboy(PATTERNS, { cwd: root });
  watcher = started;
  await once(started, 'ready');
  return started;
};

afterEach(() => {
  watcher?.close();
  watcher = undefined;
  fs.rmSync(root, { recursive: true, force: true });
});

/** The next event of `type` whose path ends in `relative`. */
const next = (
  events: EventEmitter,
  type: 'change' | 'add' | 'unlink',
  relative: string,
) =>
  new Promise<string>((resolve) => {
    const wanted = path.join(root, relative);
    const listener = (event: IWatchboyEvent) => {
      if (event.path === wanted) {
        events.off(type, listener);
        resolve(event.path);
      }
    };
    events.on(type, listener);
  });

const record = (events: EventEmitter) => {
  const seen: string[] = [];
  (['change', 'add', 'unlink'] as const).forEach((type) =>
    events.on(type, (event: IWatchboyEvent) =>
      seen.push(
        `${type} ${path.relative(root, event.path).split(path.sep).join('/')}`,
      ),
    ),
  );
  return seen;
};

const tell = (name: string | null) => {
  if (!rootCallback) {
    throw new Error('the root is not being watched');
  }
  rootCallback('change', name);
};

describe("the dev main process's file watcher", () => {
  it('reports a file Windows names (control)', async () => {
    const events = await start();
    const changed = next(events, 'change', 'src/main/a.ts');

    write('src/main/a.ts', 'export const a = 2;\n');
    tell('src\\main\\a.ts');

    await expect(changed).resolves.toBe(path.join(root, 'src/main/a.ts'));
  });

  it("reports every file a landing changed when Windows' buffer overflowed", async () => {
    const events = await start();
    const seen = record(events);
    const changedA = next(events, 'change', 'src/main/a.ts');
    const changedLocale = next(
      events,
      'change',
      'src/common/i18n/en/autoEq.ts',
    );

    write('src/main/a.ts', 'export const a = 2;\n');
    write('src/common/i18n/en/autoEq.ts', 'export default { x: 1 };\n');
    // The overflow, as libuv reports it: one change with no name at all.
    tell(null);
    await Promise.all([changedA, changedLocale]);

    // A file written after the overflow arrives behind every file it made
    // the watcher look at again, so the record is complete by then.
    const changedC = next(events, 'change', 'src/main/c.ts');
    write('src/main/c.ts', 'export const c = 2;\n');
    tell('src\\main\\c.ts');
    await changedC;

    expect(seen.sort()).toEqual([
      'change src/common/i18n/en/autoEq.ts',
      'change src/main/a.ts',
      'change src/main/c.ts',
    ]);
  });

  it('reports a file whose stat comes back after a newer one', async () => {
    const events = await start();
    const changedA = next(events, 'change', 'src/main/a.ts');
    write('src/main/a.ts', 'export const a = 2;\n', 20_000);
    tell('src\\main\\a.ts');
    await changedA;

    // Written before a, answered after it: the whole tree used to be held to
    // the newest mtime seen, and b was dropped for being older than a.
    const changedB = next(events, 'change', 'src/main/b.ts');
    write('src/main/b.ts', 'export const b = 2;\n', 10_000);
    tell('src\\main\\b.ts');

    await expect(changedB).resolves.toBe(path.join(root, 'src/main/b.ts'));
  });

  it('reports a file git rewrote while its folder was being rescanned', async () => {
    const events = await start();
    const seen = record(events);
    const file = path.join(root, 'src/main/a.ts');
    const changed = next(events, 'change', 'src/main/a.ts');

    // git deletes the file and creates it again; the folder's own change
    // makes the watcher list it in between, and the file is back the moment
    // that listing has been taken.
    fs.unlinkSync(file);
    duringNextListing = () => write('src/main/a.ts', 'export const a = 2;\n');
    tell('src\\main');

    await expect(changed).resolves.toBe(file);
    expect(seen).toEqual(['change src/main/a.ts']);

    // And it is still watched: the next edit to it is reported too.
    const again = next(events, 'change', 'src/main/a.ts');
    write('src/main/a.ts', 'export const a = 3;\n', 5_000);
    tell('src\\main\\a.ts');
    await expect(again).resolves.toBe(file);
  });

  it('still reports a file that is really deleted as deleted (control)', async () => {
    const events = await start();
    const removed = next(events, 'unlink', 'src/main/b.ts');

    fs.unlinkSync(path.join(root, 'src/main/b.ts'));
    tell('src\\main');

    await expect(removed).resolves.toBe(path.join(root, 'src/main/b.ts'));
  });

  it('still reports a new file as added (control)', async () => {
    const events = await start();
    const added = next(events, 'add', 'src/main/fresh.ts');

    write('src/main/fresh.ts', 'export const fresh = 1;\n');
    tell('src\\main\\fresh.ts');

    await expect(added).resolves.toBe(path.join(root, 'src/main/fresh.ts'));
  });
});
