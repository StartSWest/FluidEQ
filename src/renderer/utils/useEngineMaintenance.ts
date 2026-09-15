/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Restart Windows audio" and the engine update, which ends in the same
 * restart: one owner at a time, so two service restarts never fight over
 * Audiosrv, and the notices about the sound wait while the update is running
 * or its result is on screen.
 */

import { useRef } from 'react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import { useAudioRestart } from './useAudioRestart';
import { useEngineUpdate } from './useEngineUpdate';

export const useEngineMaintenance = (
  updateReady: boolean,
  restart: () => Promise<IAudioRestartOutcome>,
  update: () => Promise<IAudioRestartOutcome>,
  /**
   * The app's own repair of one output the engine never ran on, which main
   * decides the shape of (`engineOutputRepair.ts`) and which ends, like an
   * update, in a restart of Windows audio.
   */
  repair: (guid: string) => Promise<IAudioRestartOutcome>,
) => {
  const audioRestart = useAudioRestart(restart);
  const engineUpdate = useEngineUpdate(updateReady, update);
  const owner = useRef<'restart' | 'update' | undefined>(undefined);

  const runRestart = async () => {
    if (owner.current) {
      return;
    }
    owner.current = 'restart';
    try {
      await audioRestart.run();
    } finally {
      owner.current = undefined;
    }
  };

  const runUpdate = async () => {
    if (owner.current) {
      return;
    }
    owner.current = 'update';
    audioRestart.close();
    try {
      await engineUpdate.run();
    } finally {
      owner.current = undefined;
    }
  };

  /**
   * The engine's installation put back, silently, under the same lock.
   *
   * The same helper run as an update, without the update card: this is the
   * app repairing a machine by itself, and the notice that made it necessary
   * is still on screen saying what it found. The lock is the point — a
   * manual restart of Windows audio started from the actions menu while this
   * runs would be a second elevated helper on the same services.
   */
  const runRepair = async (
    guid: string,
  ): Promise<IAudioRestartOutcome | undefined> => {
    if (owner.current) {
      // Not tried: the caller may ask again once the lock is free.
      return undefined;
    }
    owner.current = 'update';
    try {
      return await repair(guid);
    } finally {
      owner.current = undefined;
    }
  };

  const openAudioRestart = () => {
    if (owner.current === 'update') {
      engineUpdate.open();
    } else {
      engineUpdate.close();
      audioRestart.open();
    }
  };

  const isUpdating = engineUpdate.phase === 'running';
  const hasUpdateResult =
    engineUpdate.isOpen &&
    (engineUpdate.phase === 'done' || engineUpdate.phase === 'failed');

  return {
    audioRestart: { ...audioRestart, open: openAudioRestart, run: runRestart },
    engineUpdate: { ...engineUpdate, run: runUpdate },
    repairEngine: runRepair,
    suppressAudioNotices: isUpdating || hasUpdateResult,
  };
};

export default useEngineMaintenance;
