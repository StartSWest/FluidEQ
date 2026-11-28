/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import useIsAutoEqRunning from '../utils/autoEqRunning';
import { toggleContinuousEq, useContinuousEq } from '../utils/continuousEq';
import { useTranslation } from '../utils/I18nContext';
import { cancelSmartEq, useSmartEqRun } from '../utils/smartEqRun';
import PlayerIcon from './PlayerIcon';

/**
 * Smart EQ, as the equalizer deck's second key: Smart correction's switch.
 * On, it keeps measuring and correcting each song; a Measure once started
 * from the Auto EQ panel shows here as its Cancel.
 *
 * It had a caret beside it that picked how Smart correction measured, from
 * the same list as the EQ page. There is one way now, Balance
 * (`common/referenceCurve`), so the switch is the whole key; the pill it sits
 * in is the same one (`.player-split`, `_miniPlayerEqKeys.scss`).
 *
 * Never greyed out. It used to wait on the graph's loopback capture, which
 * was what the measurement listened to; the measurement opens its own tap on
 * the source now and says in the bubble if it cannot.
 */
const SmartEqKey = () => {
  const { t } = useTranslation();
  const isContinuousOn = useContinuousEq();
  const isRunning = useIsAutoEqRunning();
  const { isRunning: isBalancing } = useSmartEqRun();

  return (
    <span className={`player-split${isRunning ? ' is-running' : ''}`}>
      <button
        type="button"
        className="button small subtle player-led player-split__main"
        aria-pressed={isBalancing || isContinuousOn}
        title={t('eq.smart.continuousAria')}
        onClick={() => {
          if (isBalancing) {
            cancelSmartEq();
            return;
          }
          toggleContinuousEq();
        }}
      >
        <PlayerIcon name="spark" className="player-icon player-split__spark" />
        {t('player.eq.smart')}
        {isBalancing && (
          <span className="player-led__value">{t('eq.smart.cancel')}</span>
        )}
      </button>
    </span>
  );
};

export default SmartEqKey;
