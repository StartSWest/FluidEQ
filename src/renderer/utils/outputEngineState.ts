/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAudioDevice } from 'common/constants';
import type { TAudioEngine } from 'common/audioEngine';

/**
 * What the output panels have to say about one output under one engine.
 *
 * - `processed` — the engine in use is on this output.
 * - `engine-missing` — it is not, and it can be put there: the FluidEQ
 *   Engine's one-prompt attach, or Equalizer APO's Device Selector.
 * - `no-effects` — Windows runs no audio effects on this output at all, so no
 *   engine can be put there and neither repair applies. Remote Desktop's audio
 *   is the case: its attach failed with "there is no output with the id…".
 * - `unknown` — Windows could not answer, or no engine is known yet. Nothing
 *   is said on a guess.
 */
export type TOutputEngineState =
  'processed' | 'engine-missing' | 'no-effects' | 'unknown';

export const outputEngineState = (
  device: IAudioDevice | undefined,
  engine: TAudioEngine | null | undefined,
): TOutputEngineState => {
  if (!device || !engine) {
    return 'unknown';
  }
  // Ahead of the attached flags, which read `false` on such an output too —
  // and that `false` is what used to offer the repair that cannot work.
  if (device.canHostEffects === false) {
    return 'no-effects';
  }
  // Only the engine in use: reading the other one's flag sent people running
  // the FluidEQ Engine into Equalizer APO's Device Selector, and put an OFF
  // badge on every output of a machine that never had Equalizer APO.
  const attached =
    engine === 'fluid'
      ? device.isFluidEngineAttached
      : device.isEqualizerApoAttached;
  if (attached === true) {
    return 'processed';
  }
  return attached === false ? 'engine-missing' : 'unknown';
};

/** The OFF badge: every state in which this output is not being processed. */
export const isOutputOff = (state: TOutputEngineState): boolean =>
  state === 'engine-missing' || state === 'no-effects';
