/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IReviewItem } from 'common/plusReview';
import { resolveSceneName } from 'common/scenePacks';
import { useTranslation } from '../utils/I18nContext';
import { categoriesLabel } from './GalleryParts';
import ReviewPicture from './ReviewPicture';

interface IReviewRowProps {
  item: IReviewItem;
  onOpen: () => void;
}

/**
 * One scene waiting for the admin: its picture, who made it, whether it is
 * new to the gallery or a new version of one already there — and which — and
 * what its maker said about it. Opening it is the only thing a row offers:
 * nothing is approved without being watched first.
 */
export default function ReviewRow({ item, onOpen }: IReviewRowProps) {
  const { t, locale } = useTranslation();
  const name = resolveSceneName(item, locale);
  const maker =
    item.authorName ?? item.authorHandle ?? t('plus.card.anonymous');
  const dates = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <li className="gallery-row review-row">
      <ReviewPicture
        className="gallery-row__picture"
        authorId={item.authorId}
        sceneId={item.sceneId}
        sha256={item.sha256}
      />
      <span className="gallery-row__text">
        <span className="gallery-row__name">{name}</span>
        <span className="gallery-row__meta">
          {t('plus.card.by', { name: maker })} · {categoriesLabel(t, item)}
        </span>
        <span className="review-row__facts">
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
          <span className="review-row__when">
            {t('review.sent', {
              date: dates.format(new Date(item.submittedAt)),
            })}
          </span>
        </span>
        {item.note && <span className="review-row__note">{item.note}</span>}
        {(item.takenDown || item.authorBanned || item.openReports > 0) && (
          <span className="review-row__flags">
            {item.takenDown && (
              <span className="gallery-row__blocked">
                {t('review.flag.takenDown')}
              </span>
            )}
            {item.authorBanned && (
              <span className="gallery-row__blocked">
                {t('plus.moderation.makerBanned')}
              </span>
            )}
            {item.openReports > 0 && (
              <span className="gallery-row__blocked">
                {t('review.flag.reports', {
                  count: String(item.openReports),
                })}
              </span>
            )}
          </span>
        )}
      </span>
      <span className="gallery-row__actions">
        <button type="button" className="button small" onClick={onOpen}>
          {t('review.open')}
        </button>
      </span>
    </li>
  );
}
