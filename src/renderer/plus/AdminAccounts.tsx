/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  accountAddress,
  isAccountAddress,
  type IAccountToDelete,
} from 'common/accountDeletion';
import {
  ACCOUNT_PLAN_FILTERS,
  MAX_ACCOUNT_QUERY,
  type IAccountListPage,
  type IAccountListRequest,
  type TAccountPlanFilter,
} from 'common/adminAccounts';
import type {
  TAccountListFailure,
  TAccountListOutcome,
} from 'main/plus/adminAccountsApi';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import AccountDeletionCard from './AccountDeletionCard';
import AdminAccountRow from './AdminAccountRow';
import GalleryListNotice from './GalleryListNotice';
import '../styles/Admin.scss';

const LIST_ERRORS: Record<TAccountListFailure, TranslationKey> = {
  offline: 'plus.accounts.error.offline',
  'signed-out': 'plus.accounts.error.signedOut',
  server: 'plus.accounts.error.server',
  // Nothing typed here is refused: the search is cut to what the server takes.
  invalid: 'plus.accounts.error.server',
  forbidden: 'plus.accounts.error.list',
  'not-deployed': 'plus.accounts.error.notDeployed',
};

const FILTER_LABELS: Record<TAccountPlanFilter, TranslationKey> = {
  all: 'plus.accounts.filter.all',
  plus: 'plus.accounts.filter.plus',
  free: 'plus.accounts.filter.free',
};

const EMPTY: Record<TAccountPlanFilter, TranslationKey> = {
  all: 'plus.accounts.empty.none',
  plus: 'plus.accounts.empty.plus',
  free: 'plus.accounts.empty.free',
};

interface IAsk {
  query: string;
  plan: TAccountPlanFilter;
}

/** The accounts on screen, and the question they answer. */
interface IShown extends IAccountListPage {
  ask: IAsk;
}

interface IDeleted {
  email: string;
  files: number;
  gifted: boolean;
}

const bridge = () => window.electron?.ipcRenderer;

/** One page, with a bridge that is missing or throws read as being offline. */
const requestPage = async (
  request: IAccountListRequest,
): Promise<TAccountListOutcome> => {
  try {
    return (
      (await bridge()?.listAccounts?.(request)) ?? {
        ok: false,
        reason: 'offline',
      }
    );
  } catch {
    return { ok: false, reason: 'offline' };
  }
};

/**
 * Accounts already gone whose deletion did not finish. The list is built from
 * the accounts that exist, so it cannot show one; the address search still
 * finds it, and a whole address typed here asks it too.
 */
const findLeftovers = async (address: string): Promise<IAccountToDelete[]> => {
  try {
    const outcome = await bridge()?.findAccountsToDelete?.(address);
    return outcome?.ok
      ? outcome.accounts.filter((account) => account.createdAt === undefined)
      : [];
  } catch {
    return [];
  }
};

/**
 * Every account, for the admin: newest first, found by any part of the
 * address, the handle or the name, narrowed to those with Plus or without,
 * with how many there are of each. An account opens in place onto what it
 * holds and Delete — the deletion the Plus terms promise, as it was when an
 * address was the only way to find one.
 *
 * The search asks as the admin types, one question at a time: while an answer
 * is on its way the typing piles up, and the moment it lands the latest text
 * is asked. What is on screen stays, dimmed, until the answer replaces it.
 */
