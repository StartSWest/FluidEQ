/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback } from 'react';
import { MAX_GAIN, PREAMP_MIN_GAIN } from 'common/constants';
import { ErrorDescription } from 'common/errors';
import { TONE_MAX_DB } from 'common/tone';
import useAutoPreAmp from '../components/useAutoPreAmp';
import useTone, { TONE_CONTROLS } from '../eq/useTone';
import { useCurrentEngine } from '../utils/audioEngineContext';
import { useEnginePreamp, useEnginePreampReader } from '../utils/enginePreamp';
import { setMainPreAmp } from '../utils/equalizerApi';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import ToneKnob from '../widgets/ToneKnob';

/**
 * The equalizer's other face: Bass, Mid and Treble, the EQ page's own three
 * dials with the EQ page's own values — one copy of them for the window
 * (`useTone`), so a dial turned here stands where it was left when the full
 * app comes back — and the preamp before them, the side bar's own (Ivan,
 * 2026-10-25, the one amp: "your three tone knobs and the preamp").
 * Ctrl+click puts one back to flat.
 *
 * The preamp is the side bar's dial in every way: -60 to +20 with unity at
 * the top of its sweep, and under Auto normalize set for the listener —
 * drawn where it stands, reading AUTO, and not turnable until its name, which
 * is the Auto switch, hands it back.
 */
const PlayerTone = () => {
  const { t } = useTranslation();
  const { tone, isDisabled, turnTone, resetTone } = useTone();
  const { isAutoPreAmpOn, preAmp, setGlobalError, setPreAmp } =
    useFluidEqContext();
  const auto = useAutoPreAmp();
  const isFluid = useCurrentEngine() === 'fluid';
  useEnginePreampReader(isFluid && isAutoPreAmpOn);
  const livePreamp = useEnginePreamp();
  const automaticPreamp = livePreamp?.enabled ? livePreamp.gainDb : 0;
  const shownPreamp = isFluid && isAutoPreAmpOn ? automaticPreamp : preAmp;
  // Shown first, written second, as the side bar's dial does: a drag that
  // waited on every write froze the knob a moment behind the hand.
  const setGain = useCallback(
    async (gain: number) => {
      setPreAmp(gain);
      try {
        await setMainPreAmp(gain);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [setGlobalError, setPreAmp],
  );

  return (
    <div className="player-tone">
      {/* The preamp first, at the left, and its name is its Auto switch, as
          the word under the faders' preamp is (Ivan, 2026-10-25: "no sense
          showing preamp if not able to set it as manual, and put it on the
          left"): lit and reading AUTO while the app sets it, and a press
          hands it to the dial. */}
      <ToneKnob
        name={t('sidebar.preamp')}
        label={
          <button
            type="button"
            className={`player-tone__auto${auto.isOn ? ' is-on' : ''}`}
            aria-pressed={auto.isOn}
            disabled={auto.isDisabled}
            title={
              auto.isOn ? t('sidebar.preampAuto') : t('player.eq.autoHint')
            }
            onClick={() => {
              auto.toggle().catch(() => undefined);
            }}
          >
            {t('sidebar.preamp')}
            {auto.isOn && (
              <span className="player-tone__auto-tag">
                {t('player.eq.auto')}
              </span>
            )}
          </button>
        }
        value={shownPreamp}
        min={PREAMP_MIN_GAIN}
        max={MAX_GAIN}
        centre={0}
        isDisabled={isDisabled || isAutoPreAmpOn}
        step={0.1}
        unit={isAutoPreAmpOn ? t('sidebar.autoLabel') : 'dB'}
        defaultValue={0}
        handleChange={setGain}
      />
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
