/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * Which engine is processing the sound now, for the labels that name it.
 *
 * With the FluidEQ Engine running, the config page still said "Equalizer APO
 * config" and "Equalizer APO is applying this config", and the sidebar still
 * said "APO headroom" — every one of them describing a program that was not
 * in the audio path. The status itself is read once, in `AppContent`, and
 * handed down here rather than read again by each screen that needs a word:
 * each read runs the engine helper and a registry probe.
 *
 * `null` while the first answer is on its way, and on a machine that has not
 * chosen yet; screens word that the way they always did.
 */

import { createContext, useContext } from 'react';
import type { TAudioEngine } from 'common/audioEngine';

export const AudioEngineContext = createContext<TAudioEngine | null>(null);

export const useCurrentEngine = (): TAudioEngine | null =>
  useContext(AudioEngineContext);
