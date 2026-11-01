/* FluidEQ — GPL-3.0-or-later */
import { useEffect } from 'react';
import {
  subscribeAudioDevices,
  windowsWatchesOutputs,
} from '../utils/equalizerApi';
import type { TRemoteAudioPhase } from './remoteAudioState';

/**
 * A device plugged in or pulled out, from whoever follows the outputs here.
 *
 * On Windows main hears Windows itself and pushes every new list
 * (`outputWatch.ts`). Chromium's `devicechange` would say the same thing, and
 * merely listening for it starts Chromium's audio service and its video
 * capture service (17 MB private, 130 MB resident, measured 2026-11-01) and
 * keeps both running for as long as a Share Audio pairing is set up.
 */
const onDevicesChanged = (listener: () => void): (() => void) => {
  if (windowsWatchesOutputs()) {
    return subscribeAudioDevices((reading) => {
      // The list itself is the output panel's to show or to fail on; here
      // only the moment matters.
      reading.catch(() => undefined);
      listener();
    });
  }
  const media = navigator.mediaDevices;
  media?.addEventListener?.('devicechange', listener);
  return () => media?.removeEventListener?.('devicechange', listener);
};

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
    const stopDevices = onDevicesChanged(retryFailedAudio);
    const stopWake = bridge?.onRemoteAudioLanResume?.(wake);
    return () => {
      stopWake?.();
      window.removeEventListener('online', online);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visible);
      stopDevices();
    };
  }, [phase, failed, start, recover]);
};
export default useRemoteAudioRecovery;
