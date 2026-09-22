/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { TONE_MAX_DB } from 'common/toneStack';
import useToneStack, { TONE_CONTROLS } from '../eq/useToneStack';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { sortHelper } from '../utils/utils';
import ToneKnob from '../widgets/ToneKnob';

/**
 * The equalizer's other face: Bass, Mid and Treble over the whole rack, the
 * EQ page's own three dials with the EQ page's own values — one copy of
 * them for the window (`useToneStack`), so a dial turned here stands where
 * it was left when the full app comes back. Ctrl+click puts one back to flat.
 */
const PlayerTone = () => {
  const { t } = useTranslation();
  const { filters, isBlockingError } = useFluidEqContext();
  const bands = useMemo(
    () => Object.values(filters).sort(sortHelper),
    [filters],
  );
  const { tone, canShapeTone, applyTone, resetToneRegion } = useToneStack(
    bands,
    true,
  );

  return (
    <div className="player-tone">
      {TONE_CONTROLS.map(({ knob, labelKey }) => (
        <ToneKnob
          key={knob}
          name={t(labelKey)}
          value={tone[knob]}
          min={-TONE_MAX_DB}
          max={TONE_MAX_DB}
          isDisabled={isBlockingError || !canShapeTone}
          step={0.1}
          unit="dB"
          defaultValue={0}
          onReset={() => {
            resetToneRegion(knob).catch(() => undefined);
          }}
          handleChange={(value) => applyTone({ ...tone, [knob]: value }, knob)}
        />
      ))}
    </div>
  );
};

export default PlayerTone;
