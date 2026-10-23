/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The FluidEQ Engine on a Mac, kept running for as long as FluidEQ is.
 *
 * On Windows the engine lives inside Windows' own audio service and runs
 * whether the app is open or not; the app only writes its configuration. A
 * Mac has no such slot, so the engine is a process of FluidEQ's own
 * (`native/mac-engine`), started here and reading the same folder the app
 * writes. It decides for itself, on every change, whether there is an EQ to
 * run: only then does it take the system's sound, and FluidEQ switched off or
 * an output with no profile leaves the sound going straight to the speakers.
 *
 * It cannot outlive the app: its standard input closing and this process
 * exiting both stop it, and everything it holds belongs to its own process,
 * so macOS gives the sound back the moment it is gone.
 */
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import log from 'electron-log';
import { macAnalysisSocketPath } from './analysisSocket';
import { findMacEngineExecutable } from './enginePath';

/**
 * Three unexpected exits inside a minute, and then it is left stopped: the
 * DSP host's own budget, for the same reason — one reproducible crash must
 * not become a loop of them. Counted by when each exit happened; nothing
 * here waits on a clock to restart.
 */
const RESTART_BUDGET = 3;
const RESTART_WINDOW_MS = 60_000;

export interface IMacEngine {
  /** Runs the engine on the configuration in `configDir`. Idempotent. */
  start(configDir: string): void;
  /** Stops it; the sound goes straight to the output again. */
  stop(): void;
}

export const createMacEngine = (): IMacEngine => {
  let child: ChildProcessWithoutNullStreams | undefined;
  let configDir: string | undefined;
  let stopping = false;
  let exits: number[] = [];

  const launch = (): void => {
    const executable = findMacEngineExecutable();
    if (!executable || !configDir) {
      log.warn(
        'macOS engine: not built, so the EQ does not reach the sound until it is',
      );
      return;
    }
    const started = spawn(
      executable,
      [
        '--config',
        configDir,
        '--parent-pid',
        String(process.pid),
        // The DSP page's meters and the automatic preamp's readout, over the
        // socket `engineAnalysisPipe.ts` serves.
        '--analysis',
        macAnalysisSocketPath(),
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    child = started;

    // Its whole account of itself: which output, whether there is an EQ to
    // run, and anything that failed. A chunk is not guaranteed to end at a
    // line, so what is left over waits for the next one.
    let pending = '';
    started.stderr.on('data', (chunk: Buffer) => {
      pending += chunk.toString('utf8');
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      lines
        .filter((line) => line.trim() !== '')
        .forEach((line) => log.info(line.trim()));
    });
    // Nothing is said on stdout while running, but a pipe nobody drains is a
    // pipe a chatty child can block on.
    started.stdout.on('data', () => undefined);
    // Writing to an engine that has just exited fails with EPIPE, which an
    // unheard stream turns into an uncaught exception — in main, the app.
    started.stdin.on('error', () => undefined);
    started.on('error', (error: Error) => {
      log.error(`macOS engine could not start: ${error.message}`);
    });
    started.on('exit', (code, signal) => {
      if (child === started) {
        child = undefined;
      }
      if (stopping) {
        return;
      }
      const now = Date.now();
      exits = exits.filter((at) => now - at < RESTART_WINDOW_MS);
      if (exits.length >= RESTART_BUDGET) {
        log.error(
          `macOS engine exited again (${code ?? signal}); left stopped, so the sound plays without the EQ until FluidEQ restarts`,
        );
        return;
      }
      exits.push(now);
      log.warn(`macOS engine exited (${code ?? signal}); starting it again`);
      launch();
    });
  };

  return {
    start(dir: string) {
      configDir = dir;
      stopping = false;
      if (!child) {
        launch();
      }
    },
    stop() {
      stopping = true;
      const running = child;
      child = undefined;
      // Asked first — it gives the sound back on its way out — and then made
      // to, since nothing it holds survives its process either way.
      running?.stdin.end();
      running?.kill();
    },
  };
};
