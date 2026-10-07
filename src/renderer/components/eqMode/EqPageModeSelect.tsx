/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import {
  pinEqMode,
  revealEqModeCard,
  takeEqModeTriggerFocus,
  useEqModeButtonOnScreen,
  useEqModePinned,
} from '../../utils/eqModePin';
import EqModeSelect from '../EqModeSelect';
import EqModeTriggerFace from './EqModeTriggerFace';
import useEqModeChoices from './useEqModeChoices';

/**
 * The button with the menu pinned: it shows the card beside the graph instead
 * of a menu over it, putting the panel on screen first when it is folded or
 * shut, and still says whether anything in it is changed.
 */
const PinnedEqModeTrigger = () => {
  const { t } = useTranslation();
  const { customized, disabled } = useEqModeChoices();
  return (
    <div className="eq-toolbar__option">
      <button
        type="button"
        className="eq-mode-trigger"
        aria-label={t('eq.mode.showPinned')}
        title={t('eq.mode.showPinned')}
        disabled={disabled}
        onClick={revealEqModeCard}
      >
        <EqModeTriggerFace
          customized={customized}
          end={<MenuIcon name="pin" className="eq-mode-trigger__pin" />}
        />
      </button>
    </div>
  );
};

/**
 * The EQ page's EQ mode button: the menu, with a pin that turns it into the
 * first card of the sound panel, beside the graph (`eqModePin.ts`).
 */
const EqPageModeSelect = () => {
  const { t } = useTranslation();
  const isPinned = useEqModePinned();
  const trigger = useRef<HTMLButtonElement>(null);
  useEqModeButtonOnScreen();
  useEffect(() => {
    if (!isPinned && takeEqModeTriggerFocus()) {
      trigger.current?.focus();
    }
  }, [isPinned]);
  if (isPinned) {
    return <PinnedEqModeTrigger />;
  }
  return (
    <EqModeSelect
      triggerRef={trigger}
      headingAction={
        <button
          type="button"
          className="button small subtle eq-mode-menu__pin"
          aria-label={t('eq.mode.pin')}
          title={t('eq.mode.pin')}
          onClick={pinEqMode}
        >
          <MenuIcon name="pin" />
        </button>
      }
    />
  );
};

export default EqPageModeSelect;
