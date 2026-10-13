/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import { FLUIDEQ_CREATOR_ID } from 'common/plusGallery';
import type {
  IAdminAnnouncement,
  IAnnouncementDraft,
  TAnnouncementAudience,
} from 'common/sceneAnnouncements';
import { premiumLookId, resolveSceneName } from 'common/scenePacks';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import AnnouncementComposer from './AnnouncementComposer';
import { ScenePicture } from './GalleryParts';
import GalleryListNotice from './GalleryListNotice';
import { INSIGHT_ERRORS } from './insightsFormat';
import '../styles/AdminAnnouncements.scss';

const AUDIENCE_NAMES: Record<TAnnouncementAudience, TranslationKey> = {
  everyone: 'announce.audience.everyone',
  members: 'announce.audience.members',
  'trial-ending': 'announce.audience.trialEnding',
};

type TList =
  | { state: 'asking' }
  | { state: 'failed'; key: TranslationKey }
  | { state: 'ready'; announcements: IAdminAnnouncement[] };

const bridge = () => window.electron?.ipcRenderer;

/**
 * The admin's announcements of new scenes (premium migration 0050): the
 * composer on top, and every one still to go out or still being shown under
 * it — one not out yet can be changed or cancelled, one out can be cancelled,
 * which stops it reaching anybody who has not seen it yet.
 */
export default function AdminAnnouncements() {
  const { t, locale } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [list, setList] = useState<TList>({ state: 'asking' });
  const [trialEnds, setTrialEnds] = useState<number[]>();
  const [editing, setEditing] = useState<IAdminAnnouncement>();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    tone: 'done' | 'failed';
    text: string;
  }>();
  const [cancelling, setCancelling] = useState<number>();

  useEffect(() => {
    let current = true;
    setList({ state: 'asking' });
    const api = bridge();
    const asked = api?.adminAnnouncements?.();
    if (!asked) {
      setList({ state: 'failed', key: INSIGHT_ERRORS.offline });
      return undefined;
    }
    asked
      .then((outcome) => {
        if (current) {
          setList(
            outcome.ok
              ? { state: 'ready', announcements: outcome.value }
              : { state: 'failed', key: INSIGHT_ERRORS[outcome.reason] },
          );
        }
        return undefined;
      })
      .catch(() => {
        if (current) {
          setList({ state: 'failed', key: INSIGHT_ERRORS.offline });
        }
      });
    api
      ?.adminTrialEnds?.()
      .then((outcome) => {
        if (current && outcome.ok) {
          setTrialEnds(outcome.value);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [attempt]);

  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const save = (draft: IAnnouncementDraft) => {
    const asked = bridge()?.adminSaveAnnouncement?.(draft);
    if (!asked) {
      setResult({ tone: 'failed', text: t(INSIGHT_ERRORS.offline) });
      return;
    }
    setSaving(true);
    setResult(undefined);
    asked
      .then((outcome) => {
        setSaving(false);
        if (outcome.ok) {
          setEditing(undefined);
          setResult({
            tone: 'done',
            text: t('announce.done', { date: when.format(draft.startsAt) }),
          });
          setAttempt((count) => count + 1);
        } else {
          setResult({
            tone: 'failed',
            text: t(INSIGHT_ERRORS[outcome.reason]),
          });
        }
        return undefined;
      })
      .catch(() => {
        setSaving(false);
        setResult({ tone: 'failed', text: t(INSIGHT_ERRORS.offline) });
      });
  };

  const cancel = (id: number) => {
    bridge()
      ?.adminCancelAnnouncement?.(id)
      .then((outcome) => {
        setCancelling(undefined);
        if (outcome.ok) {
          setAttempt((count) => count + 1);
        } else {
          setResult({
            tone: 'failed',
            text: t(INSIGHT_ERRORS[outcome.reason]),
          });
        }
        return undefined;
      })
      .catch(() => {
        setCancelling(undefined);
        setResult({ tone: 'failed', text: t(INSIGHT_ERRORS.offline) });
      });
  };

  const now = Date.now();

  return (
    <div className="gallery-page admin-announcements">
      <p className="gallery-fine">{t('announce.pageHint')}</p>
      <AnnouncementComposer
        key={editing?.id ?? 'new'}
        editing={editing}
        trialEnds={trialEnds}
        saving={saving}
        onSave={save}
        onCancelEdit={() => setEditing(undefined)}
      />
      {result && (
        <p
          className={`admin-announcements__result is-${result.tone}`}
          role="status"
        >
          <Glyph name={result.tone === 'done' ? 'check' : 'alert'} />
          <span>{result.text}</span>
        </p>
      )}

      <h3 className="account-deletion__eyebrow">{t('announce.listTitle')}</h3>
      {list.state === 'failed' && (
        <GalleryListNotice
          text={t(list.key)}
          onRetry={() => setAttempt((count) => count + 1)}
        />
      )}
      {list.state === 'ready' && list.announcements.length === 0 && (
        <p className="gallery-fine">{t('announce.listEmpty')}</p>
      )}
      {list.state === 'ready' && list.announcements.length > 0 && (
        <ul className="admin-announcements__list">
          {list.announcements.map((announcement) => {
            const out = announcement.startsAt <= now;
            return (
              <li key={announcement.id} className="admin-announcements__row">
                <span
                  className="admin-announcements__thumbs"
                  aria-hidden="true"
                >
                  {announcement.scenes.slice(0, 3).map((scene) => (
                    <ScenePicture
                      key={scene.sceneId}
                      scene={{
                        lookId: premiumLookId(scene.sceneId),
                        authorId: FLUIDEQ_CREATOR_ID,
                        sceneId: scene.sceneId,
                        version: scene.version,
                      }}
                    />
                  ))}
                </span>
                <span className="admin-announcements__what">
                  <span className="admin-announcements__title">
                    {announcement.title}
                  </span>
                  <span className="admin-announcements__meta">
                    <span
                      className={`admin-account__tag${out ? ' is-plus' : ''}`}
                    >
                      {out
                        ? t('announce.state.out')
                        : t('announce.state.later')}
                    </span>
                    <span>{when.format(announcement.startsAt)}</span>
                    <span>{t(AUDIENCE_NAMES[announcement.audience])}</span>
                    <span>
                      {announcement.scenes
                        .map((scene) => resolveSceneName(scene, locale))
                        .join(' · ')}
                    </span>
                  </span>
                </span>
                <span className="admin-announcements__actions">
                  {cancelling === announcement.id ? (
                    <>
                      <span className="gallery-fine">
                        {out
                          ? t('announce.cancelOut')
                          : t('announce.cancelAsk')}
                      </span>
                      <button
                        type="button"
                        className="button small subtle"
                        onClick={() => setCancelling(undefined)}
                      >
                        {t('announce.keep')}
                      </button>
                      <button
                        type="button"
                        className="button small"
                        onClick={() => cancel(announcement.id)}
                      >
                        {t('announce.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      {!out && (
                        <button
                          type="button"
                          className="button small subtle"
                          onClick={() => setEditing(announcement)}
                        >
                          {t('announce.edit')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="button small subtle"
                        onClick={() => setCancelling(announcement.id)}
                      >
                        {t('announce.cancel')}
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
