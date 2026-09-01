/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Hand the host a frame whose declared length is not a length.
 *
 * `dsp-core` has thirteen test binaries. `dsp-host` had none, and the one file
 * with no tests was the one holding every unbounded allocation: five command
 * handlers sized a `std::string` or a `std::vector` straight from a wire field,
 * and there is no `catch` anywhere on that path. A `parameter_id` of
 * 0xFFFFFFFF asked for 34 GB, `std::bad_alloc` reached `std::terminate`, and
 * the engine disappeared mid-session with nothing in the log to say why.
 *
 * The other eight smoke scripts cannot find that, and it is worth being exact
 * about why rather than adding a ninth by reflex: they all drive the host
 * through `encodeCommand`, which only ever produces well-formed frames. A
 * malformed one has to be built by hand, which is what this file does.
 *
 * WHAT IS BEING MEASURED IS THE MANNER OF DEATH, NOT WHETHER IT DIES. An
 * out-of-range length means the reader and the writer disagree about where the
 * frame ends, so there is no safe number of bytes to skip and the host is right
 * to stop — `wire.h` has said so all along. The distinction that matters is
 * between stopping and CRASHING:
 *
 *  - a clean stop exits 0 and says on stderr that the stream desynchronised;
 *  - a crash exits on a signal, or with a Windows exception code such as
 *    0xC0000409 / 0xC0000005, and says nothing.
 *
 * Before the bounds went in, every case below took the second path.
 */
import { spawn } from 'child_process';
import { findDspHostExecutable } from '../../src/main/dspHost/hostPath';
import {
  COMMAND_BYTES,
  HOST_COMMANDS,
  encodeCommand,
} from '../../src/main/dspHost/wire';

