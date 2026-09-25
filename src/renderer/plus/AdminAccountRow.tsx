/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { IAccountToDelete } from 'common/accountDeletion';
import { useTranslation } from '../utils/I18nContext';
import {
  AccountDeletionBody,
  accountName,
  useAccountPlan,
} from './AccountDeletionCard';

/**
 * Counted as here now.
 *
 * A signed-in FluidEQ renews its hour-long token when it next needs one, so
 * the sign-in service hears from a computer that is being used at least that
 * often and from one that is not at all. An hour is therefore the finest this
 * can honestly be: the app reports no heartbeat, and it is not going to start.
 */
const ONLINE_WITHIN_MS = 60 * 60 * 1000;

interface IAdminAccountRowProps {
  account: IAccountToDelete;
  open: boolean;
  onToggle: () => void;
  onDeleted: (files: number) => void;
  /** Plus was given from this row; the list is read again. */
  onGiven: () => void;
}

/**
 * One account: who it is, when it joined, which FluidEQ it runs, whether it
 * is there now and its Plus on one line, which opens onto what the account
 * holds and Delete.
 *
 * The version and the last sign-in are read from the account's own sessions
 * and are the admin's alone — the server refuses the whole list to anybody
 * else, so there is no member-facing version of this row to keep them out of.
 */
export default function AdminAccountRow({
  account,
  open,
  onToggle,
  onDeleted,
  onGiven,
}: IAdminAccountRowProps) {
  const { t, locale } = useTranslation();
  const plan = useAccountPlan(account);
  const bodyId = useId();
  const name = accountName(account);
  const plus = account.plusUntil !== undefined;
  const online =
    account.seenAt !== undefined &&
    Date.now() - account.seenAt < ONLINE_WITHIN_MS;

  return (
    <li
      className={`admin-account${open ? ' is-open' : ''}${plus ? ' is-plus' : ''}`}
    >
      <button
        type="button"
        className="admin-account__head"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={onToggle}
      >
        <span className="admin-account__avatar" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="admin-account__who">
          <span className="admin-account__name">{name}</span>
          <span className="admin-account__meta">
            <span>
              {account.handle
                ? `@${account.handle}`
                : t('plus.accounts.noName')}
            </span>
            {account.email !== name && <span>{account.email}</span>}
            {account.createdAt !== undefined && (
              <span>
                {t('plus.accounts.joined', {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                  }).format(account.createdAt),
                })}
              </span>
            )}
            {!account.confirmed && (
              <span className="admin-account__unconfirmed">
                {t('plus.accounts.unconfirmed')}
              </span>
            )}
            {/* Nothing at all when the account has no session to read: an
                account already deleted has none, and so does every account
                until the server answers this. Better silent than wrong. */}
            {account.seenAt !== undefined && (
              <span
                className={`admin-account__seen${online ? ' is-online' : ''}`}
              >
                <span className="admin-account__dot" aria-hidden="true" />
                {online
                  ? t('plus.accounts.online')
                  : t('plus.accounts.lastSeen', {
                      date: new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(account.seenAt),
                    })}
              </span>
            )}
          </span>
        </span>
        <span className="admin-account__tags">
          {account.appVersion && (
            <span
              className="admin-account__tag is-version"
              title={t('plus.accounts.appVersion', {
                version: account.appVersion,
              })}
            >
              {account.appVersion}
            </span>
          )}
          {account.admin && (
            <span className="admin-account__tag is-admin">
              {t('plus.accounts.admin')}
            </span>
          )}
          <span className={`admin-account__tag${plus ? ' is-plus' : ''}`}>
            {plan}
          </span>
        </span>
        <span className="admin-account__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div id={bodyId} className="admin-account__body">
          <AccountDeletionBody
            account={account}
            onDeleted={onDeleted}
            onGiven={onGiven}
          />
        </div>
      )}
    </li>
  );
}
