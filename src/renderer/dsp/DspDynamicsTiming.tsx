/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DYNAMICS_DEFAULTS,
  DYNAMICS_RANGES,
  type IDynamicsSettings,
} from '../../common/dsp/dynamicsStage';
import { useTranslation } from '../utils/I18nContext';
import { Dial } from './DspControls';

interface IProps {
  dynamics: IDynamicsSettings;
  isDisabled: boolean;
  onPatch: (next: Partial<IDynamicsSettings>) => void;
  onCommit: () => void;
}

/** What all three bands share: how fast, how loud, and how much of it. */
const DspDynamicsTiming = ({
  dynamics,
  isDisabled,
  onPatch,
  onCommit,
}: IProps) => {
  const { t } = useTranslation();
  const r = DYNAMICS_RANGES;
  return (
    <section className="dsp-band dsp-dynamics-timing">
      <div className="dsp-band-head">
        <span className="dsp-band-title">{t('dsp.dynamics.timing')}</span>
      </div>
      <p className="dsp-band-hint">{t('dsp.dynamics.timingHint')}</p>
      <div className="dsp-band-dials">
        <Dial
          labelKey="dsp.dynamics.attack"
          value={dynamics.attackMs}
          defaultValue={DYNAMICS_DEFAULTS.attackMs}
          min={r.attackMs.min}
          max={r.attackMs.max}
          unit="ms"
          step={1}
          isDisabled={isDisabled}
          onCommit={onCommit}
          onChange={(attackMs) => onPatch({ attackMs })}
        />
        <Dial
          labelKey="dsp.dynamics.release"
          value={dynamics.releaseMs}
          defaultValue={DYNAMICS_DEFAULTS.releaseMs}
          min={r.releaseMs.min}
          max={r.releaseMs.max}
          unit="ms"
          step={5}
          isDisabled={isDisabled}
          onCommit={onCommit}
          onChange={(releaseMs) => onPatch({ releaseMs })}
        />
        <Dial
          labelKey="dsp.dynamics.makeup"
          value={dynamics.makeupDb}
          defaultValue={DYNAMICS_DEFAULTS.makeupDb}
          min={r.makeupDb.min}
          max={r.makeupDb.max}
          unit="dB"
          step={0.1}
          isDisabled={isDisabled}
          onCommit={onCommit}
          onChange={(makeupDb) => onPatch({ makeupDb })}
        />
        <Dial
          labelKey="dsp.dynamics.mix"
          value={Math.round(dynamics.mix * 100)}
          defaultValue={100}
          min={0}
          max={100}
          unit="%"
          step={1}
          isDisabled={isDisabled}
          onCommit={onCommit}
          onChange={(percent) => onPatch({ mix: percent / 100 })}
        />
      </div>
    </section>
  );
};

export default DspDynamicsTiming;
