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
};

interface IAdminAccountStatsProps {
  /** The answer on screen, or undefined before the first one. */
  page: IAccountListPage | undefined;
  asking: boolean;
  plan: TAccountPlanFilter;
  onChoose: (plan: TAccountPlanFilter) => void;
}

/**
 * How many accounts there are — with Plus, without, and on a free trial —
 * each count also the filter that lists them, and under them which engine
 * the accounts that said run. A count the server does not answer yet (one
 * before premium migration 0049) is a dash, never a zero.
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
  };

  const fluid = page?.engineFluid;
  const apo = page?.engineApo;
  const reported = (fluid ?? 0) + (apo ?? 0);

  return (
    <>
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

      {fluid !== undefined && apo !== undefined && page && (
        <div className="admin-engines">
          <span className="admin-engines__label">
            {t('plus.accounts.engine.title')}
          </span>
          <span
            className="admin-engines__bar"
            role="img"
            aria-label={t('plus.accounts.engine.summary', {
              fluid: numbers.format(fluid),
              apo: numbers.format(apo),
              unknown: numbers.format(page.matched - reported),
            })}
          >
            {page.matched > 0 && (
              <>
                <i
                  className="is-fluid"
                  style={{ width: `${(fluid / page.matched) * 100}%` }}
                />
                <i
                  className="is-apo"
                  style={{ width: `${(apo / page.matched) * 100}%` }}
                />
              </>
            )}
          </span>
          <span className="admin-engines__key">
            <span className="is-fluid">
              {t('plus.accounts.engine.fluid')} {numbers.format(fluid)}
            </span>
            <span className="is-apo">
              {t('plus.accounts.engine.apo')} {numbers.format(apo)}
            </span>
            <span className="is-unknown">
              {t('plus.accounts.engine.unknown', {
                count: numbers.format(page.matched - reported),
              })}
            </span>
          </span>
        </div>
      )}
    </>
  );
}
