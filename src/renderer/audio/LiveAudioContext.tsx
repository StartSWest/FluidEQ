import { createContext, ReactNode, useContext } from 'react';
import useLiveOutputSpectrum from '../graph/useLiveOutputSpectrum';

type LiveAudioValue = ReturnType<typeof useLiveOutputSpectrum>;

const LiveAudioContext = createContext<LiveAudioValue | undefined>(undefined);

export const LiveAudioProvider = ({ children }: { children: ReactNode }) => {
  const value = useLiveOutputSpectrum();
  return (
    <LiveAudioContext.Provider value={value}>
      {children}
    </LiveAudioContext.Provider>
  );
};

export const useLiveAudio = () => {
  const value = useContext(LiveAudioContext);
  if (!value) {
    throw new Error('useLiveAudio must be used inside LiveAudioProvider');
  }
  return value;
};
