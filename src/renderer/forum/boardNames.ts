import type { IForumBoard } from 'common/forum/forumTypes';
import type { Translate, TranslationKey } from 'common/i18n';

/**
 * A board's name and line in the reader's language.
 *
 * GitHub's category names are English and belong to whoever set the
 * repository up, so the ones this repository ships with — GitHub's defaults —
 * are translated here by slug. A board added on GitHub later shows the name
 * and description GitHub has for it.
 */

const KEYS: Record<string, [TranslationKey, TranslationKey]> = {
  announcements: [
    'forum.board.announcements',
    'forum.boardDescription.announcements',
  ],
  general: ['forum.board.general', 'forum.boardDescription.general'],
  ideas: ['forum.board.ideas', 'forum.boardDescription.ideas'],
  polls: ['forum.board.polls', 'forum.boardDescription.polls'],
  'q-a': ['forum.board.qa', 'forum.boardDescription.qa'],
  'show-and-tell': [
    'forum.board.showAndTell',
    'forum.boardDescription.showAndTell',
  ],
};

export const boardName = (
  slug: string,
  boards: readonly IForumBoard[],
  t: Translate,
): string => {
  const keys = KEYS[slug];
  if (keys) {
    return t(keys[0]);
  }
  return boards.find((board) => board.slug === slug)?.name ?? slug;
};

export const boardDescription = (
  slug: string,
  boards: readonly IForumBoard[],
  t: Translate,
): string => {
  const keys = KEYS[slug];
  if (keys) {
    return t(keys[1]);
  }
  return boards.find((board) => board.slug === slug)?.description ?? '';
};

/** What to tell someone about to post on a board, where there is something. */
export const boardGuidance = (
  slug: string,
  t: Translate,
): string | undefined => {
  switch (slug) {
    case 'q-a':
      return t('forum.compose.guidance.qa');
    case 'ideas':
      return t('forum.compose.guidance.ideas');
    case 'show-and-tell':
      return t('forum.compose.guidance.showAndTell');
    default:
      return undefined;
  }
};
