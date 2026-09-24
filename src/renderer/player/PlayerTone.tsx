/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TONE_MAX_DB } from 'common/tone';
import useTone, { TONE_CONTROLS } from '../eq/useTone';
import { useTranslation } from '../utils/I18nContext';
import ToneKnob from '../widgets/ToneKnob';

/**
 * The equalizer's other face: Bass, Mid and Treble, the EQ page's own three
 * dials with the EQ page's own values — one copy of them for the window
 * (`useTone`), so a dial turned here stands where it was left when the full
 * app comes back. Ctrl+click puts one back to flat.
 */
const PlayerTone = () => {
  const { t } = useTranslation();
  const { tone, isDisabled, turnTone, resetTone } = useTone();

  return (
    <div className="player-tone">
      {TONE_CONTROLS.map(({ knob, labelKey }) => (
        <ToneKnob
          key={knob}
          name={t(labelKey)}
          value={tone[knob]}
          min={-TONE_MAX_DB}
          max={TONE_MAX_DB}
          isDisabled={isDisabled}
          step={0.1}
          unit="dB"
          defaultValue={0}
          onReset={() => resetTone(knob)}
          handleChange={(value) => turnTone(knob, value)}
        />
      ))}
    </div>
  );
};

export default PlayerTone;
