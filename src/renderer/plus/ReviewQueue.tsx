/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IReviewItem } from 'common/plusReview';
import type { TReviewQueueOutcome } from 'main/ipc/plusReview';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import GalleryListNotice from './GalleryListNotice';
import { setReviewWaiting } from './moderationStore';
import { openReviewItem, usePlusNavigation } from './plusNavigation';
import ReviewRow from './ReviewRow';
import ReviewScene from './ReviewScene';
import { useSceneReview } from './sceneReviewStore';
import '../styles/GalleryModeration.scss';
import '../styles/Review.scss';

type TListFailure = Extract<TReviewQueueOutcome, { ok: false }>['reason'];

const LIST_ERRORS: Record<TListFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
  forbidden: 'review.forbidden',
};

type TQueue =
  | { state: 'loading' }
  | { state: 'ready'; items: IReviewItem[] }
  | { state: 'failed'; key: TranslationKey };

interface IReviewListProps {
  me: string | undefined;
}

/**
 * Everything waiting for the admin, oldest first: the order members sent it
 * in, so nobody waits behind a scene that arrived after theirs.
 *
 * Read afresh every time it is opened — a tab pressed again and "Review now"
 * on a notice included — because it is short, it is the one list the admin
 * comes here to work through, and a list read before an answer was given, or
 * before a scene arrived, is a list that is wrong. Read again, too, when the
 * count the rest of the app hears stops matching the list on screen.
 */
function ReviewList({ me }: IReviewListProps) {
  const { t } = useTranslation();
  const { adminVisit } = usePlusNavigation();
  const { waiting } = useSceneReview();
  const [queue, setQueue] = useState<TQueue>({ state: 'loading' });

  const load = useCallback(() => {
    let current = true;
    setQueue({ state: 'loading' });
    window.electron?.ipcRenderer
      ?.listReviewQueue?.()
      .then((outcome) => {
        if (!current) {
          return undefined;
        }
        setQueue(
          outcome.ok
            ? { state: 'ready', items: outcome.items }
            : { state: 'failed', key: LIST_ERRORS[outcome.reason] },
        );
        return undefined;
      })
      .catch(() => {
        if (current) {
          setQueue({ state: 'failed', key: 'plus.gallery.error.offline' });
        }
      });
    return () => {
      current = false;
    };
  }, []);

  // A scene arrived, or was answered elsewhere, while the list was open: the
  // count the rest of the app hears moved away from the list on screen. Once
  // per move — a count that stays wrong is not news, and asking again on it
  // would ask forever.
  const [moved, setMoved] = useState(0);
  const lastWaiting = useRef(waiting);
  const shown = queue.state === 'ready' ? queue.items.length : undefined;
  useEffect(() => {
    if (waiting === lastWaiting.current) {
      return;
    }
    lastWaiting.current = waiting;
    if (shown !== undefined && waiting !== undefined && waiting !== shown) {
      setMoved((count) => count + 1);
    }
  }, [waiting, shown]);

  useEffect(load, [load, adminVisit, moved]);

  // The badges follow the list on screen: it is the freshest answer there is.
  useEffect(() => {
    if (queue.state === 'ready') {
      setReviewWaiting(me, queue.items.length);
    }
  }, [queue, me]);

  return (
    <div className="gallery-page gallery-moderation review-queue">
      <div className="gallery-moderation__intro">
        <span
          className="gallery-moderation__mark review-queue__mark"
          aria-hidden="true"
        >
          <Glyph name="check" />
        </span>
        <p className="gallery-fine">{t('review.hint')}</p>
      </div>

      {queue.state === 'failed' && (
        <GalleryListNotice text={t(queue.key)} onRetry={load} />
      )}

      {queue.state === 'loading' && (
        <div
          className="gallery-rows"
          role="status"
          aria-label={t('plus.gallery.loading')}
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="gallery-row gallery-row--skeleton"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {queue.state === 'ready' && queue.items.length === 0 && (
        <div className="community__empty gallery-empty">
          <span className="community__empty-mark" aria-hidden="true">
            <Glyph name="check" />
          </span>
          <p className="community__empty-title">{t('review.empty.title')}</p>
          <p className="community__empty-hint">{t('review.empty.hint')}</p>
        </div>
      )}

      {queue.state === 'ready' && queue.items.length > 0 && (
        <ul className="gallery-rows">
          {queue.items.map((item) => (
            <ReviewRow
              key={`${item.lookId}@${item.version}:${item.sha256}`}
              item={item}
              onOpen={() => openReviewItem(item)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface IReviewQueueProps {
  me: string | undefined;
}

/** The admin's page of scenes to approve: the list, or the one opened from it. */
export default function ReviewQueue({ me }: IReviewQueueProps) {
  const { reviewing } = usePlusNavigation();
  return reviewing ? (
    <ReviewScene
      key={`${reviewing.lookId}@${reviewing.version}:${reviewing.sha256}`}
      item={reviewing}
      me={me}
    />
  ) : (
    <ReviewList me={me} />
  );
}
