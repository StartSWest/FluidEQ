/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

import { execFileSync } from 'child_process';
import type { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The watcher `pnpm dev` restarts the main process with: electronmon's own
// module over the patched watchboy, driven by the pattern list in package.json,
// so this breaks if either the patch or the patterns stop protecting the tree.
type Watcher = EventEmitter & { close: () => void };
type CreateWatcher = (options: { root: string; patterns: string[] }) => Watcher;
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require -- electronmon ships untyped CommonJS and no declarations
const createWatcher: CreateWatcher = require('electronmon/src/watch');

const readPatterns = (): string[] => {
  const pkg: unknown = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf8'),
  );
  if (typeof pkg !== 'object' || pkg === null || !('electronmon' in pkg)) {
    throw new Error('package.json has no electronmon section');
  }
  const { electronmon } = pkg;
  if (
    typeof electronmon !== 'object' ||
    electronmon === null ||
    !('patterns' in electronmon) ||
    !Array.isArray(electronmon.patterns)
  ) {
    throw new Error('package.json electronmon.patterns is not a list');
  }
  return electronmon.patterns.map(String);
};

const nextEvent = (
  watcher: Watcher,
  name: string,
  target: string,
): Promise<void> =>
  new Promise((resolve) => {
    const onEvent = ({ path: reported }: { path: string }) => {
      if (path.resolve(reported) !== path.resolve(target)) {
        return;
      }
      watcher.off(name, onEvent);
      resolve();
    };
    watcher.on(name, onEvent);
  });

const ready = (watcher: Watcher): Promise<void> =>
  new Promise((resolve) => {
    watcher.once('ready', () => resolve());
  });

// The EPERM case is built from Windows ACLs, and only Windows gives the root
// a recursive watch that reports paths outside the patterns in the first place.
const describeOnWindows =
  process.platform === 'win32' ? describe : describe.skip;

describe('the dev reload watcher', () => {
  let root: string;
  let watcher: Watcher | undefined;
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-devwatch-'));
    fs.mkdirSync(path.join(root, 'src/main'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src/common'), { recursive: true });
  });

  afterEach(() => {
    watcher?.close();
    watcher = undefined;
    cleanups.splice(0).forEach((undo) => undo());
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('picks up a file created later in a new folder under src/common', async () => {
    const fresh = path.join(root, 'src/common/sub/fresh.ts');
    watcher = createWatcher({ root, patterns: readPatterns() });
    await ready(watcher);

    const added = nextEvent(watcher, 'add', fresh);
    fs.mkdirSync(path.dirname(fresh), { recursive: true });
    fs.writeFileSync(fresh, '1');
    await expect(added).resolves.toBeUndefined();

    const changed = nextEvent(watcher, 'change', fresh);
    fs.writeFileSync(fresh, '2');
    await expect(changed).resolves.toBeUndefined();
  });

  // A worktree's package store under .claude/worktrees answered stat with
  // EPERM while it was being deleted; the watcher stat'ed it although nothing
  // there is watched, the rejection went unhandled and `pnpm dev` died. The
  // same EPERM is made here with ACLs on a throwaway folder: read-attributes
  // denied on the file and listing denied on its folder, then the file is
  // renamed in so the event the watcher receives names it.
  describeOnWindows('with an unreadable path outside its patterns', () => {
    it('survives it and keeps reporting watched files', async () => {
      const user = process.env.USERNAME ?? '';
      const lockedDir = path.join(root, '.claude/worktrees/gone');
      const staged = path.join(root, 'staged');
      const locked = path.join(lockedDir, 'store-entry');
      const watched = path.join(root, 'src/main/main.ts');
      fs.mkdirSync(lockedDir, { recursive: true });
      fs.writeFileSync(staged, 'x');
      fs.writeFileSync(watched, '1');

      const icacls = (...args: string[]) =>
        execFileSync('icacls', args, { stdio: 'ignore' });
      cleanups.push(() => {
        icacls(lockedDir, '/remove:d', user);
        icacls(fs.existsSync(locked) ? locked : staged, '/remove:d', user);
      });

      const rejections: unknown[] = [];
      const onRejection = (reason: unknown) => rejections.push(reason);
      process.on('unhandledRejection', onRejection);
      cleanups.push(() => process.off('unhandledRejection', onRejection));

      watcher = createWatcher({ root, patterns: readPatterns() });
      await ready(watcher);

      // Positive control: the setup really produces the error that crashed dev.
      icacls(staged, '/deny', `${user}:(RA)`);
      icacls(lockedDir, '/deny', `${user}:(RD)`);
      const renamedIn = new Promise<void>((resolve) => {
        const probe = fs.watch(root, { recursive: true }, (_type, name) => {
          if (name && name.replace(/\\/g, '/').endsWith('gone/store-entry')) {
            probe.close();
            resolve();
          }
        });
      });
      fs.renameSync(staged, locked);
      expect(() => fs.statSync(locked)).toThrow(
        expect.objectContaining({ code: 'EPERM' }),
      );
      await renamedIn;

      // The watcher has been handed the locked path by now; it must still be
      // alive and reporting the files it does watch.
      const changed = nextEvent(watcher, 'change', watched);
      fs.writeFileSync(watched, '2');
      await changed;
      expect(rejections).toEqual([]);
    });
  });
});
