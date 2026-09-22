/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef, useState } from 'react';
import useIsAutoEqRunning from '../utils/autoEqRunning';
import { toggleContinuousEq, useContinuousEq } from '../utils/continuousEq';
import { useTranslation } from '../utils/I18nContext';
import {
  SMART_EQ_MODES,
  SMART_EQ_MODE_NAME,
  SMART_EQ_MODE_NOTE,
  isContinuousMode,
  setSmartEqMode,
  useSmartEqMode,
} from '../utils/smartEqMode';
import { cancelSmartEq, runSmartEq, useSmartEqRun } from '../utils/smartEqRun';
import AnchoredMenu from '../widgets/AnchoredMenu';
import PlayerIcon from './PlayerIcon';
import useMenuDismiss from './useMenuDismiss';

/**
 * Smart EQ, as the equalizer deck's second key: the EQ page's split button
 * made small. The key does what the page's does — starts or stops the mode
 * that keeps measuring, or runs the one-off and becomes its Cancel — and
 * its caret picks the mode, from the same list and in the same words.
 *
 * Never greyed out. It used to wait on the graph's loopback capture, which
 * was what the measurement listened to; the measurement opens its own tap on
 * the source now and says in the bubble if it cannot.
 */
const SmartEqKey = () => {
  const { t } = useTranslation();
  const mode = useSmartEqMode();
  const isContinuousOn = useContinuousEq();
  const isRunning = useIsAutoEqRunning();
  const { isRunning: isBalancing } = useSmartEqRun();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  useMenuDismiss(isMenuOpen, holder, closeMenu);
  const isContinuous = isContinuousMode(mode);
  const isLit = isContinuous ? isContinuousOn : isBalancing;

  return (
    <span
      className={`player-split${isRunning ? ' is-running' : ''}`}
      ref={holder}
    >
      <button
        type="button"
        className="button small subtle player-led player-split__main"
        aria-pressed={isLit}
        title={isContinuous ? t('eq.smart.continuousAria') : t('eq.smart.aria')}
        onClick={() => {
          if (isContinuous) {
            toggleContinuousEq();
            return;
          }
          if (isBalancing) {
            cancelSmartEq();
            return;
          }
          runSmartEq();
        }}
      >
        <span className="player-led__lamp" aria-hidden="true" />
        {t('player.eq.smart')}
        {isContinuous && (
          <span className="player-led__value">
            {t(SMART_EQ_MODE_NAME[mode])}
          </span>
        )}
        {!isContinuous && isBalancing && (
          <span className="player-led__value">{t('eq.smart.cancel')}</span>
        )}
      </button>
      <button
        type="button"
        className="button small subtle player-led player-split__caret"
        aria-label={t('eq.smart.modeAria')}
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        <PlayerIcon name="caret" className="player-icon player-icon--caret" />
      </button>
      <AnchoredMenu
        anchor={holder.current}
        isOpen={isMenuOpen}
        align="left"
        className="player-menu player-menu--modes"
        ariaLabel={t('eq.smart.modeAria')}
      >
        {SMART_EQ_MODES.map((entry) => (
          <button
            key={entry}
            type="button"
            role="menuitemradio"
            aria-checked={entry === mode}
            className="player-menu__item player-menu__item--two"
            onClick={() => {
              setSmartEqMode(entry);
              closeMenu();
            }}
          >
            <PlayerIcon
              name="check"
              className="player-icon player-menu__tick"
            />
            <span className="player-menu__two">
              <b>{t(SMART_EQ_MODE_NAME[entry])}</b>
              <small>{t(SMART_EQ_MODE_NOTE[entry])}</small>
            </span>
          </button>
        ))}
      </AnchoredMenu>
    </span>
  );
};

export default SmartEqKey;
