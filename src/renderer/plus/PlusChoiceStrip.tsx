/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { SCENE_PRICE_CREDITS } from 'common/sceneStore';
import Glyph from '../community/Glyph';
import { createFlagSetting } from '../utils/graphStorage';
import { useTranslation } from '../utils/I18nContext';
import { creditsText } from './credits';
import GetPlusButton from './GetPlusButton';
import PlusMark from './PlusMark';
import { plusOnSale, usePlusSubscription } from './plusSubscriptionStore';
import { startingPriceText } from './plusWords';

/**
 * Put away for good once closed: it explains, and somebody who has read it
 * does not need it on every visit. The cards' "Get · 1 credit" and Plus mark
 * keep saying the same thing in smaller words.
 */
const hiddenSetting = createFlagSetting('fluideq.plusChoiceHidden', false);

/**
 * The two ways a scene becomes playable, over the gallery, for an account
 * without Plus: a credit keeps one scene for good, Plus plays every scene
 * while it lasts (Ivan, 2026-11-28: "make sure users doent get confusued if
 * they should get plus or buy credits"). The same two lines every surface
 * uses, so the words never change between the gallery, a scene and the sheet.
 */
export default function PlusChoiceStrip() {
  const { t, locale } = useTranslation();
  const plus = usePlusSubscription();
  const hidden = useSyncExternalStore(
    hiddenSetting.subscribe,
    hiddenSetting.get,
    hiddenSetting.get,
  );
  if (hidden || !plus || !plusOnSale(plus) || plus.lapse) {
    return null;
  }
  return (
    <section className="plus-choice" aria-label={t('subscription.ways.title')}>
      <span className="plus-choice__way">
        <Glyph name="credit" />
        <span className="plus-choice__words">
          <b>{t('subscription.choice.credits.title')}</b>
          <span>
            {t('subscription.choice.credits.body', {
              credits: creditsText(t, locale, SCENE_PRICE_CREDITS),
            })}
          </span>
        </span>
      </span>
      <span className="plus-choice__or" aria-hidden="true">
        {t('subscription.choice.or')}
      </span>
      <span className="plus-choice__way plus-choice__way--plus">
        <PlusMark />
        <span className="plus-choice__words">
          <b>{t('subscription.choice.plus.title')}</b>
          <span>
            {t('subscription.choice.plus.body', {
              price: startingPriceText(t, plus.plans, locale),
            })}
          </span>
        </span>
      </span>
      <span className="plus-choice__actions">
        <GetPlusButton
          label={t('subscription.get')}
          className="button small subtle"
        />
        <button
          type="button"
          className="plus-choice__hide"
          aria-label={t('subscription.choice.hide')}
          title={t('subscription.choice.hide')}
          onClick={() => hiddenSetting.set(true)}
        >
          <Glyph name="close" />
        </button>
      </span>
    </section>
  );
}
