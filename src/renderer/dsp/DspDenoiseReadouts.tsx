/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Denoise page's live readings, each subscribed where it is drawn.
 *
 * The engine publishes them with every host frame. Read at the top of
 * `DspDenoiseCard`, they re-rendered the whole page — four modules, a dozen
 * dials, the preset bar — a hundred times a second to change four numbers.
 */

import { useTranslation } from '../utils/I18nContext';
import { useDspDenoiseMeter } from './store';

const value = (input: number, unit: string) => `${input.toFixed(1)} ${unit}`;

interface IDspDenoiseReadoutProps {
  /** A stage that is off measures nothing, and says so with a dash. */
  isEnabled: boolean;
}

/** The floor the adaptive profile is tracking, under the FluidEQ Engine. */
export const DspDenoiseLiveFloor = ({ isEnabled }: IDspDenoiseReadoutProps) => {
  const { t } = useTranslation();
  const { noiseFloorDb } = useDspDenoiseMeter();
  return (
    <dl className="dsp-normalizer-stats" aria-live="polite">
      <div>
        <dt>{t('dsp.denoise.measuredFloor')}</dt>
        <dd>
          {isEnabled && noiseFloorDb > -120 ? value(noiseFloorDb, 'dBFS') : '—'}
        </dd>
      </div>
    </dl>
  );
};

/** Reduction, clicks repaired and Voice underruns, under the modules. */
export const DspDenoiseLiveStats = ({ isEnabled }: IDspDenoiseReadoutProps) => {
  const { t } = useTranslation();
  const meter = useDspDenoiseMeter();
  return (
    // The readings already carry their own three surfaces. A fourth card
    // around them added padding and a border but no grouping information.
    <dl className="dsp-normalizer-stats dsp-denoise-live" aria-live="polite">
      <div>
        <dt>{t('dsp.denoise.liveReduction')}</dt>
        <dd>{isEnabled ? value(meter.reductionDb, 'dB') : '—'}</dd>
      </div>
      <div>
        <dt>{t('dsp.denoise.clicksRepaired')}</dt>
        <dd>{isEnabled ? meter.clicksRepaired.toFixed(0) : '—'}</dd>
      </div>
      <div>
        <dt>{t('dsp.denoise.voiceUnderruns')}</dt>
        <dd>{isEnabled ? meter.voiceUnderruns.toFixed(0) : '—'}</dd>
      </div>
    </dl>
  );
};
