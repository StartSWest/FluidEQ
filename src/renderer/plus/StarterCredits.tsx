/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { STARTER_CREDITS } from 'common/sceneStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { storeFailureKey } from './CreditPacks';
import { creditsText } from './credits';
import { claimStarterCredits } from './sceneStore';

/**
 * The free credits, while they are still there: one line on what they are
 * and the loud button that takes them. Shown above the packs wherever the
 * packs are, because three scenes for nothing is the better offer.
 */
export default function StarterCredits({
  onFailure,
}: {
  onFailure: (key: TranslationKey | undefined) => void;
}) {
  const { t, locale } = useTranslation();
  const [claiming, setClaiming] = useState(false);
  const credits = creditsText(t, locale, STARTER_CREDITS);
  const claim = () => {
    if (claiming) {
      return;
    }
    setClaiming(true);
    onFailure(undefined);
    claimStarterCredits()
      .then((outcome) => {
        setClaiming(false);
        if (!outcome.ok) {
          onFailure(storeFailureKey(outcome.reason));
        }
        return undefined;
      })
      .catch(() => {
        setClaiming(false);
        onFailure('store.error.offline');
      });
  };
  return (
    <div className="dialog-frame__group store-starter">
      <span className="store-starter__coin" aria-hidden="true">
        <Glyph name="credit" />
      </span>
      <span className="store-starter__text">
        <span className="store-starter__title">
          {t('store.starter.title', { credits })}
        </span>
        <span className="store-starter__body">{t('store.starter.body')}</span>
      </span>
      <button
        type="button"
        className={`button small${claiming ? ' is-running' : ''}`}
        aria-busy={claiming}
        disabled={claiming}
        onClick={claim}
      >
        {t('store.starter.claim', { credits })}
      </button>
    </div>
  );
}
