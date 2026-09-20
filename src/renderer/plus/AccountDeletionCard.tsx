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
import AccountGiftButton from './AccountGiftButton';
import '../styles/AccountDeletion.scss';

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

interface IAccountDeletionProps {
  account: IAccountToDelete;
  /** The account is gone, with this many files. */
  onDeleted: (files: number) => void;
  /**
   * Plus was given to this account, so whatever holds the row reads it
   * again: its plan and its gift note are the server's to say.
   */
  onGiven?: () => void;
}

const bridge = () => window.electron?.ipcRenderer;

/** The name an account goes by: its chosen name, its handle, or its address. */
export const accountName = (account: IAccountToDelete) =>
  account.displayName ?? account.handle ?? account.email;

/** An account's Plus in words: paid until a date, given, or none. */
export const useAccountPlan = (account: IAccountToDelete): string => {
  const { t, locale } = useTranslation();
  if (account.plusUntil === undefined) {
    return t('plus.accounts.plan.none');
  }
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    account.plusUntil,
  );
  if (account.plan !== GIFT_PLAN) {
    return t('plus.accounts.plan.paid', { date });
  }
  return account.plusUntil < GIFT_FOREVER_AFTER
    ? t('plus.accounts.plan.giftUntil', { date })
    : t('plus.accounts.plan.gift');
};

/**
 * What goes with an account, and Delete behind a second press that names who
 * is about to go: under the account's row in the admin's list, and inside the
 * card of an account already gone.
 */
export function AccountDeletionBody({
  account,
  onDeleted,
  onGiven,
}: IAccountDeletionProps) {
  const { t, locale } = useTranslation();
  // One question at a time in this footer: two open at once would be two
  // sentences about the same account asking for opposite things.
  const [asking, setAsking] = useState<'none' | 'delete' | 'gift'>('none');
  const confirming = asking === 'delete';
  const setConfirming = (open: boolean) => setAsking(open ? 'delete' : 'none');
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<TranslationKey>();
  // A Delete that stopped part way here is as unfinished as one the server
  // reported when the account was found.
  const [unfinished, setUnfinished] = useState(account.deleting);

  const numbers = new Intl.NumberFormat(locale);
  const gone = account.createdAt === undefined;
  const name = accountName(account);
  // An account that is there, has no Plus of any kind, and is somebody
  // else's: the admin's own is not gifted from here.
  const canGive =
    !gone && !account.admin && account.plusUntil === undefined && !!onGiven;

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
    // What an earlier attempt left; an attempt made here says so in its
    // failure line instead.
    note = { tone: 'warning', key: 'plus.accounts.note.deleting' };
  }

  return (
    <div
      className={`account-deletion__body${confirming ? ' is-confirming' : ''}`}
    >
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
                  className={`button small danger${working ? ' is-running' : ''}`}
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
              {/* Plus given from here rather than by typing the address on
                  the gifts page. Only to an account that has none: giving a
                  gift to somebody already paying changes nothing they can
                  see, and one that already has a gift says so in the note
                  above — the gifts page is where a gift is taken back. */}
              {canGive && (
                <AccountGiftButton
                  account={account}
                  name={name}
                  asking={asking === 'gift'}
                  onAsk={(open) => setAsking(open ? 'gift' : 'none')}
                  onGiven={() => onGiven?.()}
                />
              )}
              {asking !== 'gift' && (
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
              )}
            </>
          )}
        </footer>
      )}
    </div>
  );
}

/**
 * One account as a card of its own: who it is, then what goes with it and
 * Delete. What the admin's list shows for an account that is already gone but
 * whose deletion did not finish — the list is built from the accounts that
 * exist, so it has no row for one.
 */
export default function AccountDeletionCard({
  account,
  onDeleted,
  onGiven,
}: IAccountDeletionProps) {
  const { t, locale } = useTranslation();
  const plan = useAccountPlan(account);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const gone = account.createdAt === undefined;
  const name = accountName(account);

  return (
    <article
      className={`account-deletion__card${account.admin ? ' is-admin' : ''}`}
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
      <AccountDeletionBody
        account={account}
        onDeleted={onDeleted}
        onGiven={onGiven}
      />
    </article>
  );
}
