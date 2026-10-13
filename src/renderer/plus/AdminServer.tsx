/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  FREE_PLAN,
  REQUEST_KINDS,
  requestTotal,
  shareOf,
  type IRequestPoint,
  type IServerUsage,
  type TRequestKind,
  type TRequestUsage,
} from 'common/serverUsage';
import type { TAdminOutcome } from 'main/plus/adminInsightsApi';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import GalleryListNotice from './GalleryListNotice';
import { INSIGHT_ERRORS } from './insightsFormat';
import '../styles/AdminServer.scss';

type TAsked<T> =
  | { state: 'asking' }
  | { state: 'failed'; key: TranslationKey }
  | { state: 'ready'; value: T };

/** How full a limit reads: the accent, amber from 60%, red from 85%. */
const levelOf = (share: number): 'ok' | 'warn' | 'full' => {
  if (share >= 0.85) {
    return 'full';
  }
  return share >= 0.6 ? 'warn' : 'ok';
};

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

const UNITS: ReadonlyArray<readonly [string, number]> = [
  ['gigabyte', GB],
  ['megabyte', MB],
  ['kilobyte', KB],
  ['byte', 1],
];

/** "212 MB", "1.2 GB", "640 kB" — in the reader's language. */
export const formatBytes = (bytes: number, locale: string): string => {
  const [unit, size] =
    UNITS.find(([, each]) => bytes >= each) ?? UNITS[UNITS.length - 1];
  const value = bytes / size;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 && unit !== 'byte' ? 1 : 0,
  }).format(value);
};

const KIND_KEYS: Record<TRequestKind, TranslationKey> = {
  rest: 'insights.server.kind.rest',
  auth: 'insights.server.kind.auth',
  storage: 'insights.server.kind.storage',
  realtime: 'insights.server.kind.realtime',
};

/** The week's points as one total per local day, oldest first. */
const byDay = (points: readonly IRequestPoint[]) => {
  const days = new Map<string, { at: number; total: number }>();
  points.forEach((point) => {
    const date = new Date(point.at);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const day = days.get(key) ?? { at: point.at, total: 0 };
    day.total += requestTotal([point]);
    days.set(key, day);
  });
  return [...days.values()].sort((a, b) => a.at - b.at);
};

/**
 * One answer, asked again on every refresh. `ask` is the bridge's own
 * function, the same one on every render, so only a refresh asks again.
 */
