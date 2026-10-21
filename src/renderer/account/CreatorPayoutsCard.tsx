/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  formatDollars,
  type ICreatorStatus,
  type TCreatorFailure,
} from 'common/creatorPayouts';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { CREATOR_ERRORS } from './creatorErrors';
import CreatorSignUpDialog from './CreatorSignUpDialog';
import { loadCreator, refreshCreator, useCreator } from './creatorStore';

type TStage = 'invite' | 'unfinished' | 'terms' | 'checking' | 'paid';

/** Where the creator is, from what the server last said. */
const stageOf = (status: ICreatorStatus): TStage => {
  const { account, terms } = status;
  if (!account) {
    return 'invite';
  }
  if (!account.detailsSubmitted) {
    return 'unfinished';
  }
  if (account.agreedVersion < terms.agreementVersion) {
    return 'terms';
  }
  return account.payoutsEnabled ? 'paid' : 'checking';
};

const LINES: Record<TStage, TranslationKey> = {
  invite: 'creator.invite',
  unfinished: 'creator.unfinished',
  terms: 'creator.newTerms',
  checking: 'creator.checking',
  paid: 'creator.paidLine',
};

type TCategory = 'one' | 'few' | 'many' | 'other';

const salesKey = (count: number, locale: string): TranslationKey => {
  const category = new Intl.PluralRules(locale).select(count);
  const known: TCategory =
    category === 'one' || category === 'few' || category === 'many'
      ? category
      : 'other';
  return `creator.sales.${known}`;
};

interface ICreatorPayoutsCardProps {
  /** Whose payouts these are. A different account starts the read again. */
  accountId: string;
}

/**
 * Getting paid for scenes, in the account panel (premium 0064): an invitation
 * until the creator signs up on Stripe's pages, then where that sign-up
 * stands, then what is ready, what is on hold and what was paid.
 *
 * Every number is the server's, and a server that cannot say leaves the card
 * out rather than drawing zeroes, which would read as earnings gone.
 */
export default function CreatorPayoutsCard({
  accountId,
}: ICreatorPayoutsCardProps) {
  const { t, locale } = useTranslation();
  const { status, accountId: asked } = useCreator();
  const [signingUp, setSigningUp] = useState(false);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState<'refresh' | 'dashboard'>();
  const [failure, setFailure] = useState<TCreatorFailure>();

  useEffect(() => {
    loadCreator(accountId).catch(() => undefined);
  }, [accountId]);

  if (!status || asked !== accountId) {
    return null;
  }

  const stage = stageOf(status);
  const money = (cents: number) => formatDollars(cents, locale);

  const checkAgain = () => {
    setBusy('refresh');
    setFailure(undefined);
    refreshCreator(accountId)
      .catch(() => undefined)
      .finally(() => setBusy(undefined));
  };

  const openDashboard = async () => {
    setBusy('dashboard');
    setFailure(undefined);
    const outcome = await window.electron?.ipcRenderer
      ?.openCreatorDashboard?.()
      .catch(() => undefined);
    setBusy(undefined);
    if (!outcome?.ok) {
      setFailure(outcome ? outcome.reason : 'offline');
    }
  };

  const asksStripe =
    stage === 'invite' || stage === 'unfinished' || stage === 'terms';
  let signUpLabel: TranslationKey = 'creator.setUp';
  if (stage === 'unfinished') {
    signUpLabel = 'creator.finish';
  } else if (stage === 'terms') {
    signUpLabel = 'creator.readTerms';
  }

  return (
    <section className="creator-card" aria-labelledby="creator-card-title">
      <div className="maker-card__head">
        <span id="creator-card-title" className="plus-card__eyebrow">
          {t('creator.title')}
        </span>
        {stage === 'paid' && (
          <span className="plus-card__badge">{t('creator.badge.active')}</span>
        )}
        {stage === 'checking' && (
          <span className="plus-card__badge plus-card__badge--ending">
            {t('creator.badge.checking')}
          </span>
        )}
      </div>

      {stage === 'paid' && (
        <dl className="creator-card__figures">
          <div className="creator-card__figure is-ready">
            <dt>{t('creator.ready')}</dt>
            <dd>{money(Math.max(0, status.readyCents))}</dd>
          </div>
          <div className="creator-card__figure">
            <dt>{t('creator.held')}</dt>
            <dd>{money(Math.max(0, status.heldCents))}</dd>
          </div>
          <div className="creator-card__figure">
            <dt>{t('creator.paid')}</dt>
            <dd>{money(status.paidCents)}</dd>
          </div>
        </dl>
      )}

      <p className="plus-card__line">
        {t(LINES[stage], {
          share: String(status.terms.sharePercent),
          sales: t(salesKey(status.sales, locale), {
            count: new Intl.NumberFormat(locale).format(status.sales),
          }),
        })}
      </p>

      {opened && asksStripe && (
        <p className="creator-card__opened">
          <Glyph name="link" />
          <span>{t('creator.opened')}</span>
        </p>
      )}

      <div className="credits-card__actions">
        {asksStripe && (
          // Loud once begun: finishing is what the card recommends. An
          // invitation is only that, so it stays quiet.
          <button
            type="button"
            className={`button small creator-action${stage === 'invite' ? ' subtle' : ''}`}
            onClick={() => setSigningUp(true)}
          >
            <Glyph name="payout" />
            {t(signUpLabel)}
          </button>
        )}
        {(stage === 'checking' || (opened && asksStripe)) && (
          <button
            type="button"
            className={`button small subtle creator-action${busy === 'refresh' ? ' is-running' : ''}`}
            disabled={busy !== undefined}
            aria-busy={busy === 'refresh'}
            onClick={checkAgain}
          >
            <Glyph name="refresh" />
            {t('creator.checkAgain')}
          </button>
        )}
        {(stage === 'paid' || stage === 'checking') && (
          <button
            type="button"
            className="button small subtle creator-action"
            disabled={busy !== undefined}
            aria-busy={busy === 'dashboard'}
            onClick={() => {
              openDashboard().catch(() => undefined);
            }}
          >
            <Glyph name="link" />
            {t('creator.dashboard')}
          </button>
        )}
      </div>

      {failure && (
        <p className="account__error" role="alert">
          {t(CREATOR_ERRORS[failure])}
        </p>
      )}

      {stage === 'paid' && (
        <p className="plus-card__hint">
          {t('creator.paidHint', {
            days: String(status.terms.holdDays),
            amount: money(status.terms.minimumCents),
          })}
        </p>
      )}

      {signingUp && (
        <CreatorSignUpDialog
          terms={status.terms}
          askCountry={!status.account}
          onClose={() => setSigningUp(false)}
          onOpened={() => {
            setSigningUp(false);
            setOpened(true);
          }}
        />
      )}
    </section>
  );
}
