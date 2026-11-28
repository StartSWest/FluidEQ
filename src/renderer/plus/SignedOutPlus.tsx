/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import PlusMark from './PlusMark';
import PLUS_STILLS from './plusStills';
import { usePlusSubscription } from './plusSubscriptionStore';
import { planPriceText } from './plusWords';
import '../styles/Gallery.scss';

/** How many stills stand in the band's row. */
const STILLS = 4;

/**
 * Plus on the welcome for somebody without an account (Ivan, 2026-11-28:
 * "also here we need some indications of plus", then "make it nicer"): a
 * band of its own under the free offer - real scenes, the pass, every scene
 * in the gallery, one subscription for FluidEQ and FluidWallpapers, and the
 * price set large. The free account and its credit stay the lead; Plus is
 * got once signed in, so its button signs in. The prices are the ones this
 * computer last heard on sale; with none, the band goes without them.
 */
export default function SignedOutPlus({ onSignIn }: { onSignIn: () => void }) {
  const { t, locale } = useTranslation();
  const plus = usePlusSubscription();
  const monthly = plus?.plans.find((plan) => plan.id === 'monthly');
  const yearly = plus?.plans.find((plan) => plan.id === 'yearly');
  const first = monthly ?? yearly;
  return (
    <section className="signed-out__plus" aria-labelledby="signed-out-plus">
      <span className="signed-out__plus-stills" aria-hidden="true">
        {PLUS_STILLS.slice(0, STILLS).map((still) => (
          <img key={still.id} src={still.src} alt="" draggable={false} />
        ))}
      </span>
      <span className="signed-out__plus-head">
        <PlusMark className="signed-out__plus-mark" />
        <b id="signed-out-plus">{t('subscription.welcome.title')}</b>
      </span>
      <span className="signed-out__plus-body">
        {t('subscription.welcome.body')}
      </span>
      <span className="signed-out__plus-foot">
        {first && (
          <span className="signed-out__plus-price">
            {planPriceText(t, first, locale)}
            {first === monthly && yearly && (
              <small>
                {t('subscription.banner.or', {
                  price: planPriceText(t, yearly, locale),
                })}
              </small>
            )}
          </span>
        )}
        <button type="button" className="button subtle" onClick={onSignIn}>
          <PlusMark />
          {t('subscription.welcome.signIn')}
        </button>
      </span>
    </section>
  );
}
