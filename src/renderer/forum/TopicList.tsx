import { useState } from 'react';
import type { IForumBoard, IForumTopicSummary } from 'common/forum/forumTypes';
import type { Translate } from 'common/i18n';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { boardDescription, boardName } from './boardNames';
import ForumAvatar from './ForumAvatar';
import ForumGlyph, { boardGlyph } from './ForumGlyph';
import {
  type IForumState,
  loadMoreTopics,
  openTopic,
  refreshForum,
  searchForum,
  setFilter,
  signIn,
  startCompose,
} from './forumStore';
import { absoluteTime, relativeTime } from './forumTime';

interface ITopicListProps {
  forum: IForumState;
}

/**
 * One board's topics — or every board's, or a search's — newest activity
 * first, with the board's own header and the way to start a topic.
 */
const FILTER_KEYS = {
  all: 'forum.filter.all',
  answered: 'forum.filter.answered',
  unanswered: 'forum.filter.unanswered',
} as const;

/** What the header says: the search, the board, or every board. */
const headingOf = (forum: IForumState, t: Translate) => {
  if (forum.search) {
    return {
      title: t('forum.search.heading', { query: forum.search }),
      description: '',
      glyph: 'search' as const,
    };
  }
  if (forum.board) {
    return {
      title: boardName(forum.board, forum.boards, t),
      description: boardDescription(forum.board, forum.boards, t),
      glyph: boardGlyph(forum.board),
    };
  }
  return {
    title: t('forum.allTopics'),
    description: t('forum.allTopics.blurb'),
    glyph: 'threads' as const,
  };
};

