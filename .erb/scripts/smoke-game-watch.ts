/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The game watcher's promise to the app, against the real helper.
 *
 * A game keeps its sound until it is really closed, and the only thing that
 * says it has closed is this helper's `gone` record for the process the app
 * asked it to `hold`. If that record stops coming, nothing fails loudly: the
 * game's sound simply never goes back, and the app's own tests — which feed
 * `gameWatch.ts` a record by hand — cannot see it. So the helper is run here
 * and asked, with a process this script owns standing in for the game.
 *
 * Nothing waits on a clock. Each answer is awaited as a line, and "said
 * nothing" is proved by ordering: a `list` sent after the thing that must stay
 * quiet is answered in the same loop, in order, so its `listed` arriving means
 * the quiet had its chance to be broken and was not.
 */
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

let failures = 0;
const check = (condition: boolean, what: string) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${what}`);
  if (!condition) {
    failures += 1;
  }
};

const WATCHER = path.join(
  __dirname,
  '../../native/.build/bin/FluidEQ-Games.exe',
);

/**
 * A process that lives until it is ended, standing in for a game. It waits on
 * its own input, so it needs no timer to stay alive and dies the moment it is
 * killed.
 */
const standIn = (): ChildProcess =>
  spawn(process.execPath, ['-e', 'process.stdin.resume()'], {
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
  });

const ended = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
  });

const run = async () => {
  if (process.platform !== 'win32') {
    console.log('game watch smoke: Windows only, skipped');
    return;
  }
  const watcher = spawn(WATCHER, [], { windowsHide: true });
  const lines: string[] = [];
  const waiting: ((line: string) => void)[] = [];
  let buffered = '';
  watcher.stdout.setEncoding('utf8');
  watcher.stdout.on('data', (chunk: string) => {
    buffered += chunk;
    let end = buffered.indexOf('\n');
    while (end >= 0) {
      const line = buffered.slice(0, end).replace(/\r$/, '');
      buffered = buffered.slice(end + 1);
      lines.push(line);
      waiting.slice().forEach((listener) => listener(line));
      end = buffered.indexOf('\n');
    }
  });
  const exited = new Promise<never>((_, reject) => {
    watcher.once('exit', (code) =>
      reject(new Error(`the watcher exited early, with ${code}`)),
    );
  });
  // Every wait below races this; one nobody is racing any more must not
  // surface as an unhandled rejection of its own.
  exited.catch(() => undefined);
  const until = (matches: (line: string) => boolean) =>
    Promise.race([
      exited,
      new Promise<string>((resolve) => {
        const found = lines.find(matches);
        if (found !== undefined) {
          resolve(found);
          return;
        }
        const look = (line: string) => {
          if (matches(line)) {
            waiting.splice(waiting.indexOf(look), 1);
            resolve(line);
          }
        };
        waiting.push(look);
      }),
    ]);
  const say = (command: string) => watcher.stdin.write(`${command}\n`);

  console.log('game watch smoke');

  const held = standIn();
  say(`hold ${held.pid}`);
  const heldEnded = ended(held);
  held.kill();
  await heldEnded;
  check(
    (await until((line) => line === `gone\t${held.pid}`)) !== undefined,
    'a held program that ends is reported gone',
  );

  const already = standIn();
  const alreadyEnded = ended(already);
  already.kill();
  await alreadyEnded;
  say(`hold ${already.pid}`);
  check(
    (await until((line) => line === `gone\t${already.pid}`)) !== undefined,
    'a program that had already ended is reported gone at once',
  );

  const released = standIn();
  say(`hold ${released.pid}`);
  say('hold 0');
  const releasedEnded = ended(released);
  released.kill();
  await releasedEnded;
  say('list');
  await until((line) => line === 'listed');
  check(
    !lines.includes(`gone\t${released.pid}`),
    'a released program says nothing when it ends',
  );

  // Its input closing is how it is told to go. That exit is the ordinary
  // one, so the early-exit guard comes off before it is asked for.
  watcher.removeAllListeners('exit');
  const closed = new Promise<void>((resolve) => {
    watcher.once('exit', () => resolve());
  });
  watcher.stdin.end();
  await closed;
};

run()
  .catch((error: unknown) => {
    console.log(`  FAIL ${String(error)}`);
    failures += 1;
  })
  .finally(() => {
    if (failures > 0) {
      console.log(`game watch smoke: ${failures} failed`);
      process.exitCode = 1;
    } else {
      console.log('game watch smoke: passed');
    }
  });
