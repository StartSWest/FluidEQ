import type { IForumFailure } from 'common/forum/forumTypes';
import type { Translate } from 'common/i18n';

/**
 * The sentence for a failure word. A refusal GitHub explained in its own
 * words gets those words after ours: "GitHub turned that down" alone leaves
 * the person guessing, and GitHub's reason is usually the fix.
 */
const failureMessage = (
  failure: IForumFailure,
  t: Translate,
  locale: string,
): string => {
  switch (failure.failure) {
    case 'network':
      return t('forum.error.network');
    case 'signed_out':
      return t('forum.error.signed_out');
    case 'rate_limited':
      return failure.retryAt
        ? t('forum.error.rate_limited', {
            time: new Intl.DateTimeFormat(locale, {
              timeStyle: 'short',
            }).format(failure.retryAt),
          })
        : t('forum.error.rateLimitedSoon');
    case 'forbidden':
      return failure.detail
        ? `${t('forum.error.forbidden')} ${failure.detail}`
        : t('forum.error.forbidden');
    case 'locked':
      return t('forum.error.locked');
    case 'not_found':
      return t('forum.error.not_found');
    case 'unconfigured':
      return t('forum.error.unconfigured');
    case 'cancelled':
      return '';
    default:
      return failure.detail
        ? `${t('forum.error.rejected')} ${failure.detail}`
        : t('forum.error.rejected');
  }
};

export default failureMessage;