export default function AdminAccounts() {
  const { t, locale } = useTranslation();
  const [text, setText] = useState('');
  const [ask, setAsk] = useState<IAsk>({ query: '', plan: 'all' });
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<IShown>();
  const [asking, setAsking] = useState(true);
  const [failure, setFailure] = useState<TranslationKey>();
  const [more, setMore] = useState<'idle' | 'asking' | 'failed'>('idle');
  const [leftovers, setLeftovers] = useState<IAccountToDelete[]>([]);
  const [openId, setOpenId] = useState<string>();
  const [deleted, setDeleted] = useState<IDeleted>();
  // Only the newest question may answer: a slower one landing late would put
  // an older search's accounts under the newest one.
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;
    setAsking(true);
    setFailure(undefined);
    setDeleted(undefined);
    requestPage({ ...ask, offset: 0 })
      .then((outcome) => {
        if (mine !== generation.current) {
          return undefined;
        }
        setAsking(false);
        if (outcome.ok) {
          setShown({ ...outcome.page, ask });
          setMore('idle');
        } else {
          setFailure(LIST_ERRORS[outcome.reason]);
        }
        return undefined;
      })
      .catch(() => undefined);
  }, [ask, attempt]);

  const wanted = text.trim();
  useEffect(() => {
    if (!asking && wanted !== ask.query) {
      setAsk((current) => ({ ...current, query: wanted }));
    }
  }, [asking, wanted, ask.query]);

  useEffect(() => {
    if (!isAccountAddress(ask.query)) {
      setLeftovers([]);
      return undefined;
    }
    let current = true;
    findLeftovers(accountAddress(ask.query))
      .then((found) => {
        if (current) {
          setLeftovers(found);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [ask.query]);

  const refresh = () => setAttempt((count) => count + 1);

  const choosePlan = (plan: TAccountPlanFilter) => {
    setOpenId(undefined);
    setAsk((current) =>
      current.plan === plan ? current : { ...current, plan },
    );
  };

  const loadMore = () => {
    if (!shown || more === 'asking') {
      return;
    }
    const mine = generation.current;
    setMore('asking');
    requestPage({ ...shown.ask, offset: shown.accounts.length })
      .then((outcome) => {
        if (mine !== generation.current) {
          return undefined;
        }
        if (!outcome.ok) {
          setMore('failed');
          return undefined;
        }
        setMore('idle');
        setShown((current) => {
          if (!current) {
            return current;
          }
          // An account made while paging pushes the rest down a place: the
          // one pushed over a page's edge arrives twice, and is kept once.
          const known = new Set(current.accounts.map((row) => row.userId));
          return {
            ...outcome.page,
            ask: current.ask,
            accounts: [
              ...current.accounts,
              ...outcome.page.accounts.filter((row) => !known.has(row.userId)),
            ],
          };
        });
        return undefined;
      })
      .catch(() => undefined);
  };

  const onDeleted = (account: IAccountToDelete, files: number) => {
    setDeleted({ email: account.email, files, gifted: account.gifted });
    setOpenId(undefined);
    setLeftovers((current) =>
      current.filter((row) => row.userId !== account.userId),
    );
    setShown((current) => {
      if (
        !current ||
        !current.accounts.some((row) => row.userId === account.userId)
      ) {
        return current;
      }
      return {
        ...current,
        accounts: current.accounts.filter(
          (row) => row.userId !== account.userId,
        ),
        matched: Math.max(0, current.matched - 1),
        paying:
          account.plusUntil === undefined
            ? current.paying
            : Math.max(0, current.paying - 1),
        listed: Math.max(0, current.listed - 1),
      };
    });
  };

  const numbers = new Intl.NumberFormat(locale);
  const share = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  });
  const counts: Record<TAccountPlanFilter, number> | undefined = shown && {
    all: shown.matched,
    plus: shown.paying,
    free: shown.matched - shown.paying,
  };
  const dimmed = asking && shown !== undefined;

  let empty = t('plus.accounts.empty.none');
  if (shown?.ask.query) {
    empty = t('plus.accounts.empty.search', { query: shown.ask.query });
  } else if (shown) {
    empty = t(EMPTY[shown.ask.plan]);
  }

  return (
    <div className="gallery-page admin-accounts">
      <div className="admin-accounts__bar">
        <div className="gallery-search admin-accounts__search">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="search"
            value={text}
            maxLength={MAX_ACCOUNT_QUERY}
            spellCheck={false}
            autoComplete="off"
            placeholder={t('plus.accounts.search')}
            aria-label={t('plus.accounts.search')}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <button
          type="button"
          className={`button small subtle admin-accounts__refresh${asking ? ' is-running' : ''}`}
          aria-busy={asking}
          onClick={refresh}
        >
          <Glyph name="refresh" />
          {t('plus.accounts.refresh')}
        </button>
      </div>

      <div
        className="admin-accounts__stats"
        role="group"
        aria-label={t('plus.accounts.filter')}
      >
        {ACCOUNT_PLAN_FILTERS.map((filter) => {
          const value = counts?.[filter];
          const part =
            filter !== 'all' &&
            shown &&
            shown.matched > 0 &&
            value !== undefined
              ? share.format(value / shown.matched)
              : undefined;
          return (
            <button
              key={filter}
              type="button"
              className={`admin-accounts__stat is-${filter}`}
              aria-pressed={ask.plan === filter}
              onClick={() => choosePlan(filter)}
            >
              <span className="admin-accounts__stat-label">
                {t(FILTER_LABELS[filter])}
              </span>
              <span className="admin-accounts__stat-figures">
                {value === undefined && asking && (
                  <span className="admin-accounts__stat-value is-waiting" />
                )}
                {value === undefined && !asking && (
                  <span className="admin-accounts__stat-value is-unknown">
                    –
                  </span>
                )}
                {value !== undefined && (
                  <span className="admin-accounts__stat-value">
                    {numbers.format(value)}
                  </span>
                )}
                {part && (
                  <span className="admin-accounts__stat-share">{part}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="gallery-fine">{t('plus.accounts.listHint')}</p>

      {deleted && (
        <div className="account-deletion__done" role="status">
          <span className="account-deletion__done-mark" aria-hidden="true">
            <Glyph name="check" />
          </span>
          <span className="account-deletion__done-text">
            <span className="account-deletion__done-title">
              {t('plus.accounts.done.title', { email: deleted.email })}
            </span>
            <span className="account-deletion__done-body">
              {t('plus.accounts.done.body', {
                count: numbers.format(deleted.files),
              })}
            </span>
            {deleted.gifted && (
              <span className="account-deletion__done-body">
                {t('plus.accounts.note.gift')}
              </span>
            )}
          </span>
        </div>
      )}

      {failure && <GalleryListNotice text={t(failure)} onRetry={refresh} />}

      {leftovers.map((account) => (
        <AccountDeletionCard
          key={account.userId}
          account={account}
          onDeleted={(files) => onDeleted(account, files)}
          onGiven={refresh}
        />
      ))}

      {!shown && asking && (
        <div
          className="gallery-rows"
          role="status"
          aria-label={t('plus.accounts.loading')}
        >
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="admin-account admin-account--skeleton"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {shown &&
        shown.accounts.length === 0 &&
        leftovers.length === 0 &&
        !asking &&
        !failure && (
          <div className="community__empty gallery-empty">
            <span className="community__empty-mark" aria-hidden="true">
              <Glyph name="person" />
            </span>
            <p className="community__empty-title">{empty}</p>
          </div>
        )}

      {shown && shown.accounts.length > 0 && (
        <>
          <ul
            className={`gallery-rows admin-accounts__rows${dimmed ? ' is-dimmed' : ''}`}
            aria-label={t('plus.accounts.title')}
            aria-busy={dimmed}
          >
            {shown.accounts.map((account) => (
              <AdminAccountRow
                key={account.userId}
                account={account}
                open={openId === account.userId}
                onToggle={() =>
                  setOpenId((current) =>
                    current === account.userId ? undefined : account.userId,
                  )
                }
                onDeleted={(files) => onDeleted(account, files)}
                onGiven={refresh}
              />
            ))}
          </ul>
          <div className="gallery-more">
            <span className="admin-accounts__shown">
              {t('plus.accounts.shown', {
                shown: numbers.format(shown.accounts.length),
                total: numbers.format(shown.listed),
              })}
            </span>
            {more === 'failed' && (
              <p className="gallery-more__error">
                {t('plus.accounts.moreError')}
              </p>
            )}
            {shown.accounts.length < shown.listed && (
              <button
                type="button"
                className={`button small subtle${more === 'asking' ? ' is-running' : ''}`}
                aria-busy={more === 'asking'}
                disabled={dimmed}
                onClick={loadMore}
              >
                {t('plus.gallery.more')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
