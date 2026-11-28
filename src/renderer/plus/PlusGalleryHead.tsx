/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISubscriptionState } from 'common/subscription';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import GetPlusButton from './GetPlusButton';
import { useGalleryList } from './galleryStore';
import { OPENING_SORT } from './plusNavigation';
import PlusMark from './PlusMark';
import {
  plusOnSale,
  usePlusBackFromCheckout,
  usePlusSubscription,
} from './plusSubscriptionStore';
import { planPriceText, plusDate } from './plusWords';
import { ScenePicture } from './GalleryParts';
import { useManagePlus } from './useGetPlus';

/**
 * Where FluidWallpapers is downloaded: its site's own download section.
 * Scenes are made there, and Plus is the same subscription in both apps
 * (Ivan, 2026-11-28: "make users aware they need to download fluidwalerp to
 * make scenes"). Opened in the browser by the window's link policy.
 */
export const FLUIDWALLPAPERS_DOWNLOAD = 'https://fluidwallpapers.com/#download';

/** How many of the newest scenes stand behind the offer's words. */
const ART_PICTURES = 6;

/**
 * For an account without Plus: Plus as the main thing - every scene in the
 * gallery, one subscription for FluidEQ and FluidWallpapers, its price and
 * the loud Get Plus - and a credit as the extra, for a scene to keep for
 * good even without Plus (Ivan, 2026-11-28: "make crlear plus is the main
 * thing", "if they want they can aditionally purchase scenes for good").
 */
function PlusOffer({ plus }: { plus: ISubscriptionState }) {
  const { t, locale } = useTranslation();
  const backFromCheckout = usePlusBackFromCheckout();
  const { list } = useGalleryList({ sort: OPENING_SORT });
  const monthly = plus.plans.find((plan) => plan.id === 'monthly');
  const yearly = plus.plans.find((plan) => plan.id === 'yearly');
  const first = monthly ?? yearly;
  return (
    <section className="plus-offer" aria-labelledby="plus-offer-title">
      <span className="plus-offer__art" aria-hidden="true">
        {list.scenes.slice(0, ART_PICTURES).map((scene) => (
          <ScenePicture key={scene.lookId} scene={scene} />
        ))}
      </span>
      <PlusMark className="plus-offer__mark" />
      <div className="plus-offer__words">
        <h3 id="plus-offer-title" className="plus-offer__title">
          {t('subscription.banner.title')}
        </h3>
        <p className="plus-offer__body">{t('subscription.banner.body')}</p>
        <p className="plus-offer__extra">
          <Glyph name="credit" />
          {t('subscription.banner.credit')}
        </p>
      </div>
      <div className="plus-offer__buy">
        {backFromCheckout ? (
          <p className="plus-offer__waiting" role="status">
            <span className="store-status__spinner" aria-hidden="true" />
            {t('subscription.status.waiting')}
          </p>
        ) : (
          <>
            {first && (
              <span className="plus-offer__price">
                {planPriceText(t, first, locale)}
              </span>
            )}
            <GetPlusButton
              label={t('subscription.get')}
              className="button plus-offer__get"
            />
            {first === monthly && yearly && (
              <span className="plus-offer__year">
                {t('subscription.banner.or', {
                  price: planPriceText(t, yearly, locale),
                })}
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * For a member: one quiet line - every scene is theirs to play, when it
 * renews or ends, that it works in FluidWallpapers too - with the way to
 * make scenes there and Manage Plus. The gallery under it is the rest.
 */
function PlusMemberLine({ plus }: { plus: ISubscriptionState }) {
  const { t, locale } = useTranslation();
  const manage = useManagePlus();
  const { status } = plus;
  const date = status?.until ? plusDate(status.until, locale) : undefined;
  let said = t('subscription.line.plain');
  if (date) {
    said = t(
      status?.renewing === false
        ? 'subscription.line.ends'
        : 'subscription.line.renews',
      { date },
    );
  }
  return (
    <section className="plus-line">
      <PlusMark className="plus-line__mark" />
      <p className="plus-line__words">
        <strong>{t('subscription.name')}</strong>
        <span>{said}</span>
        {status?.graceUntil && (
          <span className="plus-line__warn">
            {t('subscription.status.grace', {
              date: plusDate(status.graceUntil, locale),
            })}
          </span>
        )}
        {manage.said && (
          <span
            className={manage.failed ? 'plus-line__warn' : undefined}
            role="status"
          >
            {t(manage.said)}
          </span>
        )}
      </p>
      <a
        className="plus-line__fw"
        href={FLUIDWALLPAPERS_DOWNLOAD}
        target="_blank"
        rel="noreferrer"
      >
        {t('subscription.makeScenes')}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3h7v7M13 3 5 11" />
        </svg>
      </a>
      {plus.manageable && (
        <button
          type="button"
          className={`button small subtle${manage.busy ? ' is-running' : ''}`}
          aria-busy={manage.busy}
          disabled={manage.busy}
          onClick={manage.manage}
        >
          {t('subscription.manage')}
        </button>
      )}
    </section>
  );
}

/**
 * The head of the gallery's front page, as the account stands with Plus:
 * the offer for anybody who can get it, the member's line for a member, and
 * nothing while Plus is nowhere to be had or has just ended (the card that
 * says what stopped stands there then, `PlusLapseCard`).
 */
export default function PlusGalleryHead() {
  const plus = usePlusSubscription();
  if (!plus) {
    return null;
  }
  if (plus.subscribed) {
    return <PlusMemberLine plus={plus} />;
  }
  if (plusOnSale(plus) && !plus.lapse) {
    return <PlusOffer plus={plus} />;
  }
  return null;
}
