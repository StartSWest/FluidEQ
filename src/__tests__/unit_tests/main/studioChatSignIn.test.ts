/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A sign-in in its own window is over the moment the tool's sign-in file
 * changes to someone other than before (`signInWindow.ts`), or when the
 * window ends - never on another session renewing the same sign-in.
 */

import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import untilSignedIn from '../../../main/studioChat/signInWindow';

const FILE = '.credentials.json';

let folder: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-sign-in-'));
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

/** A sign-in window that stays open, and the answers `who` gives in turn. */
const signIn = (
  before: string | undefined,
  answers: (string | undefined)[],
) => {
  const child = new EventEmitter() as unknown as ChildProcess;
  const asked: (string | undefined)[] = [];
  let next: () => void = () => undefined;
  const nextAsk = () =>
    new Promise<void>((resolve) => {
      next = resolve;
    });
  const who = jest.fn(async () => {
    const answer = answers[Math.min(asked.length, answers.length - 1)];
    asked.push(answer);
    next();
    return answer;
  });
  let ended = false;
  const done = untilSignedIn({ child, folder, file: FILE, who, before }).then(
    () => {
      ended = true;
      return undefined;
    },
  );
  return { child, who, done, nextAsk, isEnded: () => ended };
};

it('is over the moment the sign-in file names someone new', async () => {
  const run = signIn(undefined, ['ready:member@example.com']);
  fs.writeFileSync(path.join(folder, FILE), '{}');
  await run.done;
  expect(run.who).toHaveBeenCalled();
});

it('another session renewing the same sign-in does not end it; the window does', async () => {
  const run = signIn('ready:member@example.com', ['ready:member@example.com']);
  const asked = run.nextAsk();
  fs.writeFileSync(path.join(folder, FILE), '{}');
  await asked;
  // Renewed again: a sign-in still waiting asks again; one that took the
  // first renewal for a new account has already ended.
  const askedAgain = run.nextAsk().then(() => 'asked again');
  fs.writeFileSync(path.join(folder, FILE), '{ }');
  expect(await Promise.race([askedAgain, run.done.then(() => 'ended')])).toBe(
    'asked again',
  );
  expect(run.isEnded()).toBe(false);
  run.child.emit('close');
  await run.done;
  expect(run.isEnded()).toBe(true);
});

it('another file in the folder is not asked about', async () => {
  const run = signIn(undefined, ['ready:member@example.com']);
  // A watcher of the test's own on the same folder, made after the one
  // under test: once it has heard the change, so has that one.
  const heard = new Promise<void>((resolve) => {
    const own = fs.watch(folder, (_type, name) => {
      if (name === 'history.jsonl') {
        own.close();
        resolve();
      }
    });
  });
  fs.writeFileSync(path.join(folder, 'history.jsonl'), 'x');
  await heard;
  await Promise.resolve();
  expect(run.who).not.toHaveBeenCalled();
  run.child.emit('close');
  await run.done;
});

it('a folder that is not there leaves the window as the signal', async () => {
  const child = new EventEmitter() as unknown as ChildProcess;
  const who = jest.fn(async () => 'ready:someone');
  const done = untilSignedIn({
    child,
    folder: path.join(folder, 'missing'),
    file: FILE,
    who,
    before: undefined,
  });
  child.emit('error', new Error('no window'));
  await done;
  expect(who).not.toHaveBeenCalled();
});
