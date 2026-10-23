/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  LISTENING_DAY_CAP_MINUTES,
  averageMinutes,
  chartDays,
  minutesAxis,
  type IAdminListening,
  type IListeningDay,
} from 'common/listening';
import { FAVOURITE_PERIODS, type TFavouritePeriod } from 'common/sceneTaste';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import GalleryListNotice from './GalleryListNotice';
import { INSIGHT_ERRORS, formatDuration } from './insightsFormat';
import '../styles/AdminServer.scss';
import '../styles/AdminListening.scss';

const PERIOD_KEYS: Record<TFavouritePeriod, TranslationKey> = {
  7: 'insights.period.week',
  30: 'insights.period.month',
  90: 'insights.period.quarter',
  3650: 'insights.period.all',
};

type TShown =
  | { state: 'asking' }
  | { state: 'failed'; key: TranslationKey }
  | { state: 'ready'; listening: IAdminListening };

/** The admin's own calendar day, as the chart's last column. */
const todayKey = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/**
 * How long people listen (premium 0068): the period's time, its listeners,
 * an ordinary listening day and how many accounts share at all, then every
 * day of the period as a column of time with the listeners drawn across it.
 *
 * Totals only, as the server sends them: nobody is named, the admin's own
 * account and banned ones are left out by the server. Asked again on each
 * period and on Refresh, never on a clock.
 */
export default function AdminListening() {
  const { t, locale } = useTranslation();
  const [period, setPeriod] = useState<TFavouritePeriod>(30);
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<TShown>({ state: 'asking' });
  const again = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    let current = true;
    setShown({ state: 'asking' });
    const asked = window.electron?.ipcRenderer?.adminListening?.(period);
    if (!asked) {
      setShown({ state: 'failed', key: INSIGHT_ERRORS.offline });
      return undefined;
    }
    asked
      .then((outcome) => {
        if (current) {
          setShown(
            outcome.ok
              ? { state: 'ready', listening: outcome.value }
              : { state: 'failed', key: INSIGHT_ERRORS[outcome.reason] },
          );
        }
        return undefined;
      })
      .catch(() => {
        if (current) {
          setShown({ state: 'failed', key: INSIGHT_ERRORS.offline });
        }
      });
    return () => {
      current = false;
    };
  }, [period, attempt]);

  const listening = shown.state === 'ready' ? shown.listening : undefined;
  const days = useMemo(
    () => (listening ? chartDays(listening, period, todayKey()) : []),
    [listening, period],
  );
  const numbers = new Intl.NumberFormat(locale);
  const time = (minutes: number) =>
    formatDuration(Math.round(minutes * 60), locale, t);

  return (
    <div className="gallery-page admin-server admin-listening">
      <div className="admin-server__bar">
        <span className="admin-server__plan">
          <Glyph name="headphones" />
          {t('listening.admin.plan')}
        </span>
        <div
          className="segmented"
          role="group"
          aria-label={t('insights.period')}
        >
          {FAVOURITE_PERIODS.map((length) => (
            <button
              key={length}
              type="button"
              className={`segmented__option${period === length ? ' is-selected' : ''}`}
              aria-pressed={period === length}
              onClick={() => setPeriod(length)}
            >
              {t(PERIOD_KEYS[length])}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`button small subtle admin-accounts__refresh${shown.state === 'asking' ? ' is-running' : ''}`}
          aria-busy={shown.state === 'asking'}
          onClick={again}
        >
          <Glyph name="refresh" />
          {t('plus.accounts.refresh')}
        </button>
      </div>

      {shown.state === 'failed' && (
        <GalleryListNotice text={t(shown.key)} onRetry={again} />
      )}

      {shown.state === 'asking' && (
        <div
          className="admin-server__gauges"
          role="status"
          aria-label={t('listening.admin.loading')}
        >
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="admin-server__skeleton" />
          ))}
        </div>
      )}

      {listening && (
        <>
          <div className="admin-server__gauges">
            <section className="admin-server__gauge">
              <h3 className="account-deletion__eyebrow">
                {t('listening.admin.time')}
              </h3>
              <p className="admin-server__value">
                <strong>{time(listening.minutes)}</strong>
              </p>
              <span className="admin-server__share">
                {t('listening.admin.timeNote', {
                  time: time(listening.minutes / Math.max(1, days.length)),
                })}
              </span>
            </section>
            <section className="admin-server__gauge">
              <h3 className="account-deletion__eyebrow">
                {t('listening.admin.listeners')}
              </h3>
              <p className="admin-server__value">
                <strong>{numbers.format(listening.listeners)}</strong>
              </p>
              <span className="admin-server__share">
                {t('listening.admin.listenersNote', {
                  accounts: numbers.format(listening.accounts),
                })}
              </span>
            </section>
            <section className="admin-server__gauge">
              <h3 className="account-deletion__eyebrow">
                {t('listening.admin.average')}
              </h3>
              <p className="admin-server__value">
                <strong>{time(averageMinutes(listening))}</strong>
              </p>
              <span className="admin-server__share">
                {t('listening.admin.averageNote')}
              </span>
            </section>
            <SharingGauge listening={listening} />
          </div>

          {listening.minutes === 0 ? (
            <div className="community__empty gallery-empty">
              <span className="community__empty-mark" aria-hidden="true">
                <Glyph name="headphones" />
              </span>
              <p className="community__empty-title">
                {t('listening.admin.empty')}
              </p>
            </div>
          ) : (
            <DayChart days={days} time={time} />
          )}
        </>
      )}

      <p className="gallery-fine admin-server__rules">
        {t('listening.admin.rules', {
          hours: String(LISTENING_DAY_CAP_MINUTES / 60),
        })}
      </p>
    </div>
  );
}

