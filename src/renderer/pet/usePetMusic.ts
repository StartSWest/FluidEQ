/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef } from 'react';
import { MAX_GAIN } from 'common/constants';
import { advanceEnergy, createEnergyState } from 'common/spectrumEnergy';
import {
  useLiveAudioControl,
  useLiveAudioFrames,
} from '../audio/LiveAudioContext';
import {
  type IPetMusic,
  SILENT_PET_MUSIC,
  petMusicOf,
} from './petChoreography';

/**
 * The music as the pet hears it, read in her own frames: the window's one
 * reading of it (`liveSound.ts`) - the beat clock, the drums, the bands, the
 * voice - which every scene reads too, so she and the visualizer never
 * disagree about whether a snare was just hit. Music relayed from another
 * window comes as points only, and is measured here from them, the way the
 * ambient layer measures it (`SceneAmbient.tsx`). Paused is silence.
 *
 * A function rather than a value: it is called on her clock, never through a
 * render, because the reading changes every frame.
 */
const usePetMusic = (isPaused: boolean) => {
  const { readFrame } = useLiveAudioControl();
  const frames = useLiveAudioFrames();
  const energyRef = useRef(createEnergyState());
  const pausedRef = useRef(isPaused);
  pausedRef.current = isPaused;
  return useCallback(
    (elapsedMs: number): IPetMusic => {
      if (pausedRef.current) {
        return SILENT_PET_MUSIC;
      }
      const sound = readFrame()?.sound;
      if (sound) {
        return petMusicOf(sound.music());
      }
      const { points } = frames.read();
      return petMusicOf(
        advanceEnergy(
          energyRef.current,
          points,
          MAX_GAIN,
          elapsedMs,
          points.length > 0,
        ),
      );
    },
    [frames, readFrame],
  );
};

export default usePetMusic;
