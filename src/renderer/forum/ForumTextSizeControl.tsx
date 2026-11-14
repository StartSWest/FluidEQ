import { useTranslation } from '../utils/I18nContext';
import {
  FORUM_TEXT_STEPS,
  largerForumText,
  resetForumText,
  smallerForumText,
  useForumTextSize,
} from './forumTextSize';

/**
 * The Forum's text size: smaller, the size now (pressed, back to 100%) and
 * larger. A small A and a large A, the marks every reader already knows from
 * a browser or an e-reader, with their names spoken and the new size said
 * aloud after each press.
 */
export default function ForumTextSizeControl() {
  const { t, locale } = useTranslation();
  const size = useForumTextSize();
  const percent = new Intl.NumberFormat(locale, { style: 'percent' }).format(
    size,
  );
  const smallest = size === FORUM_TEXT_STEPS[0];
  const largest = size === FORUM_TEXT_STEPS[FORUM_TEXT_STEPS.length - 1];

  return (
    <div
      className="forum__text-size"
      role="group"
      aria-label={t('forum.textSize.label')}
    >
      <span className="forum__text-size-label" aria-hidden="true">
        {t('forum.textSize.label')}
      </span>
      <span className="forum__text-size-steps">
        <button
          type="button"
          className="forum__text-size-step"
          aria-label={t('forum.textSize.smaller')}
          title={t('forum.textSize.smallerKeys')}
          disabled={smallest}
          onClick={smallerForumText}
        >
          <span className="forum__text-size-a is-small" aria-hidden="true">
            A
          </span>
        </button>
        <button
          type="button"
          className="forum__text-size-value"
          aria-label={t('forum.textSize.reset', { percent })}
          title={t('forum.textSize.resetKeys')}
          disabled={smallest}
          onClick={resetForumText}
        >
          {percent}
        </button>
        <button
          type="button"
          className="forum__text-size-step"
          aria-label={t('forum.textSize.larger')}
          title={t('forum.textSize.largerKeys')}
          disabled={largest}
          onClick={largerForumText}
        >
          <span className="forum__text-size-a is-large" aria-hidden="true">
            A
          </span>
        </button>
      </span>
      <span className="forum__text-size-said" role="status">
        {t('forum.textSize.now', { percent })}
      </span>
    </div>
  );
}
