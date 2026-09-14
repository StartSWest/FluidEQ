import { createContext, useContext } from 'react';
import type { ILiveFrame } from '../graph/liveFrameReader';

export interface ISceneAudio {
  points: ILiveFrame['points'];
  waveform: ILiveFrame['waveform'];
  isPaused: boolean;
  readFrame(): Pick<ILiveFrame, 'points' | 'waveform'> | undefined;
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
