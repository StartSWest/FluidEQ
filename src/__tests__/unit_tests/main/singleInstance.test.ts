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
 * prevents, so the uncertain cases are all tested for "start". Real sockets,
 * no clock: the lock is a server the operating system takes away with its
 * process, and nothing here is rewritten on a timer any more.
 */

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

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-instance-'));
    lock = path.join(dir, 'fluideq-instance.sock');
  });

  afterEach(() => {
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

  it('replaces a socket file nobody answers on, as a crash leaves one', async () => {
    fs.writeFileSync(lock, '');

    const claim = await claimInstance(lock);
    releases.push(releaseOf(claim));
    expect(claim.status).toBe('claimed');
    // And it is really held: the next copy is refused.
    expect((await claimInstance(lock)).status).toBe('taken');
  });

  it('starts anyway when the lock cannot be served at all', async () => {
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
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-instance-'));
    lock = path.join(dir, 'fluideq-instance.sock');
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
