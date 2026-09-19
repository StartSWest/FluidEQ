/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IReviewItem, TReviewAnswer } from 'common/plusReview';
import { resolveSceneName, type IScenePack } from 'common/scenePacks';
import type { TReviewAnswerOutcome } from 'main/ipc/plusReview';
import Avatar from '../community/Avatar';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { setGalleryNotice } from './galleryActions';
import { markGalleryStale } from './galleryStore';
import { categoriesLabel } from './GalleryParts';
import { isReviewing, openAdminSection } from './plusNavigation';
import ReviewDecision from './ReviewDecision';
import ReviewPicture from './ReviewPicture';
import ScenePreview, { type TPreviewTrouble } from './ScenePreview';

type TAnswerFailure = Extract<TReviewAnswerOutcome, { ok: false }>['reason'];

const ANSWER_FAILURES: Record<TAnswerFailure, TranslationKey> = {
  offline: 'review.failed',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'review.failed',
  forbidden: 'review.forbidden',
  changed: 'review.changed',
  'version-not-raised': 'review.versionRaised',
  'files-failed': 'review.filesFailed',
  'taken-down': 'review.takenDown',
  deleted: 'review.deleted',
};

const PREVIEW_TROUBLE: Record<TPreviewTrouble, TranslationKey> = {
  heavy: 'plus.scene.heavy',
  // Not the gallery's 'cannot be downloaded': the file arrived, verified;
  // what failed is running it here.
  unavailable: 'review.sceneFailed',
  compile: 'plus.scene.broken',
};

type TScene =
  | { state: 'loading' }
  | { state: 'ready'; pack: IScenePack }
  | { state: 'failed'; key: TranslationKey };

interface IReviewSceneProps {
  item: IReviewItem;
}

/**
 * One scene waiting for review, playing on the admin's own music, with what
 * is known about it beside it and the answer under that.
 *
 * Laid out as a gallery scene's page is, because that is what approving it
 * makes it: what the admin sees here is what every member will. The scene is
 * the exact file the queue named — main refuses any other — and it plays
 * through the same runner with the brightness limiter on, as a stranger's
 * scene does everywhere else in the app: being watched by the admin is no
 * reason to hand a flashing picture to anybody at full strength.
 */