const useAsked = <T,>(
  ask: (() => Promise<TAdminOutcome<T>>) | undefined,
  attempt: number,
): TAsked<T> => {
  const [shown, setShown] = useState<TAsked<T>>({ state: 'asking' });
  useEffect(() => {
    let current = true;
    setShown({ state: 'asking' });
    const asked = ask?.();
    if (!asked) {
      setShown({ state: 'failed', key: INSIGHT_ERRORS.offline });
      return undefined;
    }
    asked
      .then((outcome) => {
        if (current) {
          setShown(
            outcome.ok
              ? { state: 'ready', value: outcome.value }
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
  }, [ask, attempt]);
  return shown;
};

/**
 * How full the server is against what Supabase's free plan allows (premium
 * migration 0053, the `admin-server-usage` function): the database, the
 * files and the accounts seen this month, each as a share of its limit, and
 * the week's requests. Data sent each month is not counted by any API, so the
 * page says where Supabase shows it. Nothing here is kept; Refresh measures
 * again.
 */
export default function AdminServer() {
  const { t, locale } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const bridge = window.electron?.ipcRenderer;
  const usage = useAsked(bridge?.adminServerUsage, attempt);
  const requests = useAsked(bridge?.adminRequestUsage, attempt);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' });

  return (
    <div className="gallery-page admin-server">
      <div className="admin-server__bar">
        <span className="admin-server__plan">
          <Glyph name="server" />
          {t('insights.server.plan')}
        </span>
        {usage.state === 'ready' && (
          <span className="admin-server__measured">
            {t('insights.server.measured', {
              time: time.format(usage.value.measuredAt),
            })}
          </span>
        )}
        {/* The Accounts page's own Refresh, turning while it asks. */}
        <button
          type="button"
          className={`button small subtle admin-accounts__refresh${usage.state === 'asking' ? ' is-running' : ''}`}
          aria-busy={usage.state === 'asking'}
          onClick={() => setAttempt((count) => count + 1)}
        >
          <Glyph name="refresh" />
          {t('plus.accounts.refresh')}
        </button>
      </div>

      {usage.state === 'failed' && (
        <GalleryListNotice
          text={t(usage.key)}
          onRetry={() => setAttempt((count) => count + 1)}
        />
      )}

      {usage.state === 'asking' && (
        <div
          className="admin-server__gauges"
          role="status"
          aria-label={t('insights.server.loading')}
        >
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="admin-server__skeleton" />
          ))}
        </div>
      )}

      {usage.state === 'ready' && (
        <>
          <div className="admin-server__gauges">
            <Gauge
              label="insights.server.database"
              value={formatBytes(usage.value.databaseBytes, locale)}
              limit={formatBytes(FREE_PLAN.databaseBytes, locale)}
              share={shareOf(
                usage.value.databaseBytes,
                FREE_PLAN.databaseBytes,
              )}
            />
            <Gauge
              label="insights.server.files"
              value={formatBytes(
                usage.value.buckets.reduce(
                  (sum, bucket) => sum + bucket.bytes,
                  0,
                ),
                locale,
              )}
              limit={formatBytes(FREE_PLAN.storageBytes, locale)}
              share={shareOf(
                usage.value.buckets.reduce(
                  (sum, bucket) => sum + bucket.bytes,
                  0,
                ),
                FREE_PLAN.storageBytes,
              )}
            />
            <Gauge
              label="insights.server.active"
              value={new Intl.NumberFormat(locale).format(
                usage.value.activeAccounts,
              )}
              limit={new Intl.NumberFormat(locale).format(
                FREE_PLAN.activeAccounts,
              )}
              share={shareOf(
                usage.value.activeAccounts,
                FREE_PLAN.activeAccounts,
              )}
              note={t('insights.server.activeNote', {
                accounts: new Intl.NumberFormat(locale).format(
                  usage.value.accounts,
                ),
              })}
            />
            <Requests requests={requests} />
          </div>

          <div className="admin-server__split">
            <Tables usage={usage.value} />
            <Buckets usage={usage.value} />
          </div>

          <Egress dashboardUrl={usage.value.dashboardUrl} />
        </>
      )}

      <p className="gallery-fine admin-server__rules">
        {t('insights.server.rules', { days: String(FREE_PLAN.idleDays) })}
      </p>
    </div>
  );
}

interface IGaugeProps {
  label: TranslationKey;
  value: string;
  limit: string;
  share: number;
  note?: string;
}

/** One limit: what is used, of how much, and the share as a bar. */
function Gauge({ label, value, limit, share, note }: IGaugeProps) {
  const { t, locale } = useTranslation();
  const level = levelOf(share);
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: share < 0.1 ? 1 : 0,
  });
  return (
    <section className={`admin-server__gauge is-${level}`}>
      <h3 className="account-deletion__eyebrow">{t(label)}</h3>
      <p className="admin-server__value">
        <strong>{value}</strong>
        <span>{t('insights.server.of', { limit })}</span>
      </p>
      <span
        className="admin-server__meter"
        role="meter"
        aria-label={t(label)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(1, share) * 100)}
      >
        <i style={{ width: `${Math.min(1, share) * 100}%` }} />
      </span>
      <span className="admin-server__share">
        {t('insights.server.used', { share: percent.format(share) })}
        {note && <span className="admin-server__note">{note}</span>}
      </span>
    </section>
  );
}

