/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';
import { runSmartEq } from '../../utils/smartEqRun';
import { setContinuousEq } from '../../utils/continuousEq';

/**
 * One measurement of what plays, applied at once — Smart EQ's first mode, in
 * Auto EQ's foot beside Manage (the mockup's place for it), so the panel
 * keeps its height for the parts above.
 */
const AutoEqMeasureOnce = ({ isBalancing }: { isBalancing: boolean }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="button small subtle"
      title={t('autoEq.smart.onceHint')}
      disabled={isBalancing}
      onClick={() => {
        // Once, instead of running: the running correction stops for it,
        // as it always has, rather than measuring again over its answer the
        // moment it is done.
        setContinuousEq(false);
        runSmartEq();
      }}
    >
      {t('autoEq.smart.once')}
    </button>
  );
};

export default AutoEqMeasureOnce;
