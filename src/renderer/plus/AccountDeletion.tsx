/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FormEvent, useId, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  accountAddress,
  isAccountAddress,
  type IAccountToDelete,
} from 'common/accountDeletion';
import type { TAccountDeletionFailure } from 'main/plus/accountDeletionApi';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import AccountDeletionCard from './AccountDeletionCard';
import GalleryListNotice from './GalleryListNotice';
import '../styles/AccountDeletion.scss';

const FIND_ERRORS: Record<TAccountDeletionFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
  forbidden: 'plus.accounts.error.forbidden',
  invalid: 'plus.accounts.error.invalid',
};

type TSearch =
  | { state: 'idle' }
  | { state: 'loading'; email: string }
  | { state: 'ready'; email: string; accounts: IAccountToDelete[] }
  | { state: 'failed'; email: string; key: TranslationKey }
  | { state: 'deleted'; email: string; files: number; gifted: boolean };

const bridge = () => window.electron?.ipcRenderer;

/**
 * The admin's account deletion: what the Plus terms promise somebody who asks
 * for their account to be deleted — the account gone, with its profile,
 * leaderboard days, membership, agreements, likes, adds, reports and the
 * scenes it published with their files.
 *
 * Found first, deleted second: the address finds the account, and the card
 * says who it is and what goes with it before Delete is offered, so a typo
 * never deletes the wrong person. Everything that decides — who the admin is,
 * which accounts may go, what goes with them — is the server's (premium
 * migration 0031); this page only asks.
 */
export default function AccountDeletion() {
  const { t, locale } = useTranslation();
  const ids = useId();
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState<TSearch>({ state: 'idle' });
  // Only the newest search may answer: an older one arriving late would put
  // the wrong account under the address being looked at.
  const asked = useRef(0);

  const valid = isAccountAddress(email);
  const loading = search.state === 'loading';

  const find = (address: string) => {
    asked.current += 1;
    const ask = asked.current;
    setSearch({ state: 'loading', email: address });
    const answer = bridge()?.findAccountsToDelete?.(address);
    if (!answer) {
      setSearch({
        state: 'failed',
        email: address,
        key: 'plus.gallery.error.offline',
      });
      return;
    }
    answer
      .then((outcome) => {
        if (ask === asked.current) {
          setSearch(
            outcome.ok
              ? { state: 'ready', email: address, accounts: outcome.accounts }
              : {
                  state: 'failed',
                  email: address,
                  key: FIND_ERRORS[outcome.reason],
                },
          );
        }
        return undefined;
      })
      .catch(() => {
        if (ask === asked.current) {
          setSearch({
            state: 'failed',
            email: address,
            key: 'plus.gallery.error.offline',
          });
        }
      });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // A search still out does not hold the form: a corrected address, or a
    // second try while the first hangs, asks again, and only it answers.
    if (valid) {
      find(accountAddress(email));
    }
  };

  return (
    <div className="gallery-page account-deletion">
      <div className="account-deletion__intro">
        <span className="account-deletion__mark" aria-hidden="true">
          <Glyph name="person" />
        </span>
        <p className="gallery-fine">{t('plus.accounts.hint')}</p>
      </div>

      <form className="account-deletion__search" onSubmit={submit} noValidate>
        <label className="account-deletion__field" htmlFor={`${ids}-email`}>
          <span className="account-deletion__label">
            {t('plus.accounts.field.email')}
          </span>
          <input
            id={`${ids}-email`}
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className={`button small account-deletion__find${loading ? ' is-running' : ''}`}
          disabled={!valid}
          aria-busy={loading}
        >
          <Glyph name="person" />
          {t('plus.accounts.find')}
        </button>
        <p className="account-deletion__search-hint">
          {t('plus.accounts.searchHint')}
        </p>
      </form>

      <div className="account-deletion__results" aria-live="polite">
        {search.state === 'loading' && (
          <span
            className="account-deletion__card account-deletion__card--skeleton"
            role="status"
            aria-label={t('plus.gallery.loading')}
          />
        )}

        {search.state === 'failed' && (
          <GalleryListNotice
            text={t(search.key)}
            onRetry={() => find(search.email)}
          />
        )}

        {search.state === 'ready' && search.accounts.length === 0 && (
          <div className="community__empty gallery-empty">
            <span className="community__empty-mark" aria-hidden="true">
              <Glyph name="person" />
            </span>
            <p className="community__empty-title">
              {t('plus.accounts.none', { email: search.email })}
            </p>
            <p className="community__empty-hint">
              {t('plus.accounts.noneHint')}
            </p>
          </div>
        )}

        {search.state === 'ready' &&
          search.accounts.map((account) => (
            <AccountDeletionCard
              key={account.userId}
              account={account}
              onDeleted={(files) =>
                setSearch({
                  state: 'deleted',
                  email: account.email,
                  files,
                  gifted: search.accounts.some((found) => found.gifted),
                })
              }
            />
          ))}

        {search.state === 'deleted' && (
          <div className="account-deletion__done" role="status">
            <span className="account-deletion__done-mark" aria-hidden="true">
              <Glyph name="check" />
            </span>
            <span className="account-deletion__done-text">
              <span className="account-deletion__done-title">
                {t('plus.accounts.done.title', { email: search.email })}
              </span>
              <span className="account-deletion__done-body">
                {t('plus.accounts.done.body', {
                  count: new Intl.NumberFormat(locale).format(search.files),
                })}
              </span>
              {search.gifted && (
                <span className="account-deletion__done-body">
                  {t('plus.accounts.note.gift')}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