/** The week's requests: the total, one bar a day, and how it splits. */
function Requests({ requests }: { requests: TAsked<TRequestUsage> }) {
  const { t, locale } = useTranslation();
  const compact = new Intl.NumberFormat(locale, { notation: 'compact' });
  const usage = requests.state === 'ready' ? requests.value : undefined;
  const points = usage?.state === 'ready' ? usage.points : undefined;
  const days = points ? byDay(points) : [];
  const most = Math.max(1, ...days.map((day) => day.total));
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });

  return (
    <section className="admin-server__gauge is-requests">
      <h3 className="account-deletion__eyebrow">
        {t('insights.server.requests')}
      </h3>
      {requests.state === 'asking' && (
        <span className="admin-server__skeleton is-inline" />
      )}
      {requests.state === 'failed' && (
        <p className="admin-server__quiet">{t(requests.key)}</p>
      )}
      {usage?.state === 'unconfigured' && (
        <p className="admin-server__quiet">
          <strong>{t('insights.server.noToken')}</strong>{' '}
          {t('insights.server.tokenSteps')}
        </p>
      )}
      {usage?.state === 'token' && (
        <p className="admin-server__quiet is-alert">
          <Glyph name="alert" />
          <span>{t('insights.server.tokenRefused')}</span>
        </p>
      )}
      {points && (
        <>
          <p className="admin-server__value">
            <strong>{compact.format(requestTotal(points))}</strong>
            <span>{t('insights.server.unlimited')}</span>
          </p>
          <span className="admin-server__days" aria-hidden="true">
            {days.map((day) => (
              <span key={day.at} className="admin-server__day">
                <i style={{ height: `${(day.total / most) * 100}%` }} />
                <small>{weekday.format(day.at)}</small>
              </span>
            ))}
          </span>
          <span className="admin-server__kinds">
            {REQUEST_KINDS.map((kind) => (
              <span key={kind} className={`is-${kind}`}>
                {t(KIND_KEYS[kind])}{' '}
                <b>{compact.format(requestTotal(points, kind))}</b>
              </span>
            ))}
          </span>
        </>
      )}
    </section>
  );
}

/** Where the database's room goes: its largest tables, largest first. */
function Tables({ usage }: { usage: IServerUsage }) {
  const { t, locale } = useTranslation();
  const most = Math.max(1, ...usage.tables.map((table) => table.bytes));
  return (
    <section className="admin-server__card">
      <h3 className="account-deletion__eyebrow">
        {t('insights.server.tables')}
      </h3>
      <ul className="admin-server__list">
        {usage.tables.map((table) => (
          <li key={table.name}>
            <span className="admin-server__name" title={table.name}>
              {table.name}
            </span>
            <span className="admin-taste__meter" aria-hidden="true">
              <i style={{ width: `${(table.bytes / most) * 100}%` }} />
            </span>
            <span className="admin-server__size">
              {formatBytes(table.bytes, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The files, folder by folder: how many, and how much room. */
function Buckets({ usage }: { usage: IServerUsage }) {
  const { t, locale } = useTranslation();
  const numbers = new Intl.NumberFormat(locale);
  const most = Math.max(1, ...usage.buckets.map((bucket) => bucket.bytes));
  return (
    <section className="admin-server__card">
      <h3 className="account-deletion__eyebrow">
        {t('insights.server.buckets')}
      </h3>
      {usage.buckets.length === 0 && (
        <p className="admin-server__quiet">{t('insights.server.noFiles')}</p>
      )}
      <ul className="admin-server__list">
        {usage.buckets.map((bucket) => (
          <li key={bucket.bucket}>
            <span className="admin-server__name">
              {bucket.bucket}
              <small>
                {t('insights.server.bucketFiles', {
                  count: numbers.format(bucket.files),
                })}
              </small>
            </span>
            <span className="admin-taste__meter" aria-hidden="true">
              <i style={{ width: `${(bucket.bytes / most) * 100}%` }} />
            </span>
            <span className="admin-server__size">
              {formatBytes(bucket.bytes, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Data sent each month: counted by no API, so said where to read it. */
function Egress({ dashboardUrl }: { dashboardUrl?: string }) {
  const { t, locale } = useTranslation();
  return (
    <section className="admin-server__card admin-server__egress">
      <span className="admin-server__egress-text">
        <h3 className="account-deletion__eyebrow">
          {t('insights.server.egress')}
        </h3>
        <p>
          {t('insights.server.egressBody', {
            limit: formatBytes(FREE_PLAN.egressBytes, locale),
          })}
        </p>
      </span>
      {dashboardUrl && (
        // Opened in the browser, as every outbound link is (`safeExternal`).
        <button
          type="button"
          className="button small"
          onClick={() => window.open(dashboardUrl, '_blank', 'noopener')}
        >
          <Glyph name="link" />
          {t('insights.server.openSupabase')}
        </button>
      )}
    </section>
  );
}
