/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Knob from '../widgets/Knob';
import { TONE_MAX_DB } from '../../common/tone';
import { useTranslation } from '../utils/I18nContext';
import EqCutKnob from './EqCutKnob';
import { TONE_CONTROLS } from './useTone';
import { type TEqPageActions } from './useEqPageActions';

/**
 * The Tone tab: the low cut, Bass, Mid and Treble, and the high cut, on
 * dials across the tab, the cuts either side as they sit on the graph. It
 * stood in the band editor's row while no band was selected; with a tab of
 * its own it is there whether or not a band is, and says what it is: a layer
 * of its own, drawn as the Tone line, that leaves the bands alone.
 */
const EqToneTab = ({ actions }: { actions: TEqPageActions }) => {
  const { t } = useTranslation();
  const { tone, isToneDisabled, turnTone, resetTone } = actions;
  return (
    <div className="eq-tone-tab">
      <div className="eq-flat-editor eq-flat-editor--tone">
        <EqCutKnob cut="low" />
        {TONE_CONTROLS.map(({ knob, labelKey }) => (
          <div
            key={knob}
            className="eq-flat-editor__control eq-flat-editor__control--centred"
          >
            <span>{t(labelKey)}</span>
            <Knob
              name={t(labelKey)}
              value={tone[knob]}
              min={-TONE_MAX_DB}
              max={TONE_MAX_DB}
              isDisabled={isToneDisabled}
              step={0.1}
              unit="dB"
              defaultValue={0}
              onReset={() => resetTone(knob)}
              handleChange={(newValue) => turnTone(knob, newValue)}
            />
          </div>
        ))}
        <EqCutKnob cut="high" />
      </div>
      <p className="eq-tone-tab__note">
        <span className="eq-tone-tab__swatch" aria-hidden="true" />
        {t('eq.tone.note')}
      </p>
    </div>
  );
};

export default EqToneTab;