export default function TopicList({ forum }: ITopicListProps) {
  const { t, locale } = useTranslation();
  const searching = forum.search !== '';
  const current = forum.boards.find((board) => board.slug === forum.board);
  const signedIn = forum.auth.status === 'signed-in';
  const canWrite = forum.auth.status !== 'unconfigured';
  const heading = headingOf(forum, t);
  const loading = forum.listStatus === 'loading';

  return (
    <div className="forum__list-view">
      <header className="community__head forum__head">
        <span className="community__head-mark">
          <ForumGlyph name={heading.glyph} />
        </span>
        <span className="community__head-text">
          <span className="community__head-name">{heading.title}</span>
          {heading.description && (
            <span className="community__head-description">
              {heading.description}
            </span>
          )}
        </span>
        <span className="forum__head-actions">
          <button
            type="button"
            className={`forum__icon-button${loading ? ' is-busy' : ''}`}
            aria-label={t('forum.refresh')}
            title={t('forum.refresh')}
            onClick={() => {
              refreshForum().catch(() => undefined);
            }}
          >
            <ForumGlyph name="refresh" />
          </button>
          {canWrite && (
            <button
              type="button"
              className="button small forum__new"
              onClick={() => {
                if (signedIn) {
                  startCompose();
                } else {
                  signIn(locale).catch(() => undefined);
                }
              }}
              disabled={forum.auth.status === 'signing-in'}
            >
              <ForumGlyph name="plus" />
              {signedIn ? t('forum.newTopic') : t('forum.signInToPost')}
            </button>
          )}
        </span>
      </header>

      <div className="forum__toolbar">
        {/* Keyed by the search it shows, so picking a board in the rail —
            which clears the search — also clears the box. */}
        <SearchBox key={forum.search} committed={forum.search} />
        {!searching && current?.isAnswerable && (
          <div
            className="segmented forum__filters"
            role="radiogroup"
            aria-label={t('forum.filter.label')}
          >
            {(['all', 'answered', 'unanswered'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                role="radio"
                aria-checked={forum.filter === filter}
                className={`segmented__option${forum.filter === filter ? ' is-selected' : ''}`}
                onClick={() => setFilter(filter)}
              >
                {t(FILTER_KEYS[filter])}
              </button>
            ))}
          </div>
        )}
      </div>

      {!signedIn && <p className="forum__notice">{t('forum.feedNotice')}</p>}

      <div className="forum__scroll">
        {loading && forum.topics.length === 0 ? (
          <TopicSkeleton />
        ) : (
          <ul className="forum__topics">
            {forum.topics.map((topic) => (
              <li key={topic.number}>
                <TopicRow
                  topic={topic}
                  boards={forum.boards}
                  showBoard={searching || !forum.board}
                  locale={locale}
                />
              </li>
            ))}
          </ul>
        )}

        {forum.listStatus === 'ready' && forum.topics.length === 0 && (
          <div className="community__empty">
            <span className="community__empty-mark" aria-hidden="true">
              <ForumGlyph name={searching ? 'search' : 'threads'} />
            </span>
            <p className="community__empty-title">
              {searching ? t('forum.empty.search') : t('forum.empty.board')}
            </p>
            <p className="community__empty-hint">
              {searching
                ? t('forum.empty.searchHint')
                : t('forum.empty.boardHint')}
            </p>
          </div>
        )}

        {forum.cursor && (
          <button
            type="button"
            className="button small subtle forum__more"
            disabled={forum.listStatus === 'more'}
            onClick={loadMoreTopics}
          >
            {forum.listStatus === 'more'
              ? t('forum.loading')
              : t('forum.loadMore')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Search runs on Enter rather than on every key. GitHub's search allows a
 * few requests a minute, and the only way to search as-you-type within that
 * is a timer deciding when the typing stopped — which this project does not
 * write.
 */
function SearchBox({ committed }: { committed: string }) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState(committed);
  return (
    <form
      className="forum__search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        searchForum(typed);
      }}
    >
      <ForumGlyph name="search" className="forum__search-glyph" />
      <input
        type="search"
        className="forum__search-input"
        value={typed}
        placeholder={t('forum.search.placeholder')}
        aria-label={t('forum.search.placeholder')}
        maxLength={200}
        onChange={(event) => setTyped(event.target.value)}
      />
      {(typed || committed) && (
        <button
          type="button"
          className="forum__icon-button forum__search-clear"
          aria-label={t('forum.search.clear')}
          title={t('forum.search.clear')}
          onClick={() => {
            setTyped('');
            searchForum('');
          }}
        >
          <ForumGlyph name="close" />
        </button>
      )}
    </form>
  );
}

interface ITopicRowProps {
  topic: IForumTopicSummary;
  boards: readonly IForumBoard[];
  showBoard: boolean;
  locale: string;
}

function TopicRow({ topic, boards, showBoard, locale }: ITopicRowProps) {
  const { t } = useTranslation();
  const count = new Intl.NumberFormat(locale);
  return (
    <button
      type="button"
      className={`forum__topic${topic.answered ? ' is-answered' : ''}`}
      onClick={() => openTopic(topic.number)}
    >
      <ForumAvatar person={topic.author} className="forum__topic-avatar" />
      <span className="forum__topic-body">
        <span className="forum__topic-title">{topic.title}</span>
        {topic.excerpt && (
          <span className="forum__topic-excerpt">{topic.excerpt}</span>
        )}
        <span className="forum__topic-meta">
          {showBoard && (
            <span className="forum__chip">
              <ForumGlyph name={boardGlyph(topic.board)} />
              {boardName(topic.board, boards, t)}
            </span>
          )}
          {topic.answered && (
            <span className="forum__chip forum__chip--answer">
              <ForumGlyph name="answer" />
              {t('forum.topic.answered')}
            </span>
          )}
          {topic.locked && (
            <span className="forum__chip forum__chip--quiet">
              <Glyph name="lock" />
              {t('forum.topic.locked')}
            </span>
          )}
          <span className="forum__byline">
            <span className="forum__login">@{topic.author.login}</span>
            <span aria-hidden="true">·</span>
            <time
              dateTime={topic.updatedAt}
              title={absoluteTime(topic.updatedAt, locale)}
            >
              {relativeTime(topic.updatedAt, locale)}
            </time>
          </span>
        </span>
      </span>
      <span className="forum__topic-stats">
        <span
          className={`forum__stat${topic.replyCount > 0 ? ' is-lit' : ''}`}
          aria-label={t('forum.topic.replies', { count: topic.replyCount })}
          title={t('forum.topic.replies', { count: topic.replyCount })}
        >
          <Glyph name="general" />
          {count.format(topic.replyCount)}
        </span>
        <span
          className="forum__stat"
          aria-label={t('forum.topic.upvotes', { count: topic.upvotes })}
          title={t('forum.topic.upvotes', { count: topic.upvotes })}
        >
          <ForumGlyph name="upvote" />
          {count.format(topic.upvotes)}
        </span>
      </span>
    </button>
  );
}

/** Rows in the shape of topics, while the first page is on its way. */
function TopicSkeleton() {
  return (
    <ul className="forum__topics forum__topics--skeleton" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <li key={row}>
          <span className="forum__topic forum__topic--skeleton">
            <span className="forum__skeleton forum__skeleton--avatar" />
            <span className="forum__topic-body">
              <span className="forum__skeleton forum__skeleton--title" />
              <span className="forum__skeleton forum__skeleton--line" />
              <span className="forum__skeleton forum__skeleton--meta" />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
