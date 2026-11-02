import { useEffect, useRef } from 'react';
import { screenNeedsSound } from '../../common/wallpaper';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { useWallpaperState } from './wallpaperStore';
import { reportError } from '../utils/logger';

/**
 * The desktop backgrounds' music, where the window is the one to answer.
 *
 * The app's core hears it for them and makes their frames itself
 * (`core/liveFrames/desktopSound.ts`), so a background behind a minimised
 * FluidEQ keeps nothing of this window awake. The window answers only where
 * the core cannot — a platform with no way to hear the output, a helper that
 * failed — and while it shows what this computer sends to another computer,
 * which the backgrounds show too and only this window has.
 *
 * IPC is event-driven even when the main window's animation frames stop.
 */
export default function WallpaperAudio() {
  const state = useWallpaperState();
  const control = useLiveAudioControl();
  const { isSharingAudio } = control;
  // Only a background following the music holds the capture: a calm one never
  // hears it, and one left holding it would keep the analyser running for
  // nothing while FluidEQ sits hidden. One paused behind FluidEQ's own window
  // holds it too (`screenFollowsMusic`). And none at all while the core hears
  // for them: a capture held here for a background is Chromium's, and the
  // whole of this window kept awake behind a minimise with it. Nor for one
  // the C++ host draws, which hears the output itself (`screenNeedsSound`).
  const wanted = !state.heardByCore && state.screens.some(screenNeedsSound);
  useLiveAudioCapture(wanted, 'work');
  const latest = useRef({ control, wanted });
  latest.current = { control, wanted };

  useEffect(() => {
    // Optional, like every bridge call: a test's partial bridge has none.
    window.electron?.ipcRenderer?.setWallpaperSoundFromWindow?.(isSharingAudio);
  }, [isSharingAudio]);

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
          const stereo = active ? heard?.stereo : undefined;
          // Everything the graph's own scenes hear, the stereo image included:
          // a desktop background is the same visualizer, and one that heard
          // less stood still where the graph's leaned with the mix.
          api.sendWallpaperAudio(requestId, {
            points: active ? (heard?.points ?? []) : [],
            waveform: active ? (heard?.waveform ?? []) : [],
            ...(stereo ? { stereo } : {}),
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
