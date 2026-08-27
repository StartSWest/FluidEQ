/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Force-kill the parent and prove the host goes with it.
 *
 * The orderly paths — a shutdown command, a `kill`, stdin closing — are all
 * covered by `smoke-supervisor.ts`, and stdin EOF alone handles most of them.
 * It handles them because the control thread is sitting in `fread` and sees
 * the EOF immediately.
 *
 * It is worth being exact about when that is NOT true, because the first two
 * versions of this test measured the wrong thing. An idle host exits on EOF
 * whether or not it is watching anything, so killing an idle parent proved
 * nothing at all. And a full stdout pipe does not block the writer on Windows
 * the way the second version assumed — a broken pipe returns an error rather
 * than waiting — so that theory was wrong too.
 *
 * What actually strands the process is a control thread that is BUSY. During a
 * long offline render it is not reading stdin at all, so the EOF sits unread
 * for as long as the work takes; a device callback loop has the same shape.
 * The parent is gone, nothing is listening, and the host holds a core at 100%
 * and its memory allocated until it happens to finish.
 *
 * So the control below starts a render that cannot finish inside this test and
 * measures that an unwatched host is still there afterwards.
 */
import { spawn, spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import { encodeCommand, HOST_COMMANDS } from '../../src/main/dspHost/wire';

let failures = 0;
const check = (condition: boolean, what: string) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${what}`);
  if (!condition) {
    failures += 1;
  }
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Whether a pid is still a live process, without signalling it. */
const isAlive = (pid: number): boolean => {
  try {
    // Signal 0 asks the question without sending anything, on every platform
    // Node supports. It throws ESRCH once the process is gone.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const hardKill = (pid: number): void => {
  if (pid <= 0) {
    return;
  }
  if (process.platform === 'win32') {
    // `/F` gives the launcher no chance to tidy up, which is the point. The
    // host is deliberately not in the tree this takes down — a detached
    // grandchild is exactly the process being tested.
    spawnSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true });
    return;
  }
  process.kill(pid, 'SIGKILL');
};

/**
 * A marker the control host carries and nothing else does.
 *
 * The control is DESIGNED to outlive its parent, which means an interrupted
 * run leaves one behind — and a leftover host holds the executable open, so
 * the next build fails to link with an error about a file in use rather than
 * anything to do with the code. That cost two builds before it was understood.
 *
 * The sweep below therefore matches on this rather than on the process name.
 * Killing every `FluidEQ-DSP` would also kill the one serving audio to a
 * running FluidEQ, which is a test that silences the developer's music.
 *
 * The host ignores arguments it does not know, so this changes nothing about
 * what is being measured.
 */
const CONTROL_MARKER = '--orphan-test-control';

/**
 * A parent that spawns the host, sets it working, and then never listens.
 *
 * Detached, so killing the launcher does not take the host down for us — the
 * host has to be the one that decides to leave. Its stdout is piped and never
 * read, which is what fills the pipe.
 */
const launcherSource = (withParentPid: boolean): string =>
  [
    "const { spawn } = require('child_process');",
    `const args = ${
      withParentPid
        ? "['--parent-pid', String(process.pid)]"
        : `['${CONTROL_MARKER}']`
    };`,
    'const child = spawn(process.argv[2], args, {',
    '  detached: true,',
    "  stdio: ['pipe', 'pipe', 'ignore'],",
    '});',
    "child.stdin.write(Buffer.from(process.argv[3], 'base64'));",
    'console.log(child.pid);',
    '// Never drain the host stdout: a crashed parent does not either, and a',
    '// full pipe is what turns an unwatched host into a stuck one.',
    'setInterval(() => {}, 1000);',
  ].join('\n');

/** Clear controls left by a run that was interrupted before it tidied up. */
const sweepStrandedControls = (): void => {
  if (process.platform === 'win32') {
    /**
     * Matched on the command line, never on the process name.
     *
     * `taskkill /IM` cannot filter that way and would take out the host
     * serving audio to a running FluidEQ — a test that silences the
     * developer's music is worse than the leftover it is cleaning up.
     *
     * PowerShell rather than `wmic`, which is deprecated and absent on a
     * current Windows 11. Every string inside is single-quoted so the whole
     * script survives as one argument without a shell.
     */
    spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq ' +
          "'FluidEQ-DSP.exe' -and $_.CommandLine -like " +
          `'*${CONTROL_MARKER}*' } | ForEach-Object ` +
          '{ Stop-Process -Id $_.ProcessId -Force }',
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
    return;
  }
  // `-f` matches the full command line, which is where the marker is.
  spawnSync('pkill', ['-f', CONTROL_MARKER], { stdio: 'ignore' });
};

/** Returns the host pid, and the launcher, both still running. */
const startPair = async (
  scratch: string,
  executable: string,
  withParentPid: boolean,
) => {
  const launcher = path.join(
    scratch,
    withParentPid ? 'watched.js' : 'unwatched.js',
  );
  writeFileSync(launcher, launcherSource(withParentPid));
  /**
   * Enough blocks that the render cannot finish inside this test.
   *
   * The count matters. At four million the control host finished rendering,
   * reached its read loop, saw EOF and exited — so the control reported that
   * an unwatched host leaves on its own and the real check proved nothing.
   * A hundred billion frames will still be going when the test gives up.
   */
  const work = encodeCommand({
    command: HOST_COMMANDS.runOfflineBlocks,
    requestId: 1,
    parameterId: 200_000_000,
  }).toString('base64');

  const parent = spawn(process.execPath, [launcher, executable, work], {
    stdio: ['ignore', 'pipe', 'inherit'],
    windowsHide: true,
  });
  const hostPid = await new Promise<number>((resolve) => {
    let buffered = '';
    parent.stdout.on('data', (chunk: Buffer) => {
      buffered += chunk.toString('utf8');
      if (buffered.includes('\n')) {
        resolve(Number.parseInt(buffered.trim(), 10));
      }
    });
  });
  return { parentPid: parent.pid ?? 0, hostPid };
};

/** Kill the launcher and answer whether the host outlived it. */
const outlivesParent = async (parentPid: number, hostPid: number) => {
  // Long enough for the offline render to have written a pipe's worth of
  // telemetry with nobody reading it.
  await sleep(2_000);
  hardKill(parentPid);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop -- polling a real process.
    await sleep(50);
    if (!isAlive(hostPid)) {
      return false;
    }
  }
  return true;
};

const main = async (): Promise<void> => {
  const executable = findDspHostExecutable();
  if (!executable) {
    console.error('orphan smoke: no host executable; run pnpm build first');
    process.exit(2);
  }
  // Before anything else: a previous run killed mid-test leaves its control
  // host alive by design, and that host holds the executable open.
  sweepStrandedControls();
  const scratch = mkdtempSync(path.join(tmpdir(), 'fluideq-orphan-'));

  console.log('the failure this guards against');
  /**
   * The positive control, and the reason the check below means anything.
   *
   * Without the watch a host in this state hangs rather than exiting, so
   * "the host is gone" and "the host was never going to survive anyway" are
   * distinguishable. If this ever starts reporting that an unwatched host
   * leaves on its own, the real check has stopped testing anything.
   */
  const control = await startPair(scratch, executable, false);
  const stranded = await outlivesParent(control.parentPid, control.hostPid);
  check(stranded, 'an unwatched host is stranded when its parent is killed');
  hardKill(control.hostPid);

  console.log('parent death');
  const watched = await startPair(scratch, executable, true);
  check(watched.hostPid > 0, 'the host started');
  check(isAlive(watched.hostPid), 'and is running while its parent is');
  const survived = await outlivesParent(watched.parentPid, watched.hostPid);
  check(!survived, 'a watched host follows its parent out');
  if (survived) {
    // Leaving a stuck host behind would be a worse outcome than the failure.
    hardKill(watched.hostPid);
  }

  rmSync(scratch, { recursive: true, force: true });
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nall checks passed');
};

main().catch((error: unknown) => {
  console.error('orphan smoke failed', error);
  process.exit(1);
});
