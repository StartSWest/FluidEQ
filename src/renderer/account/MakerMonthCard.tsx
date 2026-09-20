import { useEffect, useMemo } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  makerMonthDaysLeft,
  makerMonthEndsToday,
  makerMonthState,
  type IMakerMonth,
} from 'common/makerMonth';
import { useTranslation } from '../utils/I18nContext';
import Glyph from '../community/Glyph';
import { loadMakerMonth, useMakerMonth } from '../plus/makerMonthStore';

/**
 * What publishing would do next, for somebody with no month running. A maker
 * whose months are banked behind a membership they pay for does not get
 * "free again": nothing of theirs stopped, and the next one joins the queue
 * rather than starting.
 */
const nextMonthLine = (month: IMakerMonth): TranslationKey => {
  if (!month.maker) {
    return 'account.maker.invite';
  }
  return month.waiting > 0
    ? 'account.maker.againWaiting'
    : 'account.maker.again';
};

interface IMakerMonthCardProps {
  /** Whose month this is. A different account starts the read again. */
  accountId: string;
}

/**
 * What publishing is worth, in the account panel: the month it earned, when
 * that month runs out, and what to do before it does.
 *
 * It has to say the ending out loud. An earned month is not a subscription —
 * nothing renews it and no card is charged — so a maker who is told nothing
 * simply finds Plus gone one morning. The panel counts the last week down,
 * and the app says the same thing again on the day (`MakerMonthNotice`).
 *
 * A maker who is paying sees something different: their months are waiting,
 * not running, because the subscription they pay for is left exactly as it
 * is. Nothing here cancels anybody's membership.
 */
export default function MakerMonthCard({ accountId }: IMakerMonthCardProps) {
  const { t, locale } = useTranslation();
  const { month, accountId: asked } = useMakerMonth();

  useEffect(() => {
    loadMakerMonth(accountId).catch(() => undefined);
  }, [accountId]);

  // The reader's own calendar conventions, as the membership card above uses.
  const dates = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    [locale],
  );

  if (!month || asked !== accountId) {
    return null;
  }
  const now = Date.now();
  const state = makerMonthState(month, now);
  const days = makerMonthDaysLeft(month, now);
  const endsToday = makerMonthEndsToday(month, now);
  const ends = month.until ? Date.parse(month.until) : undefined;
  const running =
    ends !== undefined && (state === 'running' || state === 'ending');

  return (
    <section className="maker-card" aria-labelledby="maker-card-title">
      <div className="maker-card__head">
        <span id="maker-card-title" className="plus-card__eyebrow">
          {t('account.maker.title')}
        </span>
        {running && (
          <span
            className={`plus-card__badge${state === 'ending' ? ' plus-card__badge--ending' : ''}`}
          >
            {t('account.maker.badge')}
          </span>
        )}
      </div>

      {running && ends !== undefined && (
        <p className="plus-card__line">
          {t('account.maker.until', { date: dates.format(ends) })}
        </p>
      )}
      {/* Asking for a scene only when one would change something. A maker
          whose month is banked behind a membership they pay for has already
          done this month's work, and the line under the waiting months says
          so — inviting them to publish again here read as a contradiction. */}
      {!running && !month.earnedThisMonth && (
        <p className="plus-card__line">{t(nextMonthLine(month))}</p>
      )}

      {running && state === 'ending' && (
        <p className="plus-card__line plus-card__line--grace">
          {/* The last day is said as "today" or "tomorrow", neither of which
              carries a number — "ends in 1 days" is the sentence this
              avoids, and "tomorrow" on the morning it ends is a day that
              does not exist. */}
          {endsToday && t('account.maker.endsToday')}
          {!endsToday &&
            (days <= 1
              ? t('account.maker.endsTomorrow')
              : t('account.maker.endsDays', { days: String(days) }))}
        </p>
      )}

      {month.waiting > 0 && (
        <p className="maker-card__waiting">
          <Glyph name="calendar" />
          <span>
            {t(
              month.waiting === 1
                ? 'account.maker.waitingOne'
                : 'account.maker.waitingMany',
              {
                count: String(month.waiting),
              },
            )}
          </span>
        </p>
      )}

      <p className="plus-card__hint">
        {t(month.earnedThisMonth ? 'account.maker.kept' : 'account.maker.keep')}
      </p>
    </section>
  );
}
