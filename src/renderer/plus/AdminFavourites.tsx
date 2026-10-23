/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  FAVOURITE_PERIODS,
  secondsByCategory,
  type IFavouriteScene,
  type TFavouritePeriod,
} from 'common/sceneTaste';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { ScenePicture } from './GalleryParts';
import GalleryListNotice from './GalleryListNotice';
import {
  INSIGHT_ERRORS,
  formatDuration,
  kindKey,
  sceneLabelName,
  scenePictureRef,
} from './insightsFormat';
import '../styles/AdminInsights.scss';

const PERIOD_KEYS: Record<TFavouritePeriod, TranslationKey> = {
  7: 'insights.period.week',
  30: 'insights.period.month',
  90: 'insights.period.quarter',
  3650: 'insights.period.all',
};

type TState =
  | { state: 'asking' }
  | { state: 'failed'; key: TranslationKey }
  | { state: 'ready'; scenes: IFavouriteScene[] };

/**
 * Which scenes members come back to (premium migration 0047): every scene
 * played, added or liked in the period, ranked by how many people played it,
 * then by time on screen. The card beside it adds the time up by kind, which
 * is the question the page exists for — what to make more of. The admin's own
 * testing is left out by the server.
 */
export default function AdminFavourites() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<TFavouritePeriod>(30);
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<TState>({ state: 'asking' });

  useEffect(() => {
    let current = true;
    setShown({ state: 'asking' });
    const asked = window.electron?.ipcRenderer?.adminSceneFavourites?.(period);
    if (!asked) {
      setShown({ state: 'failed', key: INSIGHT_ERRORS.offline });
      return undefined;
    }
    asked
      .then((outcome) => {
        if (current) {
          setShown(
            outcome.ok
              ? { state: 'ready', scenes: outcome.value }
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

  return (
    <div className="gallery-page admin-favourites">
      <div className="admin-favourites__bar">
        <div
          className="segmented"
          role="group"
          aria-label={t('insights.period')}
        >
          {FAVOURITE_PERIODS.map((days) => (
            <button
              key={days}
              type="button"
              className={`segmented__option${period === days ? ' is-selected' : ''}`}
              aria-pressed={period === days}
              onClick={() => setPeriod(days)}
            >
              {t(PERIOD_KEYS[days])}
            </button>
          ))}
        </div>
        {shown.state === 'ready' && <Summary scenes={shown.scenes} />}
      </div>
      <p className="gallery-fine">{t('insights.favourites.hint')}</p>

      {shown.state === 'failed' && (
        <GalleryListNotice
          text={t(shown.key)}
          onRetry={() => setAttempt((count) => count + 1)}
        />
      )}

      {shown.state === 'asking' && (
        <div
          className="admin-favourites__split"
          role="status"
          aria-label={t('insights.loading')}
        >
          <span className="admin-favourites__skeleton is-card" />
          <span className="admin-favourites__skeleton is-table" />
        </div>
      )}

      {shown.state === 'ready' && shown.scenes.length === 0 && (
        <div className="community__empty gallery-empty">
          <span className="community__empty-mark" aria-hidden="true">
            <Glyph name="looks" />
          </span>
          <p className="community__empty-title">
            {t('insights.favourites.empty')}
          </p>
        </div>
      )}

      {shown.state === 'ready' && shown.scenes.length > 0 && (
        <div className="admin-favourites__split">
          <Kinds scenes={shown.scenes} />
          <Ranking scenes={shown.scenes} />
        </div>
      )}
    </div>
  );
}

/** "164 members played 41 scenes for 2,310 hours." */
function Summary({ scenes }: { scenes: IFavouriteScene[] }) {
  const { t, locale } = useTranslation();
  const numbers = new Intl.NumberFormat(locale);
  const seconds = scenes.reduce((sum, scene) => sum + scene.seconds, 0);
  const played = scenes.filter((scene) => scene.seconds > 0).length;
  return (
    <span className="admin-favourites__summary">
      {t('insights.favourites.summary', {
        scenes: numbers.format(played),
        time: formatDuration(seconds, locale, t),
      })}
    </span>
  );
}

/** Time on screen by kind, the largest first, with the one to make more of. */
function Kinds({ scenes }: { scenes: IFavouriteScene[] }) {
  const { t, locale } = useTranslation();
  const kinds = secondsByCategory(scenes).filter((kind) => kind.seconds > 0);
  const total = kinds.reduce((sum, kind) => sum + kind.seconds, 0);
  const share = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  const [top] = kinds;
  const most = top?.seconds ?? 1;
  return (
    <section className="admin-favourites__kinds">
      <h3 className="account-deletion__eyebrow">
        {t('insights.favourites.kinds')}
      </h3>
      {kinds.length === 0 && (
        <p className="admin-taste__note is-quiet">
          {t('insights.favourites.noPlays')}
        </p>
      )}
      <ul className="admin-favourites__kind-list">
        {kinds.map((kind) => (
          <li key={kind.category} className="admin-favourites__kind">
            <span className="admin-favourites__kind-name">
              {t(kindKey(kind.category))}
            </span>
            <span className="admin-taste__meter is-wide" aria-hidden="true">
              <i style={{ width: `${(kind.seconds / most) * 100}%` }} />
            </span>
            <span className="admin-favourites__kind-share">
              {share.format(kind.seconds / total)}
            </span>
          </li>
        ))}
      </ul>
      {top && total > 0 && (
        <p className="admin-favourites__advice">
          {t('insights.favourites.advice', {
            kind: t(kindKey(top.category)),
            share: share.format(top.seconds / total),
            count: String(top.scenes),
          })}
        </p>
      )}
    </section>
  );
}

/** Every scene, ranked as the server ranked it. */
function Ranking({ scenes }: { scenes: IFavouriteScene[] }) {
  const { t, locale } = useTranslation();
  const numbers = new Intl.NumberFormat(locale);
  return (
    <div className="admin-favourites__table-wrap">
      <table className="admin-favourites__table">
        <thead>
          <tr>
            <th scope="col" aria-label={t('insights.col.rank')} />
            <th scope="col">{t('insights.col.scene')}</th>
            <th scope="col" className="is-number">
              {t('insights.col.people')}
            </th>
            <th scope="col" className="is-number">
              {t('insights.col.time')}
            </th>
            <th scope="col" className="is-number">
              {t('insights.col.perPerson')}
            </th>
            <th scope="col" className="is-number">
              {t('insights.col.adds')}
            </th>
            <th scope="col" className="is-number">
              {t('insights.col.likes')}
            </th>
          </tr>
        </thead>
        <tbody>
          {scenes.map((scene, index) => (
            <tr key={`${scene.authorId ?? ''}/${scene.sceneId}`}>
              <td className="admin-favourites__rank">
                {numbers.format(index + 1)}
              </td>
              <td>
                <span className="admin-favourites__scene">
                  <ScenePicture
                    scene={scenePictureRef(scene)}
                    className="admin-taste__picture"
                  />
                  <span className="admin-taste__who">
                    <span className="admin-taste__name">
                      {sceneLabelName(scene, locale)}
                    </span>
                    <span className="admin-taste__by">
                      {scene.authorId
                        ? (scene.authorName ?? t('insights.member'))
                        : 'FluidEQ'}
                      {' · '}
                      {t(kindKey(scene.category))}
                    </span>
                  </span>
                </span>
              </td>
              <td className="is-number">{numbers.format(scene.players)}</td>
              <td className="is-number">
                {formatDuration(scene.seconds, locale, t)}
              </td>
              <td className="is-number">
                {scene.players > 0
                  ? formatDuration(scene.seconds / scene.players, locale, t)
                  : '–'}
              </td>
              <td className="is-number">{numbers.format(scene.adds)}</td>
              <td className="is-number">{numbers.format(scene.likes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
