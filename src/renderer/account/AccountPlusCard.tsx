/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISubscriptionState } from 'common/subscription';
import {
  FLUIDWALLPAPERS_DOWNLOAD,
  ManagePlusButton,
  PlusOffer,
  plusEnding,
} from '../plus/PlusGalleryHead';
import PlusMark from '../plus/PlusMark';
import { plusOnSale, usePlusSubscription } from '../plus/plusSubscriptionStore';
import { planName, plusDate } from '../plus/plusWords';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

/**
 * A member's Plus as a pass worth having (Ivan, 2026-11-28: "make it
 * nicer"): a ticket in the window's own colours, its stub holding the pass
 * mark large, then that every scene in the gallery is theirs, the plan and
 * when it renews - or, cancelled, when it ends, with Renew Plus - the way to
 * make scenes in FluidWallpapers, and the one action at its end.
 */
function PlusPass({ plus }: { plus: ISubscriptionState }) {
  const { t, locale } = useTranslation();
  const { status } = plus;
  const ending = plusEnding(plus);
  const date = status?.until ? plusDate(status.until, locale) : undefined;
  let line = t('subscription.line.plain');
  if (date) {
    line = t(
      ending ? 'subscription.account.ends' : 'subscription.account.renews',
      {
        date,
      },
    );
  }
  if (status?.plan) {
    line = `${planName(t, status.plan)} · ${line}`;
  }
  return (
    <section
      className={`plus-pass${ending ? ' is-ending' : ''}`}
      aria-labelledby="plus-pass-title"
    >
      <span className="plus-pass__stub">
        <PlusMark className="plus-pass__mark" />
        <span className="plus-pass__brand">{t('subscription.name')}</span>
      </span>
      <span className="plus-pass__words">
        <span className="plus-pass__eyebrow">
          {t(ending ? 'subscription.pass.ending' : 'subscription.pass.member')}
        </span>
        <span id="plus-pass-title" className="plus-pass__title">
          {t('subscription.account.yours')}
        </span>
        <span className="plus-pass__line">{line}</span>
        {status?.graceUntil && (
          <span className="plus-pass__line">
            {t('subscription.status.grace', {
              date: plusDate(status.graceUntil, locale),
            })}
          </span>
        )}
        <a
          className="plus-pass__fw"
          href={FLUIDWALLPAPERS_DOWNLOAD}
          target="_blank"
          rel="noreferrer"
        >
          {t('subscription.makeScenes')}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3h7v7M13 3 5 11" />
          </svg>
        </a>
      </span>
      <ManagePlusButton plus={plus} className="button plus-pass__action" />
    </section>
  );
}

/**
 * The account that owns every scene, the admin (Ivan, 2026-11-28: "admin
 * doesnt need to see renew plus admin own all scenes"): what is true of it,
 * in the panel's quiet ink - no ticket, no Plus mark, no Renew. Manage Plus
 * only while a subscription of its still renews, quietly, so it can be
 * stopped.
 */
function EveryScene({ plus }: { plus: ISubscriptionState }) {
  const { t } = useTranslation();
  return (
    <section
      className="account-every-scene"
      aria-labelledby="every-scene-title"
    >
      <span className="account-every-scene__mark" aria-hidden="true">
        <Glyph name="crown" />
      </span>
      <span className="account-every-scene__words">
        <span id="every-scene-title" className="account-every-scene__title">
          {t('subscription.everyScene.title')}
        </span>
        <span className="account-every-scene__body">
          {t('subscription.everyScene.body')}
        </span>
      </span>
      <ManagePlusButton plus={plus} className="button small subtle" />
    </section>
  );
}

/**
 * Plus in the account panel, over the credits (Ivan, 2026-11-28: "if plus
 * somenice plus thing if not plus to get plus nice banner like in the
 * gallery"): a member's pass, or the gallery's own Plus block for anybody
 * who can get it - Get Plus again once it ended. Credits under it are the
 * extra, a scene kept for good.
 */
export default function AccountPlusCard() {
  const plus = usePlusSubscription();
  if (!plus) {
    return null;
  }
  if (plus.everyScene) {
    return <EveryScene plus={plus} />;
  }
  if (plus.subscribed) {
    return <PlusPass plus={plus} />;
  }
  return plusOnSale(plus) ? (
    <PlusOffer plus={plus} className="account-plus-offer" />
  ) : null;
}
