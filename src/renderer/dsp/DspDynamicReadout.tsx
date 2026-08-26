/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';

interface IDspDynamicReadoutProps {
  /** Which band in the rack this is reporting on. */
  bandIndex: number;
  isDynamic: boolean;
  isDisabled: boolean;
  /** The rack itself. Bypassed, no band is doing anything and a percentage
   * here would be the last one it happened to be showing. */
  isRackEnabled: boolean;
  onToggle: () => void;
}

/** A compact on/off control for the selected band's dynamic response. */
const DspDynamicReadout = ({
  bandIndex,
  isDynamic,
  isDisabled,
  isRackEnabled,
  onToggle,
}: IDspDynamicReadoutProps) => {
  const { t } = useTranslation();

  return (
    <div className="dsp-eq-dynamic-readout" title={t('dsp.eq.dynamicHint')}>
      <span>{t('dsp.eq.dynamic')}</span>
      <Switch
        id={`dsp-eq-dynamic-${bandIndex}`}
        isOn={isDynamic}
        isDisabled={isDisabled || !isRackEnabled}
        handleToggle={onToggle}
        ariaLabel={t('dsp.eq.dynamic')}
      />
    </div>
  );
};

export default DspDynamicReadout;
