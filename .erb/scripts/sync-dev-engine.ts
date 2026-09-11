/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Put the FluidEQ Engine that `pnpm dev` just compiled where Windows runs it.
 *
 * `build-native-dsp` leaves `FluidEQ-Engine.dll` in `native/.build/bin`, and
 * audiodg.exe never loads it from there: it loads the copy the setup helper
 * installed into `%ProgramFiles%\FluidEQ Engine`. So every C++ change to the
 * engine compiled cleanly on each `pnpm dev` and was never heard — measured on
 * the machine this was written on, a 19:39 build beside a 17:06 installed copy
 * with different bytes, and nothing inside the app able to tell the two apart.
 *
 * Only when a file actually differs (see `engineSync.ts`): the swap costs a
 * UAC prompt and a few seconds of silence while Windows audio restarts, and
 * neither belongs on a `pnpm dev` where nothing changed. The engine embeds no
 * build revision, so ninja leaves it byte-identical until one of its own
 * sources changes.
 *
 * The swap is the same `install --restart-audio` the app's own Apply runs,
 * from the helper beside the fresh build: that path already moves aside a DLL
 * audiodg.exe holds open, and the restart is what makes audiodg.exe load the
 * new one instead of carrying on with the old code already in memory.
 *
 * Not part of `build-native-dsp`, which the packaging and the weekly cold
 * build also run: neither has any business writing to the machine it runs on.
 *
 * Exit codes: 0 the installed engine matches this build (or there is none),
 * 2 the UAC prompt was declined, 1 anything else went wrong.
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import {
  differingFiles,
  ENGINE_DLL,
  helperError,
  planEngineSync,
} from './engineSync';

const BUILD_BIN = path.join(__dirname, '..', '..', 'native', '.build', 'bin');
const HELPER = path.join(BUILD_BIN, 'FluidEQ-Engine-Setup.exe');
/**
 * The helper's `install_dir()`, `FOLDERID_ProgramFiles\FluidEQ Engine`.
 * Windows rewrites `ProgramFiles` in every new process's environment to the
 * folder matching its bitness, so for this 64-bit Node it is that same folder
 * whatever the parent shell exported.
 */
const INSTALL_DIR = path.join(
  process.env.ProgramFiles ?? 'C:\\Program Files',
  'FluidEQ Engine',
);

/** The helper's own code for a declined elevation prompt. */
const EXIT_DECLINED = 2;

const say = (message: string) => console.log(`native engine: ${message}`);

const fail = (message: string): never => {
  console.error(`native engine: ${message}`);
  process.exit(1);
};

const sync = () => {
  if (process.platform !== 'win32') {
    return;
  }
  if (!existsSync(path.join(BUILD_BIN, ENGINE_DLL)) || !existsSync(HELPER)) {
    fail(`the build left no engine or setup helper in ${BUILD_BIN}`);
  }

  const plan = planEngineSync(BUILD_BIN, INSTALL_DIR);
  if (plan.kind === 'not-installed') {
    say('not installed on this machine, so there is nothing to update');
    return;
  }
  if (plan.kind === 'current') {
    say('the installed engine already matches this build');
    return;
  }

  say(
    `${plan.files.join(', ')} changed — installing this build. Windows asks ` +
      'for permission, then audio restarts for a few seconds.',
  );
  // Captured, not inherited: the helper is a windowed program, and only a
  // capture makes the call wait for the elevated run to finish.
  const result = spawnSync(HELPER, ['install', '--restart-audio'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) {
    fail(`the setup helper could not be started: ${result.error.message}`);
  }
  if (result.status === EXIT_DECLINED) {
    console.error(
      'native engine: permission was declined, so Windows is still running ' +
        'the previously installed engine, not this build.',
    );
    process.exit(EXIT_DECLINED);
  }
  if (result.status !== 0) {
    fail(
      `the setup helper exited with ${result.status}: ${
        helperError(result.stdout) ?? 'no reason given'
      }`,
    );
  }

  // The helper reporting success is not the same as the files matching.
  const stillDiffering = differingFiles(BUILD_BIN, INSTALL_DIR);
  if (stillDiffering.length > 0) {
    fail(
      `install reported success but ${stillDiffering.join(
        ', ',
      )} still differ from this build`,
    );
  }
  say('installed this build, and Windows audio restarted onto it');
};

sync();
