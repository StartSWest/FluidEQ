/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { STARTER_CREDITS } from 'common/sceneStore';
import { useTranslation } from '../utils/I18nContext';
import { pluralCategory } from '../utils/pluralCategory';
import { creditsText } from './credits';
import { openNotMineYet } from './plusNavigation';
import { useSceneStore } from './sceneStore';
import { STARTER_COVERS, StarterCoin, useStarterClaim } from './StarterParts';
import { isCardDue, useStarterWelcome } from './starterWelcome';

/**
 * The starter credits at the top of Visualizers, every visit while they are
 * not claimed (`starterWelcome.ts`): where they are spent, so it reminds
 * without stopping anybody. Claimed here, the gallery switches to Not mine
 * yet under it at once, and the card says the credits are ready.
 */
export default function StarterCard({ accountId }: { accountId: string }) {
  const { t, locale } = useTranslation();
  const { store, owner } = useSceneStore();
  const welcome = useStarterWelcome(accountId);
  // The visit's own time: the card is due or not for the whole visit.
  const [visitedAt] = useState(() => Date.now());
  const [gone, setGone] = useState(false);
  const { phase, failure, claim } = useStarterClaim();
  const claimed = phase === 'claimed';

  useEffect(() => {
    if (claimed) {
      openNotMineYet();
    }
  }, [claimed]);

  const offered =
    store !== undefined &&
    owner === accountId &&
    !store.starterClaimed &&
    !store.everything &&
    !store.suspension &&
    isCardDue(welcome.record, visitedAt);
  if (gone || !(offered || claimed)) {
    return null;
  }

  const plural = pluralCategory(STARTER_CREDITS, locale);
  const count = new Intl.NumberFormat(locale).format(STARTER_CREDITS);
  const title = t(
    `store.welcome.${claimed ? 'cardClaimedTitle' : 'cardTitle'}.${plural}` as TranslationKey,
    { count },
  );

  return (
    <section
      className={`starter-card${claimed ? ' is-claimed' : ''}`}
      aria-labelledby="starter-card-title"
    >
      <img
        className="starter-card__glow"
        src={STARTER_COVERS[2].picture}
        alt=""
        aria-hidden="true"
      />
      <StarterCoin claimed={claimed} size="m" />
      <div className="starter-card__text">
        <h3 id="starter-card-title" className="starter-card__title">
          {title}
        </h3>
        <p className="starter-card__body">
          {t(
            claimed
              ? 'store.welcome.cardClaimedBody'
              : 'store.welcome.cardBody',
          )}
        </p>
        {failure && (
          <p className="gallery-dialog__error" role="alert">
            {t(failure)}
          </p>
        )}
      </div>
      <div className="starter-card__stack" aria-hidden="true">
        {STARTER_COVERS.map((cover) => (
          <img key={cover.id} src={cover.picture} alt="" />
        ))}
      </div>
      <div className="starter-card__actions">
        {claimed ? (
          <button
            type="button"
            className="button small subtle"
            onClick={() => setGone(true)}
          >
            {t('store.welcome.gotIt')}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="button small subtle"
              onClick={() => {
                welcome.putCardAway();
                setGone(true);
              }}
            >
              {t('store.welcome.later')}
            </button>
            <button
              type="button"
              className={`button small${phase === 'claiming' ? ' is-running' : ''}`}
              aria-busy={phase === 'claiming'}
              disabled={phase === 'claiming'}
              onClick={claim}
            >
              {t('store.starter.claim', {
                credits: creditsText(t, locale, STARTER_CREDITS),
              })}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
