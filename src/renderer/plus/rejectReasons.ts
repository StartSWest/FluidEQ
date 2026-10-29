import type { TranslationKey } from 'common/i18n';
import type { TRejectReason } from 'common/plusReview';

/** Why a scene was sent back, as its maker reads it. */
export const REJECT_REASON_LABELS: Record<TRejectReason, TranslationKey> = {
  flashing: 'review.reason.flashing',
  rights: 'review.reason.rights',
  offensive: 'review.reason.offensive',
  broken: 'review.reason.broken',
  other: 'review.reason.other',
};
