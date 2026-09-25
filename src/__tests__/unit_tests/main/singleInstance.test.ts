/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The cross-build instance lock.
 *
 * Every one of these is really the same question asked twice: does it stop a
 * second copy, and — the one that matters far more — can it ever stop the
 * first? Refusing to start is a worse failure than the confusion this
 * prevents, so the uncertain cases are all tested for "start". Real sockets
 * and pipes, under the name this platform really uses, no clock: the lock is
 * a server the operating system takes away with its process, and nothing
 * here is rewritten on a timer any more.
 */

import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  TInstanceClaim,
  claimInstance,
  describeInstanceHolder,
  instanceLockPath,
} from '../../../main/singleInstance';

const releaseOf = (claim: TInstanceClaim) => {
  if (claim.status !== 'claimed') {
    throw new Error('expected this copy to hold the lock');
  }
  return claim.release;
};

/**
 * A folder of the test's own, and the lock where this platform keeps it for
 * that folder — never a path spelled here. On Windows the lock is a named
 * pipe, and a file path is not a pipe name: Windows serves nothing there, a
 * lock that cannot be served fails open to "start", and so every claim in
 * this file came back claimed on Windows while Linux, where the lock really
 * is a file, was green. The folder's digest in the pipe's name keeps it apart
 * from a FluidEQ running on the same machine.
 */
const freshLock = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-instance-'));
  return { dir, lock: instanceLockPath(dir) };
};

/**
 * Another copy holding the lock, as a process of its own: it serves the lock
 * the way `claimInstance`'s server does — every connection told its pid and
 * closed — and says so once it is listening. Plain JavaScript in a file, so
 * no command line has to carry quotes or a pipe name through a shell.
 */
const OTHER_COPY = `
const net = require('net');
const server = net.createServer((socket) => {
  socket.on('error', () => undefined);
  socket.end(String(process.pid));
});
server.on('error', (error) => {
  process.stderr.write(String(error));
  process.exit(1);
});
server.listen(process.argv[2], () => process.stdout.write('listening'));
`;

interface IOtherCopy {
  pid: number;
  /**
   * Ends it the way End task or a crash does — nothing released, nothing
   * cleaned up — and resolves once the process is gone.
   */
  crash: () => Promise<void>;
}

/** Settles when the process has ended and its output has closed. */
const ended = (child: ChildProcess): Promise<void> =>
  new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once('close', () => resolve());
  });

describe('where the lock lives', () => {
  it('is a pipe per user on Windows, since a pipe name is machine-wide', () => {
    const ivan = instanceLockPath('C:\\Users\\Ivan\\AppData\\Roaming', 'win32');
    expect(ivan).toMatch(/^\\\\\.\\pipe\\FluidEQ-Instance-[0-9a-f]{16}$/);
    expect(
      instanceLockPath('C:\\Users\\Ana\\AppData\\Roaming', 'win32'),
    ).not.toBe(ivan);
    // Windows paths are not case-sensitive, and neither is the answer.
    expect(instanceLockPath('c:\\users\\ivan\\appdata\\roaming', 'win32')).toBe(
      ivan,
    );
  });

  it('is a socket in the shared folder elsewhere', () => {
    expect(instanceLockPath('/home/ivan/.config', 'linux')).toBe(
      path.join('/home/ivan/.config', 'fluideq-instance.sock'),
    );
  });
});

describe('claiming it', () => {
  let dir: string;
  let lock: string;
  const releases: Array<() => void> = [];
  const others: ChildProcess[] = [];

  const anotherCopy = (): Promise<IOtherCopy> => {
    const script = path.join(dir, 'other-copy.js');
    fs.writeFileSync(script, OTHER_COPY);
    const child = spawn(process.execPath, [script, lock], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    others.push(child);
    return new Promise((resolve, reject) => {
      const { pid, stdout } = child;
      if (pid === undefined || stdout === null) {
        reject(new Error('the other copy did not start'));
        return;
      }
      let said = '';
      stdout.setEncoding('utf8');
      stdout.on('data', (chunk: string) => {
        said += chunk;
        if (said.includes('listening')) {
          resolve({
            pid,
            crash: () => {
              child.kill('SIGKILL');
              return ended(child);
            },
          });
        }
      });
      child.once('error', reject);
      // Only heard before it listens: once it has, this promise is settled.
      child.once('exit', (code) =>
        reject(new Error(`the other copy ended before serving (${code})`)),
      );
    });
  };

  beforeEach(() => {
    ({ dir, lock } = freshLock());
  });

  afterEach(async () => {
    // A copy a failed test left running would hold its lock, and on Windows
    // keep its folder in use.
    await Promise.all(
      others.splice(0).map((child) => {
        child.kill('SIGKILL');
        return ended(child);
      }),
    );
    releases.splice(0).forEach((release) => release());
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('is claimed by the first copy and refused to the second', async () => {
    const first = await claimInstance(lock);
    releases.push(releaseOf(first));

    const second = await claimInstance(lock);
    expect(second).toEqual({
      status: 'taken',
      holder: `The copy holding the instance lock answered as pid ${process.pid}.`,
    });
  });

  it('is free again once released, with nothing waiting to go stale', async () => {
    const release = releaseOf(await claimInstance(lock));
    release();
    // Twice is harmless: quitting runs through several paths.
    release();

    const again = await claimInstance(lock);
    releases.push(releaseOf(again));
    expect(again.status).toBe('claimed');
  });

  it('is not kept out by a copy that crashed holding it', async () => {
    const other = await anotherCopy();
    // The positive control: while that copy runs it holds the lock, so what
    // follows is a crash being got past, not a lock nobody ever held.
    expect(await claimInstance(lock)).toEqual({
      status: 'taken',
      holder: `The copy holding the instance lock answered as pid ${other.pid}.`,
    });

    await other.crash();
    // On Windows the pipe went with the process. Elsewhere the socket file is
    // still there with nobody behind it, as a crash leaves one, and the claim
    // has to replace it.
    const claim = await claimInstance(lock);
    releases.push(releaseOf(claim));
    expect(claim.status).toBe('claimed');
    // And it is really held: the next copy is refused.
    expect((await claimInstance(lock)).status).toBe('taken');
  });

  it('starts anyway when the lock cannot be served at all', async () => {
    // Under a folder that does not exist — and on Windows not a pipe name at
    // all — so there is nothing any copy could serve.
    const nowhere = path.join(dir, 'missing', 'fluideq-instance.sock');

    const claim = await claimInstance(nowhere);
    expect(claim.status).toBe('claimed');
    expect(() => releaseOf(claim)()).not.toThrow();
  });
});

describe('the sentence it writes for the log', () => {
  let dir: string;
  let lock: string;

  beforeEach(() => {
    ({ dir, lock } = freshLock());
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('names the pid that answered', async () => {
    const release = releaseOf(await claimInstance(lock));
    try {
      await expect(describeInstanceHolder(lock)).resolves.toBe(
        `The copy holding the instance lock answered as pid ${process.pid}.`,
      );
    } finally {
      release();
    }
  });

  it('says so plainly when nobody holds it', async () => {
    await expect(describeInstanceHolder(lock)).resolves.toMatch(
      /^Nothing answered on the instance lock \(ENOENT\)\.$/,
    );
  });
});
