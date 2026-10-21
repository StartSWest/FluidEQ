/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  formatDollars,
  owedShortCents,
  owedTotal,
  payoutSoon,
  yoursCents,
  type ICreatorPayoutPreview,
} from 'common/creatorPayouts';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import GalleryListNotice from './GalleryListNotice';
import { adoptPayoutPreview, putAwayPayoutDue } from './payoutDue';
import { INSIGHT_ERRORS } from './insightsFormat';
import '../styles/AdminServer.scss';
import '../styles/AdminPayouts.scss';

type TShown =
  | { state: 'asking' }
  | { state: 'failed'; key: TranslationKey }
  | { state: 'ready'; preview: ICreatorPayoutPreview };

/**
 * Paying creators (premium 0064, `run-creator-payouts`): what is at Stripe,
 * what is owed to creators, what is FluidEQ's, and who the next run pays.
 *
 * Only shown, never pressed (Ivan, 2026-10-21: "I wont do a manual" anything,
 * "I do want the money shown there"). The server pays creators on the 1st and
 * the 16th, then sends FluidEQ's share to its bank (0069), and never pays the
 * same cent twice.
 */
export default function AdminPayouts() {
  const { t, locale } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<TShown>({ state: 'asking' });
  const money = (cents: number) => formatDollars(cents, locale);
  const again = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    let current = true;
    setShown({ state: 'asking' });
    const asked = window.electron?.ipcRenderer?.previewCreatorPayouts?.();
    if (!asked) {
      setShown({ state: 'failed', key: INSIGHT_ERRORS.offline });
      return undefined;
    }
    asked
      .then((outcome) => {
        if (current) {
          setShown(
            outcome.ok
              ? { state: 'ready', preview: outcome.value }
              : { state: 'failed', key: INSIGHT_ERRORS[outcome.reason] },
          );
        }
        return undefined;
      })
      .catch(() => {
        if (current) {
          setShown({ state: 'failed', key: INSIGHT_ERRORS.offline });
        }
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  // What this page read is the newest word on what is owed, and the admin
  // looking at it is the reminder heard: the corner notice goes.
  useEffect(() => {
    if (shown.state === 'ready') {
      adoptPayoutPreview(shown.preview);
      putAwayPayoutDue();
    }
  }, [shown]);

  const preview = shown.state === 'ready' ? shown.preview : undefined;
  const short =
    preview?.availableCents !== undefined &&
    preview.availableCents < preview.totalCents;
  const count = preview?.due.length ?? 0;
  const numbers = new Intl.NumberFormat(locale);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  // Close enough to tell: the line turns amber, as the corner notice shows.
  const soon = preview ? payoutSoon(preview, Date.now()) : false;
  const owed = preview ? owedTotal(preview) : undefined;
  const yours = preview ? yoursCents(preview) : undefined;
  const owedShort = preview ? owedShortCents(preview) : undefined;
  let schedule: string | undefined;
  if (preview) {
    const last =
      preview.lastPaidAt === undefined
        ? t('creator.admin.neverPaid')
        : t('creator.admin.lastPaid', {
            date: dates.format(preview.lastPaidAt),
          });
    const next =
      preview.nextRunAt === undefined
        ? ''
        : t('creator.admin.nextDue', { date: dates.format(preview.nextRunAt) });
    schedule = next ? `${last} · ${next}` : last;
  }

  return (
    <div className="gallery-page admin-server admin-payouts">
      <div className="admin-server__bar">
        <span className="admin-server__plan">
          <Glyph name="payout" />
          {t('creator.admin.plan')}
        </span>
        {/* Paid by themselves on the 1st and the 16th (Ivan, 2026-10-21):
            when the last payout went, and when the next one goes. */}
        {schedule && (
          <span
            className={`admin-server__measured${soon ? ' admin-payouts__due' : ''}`}
          >
            {schedule}
          </span>
        )}
        <button
          type="button"
          className={`button small subtle admin-accounts__refresh${shown.state === 'asking' ? ' is-running' : ''}`}
          aria-busy={shown.state === 'asking'}
          onClick={again}
        >
          <Glyph name="refresh" />
          {t('plus.accounts.refresh')}
        </button>
      </div>

      {shown.state === 'failed' && (
        <GalleryListNotice text={t(shown.key)} onRetry={again} />
      )}

      {shown.state === 'asking' && (
        <div
          className="admin-server__gauges"
          role="status"
          aria-label={t('creator.admin.loading')}
        >
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="admin-server__skeleton" />
          ))}
        </div>
      )}

      {preview && (
        <>
          {/* What of the balance is FluidEQ's (Ivan, 2026-10-21: "we need to be
              able to tell before expending stripe money how much I owe to
              creators"): owed, at Stripe, yours, and the next payout. */}
          <div className="admin-server__gauges admin-payouts__gauges">
            <section className="admin-server__gauge">
              <h3 className="account-deletion__eyebrow">
                {t('creator.admin.owed')}
              </h3>
              <p className="admin-server__value">
                <strong>{owed === undefined ? '—' : money(owed)}</strong>
              </p>
              {preview.owed && (
                <span className="admin-server__share">
                  {t('creator.admin.owedNote', {
                    held: money(preview.owed.heldCents),
                    ready: money(preview.owed.readyCents),
                  })}
                  {preview.owed.sendingCents > 0 &&
                    ` · ${t('creator.admin.sending', {
                      amount: money(preview.owed.sendingCents),
                    })}`}
                </span>
              )}
            </section>
            <section className="admin-server__gauge">
              <h3 className="account-deletion__eyebrow">
                {t('creator.admin.available')}
              </h3>
              <p className="admin-server__value">
                <strong>
                  {preview.availableCents === undefined
                    ? '—'
                    : money(preview.availableCents)}
                </strong>
              </p>
              <span className="admin-server__share">
                {preview.pendingCents
                  ? t('creator.admin.onItsWay', {
                      amount: money(preview.pendingCents),
                    })
                  : t('creator.admin.availableNote')}
              </span>
            </section>
            <section
              className={`admin-server__gauge${owedShort ? ' is-full' : ''}`}
            >
              <h3 className="account-deletion__eyebrow">
                {t('creator.admin.yours')}
              </h3>
              <p className="admin-server__value">
                <strong>{yours === undefined ? '—' : money(yours)}</strong>
              </p>
              <span className="admin-server__share">
                {owedShort
                  ? t('creator.admin.yoursShort', { amount: money(owedShort) })
                  : t('creator.admin.yoursNote', {
                      reserve: money(preview.reserveCents ?? 0),
                    })}
              </span>
              {preview.lastOwnerPayout && (
                <span className="admin-server__share">
                  {t('creator.admin.lastToYou', {
                    amount: money(preview.lastOwnerPayout.amountCents),
                    date: dates.format(preview.lastOwnerPayout.at),
                  })}
                </span>
              )}
            </section>
            <section
              className={`admin-server__gauge${short ? ' is-warn' : ''}`}
            >
              <h3 className="account-deletion__eyebrow">
                {t('creator.admin.next')}
              </h3>
              <p className="admin-server__value">
                <strong>{money(preview.totalCents)}</strong>
                <span>
                  {t('creator.admin.creators', {
                    count: numbers.format(count),
                  })}
                </span>
              </p>
              {preview.nextRunAt !== undefined && (
                <span className="admin-server__share">
                  {dates.format(preview.nextRunAt)}
                </span>
              )}
            </section>
          </div>

          {/* Stripe sweeping the balance to the bank on a schedule takes the
              creators' money with FluidEQ's, and holds back the server's own
              transfer of FluidEQ's share (0069). Said only while it is so. */}
          {preview.ownPayouts !== undefined &&
            preview.ownPayouts !== 'manual' && (
              <p className="admin-server__quiet is-alert">
                <Glyph name="alert" />
                <span>{t('creator.admin.manual')}</span>
              </p>
            )}

          {preview.pending > 0 && (
            <p className="admin-server__quiet is-alert">
              <Glyph name="alert" />
              <span>
                {t('creator.admin.pendingLine', {
                  count: numbers.format(preview.pending),
                })}
              </span>
            </p>
          )}

          {short && (
            <p className="admin-server__quiet is-alert">
              <Glyph name="alert" />
              <span>{t('creator.admin.short')}</span>
            </p>
          )}

          <section className="admin-server__card">
            <h3 className="account-deletion__eyebrow">
              {t('creator.admin.list')}
            </h3>
            {count === 0 ? (
              <p className="admin-server__quiet">{t('creator.admin.none')}</p>
            ) : (
              <ul className="admin-server__list admin-payouts__list">
                {preview.due.map((row) => (
                  <li key={row.creatorId}>
                    <span className="admin-server__name" title={row.creatorId}>
                      {row.handle ? `@${row.handle}` : row.creatorId}
                    </span>
                    <span className="admin-server__size">
                      {money(row.readyCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="gallery-fine admin-server__rules">
        {t('creator.admin.rules')}
      </p>
    </div>
  );
}
