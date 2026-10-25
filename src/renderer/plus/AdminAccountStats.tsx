/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import {
  ACCOUNT_PLAN_FILTERS,
  type IAccountListPage,
  type TAccountPlanFilter,
} from 'common/adminAccounts';
import { useTranslation } from '../utils/I18nContext';

const FILTER_LABELS: Record<TAccountPlanFilter, TranslationKey> = {
  all: 'plus.accounts.filter.all',
  plus: 'plus.accounts.filter.plus',
  free: 'plus.accounts.filter.free',
  trial: 'plus.accounts.filter.trial',
  lapsed: 'plus.accounts.filter.lapsed',
};

interface IAdminAccountStatsProps {
  /** The answer on screen, or undefined before the first one. */
  page: IAccountListPage | undefined;
  asking: boolean;
  plan: TAccountPlanFilter;
  onChoose: (plan: TAccountPlanFilter) => void;
}

/**
 * How many accounts there are — with Plus, without, on a free trial, and
 * whose trial ended without Plus — each count also the filter that lists
 * them. A count the server does not answer yet (one before premium
 * migration 0049, or 0054 for the ended trials) is a dash, never a zero.
 */
export default function AdminAccountStats({
  page,
  asking,
  plan,
  onChoose,
}: IAdminAccountStatsProps) {
  const { t, locale } = useTranslation();
  const numbers = new Intl.NumberFormat(locale);
  const share = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  });
  const counts: Record<TAccountPlanFilter, number | undefined> = {
    all: page?.matched,
    plus: page?.paying,
    free: page && page.matched - page.paying,
    trial: page?.trialing,
    lapsed: page?.lapsed,
  };

  return (
    <div
      className="admin-accounts__stats"
      role="group"
      aria-label={t('plus.accounts.filter')}
    >
      {ACCOUNT_PLAN_FILTERS.map((filter) => {
        const value = counts[filter];
        let part: string | undefined;
        if (filter === 'trial' && page?.trialsThisWeek !== undefined) {
          part = t('plus.accounts.trial.thisWeek', {
            count: numbers.format(page.trialsThisWeek),
          });
        } else if (
          (filter === 'plus' || filter === 'free') &&
          page &&
          page.matched > 0 &&
          value !== undefined
        ) {
          part = share.format(value / page.matched);
        }
        return (
          <button
            key={filter}
            type="button"
            className={`admin-accounts__stat is-${filter}`}
            aria-pressed={plan === filter}
            onClick={() => onChoose(filter)}
          >
            <span className="admin-accounts__stat-label">
              {t(FILTER_LABELS[filter])}
            </span>
            <span className="admin-accounts__stat-figures">
              {value === undefined && asking && !page && (
                <span className="admin-accounts__stat-value is-waiting" />
              )}
              {value === undefined && (!asking || page) && (
                <span className="admin-accounts__stat-value is-unknown">–</span>
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
  );
}