export default function ReviewScene({ item }: IReviewSceneProps) {
  const { t, locale } = useTranslation();
  const [scene, setScene] = useState<TScene>({ state: 'loading' });
  const [live, setLive] = useState(false);
  const [trouble, setTrouble] = useState<TranslationKey>();
  const [working, setWorking] = useState<TReviewAnswer['action']>();
  const [failure, setFailure] = useState<TranslationKey>();
  const name = resolveSceneName(item, locale);
  const maker =
    item.authorName ?? item.authorHandle ?? t('plus.card.anonymous');
  const dates = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  useEffect(() => {
    let current = true;
    setScene({ state: 'loading' });
    setLive(false);
    setTrouble(undefined);
    window.electron?.ipcRenderer
      ?.reviewScene?.(item.authorId, item.sceneId, item.sha256)
      .then((outcome) => {
        if (!current) {
          return undefined;
        }
        setScene(
          outcome.ok
            ? { state: 'ready', pack: outcome.pack }
            : {
                state: 'failed',
                key:
                  outcome.reason === 'changed'
                    ? 'review.changed'
                    : 'review.sceneFailed',
              },
        );
        return undefined;
      })
      .catch(() => {
        if (current) {
          setScene({ state: 'failed', key: 'review.sceneFailed' });
        }
      });
    return () => {
      current = false;
    };
  }, [item.authorId, item.sceneId, item.sha256]);

  const markLive = useCallback(() => setLive(true), []);

  /**
   * What became of an answer. The reply can arrive after the admin went back
   * and opened another scene: then it neither moves that page nor lands on
   * it, and is said on the admin place's own line instead, where it is seen.
   */
  const settle = (outcome: TReviewAnswerOutcome, sent: TReviewAnswer) => {
    const here = isReviewing(item);
    if (here) {
      setWorking(undefined);
    }
    if (outcome.ok) {
      if (sent.action === 'approve') {
        markGalleryStale();
      }
      setGalleryNotice({
        ok: true,
        key:
          sent.action === 'approve'
            ? 'review.done.approved'
            : 'review.done.rejected',
        vars: { name },
      });
    } else if (outcome.reason === 'changed' || !here) {
      // What waits is not what was watched, or this page is gone: the list
      // has what waits now.
      setGalleryNotice({ ok: false, key: ANSWER_FAILURES[outcome.reason] });
    } else {
      setFailure(ANSWER_FAILURES[outcome.reason]);
      return;
    }
    if (here) {
      openAdminSection('review');
    }
  };

  const answer = (next: TReviewAnswer) => {
    setWorking(next.action);
    setFailure(undefined);
    window.electron?.ipcRenderer
      ?.answerReview?.(
        item.authorId,
        item.sceneId,
        item.version,
        item.sha256,
        next,
      )
      .then((outcome) => {
        settle(outcome, next);
        return undefined;
      })
      .catch(() => {
        settle({ ok: false, reason: 'server' }, next);
      });
  };

  // Nothing is approved unseen: the scene has to have drawn on the admin's
  // own screen, playing, with nothing wrong with it. A taken-down scene takes
  // no new version at all (server migration 0038) until it is restored.
  const watched =
    scene.state === 'ready' && live && trouble === undefined && !item.takenDown;

  return (
    <>
      <div className="gallery-pagebar">
        <button
          type="button"
          className="gallery-back"
          onClick={() => openAdminSection('review')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
          {t('review.back')}
        </button>
        <span className="gallery-pagebar__title">{name}</span>
      </div>
      <div className="gallery-page gallery-scene review-scene">
        <div className="gallery-scene__main">
          <div className="gallery-preview">
            <ReviewPicture
              authorId={item.authorId}
              sceneId={item.sceneId}
              sha256={item.sha256}
              className={`gallery-preview__still${live ? ' is-behind' : ''}`}
            />
            {scene.state === 'ready' && (
              <ScenePreview
                identity={`${item.lookId}@${item.version}:${item.sha256}`}
                madeBy="member"
                pack={scene.pack}
                label={t('plus.scene.playing')}
                onTrouble={(next) => setTrouble(PREVIEW_TROUBLE[next])}
                onDrawn={markLive}
              />
            )}
            {(scene.state === 'loading' ||
              (scene.state === 'ready' && !live && !trouble)) && (
              <span
                className="gallery-preview__veil gallery-preview__wait"
                role="status"
                aria-live="polite"
              >
                <span className="gallery-preview__wait-mark" aria-hidden="true">
                  <Glyph
                    name={scene.state === 'loading' ? 'download' : 'looks'}
                  />
                </span>
                <span className="gallery-preview__wait-title">
                  {t(
                    scene.state === 'loading'
                      ? 'plus.scene.loading'
                      : 'plus.scene.starting',
                  )}
                </span>
                <span className="gallery-preview__wait-name">{name}</span>
              </span>
            )}
            {(scene.state === 'failed' || trouble) && (
              <span
                className="gallery-preview__veil gallery-preview__veil--failed"
                role="alert"
              >
                {t(
                  scene.state === 'failed'
                    ? scene.key
                    : (trouble ?? 'review.sceneFailed'),
                )}
              </span>
            )}
            {scene.state === 'ready' && live && !trouble && (
              <span className="gallery-preview__tag">
                <span className="gallery-preview__live" aria-hidden="true" />
                {t('plus.scene.playing')}
              </span>
            )}
          </div>
        </div>

        <aside className="gallery-scene__info">
          <header className="gallery-scene__head">
            <span className="eyebrow gallery-scene__kicker">
              {categoriesLabel(t, item)}
            </span>
            <h3 className="gallery-scene__name">{name}</h3>
            <div className="gallery-scene__byline">
              <span className="gallery-scene__maker">
                <Avatar
                  handle={item.authorHandle ?? item.authorId}
                  displayName={item.authorName ?? undefined}
                />
                <span className="gallery-scene__maker-name">{maker}</span>
              </span>
            </div>
          </header>

          <section className="review-card" aria-label={t('review.tab')}>
            <div className="review-card__facts">
              <span
                className={`review-kind${item.liveVersion ? ' review-kind--update' : ''}`}
              >
                {item.liveVersion
                  ? t('review.kind.update', {
                      from: String(item.liveVersion),
                      to: String(item.version),
                    })
                  : t('review.kind.new')}
              </span>
              <span className="review-card__when">
                {t('review.sent', {
                  date: dates.format(new Date(item.submittedAt)),
                })}
              </span>
            </div>
            <div className="review-card__note">
              <span className="review-card__label">
                {t('review.note.title')}
              </span>
              {item.note ? (
                <p>{item.note}</p>
              ) : (
                <p className="review-card__none">{t('review.note.none')}</p>
              )}
            </div>
            {(item.takenDown || item.authorBanned || item.openReports > 0) && (
              <ul className="review-card__flags">
                {item.takenDown && <li>{t('review.flag.takenDownHint')}</li>}
                {item.authorBanned && (
                  <li>{t('plus.moderation.makerBanned')}</li>
                )}
                {item.openReports > 0 && (
                  <li>
                    {t('review.flag.reports', {
                      count: String(item.openReports),
                    })}
                  </li>
                )}
              </ul>
            )}
          </section>

          <ReviewDecision
            working={working}
            watched={watched}
            onAnswer={answer}
          />
          {failure && (
            <p className="gallery-dialog__error" role="alert">
              {t(failure)}
            </p>
          )}
          <p className="gallery-fine">
            {t(item.liveVersion ? 'review.fine.update' : 'review.fine.new', {
              version: String(item.liveVersion ?? item.version),
            })}
          </p>
        </aside>
      </div>
    </>
  );
}
