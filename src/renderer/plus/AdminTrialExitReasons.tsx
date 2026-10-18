/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import type { ITrialExitCount, TTrialExitReason } from 'common/trialExit';
import { useTranslation } from '../utils/I18nContext';
import '../styles/AdminInsights.scss';

/** Each reason as the admin reads it: short, in the third person. */
export const TRIAL_EXIT_SHORT: Record<
  TTrialExitReason | 'none',
  TranslationKey
> = {
  price: 'plus.accounts.exit.price',
  'not-enough': 'plus.accounts.exit.not-enough',
  'free-is-enough': 'plus.accounts.exit.free-is-enough',
  'no-time': 'plus.accounts.exit.no-time',
  problems: 'plus.accounts.exit.problems',
  payment: 'plus.accounts.exit.payment',
  other: 'plus.accounts.exit.other',
  none: 'plus.accounts.exit.none',
};

/**
 * Why the trials in the list ended without Plus, reason by reason, most said
 * first and the ones who have not said last: the Favourites page's bars, each
 * as long as its share of the answers. Over the lapsed list only, for the
 * same search and the same joined window.
 */
export default function AdminTrialExitReasons({
  counts,
}: {
  counts: readonly ITrialExitCount[];
}) {
  const { t, locale } = useTranslation();
  const numbers = new Intl.NumberFormat(locale);
  const total = counts.reduce((sum, entry) => sum + entry.answers, 0);
  const said = counts
    .filter((entry) => entry.reason !== 'none')
    .reduce((sum, entry) => sum + entry.answers, 0);
  // Answers first, the silence last, whatever the server's order.
  const ordered = [...counts].sort(
    (a, b) =>
      Number(a.reason === 'none') - Number(b.reason === 'none') ||
      b.answers - a.answers,
  );
  const most = Math.max(1, ...counts.map((entry) => entry.answers));

  return (
    <section
      className="admin-favourites__kinds admin-trial-exits"
      aria-labelledby="admin-trial-exits-title"
    >
      <h3 id="admin-trial-exits-title" className="admin-engines__label">
        {t('plus.accounts.exit.title')}
      </h3>
      <p className="admin-favourites__summary">
        {total === 0
          ? t('plus.accounts.exit.empty')
          : t('plus.accounts.exit.summary', {
              said: numbers.format(said),
              total: numbers.format(total),
            })}
      </p>
      {total > 0 && (
        <ul className="admin-favourites__kind-list">
          {ordered.map((entry) => (
            <li
              key={entry.reason}
              className={`admin-favourites__kind${entry.reason === 'none' ? ' is-silent' : ''}`}
            >
              <span className="admin-favourites__kind-name">
                {t(TRIAL_EXIT_SHORT[entry.reason])}
              </span>
              <span className="admin-taste__meter" aria-hidden="true">
                <i style={{ width: `${(entry.answers / most) * 100}%` }} />
              </span>
              <span className="admin-favourites__kind-share">
                {numbers.format(entry.answers)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
