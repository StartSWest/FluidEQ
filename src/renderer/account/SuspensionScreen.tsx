/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import type { IAccountSuspension } from 'common/accountSuspension';
import { formatDollars } from 'common/creatorPayouts';
import DialogFrame from '../components/DialogFrame';
import MenuIcon from '../icons/MenuIcon';
import { requestSuspensionRefund, useSceneStore } from '../plus/sceneStore';
import { useTranslation } from '../utils/I18nContext';
import { pluralCategory } from '../utils/pluralCategory';
import { signOutAccount, useAccount } from './accountStore';
import '../styles/SuspensionScreen.scss';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days left to the deletion, and how much of the suspension has run, from
 * the instant this was drawn. Read again whenever the store comes back from
 * the server — at every focus — which is as often as a day can change.
 */
const countdown = (suspension: IAccountSuspension, now: number) => {
  const from = Date.parse(suspension.windowTo);
  const to = Date.parse(suspension.deletesAt);
  const left = Math.max(0, Math.ceil((to - now) / DAY_MS));
  const run =
    to > from ? Math.min(1, Math.max(0, (now - from) / (to - from))) : 1;
  return { left, run };
};

/**
 * What a suspended account sees while it is signed in (premium 0105,
 * Ivan's words, 2026-11-12): why, until when it may ask for its money, and
 * the one ask it has. Nothing else of the account can be reached from here,
 * so there is no close — only signing out, which leaves FluidEQ as it is for
 * anyone without an account, the equalizer and the free looks included.
 *
 * Mounted at the window's root, above everything a person opened on purpose
 * and under the first-run gate, which nobody has passed yet when this could
 * show. Asking is the recommendation while there is money to ask for, and
 * wears the loud style; once asked, signing out is all that is left.
 */
export default function SuspensionScreen() {
  const { t, locale } = useTranslation();
  const account = useAccount();
  const { store } = useSceneStore();
  const suspension =
    account.status === 'signed-in' ? store?.suspension : undefined;
  const [isAsking, setIsAsking] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = suspension !== undefined;

  // Announced when it appears; it has nothing else to put the focus on.
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  const dates = useMemo(() => {
    const day = new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
    });
    return suspension
      ? {
          from: day.format(new Date(suspension.windowFrom)),
          to: day.format(new Date(suspension.windowTo)),
          until: day.format(new Date(suspension.deletesAt)),
        }
      : undefined;
  }, [suspension, locale]);

  if (!suspension || !dates) {
    return null;
  }

  // The store is the server's answer of a moment ago, so the moment it is
  // drawn is the moment to count from; a redraw comes with every store.
  const { left, run } = countdown(suspension, Date.now());
  const amount = formatDollars(suspension.refundCents, locale);
  const asked = suspension.refundRequestedAt !== undefined;
  const canAsk = !asked && suspension.refundCents > 0 && left > 0;

  let lead: string;
  if (asked) {
    lead = t('account.suspended.bodyAsked');
  } else if (suspension.refundCents > 0) {
    lead = t('account.suspended.body', dates);
  } else {
    lead = t('account.suspended.bodyNothing', { until: dates.until });
  }

  const ask = () => {
    if (isAsking) {
      return;
    }
    setIsAsking(true);
    setHasFailed(false);
    requestSuspensionRefund()
      .then((outcome) => setHasFailed(!outcome.ok))
      .catch(() => setHasFailed(true))
      .finally(() => setIsAsking(false));
  };

  const signOut = () => {
    signOutAccount().catch(() => undefined);
  };

  return (
    <div className="suspension-backdrop" role="presentation">
      <DialogFrame
        ref={dialogRef}
        className="suspension-screen"
        tabIndex={-1}
        icon={<MenuIcon name="lock" />}
        eyebrow={t('account.suspended.eyebrow')}
        title={t('account.suspended.title')}
        titleId="suspension-screen-title"
        aria-describedby="suspension-screen-lead"
        rail={
          !asked && (
            <div className="suspension-screen__countdown">
              <span className="suspension-screen__days">
                {t(
                  `account.suspended.daysLeft.${pluralCategory(left, locale)}`,
                  { count: String(left) },
                )}
              </span>
              <span className="suspension-screen__track" role="presentation">
                <span
                  className="suspension-screen__run"
                  style={{ width: `${Math.round(run * 100)}%` }}
                />
              </span>
              <span className="suspension-screen__until">
                {t('account.suspended.until', { date: dates.until })}
              </span>
            </div>
          )
        }
        footer={
          <div className="dialog-frame__actions">
            <button
              type="button"
              className={canAsk ? 'button small subtle' : 'button small'}
              onClick={signOut}
            >
              {t('account.signOut')}
            </button>
            {canAsk && (
              <button
                type="button"
                className={`button small${isAsking ? ' is-running' : ''}`}
                aria-busy={isAsking}
                onClick={ask}
              >
                {t('account.suspended.ask')}
              </button>
            )}
          </div>
        }
      >
        <div className="suspension-screen__body">
          <p id="suspension-screen-lead" className="suspension-screen__lead">
            {lead}
          </p>
          {asked && (
            <p className="suspension-screen__asked" role="status">
              <MenuIcon name="check" />
              <span>
                {t('account.suspended.asked', {
                  amount,
                  date: dates.until,
                })}
              </span>
            </p>
          )}
          {!asked && suspension.refundCents > 0 && (
            <div className="suspension-screen__amount">
              <span>{t('account.suspended.paid')}</span>
              <strong>{amount}</strong>
            </div>
          )}
          {suspension.maker && (
            <p className="suspension-screen__maker">
              {t('account.suspended.maker')}
            </p>
          )}
          {hasFailed && (
            <p className="suspension-screen__failed" role="alert">
              {t('account.suspended.failed')}
            </p>
          )}
        </div>
      </DialogFrame>
    </div>
  );
}
