import { REPOSITORY_URL } from 'common/branding';
import {
  FORUM_ISSUES_BOARD,
  type IForumBoard,
  type IForumTopicSummary,
  type TForumAuthState,
} from 'common/forum/forumTypes';
import { useTranslation } from '../utils/I18nContext';
import { boardDescription, boardName } from './boardNames';
import ForumAvatar from './ForumAvatar';
import ForumGlyph, { boardGlyph, GithubMark } from './ForumGlyph';
import { BoardsLoading } from './ForumLoading';
import ForumNewsBadge from './ForumNewsBadge';
import { cancelSignIn, NEW_BOARD, signIn, signOut } from './forumStore';

interface IForumRailProps {
  boards: readonly IForumBoard[];
  board: string;
  /** Searching shows every board's topics, so no single board is lit. */
  searching: boolean;
  auth: TForumAuthState;
  /** The boards are being asked for and none are known yet. */
  loadingBoards: boolean;
  /** Every board's topics with something this reader has not read. */
  fresh: readonly IForumTopicSummary[];
  /** The repository's issues, open and closed, once known. */
  issueCount?: number;
  onSelect: (board: string) => void;
}

/**
 * The boards down the left, and at their foot who is writing.
 *
 * Drawn with the Plus rail's own rows, so the two tabs beside each other
 * in the titlebar read as one family: a picture in a tile, the name, what it
 * is for underneath, and a count where the count is known.
 */
export default function ForumRail({
  boards,
  board,
  searching,
  auth,
  loadingBoards,
  fresh,
  issueCount,
  onSelect,
}: IForumRailProps) {
  const { t, locale } = useTranslation();
  const count = new Intl.NumberFormat(locale);
  const total = boards.reduce(
    (sum, candidate) => sum + (candidate.topicCount ?? 0),
    0,
  );

  const row = (
    slug: string,
    name: string,
    blurb: string,
    glyph: ReturnType<typeof boardGlyph>,
    topics: number | undefined,
  ) => {
    const isActive = !searching && slug === board;
    // A board with something unread carries the accent's dot; the new ones'
    // own row carries their number instead, filled, because that number is
    // the request for attention a topic count is not.
    const unread = fresh.filter((topic) => topic.board === slug).length;
    // The issues' row says how many are new in the yellow Help's button
    // wears for the same news (Ivan, 2026-10-16), in place of its total.
    const isIssues = slug === FORUM_ISSUES_BOARD;
    return (
      <button
        key={slug || 'all'}
        type="button"
        className={`community__channel forum__board${isActive ? ' is-active' : ''}`}
        aria-current={isActive ? 'true' : undefined}
        title={blurb}
        onClick={() => onSelect(slug)}
      >
        <span className="community__channel-mark">
          <ForumGlyph name={glyph} />
        </span>
        <span className="community__channel-text">
          <span className="community__channel-name">
            {name}
            {slug !== NEW_BOARD && slug !== '' && !isIssues && unread > 0 && (
              <span
                className="forum__new-dot"
                role="img"
                aria-label={t('forum.new.countLabel', { count: unread })}
              />
            )}
          </span>
          <span className="community__channel-blurb">{blurb}</span>
        </span>
        {isIssues && unread > 0 && (
          <ForumNewsBadge count={unread} placement="row" />
        )}
        {topics !== undefined && topics > 0 && !(isIssues && unread > 0) && (
          <span
            className={`forum__count${slug === NEW_BOARD ? ' forum__count--new' : ''}`}
            aria-label={t(
              slug === NEW_BOARD
                ? 'forum.new.countLabel'
                : 'forum.board.countLabel',
              { count: topics },
            )}
          >
            {count.format(topics)}
          </span>
        )}
      </button>
    );
  };

  return (
    <nav className="community__rail forum__rail" aria-label={t('forum.title')}>
      <div className="community__rail-head">
        <span className="eyebrow">{t('forum.title')}</span>
        <span className="forum__source">
          <GithubMark />
          <span className="forum__source-word">{t('forum.source')}</span>
        </span>
      </div>

      <div className="community__channels">
        {row(
          NEW_BOARD,
          t('forum.new'),
          t('forum.new.blurb'),
          'inbox',
          fresh.length || undefined,
        )}
        {row(
          '',
          t('forum.allTopics'),
          t('forum.allTopics.blurb'),
          'threads',
          total || undefined,
        )}
        {loadingBoards && boards.length === 0 ? (
          <BoardsLoading />
        ) : (
          boards.map((candidate) =>
            row(
              candidate.slug,
              boardName(candidate.slug, boards, t),
              boardDescription(candidate.slug, boards, t),
              boardGlyph(candidate.slug),
              candidate.topicCount,
            ),
          )
        )}
        {/* GitHub's issues, after the boards: read here by everybody,
            answered on GitHub. */}
        {row(
          FORUM_ISSUES_BOARD,
          t('forum.board.issues'),
          t('forum.boardDescription.issues'),
          'issue',
          issueCount,
        )}
      </div>

      <ForumIdentity auth={auth} />
    </nav>
  );
}

function ForumIdentity({ auth }: { auth: TForumAuthState }) {
  const { t, locale } = useTranslation();

  if (auth.status === 'signed-in') {
    return (
      <div className="community__me forum__me">
        <ForumAvatar person={auth.viewer} size="rail" />
        <span className="community__me-text">
          <span className="community__name">@{auth.viewer.login}</span>
          <span className="community__handle">{t('forum.me.signedInAs')}</span>
        </span>
        <button
          type="button"
          className="community__link"
          onClick={() => {
            signOut().catch(() => undefined);
          }}
        >
          {t('forum.signOut')}
        </button>
      </div>
    );
  }

  if (auth.status === 'signing-in') {
    return (
      <div className="forum__identity forum__identity--waiting" role="status">
        <span className="forum__identity-title">
          <span className="forum__pulse" aria-hidden="true" />
          {t('forum.me.waitingTitle')}
        </span>
        <span className="forum__identity-body">
          {t('forum.me.waitingBody')}
        </span>
        <div className="forum__identity-actions">
          <a
            className="community__link"
            href={auth.authorizeUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('forum.me.openAgain')}
          </a>
          <button
            type="button"
            className="button small subtle"
            onClick={cancelSignIn}
          >
            {t('forum.cancel')}
          </button>
        </div>
      </div>
    );
  }

  if (auth.status === 'unconfigured') {
    return (
      <div className="forum__identity">
        <span className="forum__identity-title">
          {t('forum.me.readOnlyTitle')}
        </span>
        <span className="forum__identity-body">
          {t('forum.me.readOnlyBody')}
        </span>
        <a
          className="button small subtle forum__github-button"
          href={`${REPOSITORY_URL}/discussions`}
          target="_blank"
          rel="noreferrer noopener"
        >
          <GithubMark />
          {t('forum.openOnGithub')}
        </a>
      </div>
    );
  }

  return (
    <div className="forum__identity forum__identity--signed-out">
      <span className="forum__identity-title">
        {t('forum.me.signedOutTitle')}
      </span>
      <span className="forum__identity-body">
        {t('forum.me.signedOutBody')}
      </span>
      <button
        type="button"
        className="button small forum__github-button"
        onClick={() => {
          signIn(locale).catch(() => undefined);
        }}
      >
        <GithubMark />
        {t('forum.signIn')}
      </button>
    </div>
  );
}
