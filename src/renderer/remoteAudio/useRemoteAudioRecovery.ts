/* FluidEQ — GPL-3.0-or-later */
import { useEffect } from 'react';
import type { TRemoteAudioPhase } from './remoteAudioState';

/** Recover on actual lifecycle events. No clock restarts a healthy stream. */
const useRemoteAudioRecovery = (
  phase: TRemoteAudioPhase,
  failed: boolean,
  start: () => Promise<void>,
  recover: () => void,
) => {
  useEffect(() => {
    if (phase === 'idle') {
      return undefined;
    }
    const bridge = window.electron?.ipcRenderer;
    const online = () => {
      recover();
      if (phase === 'error') {
        start().catch(() => undefined);
      } else {
        bridge?.retryRemoteAudioLan?.().catch(() => undefined);
      }
    };
    const wake = () => {
      recover();
      if (phase === 'error') {
        start().catch(() => undefined);
      }
    };
    const retryFailedAudio = () => {
      if (failed) {
        online();
      }
    };
    const visible = () => {
      if (!document.hidden) {
        retryFailedAudio();
      }
    };
    const focus = (event: FocusEvent) => {
      if (event.target === window) {
        retryFailedAudio();
      }
    };
    window.addEventListener('online', online);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visible);
    navigator.mediaDevices?.addEventListener?.(
      'devicechange',
      retryFailedAudio,
    );
    const stopWake = bridge?.onRemoteAudioLanResume?.(wake);
    return () => {
      stopWake?.();
      window.removeEventListener('online', online);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visible);
      navigator.mediaDevices?.removeEventListener?.(
        'devicechange',
        retryFailedAudio,
      );
    };
  }, [phase, failed, start, recover]);
};
export default useRemoteAudioRecovery;
