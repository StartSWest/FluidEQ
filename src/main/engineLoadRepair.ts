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
import type { IAutomaticSetup } from './automaticSetup';

export interface IEngineLoadRepairDeps {
  getEngine: () => TAudioEngine | null;
  runEngineSetup: (
    command: 'install',
    args: string[],
  ) => Promise<{ ok: boolean; declined: boolean; error?: string }>;
  /**
   * The one gate every automatic elevated run passes through
   * (`automaticSetup.ts`). The window asks for the same re-install once it
   * has heard sound past an engine that never ran; without a shared "once"
   * a declined prompt here was followed by a second one from there.
   */
  automatic: IAutomaticSetup;
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
  // "Attached and never once run" is deliberately NOT one of these, even
  // though it is the state a user's machine was in. From here it cannot be
  // told apart from a machine where setup finished a minute ago and nothing
  // has played yet — the engine writes nothing until Windows first creates
  // it — and a Windows permission prompt seconds after an install nobody has
  // even heard yet is its own bug. The window asks for that repair instead,
  // once it has heard sound go past an engine that wrote nothing
  // (`useRepairWhenEngineNeverRan`), which is the evidence this read lacks.
  return undefined;
};

export const createEngineLoadRepair = ({
  getEngine,
  runEngineSetup,
  automatic,
}: IEngineLoadRepairDeps): IEngineLoadRepair => ({
  check: async (status) => {
    if (
      process.platform !== 'win32' ||
      getEngine() !== 'fluid' ||
      !automatic.wanted('install')
    ) {
      return;
    }
    const wrong = whatStopsTheEngineLoading(status);
    if (!wrong) {
      return;
    }
    log.info(`The FluidEQ Engine cannot be loaded by Windows: ${wrong}`);
    try {
      // No `--attach-all`: which outputs the engine is on is the user's,
      // and this is repairing the machine, not changing their choice.
      const result = await automatic.attempt('install', () =>
        runEngineSetup('install', ['--restart-audio']),
      );
      if (result) {
        log.info(
          `Repairing the engine's install: ok=${result.ok}` +
            `${result.declined ? ' (consent declined)' : ''}` +
            `${result.error ? ` error=${result.error}` : ''}`,
        );
      }
    } catch (error) {
      log.error("The engine's install could not be repaired", error);
    }
  },
});

export default createEngineLoadRepair;
