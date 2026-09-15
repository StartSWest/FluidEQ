/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine installed, attached, and never once loaded by Windows — put
 * right by the app itself.
 *
 * Two machine-wide things have to be true before `audiodg.exe` will create
 * this effect at all, and neither is kept by anybody: Windows has to be set
 * to load effects it did not sign (`DisableProtectedAudioDG`), and the C++
 * runtime the effect is linked against has to sit in the engine's own folder,
 * because Windows looks there and in its own directory and nowhere else. A
 * feature update, a driver's installer, an audio "repair" tool or a disk
 * cleaner can undo either of them long after setup ran.
 *
 * When that happens nothing looks wrong. The engine is installed, the class
 * is registered, every output names it, the engine's health says nothing
 * because an effect that is never created writes nothing — and the only sign
 * is that the EQ does not change the sound. That is a user's machine, with a
 * report that said installed, attached, enhancements on, and "never loaded on
 * this output".
 *
 * Re-running the install puts both back (it sets the switch and copies the
 * runtime beside the DLL) and restarts Windows audio so the outputs are built
 * again with the effect in them. Once a session: it costs one Windows
 * permission prompt and a moment of silence, and the status is re-read often.
 * A refusal or a failure leaves the machine exactly as it was.
 */

import log from 'electron-log';
import type { IAudioEngineStatus, TAudioEngine } from '../common/audioEngine';

export interface IEngineLoadRepairDeps {
  getEngine: () => TAudioEngine | null;
  runEngineSetup: (
    command: 'install',
    args: string[],
  ) => Promise<{ ok: boolean; declined: boolean; error?: string }>;
}

export interface IEngineLoadRepair {
  /** Given a status just read, repair the machine if it needs it. */
  check: (status: IAudioEngineStatus) => Promise<void>;
}

/**
 * What is wrong, or undefined when nothing is — exported for the test, and
 * because the sentence it returns is what goes in the log.
 */
export const whatStopsTheEngineLoading = (
  status: IAudioEngineStatus,
): string | undefined => {
  const { fluid } = status;
  if (!fluid.installed) {
    return undefined;
  }
  // Explicit `false` only, throughout. An older helper answers none of these,
  // and unknown must never raise a permission prompt for a machine where
  // nothing is broken.
  if (fluid.unsignedAllowed === false) {
    return 'Windows is set to refuse effects it did not sign itself';
  }
  if (fluid.runtimeBeside === false) {
    return 'the C++ runtime is missing from the engine folder';
  }
  if (fluid.serviceCanWrite === false) {
    return 'the engine may not write in its own folder';
  }
  // And the state that says something is wrong without saying what: the
  // engine is on an output, and has never once run on this machine. It
  // writes its own log the first time Windows creates it, so on a machine
  // that has been playing sound an absent log is not a gap in the evidence,
  // it IS the evidence. Re-installing is the one action that puts back
  // everything the three checks above cover and the permissions besides, so
  // it is worth the single prompt rather than leaving a user with an engine
  // that reports healthy and does nothing — which is where this began.
  if (fluid.everRan === false && fluid.endpoints.some((one) => one.attached)) {
    return 'it is on an output and has never once run here';
  }
  return undefined;
};

export const createEngineLoadRepair = ({
  getEngine,
  runEngineSetup,
}: IEngineLoadRepairDeps): IEngineLoadRepair => {
  let tried = false;
  return {
    check: async (status) => {
      if (tried || process.platform !== 'win32' || getEngine() !== 'fluid') {
        return;
      }
      const wrong = whatStopsTheEngineLoading(status);
      if (!wrong) {
        return;
      }
      tried = true;
      log.info(`The FluidEQ Engine cannot be loaded by Windows: ${wrong}`);
      try {
        // No `--attach-all`: which outputs the engine is on is the user's,
        // and this is repairing the machine, not changing their choice.
        const result = await runEngineSetup('install', ['--restart-audio']);
        log.info(
          `Repairing the engine's install: ok=${result.ok}` +
            `${result.declined ? ' (consent declined)' : ''}` +
            `${result.error ? ` error=${result.error}` : ''}`,
        );
      } catch (error) {
        log.error("The engine's install could not be repaired", error);
      }
    },
  };
};

export default createEngineLoadRepair;
