/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IAccountToDelete } from 'common/accountDeletion';
import { GIFT_FOREVER_AFTER, GIFT_PLAN } from 'common/plusGifts';
import type { TDeleteAccountFailure } from 'main/plus/accountDeletionApi';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';

const DELETE_ERRORS: Record<TDeleteAccountFailure, TranslationKey> = {
  offline: 'plus.accounts.error.failed',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.accounts.error.failed',
  forbidden: 'plus.accounts.error.forbidden',
  invalid: 'plus.accounts.error.invalid',
  'admin-account': 'plus.accounts.note.admin',
  'no-account': 'plus.accounts.error.noAccount',
  unfinished: 'plus.accounts.error.unfinished',
};

interface IAccountDeletionCardProps {
  account: IAccountToDelete;
  /** The account is gone, with this many files. */
  onDeleted: (files: number) => void;
}

const bridge = () => window.electron?.ipcRenderer;

/**
 * One account the address found: who it is, what goes with it, and Delete
 * behind a second press that names who is about to go.
 */
export default function AccountDeletionCard({
  account,
  onDeleted,
}: IAccountDeletionCardProps) {
  const { t, locale } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<TranslationKey>();
  // A Delete that stopped part way on this page is as unfinished as one the
  // server reported when the account was found.
  const [unfinished, setUnfinished] = useState(account.deleting);

  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const numbers = new Intl.NumberFormat(locale);
  const gone = account.createdAt === undefined;
  const name = account.displayName ?? account.handle ?? account.email;

  let plan = t('plus.accounts.plan.none');
  if (account.plan === GIFT_PLAN && account.plusUntil !== undefined) {
    plan =
      account.plusUntil < GIFT_FOREVER_AFTER
        ? t('plus.accounts.plan.giftUntil', {
            date: dates.format(account.plusUntil),
          })
        : t('plus.accounts.plan.gift');
  } else if (account.plusUntil !== undefined) {
    plan = t('plus.accounts.plan.paid', {
      date: dates.format(account.plusUntil),
    });
  }

  const facts: Array<{ key: TranslationKey; value: number }> = [
    { key: 'plus.accounts.fact.published', value: account.published },
    { key: 'plus.accounts.fact.boardDays', value: account.boardDays },
    { key: 'plus.accounts.fact.likes', value: account.likes },
    { key: 'plus.accounts.fact.adds', value: account.adds },
    { key: 'plus.accounts.fact.reports', value: account.reports },
  ];

  const remove = () => {
    if (working) {
      return;
    }
    setFailure(undefined);
    const answer = bridge()?.deleteAccount?.(account.email);
    if (!answer) {
      setFailure('plus.accounts.error.failed');
      return;
    }
    setWorking(true);
    answer
      .then((outcome) => {
        setWorking(false);
        if (outcome.ok) {
          onDeleted(outcome.files);
          return undefined;
        }
        setConfirming(false);
        if (outcome.reason === 'unfinished') {
          setUnfinished(true);
        }
        setFailure(DELETE_ERRORS[outcome.reason]);
        return undefined;
      })
      .catch(() => {
        setWorking(false);
        setConfirming(false);
        setFailure('plus.accounts.error.failed');
      });
  };

  let note: { tone: string; key: TranslationKey } | undefined;
  if (account.admin) {
    note = { tone: 'warning', key: 'plus.accounts.note.admin' };
  } else if (gone) {
    note = { tone: 'warning', key: 'plus.accounts.note.gone' };
  } else if (account.deleting) {
    // What an earlier attempt left; this page's own attempt says so in its
    // failure line instead.
    note = { tone: 'warning', key: 'plus.accounts.note.deleting' };
  }

  return (
    <article
      className={`account-deletion__card${confirming ? ' is-confirming' : ''}${account.admin ? ' is-admin' : ''}`}
      aria-label={name}
    >
      <header className="account-deletion__who">
        <span className="account-deletion__avatar" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="account-deletion__identity">
          <span className="account-deletion__name">
            {gone ? account.email : name}
          </span>
          <span className="account-deletion__meta">
            {!gone && account.handle && <span>@{account.handle}</span>}
            {!gone && !account.handle && (
              <span>{t('plus.accounts.noName')}</span>
            )}
            {!gone && account.email !== name && <span>{account.email}</span>}
            {account.createdAt !== undefined && (
              <span>
                {t('plus.accounts.joined', {
                  date: dates.format(account.createdAt),
                })}
              </span>
            )}
            {!gone && !account.confirmed && (
              <span className="account-deletion__unconfirmed">
                {t('plus.accounts.unconfirmed')}
              </span>
            )}
          </span>
        </span>
        {!gone && (
          <span
            className={`account-deletion__plan${account.plusUntil !== undefined ? ' is-plus' : ''}`}
          >
            {plan}
          </span>
        )}
      </header>

      {!gone && !account.admin && (
        <section className="account-deletion__goes">
          <h3 className="account-deletion__eyebrow">
            {t('plus.accounts.goes')}
          </h3>
          <dl className="account-deletion__facts">
            {facts.map((fact) => (
              <div
                key={fact.key}
                className={fact.value === 0 ? 'is-zero' : undefined}
              >
                <dt>{t(fact.key)}</dt>
                <dd>{numbers.format(fact.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {note && (
        <p className={`account-deletion__note is-${note.tone}`}>
          <Glyph name="alert" />
          <span>{t(note.key)}</span>
        </p>
      )}
      {account.gifted && !gone && (
        <p className="account-deletion__note is-gift">
          <Glyph name="gift" />
          <span>{t('plus.accounts.note.gift')}</span>
        </p>
      )}

      {!account.admin && (
        <footer className="account-deletion__actions">
          {confirming ? (
            <>
              <span className="account-deletion__confirm">
                {t(
                  working ? 'plus.accounts.working' : 'plus.accounts.confirm',
                  { name },
                )}
              </span>
              {/* One group, so a narrow card wraps both answers to the next
                  line together instead of splitting Keep from Delete. */}
              <span className="account-deletion__answers">
                <button
                  type="button"
                  className="button small subtle"
                  disabled={working}
                  onClick={() => setConfirming(false)}
                >
                  {t('plus.accounts.keep')}
                </button>
                <button
                  type="button"
                  className={`button small gallery-danger${working ? ' is-running' : ''}`}
                  aria-busy={working}
                  onClick={remove}
                >
                  <Glyph name="delete" />
                  {t('plus.accounts.confirmYes')}
                </button>
              </span>
            </>
          ) : (
            <>
              {failure && (
                <span className="account-deletion__failure" role="alert">
                  {t(failure)}
                </span>
              )}
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  setFailure(undefined);
                  setConfirming(true);
                }}
              >
                <Glyph name="delete" />
                {t(
                  unfinished || gone
                    ? 'plus.accounts.finish'
                    : 'plus.accounts.delete',
                )}
              </button>
            </>
          )}
        </footer>
      )}
    </article>
  );
}
