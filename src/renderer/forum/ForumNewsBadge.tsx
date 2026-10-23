import { useTranslation } from '../utils/I18nContext';
import { newTopics } from './forumNew';
import { useForumValue } from './forumState';
import '../styles/Forum.scss';

/** Past this the badge stops counting: "99+" says "a lot" in three glyphs. */
const MOST_SHOWN = 99;

/**
 * How many topics have something this reader has not seen — the same number
 * the Forum's "New for you" row shows, so the two never disagree. Redraws only
 * when the number changes.
 */
export const useForumNewsCount = (): number =>
  useForumValue((forum) => newTopics(forum).length);

/** The count as the badge writes it, in the reader's own digits. */
export const forumNewsText = (count: number, locale: string): string => {
  const format = new Intl.NumberFormat(locale);
  return count > MOST_SHOWN
    ? `${format.format(MOST_SHOWN)}+`
    : format.format(count);
};

interface IForumNewsBadgeProps {
  count: number;
  /** Where it sits: on a button's corner, or at the end of a menu row. */
  placement: 'corner' | 'row';
}

/**
 * The Forum's count of what is new, in the yellow a second output's EQ is
 * edited in (Ivan, 2026-10-14: "in orange same color we use on second output
 * editing EQ yellow that color") — the one colour in the titlebar that is not
 * the accent, so it reads as a request for attention and not as a state.
 * Nothing is drawn while there is nothing new.
 */
export default function ForumNewsBadge({
  count,
  placement,
}: IForumNewsBadgeProps) {
  const { t, locale } = useTranslation();
  if (count <= 0) {
    return null;
  }
  const text = forumNewsText(count, locale);
  return (
    // Keyed by its text, so a new number arrives with the badge's pop
    // rather than changing silently under the reader's eye.
    <span
      key={text}
      className={`forum-news-badge forum-news-badge--${placement}`}
      role="img"
      aria-label={t('forum.new.countLabel', { count: text })}
    >
      {text}
    </span>
  );
}