/** How many said yes, as a meter of the accounts, with the no and the unasked. */
function SharingGauge({ listening }: { listening: IAdminListening }) {
  const { t, locale } = useTranslation();
  const numbers = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  const unasked = Math.max(
    0,
    listening.accounts - listening.sharing - listening.declined,
  );
  const share =
    listening.accounts > 0 ? listening.sharing / listening.accounts : 0;
  return (
    <section className="admin-server__gauge">
      <h3 className="account-deletion__eyebrow">
        {t('listening.admin.sharing')}
      </h3>
      <p className="admin-server__value">
        <strong>{numbers.format(listening.sharing)}</strong>
        <span>{percent.format(share)}</span>
      </p>
      <span className="admin-server__meter" aria-hidden="true">
        <i style={{ width: `${share * 100}%` }} />
      </span>
      <span className="admin-server__share">
        {t('listening.admin.sharingNote', {
          declined: numbers.format(listening.declined),
          unasked: numbers.format(unasked),
        })}
      </span>
    </section>
  );
}

/**
 * Where a date stands under the plot: centred under its own day, except the
 * first and the last, held to the plot's edges so the card never cuts them.
 */
const datePlace = (index: number, count: number): CSSProperties => {
  if (index === 0) {
    return { left: 0 };
  }
  if (index === count - 1) {
    return { right: 0 };
  }
  return {
    left: `${((index + 0.5) / count) * 100}%`,
    transform: 'translateX(-50%)',
  };
};

/**
 * Every day of the period: a column of listening time, on an axis of hours
 * and minutes a person reads, with the day's listeners drawn across the
 * columns on their own scale. Pointing at a column reads that day out; at
 * rest the readout is the busiest day.
 *
 * Laid out in HTML and percentages so it fills whatever width the page has
 * without measuring it; only the listeners' line is SVG, stretched to the
 * columns with a stroke that keeps its width.
 */
function DayChart({
  days,
  time,
}: {
  days: IListeningDay[];
  time: (minutes: number) => string;
}) {
  const { t, locale } = useTranslation();
  const [pointed, setPointed] = useState<number | undefined>(undefined);
  const numbers = new Intl.NumberFormat(locale);
  const dates = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
    [locale],
  );
  const dateOf = (day: IListeningDay) =>
    dates.format(new Date(`${day.day}T00:00:00Z`));

  const most = Math.max(1, ...days.map((day) => day.minutes));
  const ticks = minutesAxis(most);
  const top = ticks[ticks.length - 1];
  const mostListeners = Math.max(1, ...days.map((day) => day.listeners));
  const peakIndex = days.reduce(
    (best, day, index) => (day.minutes > days[best].minutes ? index : best),
    0,
  );
  const shownIndex = pointed ?? peakIndex;
  const shownDay = days[shownIndex];
  // The line's top sits a little under the plot's, so its busiest day is
  // never drawn on the frame.
  const line = days
    .map((day, index) => {
      const x = index + 0.5;
      const y = 100 - (day.listeners / mostListeners) * 88;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  // First, last and evenly between: never so many the dates collide, and
  // none so close to the last that the two run into each other.
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));
  const labelled = days
    .map((_, index) => index)
    .filter(
      (index) =>
        index === days.length - 1 ||
        (index % labelEvery === 0 && days.length - 1 - index >= labelEvery / 2),
    );

  return (
    <section className="admin-server__card admin-listening__card">
      <div className="admin-listening__head">
        <h3 className="account-deletion__eyebrow">
          {t('listening.admin.chart')}
        </h3>
        <span className="admin-listening__key">
          <span className="is-time">{t('listening.admin.chartKey.time')}</span>
          <span className="is-listeners">
            {t('listening.admin.chartKey.listeners')}
          </span>
        </span>
      </div>
      {shownDay && (
        <p className="admin-listening__readout" aria-live="polite">
          {pointed === undefined
            ? t('listening.admin.peak', {
                date: dateOf(shownDay),
                time: time(shownDay.minutes),
              })
            : t('listening.admin.day', {
                date: dateOf(shownDay),
                time: time(shownDay.minutes),
                listeners: numbers.format(shownDay.listeners),
              })}
        </p>
      )}
      <div className="admin-listening__chart">
        <div className="admin-listening__axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>
              {time(tick)}
            </span>
          ))}
        </div>
        <div
          className="admin-listening__plot"
          onPointerLeave={() => setPointed(undefined)}
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="admin-listening__grid"
              style={{ bottom: `${(tick / top) * 100}%` }}
            />
          ))}
          <ol className="admin-listening__bars">
            {days.map((day, index) => (
              <li
                key={day.day}
                className={`admin-listening__bar${index === shownIndex ? ' is-shown' : ''}${day.minutes === 0 ? ' is-quiet' : ''}`}
                aria-label={t('listening.admin.day', {
                  date: dateOf(day),
                  time: time(day.minutes),
                  listeners: numbers.format(day.listeners),
                })}
                onPointerEnter={() => setPointed(index)}
              >
                <i style={{ height: `${(day.minutes / top) * 100}%` }} />
              </li>
            ))}
          </ol>
          <svg
            className="admin-listening__line"
            viewBox={`0 0 ${days.length} 100`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path d={line} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <span className="admin-listening__dates" aria-hidden="true">
          {labelled.map((index) => (
            <span key={days[index].day} style={datePlace(index, days.length)}>
              {dateOf(days[index])}
            </span>
          ))}
        </span>
      </div>
    </section>
  );
}
