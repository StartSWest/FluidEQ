import { useRef } from 'react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import { useAudioRestart } from './useAudioRestart';
import { useEngineUpdate } from './useEngineUpdate';

export const useEngineMaintenance = (
  updateReady: boolean,
  restart: () => Promise<IAudioRestartOutcome>,
  update: () => Promise<IAudioRestartOutcome>,
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
    suppressAudioNotices: isUpdating || hasUpdateResult,
  };
};

export default useEngineMaintenance;