let failures = 0;
const check = (condition: boolean, what: string) => {
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${what}`);
  if (!condition) {
    failures += 1;
  }
};

interface IRun {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
}

/**
 * Start the host, write these bytes, and wait for it to be gone.
 *
 * stdin is closed after the frame so that a host which correctly refuses the
 * frame still has a reason to exit — otherwise a passing case would hang here
 * waiting for a command that is never coming, and a hang is the one result
 * that cannot be told apart from a deadlock.
 */
const feed = (executable: string, bytes: Buffer): Promise<IRun> =>
  new Promise((resolve) => {
    const child = spawn(executable, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    // Read and discard: a full stdout pipe would block the host mid-write and
    // turn a clean refusal into a stall that looks like a hang.
    child.stdout.resume();
    child.on('error', () => resolve({ code: null, signal: null, stderr }));
    child.on('close', (code, signal) => resolve({ code, signal, stderr }));
    child.stdin.write(bytes, () => child.stdin.end());
  });

/**
 * Exited under its own control rather than being killed by the operating
 * system.
 *
 * On Windows a C++ runtime abort surfaces as an exit code rather than a signal
 * — 0xC0000409 for a security check, 0xC0000005 for an access violation,
 * 0xE06D7363 for an unhandled C++ exception — so a bare "exited" check would
 * have called `std::terminate` a pass. Node reports these as their signed
 * 32-bit values, which is why they are compared as negatives too.
 */
const CRASH_CODES = new Set([
  0xc0000409, 0xc0000005, 0xe06d7363, 0xc0000374, 3,
  -1073740791, -1073741819, -529697949, -1073740940,
]);

const exitedCleanly = (run: IRun): boolean =>
  run.signal === null && run.code !== null && !CRASH_CODES.has(run.code);

const main = async () => {
  const executable = findDspHostExecutable();
  if (!executable) {
    console.error('smoke-wire-bounds: no host executable; run pnpm build first');
    process.exit(1);
  }
  console.log(`smoke-wire-bounds: ${executable}`);

  /**
   * The five commands that size an allocation from the wire, each handed the
   * largest value its field can carry.
   *
   * `LOAD_DECK` and `LOAD_VOICE_MODEL` size a `std::string` from
   * `parameter_id`; `APPLY_CHAIN` sizes a `std::vector<double>` from it, which
   * is eight bytes per count and the largest ask of the five.
   */
  const cases: { what: string; frame: Buffer }[] = [
    {
      what: 'LOAD_DECK with a 4GB path length',
      frame: encodeCommand({
        command: HOST_COMMANDS.loadDeck,
        requestId: 1,
        parameterId: 0xffffffff,
        parameterIndex: 0,
      }),
    },
    {
      what: 'APPLY_CHAIN with a 34GB payload count',
      frame: encodeCommand({
        command: HOST_COMMANDS.applyChain,
        requestId: 2,
        parameterId: 0xffffffff,
      }),
    },
    {
      what: 'LOAD_VOICE_MODEL with a 4GB payload length',
      frame: encodeCommand({
        command: HOST_COMMANDS.loadVoiceModel,
        requestId: 3,
        parameterId: 0xffffffff,
      }),
    },
    /**
     * `RENDER_TO_FILE` carries its path length in `value`, which is a DOUBLE.
     * Casting a negative or NaN double to `size_t` is undefined behaviour
     * before any allocation is attempted — on x86-64 it lands on
     * 0x8000000000000000 — so these two are a distinct defect from the three
     * above rather than more of the same.
     */
    {
      what: 'RENDER_TO_FILE with a NaN path length',
      frame: encodeCommand({
        command: HOST_COMMANDS.renderToFile,
        requestId: 4,
        parameterId: 128,
        parameterIndex: 0,
        value: Number.NaN,
      }),
    },
    {
      what: 'RENDER_TO_FILE with a negative path length',
      frame: encodeCommand({
        command: HOST_COMMANDS.renderToFile,
        requestId: 5,
        parameterId: 128,
        parameterIndex: 0,
        value: -1,
      }),
    },
    {
      what: 'RENDER_TO_FILE with an infinite path length',
      frame: encodeCommand({
        command: HOST_COMMANDS.renderToFile,
        requestId: 6,
        parameterId: 128,
        parameterIndex: 0,
        value: Number.POSITIVE_INFINITY,
      }),
    },
  ];

  /*
   * BOTH HALVES, AND THE SECOND ONE IS THE ONE THAT BITES.
   *
   * "Did not crash" is far too weak on its own, and that was measured rather
   * than assumed: with the `LOAD_DECK` bound deliberately removed and the host
   * rebuilt, the 4 GB `std::string` SUCCEEDED on this machine — 64-bit address
   * space and a pagefile are enough — and the process then hit EOF on stdin and
   * exited 0. The check reported "ok" for a build with the defect back in.
   *
   * So each case also asserts that the refusal was NAMED. That is the only
   * assertion here which can tell "the bound fired" apart from "the allocation
   * happened to be affordable", and it is the difference between this file and
   * a null test that passes for every input.
   */
  console.log('malformed length fields');
  for (const one of cases) {
    // eslint-disable-next-line no-await-in-loop -- one host at a time, on purpose.
    const run = await feed(executable, one.frame);
    check(
      exitedCleanly(run),
      `${one.what} does not crash the host (code=${run.code} signal=${run.signal})`,
    );
    check(
      run.stderr.includes('desynchronised'),
      `${one.what} is refused by name, not merely survived`,
    );
  }

  /**
   * The positive control, and this file is useless without it.
   *
   * Every check above passes if the host refuses to start at all — a missing
   * DLL, a bad path, an executable that exits instantly would all "exit
   * cleanly" for every case and report six passes having measured nothing.
   * This proves the host actually runs and answers a frame it should accept.
   */
  console.log('the control');
  const good = await feed(
    executable,
    encodeCommand({ command: HOST_COMMANDS.hello, requestId: 7 }),
  );
  check(
    exitedCleanly(good),
    `a well-formed HELLO is accepted (code=${good.code} signal=${good.signal})`,
  );
  check(
    good.stderr.includes('FluidEQ-DSP'),
    'the host identified itself on stderr, so it really ran',
  );

  /**
   * The other direction: a well-formed frame must NOT be reported as a
   * desync.
   *
   * Without this, a host that printed "desynchronised" unconditionally would
   * pass every check above. The two controls together fix the meaning of the
   * message at both ends.
   */
  check(
    !good.stderr.includes('desynchronised'),
    'a well-formed frame is not reported as a desync',
  );

  /**
   * A truncated frame, which is the other half of the same question: the host
   * must treat a short read as the pipe closing rather than acting on a
   * half-filled struct.
   */
  const short = await feed(
    executable,
    encodeCommand({ command: HOST_COMMANDS.hello, requestId: 8 }).subarray(
      0,
      COMMAND_BYTES - 4,
    ),
  );
  check(
    exitedCleanly(short),
    `a truncated frame is not fatal (code=${short.code} signal=${short.signal})`,
  );

  if (failures > 0) {
    console.error(`smoke-wire-bounds: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('smoke-wire-bounds: all checks passed');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
