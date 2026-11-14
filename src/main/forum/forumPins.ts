import type {
  IForumTopicQuery,
  IForumTopicSummary,
} from '../../common/forum/forumTypes';

/**
 * The repository's pinned discussions, first in a list.
 *
 * GitHub pins up to four discussions for everyone (the welcome post, the
 * guides). Ordered by activity alone they sank under every new reply, so the
 * list a reader opens to learn where things are lost what it was meant to
 * lead with. A list a reader filtered down still shows only what the filter
 * lets through: a pin from another board, or one the filter excludes, stays
 * out. A search is ordered by GitHub's relevance and is left alone.
 */

/** Whether a pinned topic belongs in the list `query` asks for. */
const fitsQuery = (
  topic: IForumTopicSummary,
  query: IForumTopicQuery,
): boolean => {
  if (query.board && topic.board !== query.board) {
    return false;
  }
  if (query.filter === 'answered') {
    return topic.answered;
  }
  return query.filter === 'unanswered' ? !topic.answered : true;
};

/**
 * One page of a list read a page at a time (GitHub's API): the pins that fit
 * lead the first page, and no page repeats one of them further down.
 */
export const pinnedFirst = (
  page: readonly IForumTopicSummary[],
  pinned: readonly IForumTopicSummary[],
  query: IForumTopicQuery,
  isFirstPage: boolean,
): IForumTopicSummary[] => {
  if (query.search.trim() !== '') {
    return [...page];
  }
  const pinnedNumbers = new Set(pinned.map((topic) => topic.number));
  const rest = page.filter((topic) => !pinnedNumbers.has(topic.number));
  if (!isFirstPage) {
    return rest;
  }
  return [
    ...pinned
      .filter((topic) => fitsQuery(topic, query))
      .map((topic) => ({ ...topic, pinned: true })),
    ...rest,
  ];
};

/**
 * The order for a list held whole (the published feed): pins first, in
 * GitHub's order, then latest activity. `pinOrder` holds the pinned topics'
 * numbers as GitHub lists them.
 */
export const byPinThenActivity =
  (pinOrder: readonly number[]) =>
  (a: IForumTopicSummary, b: IForumTopicSummary): number => {
    const pinA = pinOrder.indexOf(a.number);
    const pinB = pinOrder.indexOf(b.number);
    if (pinA !== pinB) {
      if (pinA < 0) {
        return 1;
      }
      if (pinB < 0) {
        return -1;
      }
      return pinA - pinB;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  };
