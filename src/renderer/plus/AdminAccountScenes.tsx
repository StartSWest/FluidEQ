/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IAccountScene } from 'common/sceneTaste';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { ScenePicture } from './GalleryParts';
import {
  INSIGHT_ERRORS,
  formatDuration,
  kindKey,
  sceneLabelName,
  scenePictureRef,
} from './insightsFormat';
import '../styles/AdminInsights.scss';

type TState =
  | { state: 'asking' }
  | { state: 'failed'; key: TranslationKey }
  | { state: 'ready'; scenes: IAccountScene[] };

/** The kind this account spends the most time in, when it has played any. */
const favouriteKind = (scenes: readonly IAccountScene[]) => {
  const totals = new Map<string, number>();
  scenes.forEach((scene) => {
    const kind = scene.category ?? 'other';
    totals.set(kind, (totals.get(kind) ?? 0) + scene.seconds);
  });
  const [best] = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] > 0 ? best[0] : undefined;
};

/**
 * Every scene one account has added, liked or played, most-played first: the
 * first section of an opened account (premium migration 0047). Asked once
 * when the account opens and again on Retry; nothing here is kept.
 */
export default function AdminAccountScenes({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<TState>({ state: 'asking' });

  useEffect(() => {
    let current = true;
    setShown({ state: 'asking' });
    const asked = window.electron?.ipcRenderer?.adminAccountScenes?.(userId);
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
  }, [userId, attempt]);

  return (
    <section className="admin-taste" aria-label={t('insights.account.title')}>
      <h3 className="account-deletion__eyebrow">
        {t('insights.account.title')}
      </h3>

      {shown.state === 'asking' && (
        <div className="admin-taste__rows" aria-busy="true">
          {[0, 1].map((index) => (
            <span key={index} className="admin-taste__skeleton" />
          ))}
        </div>
      )}

      {shown.state === 'failed' && (
        <p className="admin-taste__note">
          <Glyph name="alert" />
          <span>{t(shown.key)}</span>
          <button
            type="button"
            className="button small subtle"
            onClick={() => setAttempt((count) => count + 1)}
          >
            {t('plus.gallery.retry')}
          </button>
        </p>
      )}

      {shown.state === 'ready' && shown.scenes.length === 0 && (
        <p className="admin-taste__note is-quiet">
          {t('insights.account.empty')}
        </p>
      )}

      {shown.state === 'ready' && shown.scenes.length > 0 && (
        <AccountTaste scenes={shown.scenes} />
      )}
    </section>
  );
}

/** What one account has played, added and liked, once it has any. */
function AccountTaste({ scenes }: { scenes: IAccountScene[] }) {
  const { t, locale } = useTranslation();
  const count = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  // A play's day is the member's own calendar day, so it is read as one.
  const day = (value: string) => {
    const [year, month, dayOfMonth] = value.split('-').map(Number);
    return date.format(new Date(year, month - 1, dayOfMonth));
  };
  const played = scenes.filter((scene) => scene.seconds > 0);
  const total = played.reduce((sum, scene) => sum + scene.seconds, 0);
  const most = Math.max(1, ...scenes.map((scene) => scene.seconds));
  const kind = favouriteKind(scenes);
  const facts: Array<{ key: TranslationKey; value: string }> = [
    {
      key: 'insights.account.played',
      value: count.format(played.length),
    },
    { key: 'insights.account.time', value: formatDuration(total, locale, t) },
    {
      key: 'insights.account.added',
      value: count.format(scenes.filter((scene) => scene.addedAt).length),
    },
    {
      key: 'insights.account.liked',
      value: count.format(scenes.filter((scene) => scene.likedAt).length),
    },
  ];
  return (
    <>
      <dl className="admin-taste__facts">
        {facts.map((fact) => (
          <div key={fact.key}>
            <dt>{t(fact.key)}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
        {kind && (
          <div>
            <dt>{t('insights.account.kind')}</dt>
            <dd>{t(kindKey(kind))}</dd>
          </div>
        )}
      </dl>
      <ul className="admin-taste__rows">
        {scenes.map((scene) => {
          const name = sceneLabelName(scene, locale);
          return (
            <li
              key={`${scene.authorId ?? ''}/${scene.sceneId}`}
              className="admin-taste__row"
            >
              <ScenePicture
                scene={scenePictureRef(scene)}
                className="admin-taste__picture"
              />
              <span className="admin-taste__who">
                <span className="admin-taste__name">{name}</span>
                <span className="admin-taste__by">
                  {scene.authorId
                    ? t('insights.by', {
                        maker: scene.authorName ?? t('insights.member'),
                      })
                    : t('insights.byFluidEQ')}
                  {' · '}
                  {t(kindKey(scene.category))}
                </span>
                <span className="admin-taste__chips">
                  {/* A member's own scene that was never published: played
                      from their looks, as the server keeps it since 0058. */}
                  {scene.authorId !== undefined &&
                    scene.version === undefined && (
                      <span className="admin-taste__chip">
                        {t('insights.chip.unpublished')}
                      </span>
                    )}
                  {scene.addedAt !== undefined && (
                    <span className="admin-taste__chip is-added">
                      {t('insights.chip.added', {
                        date: date.format(scene.addedAt),
                      })}
                    </span>
                  )}
                  {scene.likedAt !== undefined && (
                    <span className="admin-taste__chip is-liked">
                      <Glyph name="heart" />
                      {t('insights.chip.liked')}
                    </span>
                  )}
                </span>
              </span>
              <span className="admin-taste__play">
                <span className="admin-taste__time">
                  {scene.seconds > 0
                    ? formatDuration(scene.seconds, locale, t)
                    : t('insights.account.notPlayed')}
                </span>
                <span className="admin-taste__meter" aria-hidden="true">
                  <i style={{ width: `${(scene.seconds / most) * 100}%` }} />
                </span>
                {scene.lastPlayed && (
                  <span className="admin-taste__when">
                    {t('insights.account.days', {
                      days: count.format(scene.days),
                      date: day(scene.lastPlayed),
                    })}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
