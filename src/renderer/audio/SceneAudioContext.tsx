import { createContext, useContext } from 'react';
import type { ILiveFrame } from '../graph/liveFrameReader';

export interface ISceneAudio {
  points: ILiveFrame['points'];
  waveform: ILiveFrame['waveform'];
  isPaused: boolean;
  /**
   * The music as it is now. `stereo` wherever the capture it comes from is
   * in stereo — this window's own, or the window's relayed to a desktop
   * background; a remote sender has none.
   */
  readFrame():
    | (Pick<ILiveFrame, 'points' | 'waveform' | 'sound'> & {
        stereo?: readonly [number, number];
      })
    | undefined;
}

const SceneAudioContext = createContext<ISceneAudio | undefined>(undefined);
export const SceneAudioProvider = SceneAudioContext.Provider;

/** A drawing needs measurements, never ownership of capture or playback. */
export const useSceneAudio = (): ISceneAudio => {
  const audio = useContext(SceneAudioContext);
  if (!audio) {
    throw new Error('Scene audio provider is missing.');
  }
  return audio;
};
