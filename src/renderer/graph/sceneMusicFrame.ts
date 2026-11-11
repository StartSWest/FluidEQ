/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISpectrumEnergy } from 'common/spectrumEnergy';
import type { ISceneFrame } from './sceneGl';

/**
 * What a scene's frame says about the music, from the music as heard and the
 * flywheel's turn: the one place both the live runner (`useSceneRunner.ts`)
 * and the review's measurement of a scene against the demo song
 * (`sceneFlashMusic.ts`) build it, so a scene hears the same thing in both.
 */
export const musicFrameOf = (
  energy: ISpectrumEnergy,
  run: number,
): Pick<
  ISceneFrame,
  'level' | 'beat' | 'bands' | 'musicAccent' | 'musicRun' | 'rhythm' | 'voice'
> => ({
  level: energy.level,
  beat: energy.beat,
  bands: [energy.bass, energy.mid, energy.treble],
  musicAccent: [energy.accent, energy.accentSerial],
  musicRun: [run, energy.runSpeed],
  rhythm: energy.rhythm,
  voice: [energy.voice.open, energy.voice.pitch, energy.voice.sure],
});
