/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TMine } from '../plus/myScenes';
import { useTranslation } from '../utils/I18nContext';

interface IAccountStatsProps {
  /** Scenes the account got (`my_store`). */
  owned: number;
  /** Its published scenes, until its own list has been read. */
  publishedFromStore: number;
  mine: TMine;
}

/**
 * Three numbers under the name: the scenes the account has, the ones it put
 * in the gallery, and the hearts those were given (Ivan, 2026-10-24, "go
 * with A"). Likes are counted only from the account's own list, so they wait
 * for it rather than reading as none.
 */
export default function AccountStats({
  owned,
  publishedFromStore,
  mine,
}: IAccountStatsProps) {
  const { t, locale } = useTranslation();
  const numbers = new Intl.NumberFormat(locale, { notation: 'compact' });
  const live =
    mine.state === 'ready'
      ? mine.scenes.filter((scene) => !scene.blocked)
      : undefined;
  const stats = [
    { key: 'owned', label: t('account.stats.owned'), value: owned },
    {
      key: 'published',
      label: t('account.published.title'),
      value: live ? live.length : publishedFromStore,
    },
    ...(live
      ? [
          {
            key: 'likes',
            label: t('account.stats.likes'),
            value: live.reduce((sum, scene) => sum + scene.likes, 0),
          },
        ]
      : []),
  ];
  return (
    <dl className="account-stats">
      {stats.map((stat) => (
        <div key={stat.key} className="account-stats__item">
          <dt>{stat.label}</dt>
          <dd>{numbers.format(stat.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
