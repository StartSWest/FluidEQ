/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memo, useRef } from 'react';
import { useSoundingGame } from '../../games/useGameSound';
import WavePresetGame from './WavePresetGame';
import WavePresetPick from './WavePresetPick';
import useWavePresetRoom from './useWavePresetRoom';
import '../../styles/WavePreset.scss';

/**
 * The playing preset, named at the top centre of the titlebar's wave (Ivan,
 * 2026-11-20, direction B of the "Preset on the meter" mockup).
 *
 * A layer over the meter rather than a part of it: the meter is a button —
 * a press cycles its look — and a button inside a button is resolved by the
 * browser unnesting it, which loses the inner press. So this is the meter's
 * sibling in its shell, laid over its label row, and lets every press that
 * is not on the plate through to the meter under it.
 *
 * Memoised: the meter renders when its own state turns (a clip, a pause, a
 * style), and the presets list this reads has nothing to do with any of it.
 */
const WavePresetPlate = memo(({ isMeterOn }: { isMeterOn: boolean }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sounding = useSoundingGame();
  useWavePresetRoom(
    overlayRef,
    sounding ? `game:${sounding.id}` : 'music',
    isMeterOn,
  );
  return (
    <div ref={overlayRef} className="wave-preset">
      {sounding ? <WavePresetGame game={sounding} /> : <WavePresetPick />}
    </div>
  );
});

export default WavePresetPlate;
