import { useEffect, useRef } from 'react';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { useWallpaperState } from './wallpaperStore';
import { reportError } from '../utils/logger';

/** IPC is event-driven even when the main window's animation frames stop. */
export default function WallpaperAudio() {
  const state = useWallpaperState();
  // Only a background following the music holds the capture: a calm one never
  // hears it, and one left holding it would keep the analyser running for
  // nothing while FluidEQ sits hidden.
  const wanted = state.screens.some(
    (screen) =>
      screen.motion === 'music' &&
      (screen.phase === 'starting' || screen.phase === 'running'),
  );
  useLiveAudioCapture(wanted, 'work');
  const control = useLiveAudioControl();
  const latest = useRef({ control, wanted });
  latest.current = { control, wanted };
  useEffect(() => {
    const api = window.electron?.ipcRenderer;
    if (!api?.onWallpaperAudioRequest) {
      return undefined;
    }
    return api.onWallpaperAudioRequest((requestId) => {
      latest.current.control
        .readBackgroundFrame()
        .then((heard) => {
          const active =
            latest.current.wanted && !latest.current.control.isPaused;
          api.sendWallpaperAudio(requestId, {
            points: active ? (heard?.points ?? []) : [],
            waveform: active ? (heard?.waveform ?? []) : [],
          });
          return undefined;
        })
        .catch((error: unknown) => {
          reportError('Could not read desktop visualizer audio', error);
          api.sendWallpaperAudio(requestId, { points: [], waveform: [] });
        });
    });
  }, []);
  return null;
}
