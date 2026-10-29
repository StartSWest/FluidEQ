import {
  FORUM_ISSUES_BOARD,
  type IForumBoard,
  type IForumBoards,
  type IForumPerson,
  type IForumTopic,
  type IForumTopicPage,
  type IForumTopicQuery,
  type IForumTopicSummary,
  type TForumPostKind,
} from '../../common/forum/forumTypes';
import type { IForumConfig } from './forumConfig';
import ForumError from './forumError';
import type { IForumFeedSource } from './forumFeed';
import type { IForumIssuesSource } from './forumIssues';
import type { IIssuesLive } from './issuesLive';
import {
  type IRepositoryBoards,
  readBoardCounts,
  readBoards,
  readTopic,
  readTopicPage,
  readVote,
} from './forumGraphqlModel';
import {
  ADD_COMMENT,
  ADD_ISSUE_COMMENT,
  ADD_REPLY,
  ADD_VOTE,
  BOARDS_QUERY,
  boardCountsQuery,
  CREATE_TOPIC,
  DELETE_COMMENT,
  MARK_ANSWER,
  REMOVE_VOTE,
  SEARCH_QUERY,
  TOPIC_QUERY,
  TOPICS_QUERY,
  UNMARK_ANSWER,
  UPDATE_COMMENT,
  UPDATE_TOPIC_BODY,
  UPDATE_TOPIC_TITLE,
  VIEWER_QUERY,
} from './forumQueries';
import { arr, num, person, rec, str } from './forumRead';
import type { IForumSession } from './forumSession';
import { createGithubApi, type IGithubApi } from './githubApi';

/**
 * The forum's reads and writes, from whichever source can answer.
 *
 * Signed in to GitHub, everything goes to GitHub's API under the reader's own
 * token: live, complete, and carrying what this reader may do to each post.
 * Signed out, reads come from the published feed and there is nothing to
 * write with. The panel asks the same questions either way.
 */

const FEED_PAGE = 25;

export interface IForumService {
  boards(): Promise<IForumBoards>;
  topics(query: IForumTopicQuery): Promise<IForumTopicPage>;
  topic(number: number, cursor?: string): Promise<IForumTopic>;
  createTopic(board: string, title: string, body: string): Promise<number>;
  reply(topicId: string, body: string, replyToId?: string): Promise<void>;
  editPost(id: string, kind: TForumPostKind, body: string): Promise<void>;
  editTitle(topicId: string, title: string): Promise<void>;
  deletePost(id: string): Promise<void>;
  /** Casts this reader's vote, or takes it back; answers with the new count. */
  vote(id: string, on: boolean): Promise<{ votes: number; hasVoted: boolean }>;
  markAnswer(id: string, on: boolean): Promise<void>;
  preview(text: string): Promise<string>;
  /** Who a freshly minted token belongs to, before the session keeps it. */
  fetchViewer(accessToken: string): Promise<IForumPerson>;
}

export interface IForumServiceDeps {
  config: IForumConfig;
  session: IForumSession;
  feed: IForumFeedSource;
  /** The repository's issues; none where nothing publishes them. */
  issues?: IForumIssuesSource;
  /** The issues read from GitHub itself; the file above when it cannot. */
  live?: IIssuesLive;
  fetchImpl?: typeof fetch;
}

const NO_ISSUES: IForumIssuesSource = { load: () => Promise.resolve([]) };

/**
 * The words of a search, and nothing that reads as a qualifier. The query is
 * scoped with `repo:` on this side; a `repo:` or `org:` typed into the box
 * would widen it to somebody else's discussions.
 */
export const searchWords = (text: string): string =>
  text
    .replace(/\S+:\S*/g, ' ')
    .replace(/["\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A list row's worth of a topic: the feed's topics carry whole threads. */
const summaryOf = (topic: IForumTopic): IForumTopicSummary => ({
  id: topic.id,
  number: topic.number,
  title: topic.title,
  excerpt: topic.excerpt,
  createdAt: topic.createdAt,
  updatedAt: topic.updatedAt,
  url: topic.url,
  board: topic.board,
  answered: topic.answered,
  locked: topic.locked,
  replyCount: topic.replyCount,
  votes: topic.votes,
  author: topic.author,
  ...(topic.issue ? { issue: topic.issue } : {}),
});

const matchesWords = (topic: IForumTopic, words: string[]): boolean => {
  const haystack = `${topic.title} ${topic.excerpt} ${topic.post.bodyHtml}`
    .replace(/<[^>]*>/g, ' ')
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
};

/** The feed has every topic, so a page is a slice and the cursor an offset. */
const feedPage = (
  topics: readonly IForumTopic[],
  query: IForumTopicQuery,
): IForumTopicPage => {
  const words = searchWords(query.search)
    .toLowerCase()
    .split(' ')
    .filter(Boolean);
  const matching = topics
    .filter((topic) => {
      if (words.length) {
        return matchesWords(topic, words);
      }
      if (query.board && topic.board !== query.board) {
        return false;
      }
      // On the issues' row, "answered" is closed and "unanswered" open.
      const settled = topic.issue ? topic.issue.closed : topic.answered;
      if (query.filter === 'answered') {
        return settled;
      }
      return query.filter === 'unanswered' ? !settled : true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const start = Math.max(0, Math.floor(Number(query.cursor ?? 0)) || 0);
  const next = start + FEED_PAGE;
  return {
    topics: matching.slice(start, next).map(summaryOf),
    total: matching.length,
    ...(next < matching.length ? { cursor: String(next) } : {}),
  };
};

export const createForumService = ({
  config,
  session,
  feed,
  issues = NO_ISSUES,
  live,
  fetchImpl = fetch,
}: IForumServiceDeps): IForumService => {
  // The issues as GitHub has them now (`issuesLive.ts`), and the published
  // file whenever GitHub cannot be asked — it is at most five minutes behind.
  const allIssues = () =>
    live ? live.list().catch(() => issues.load()) : issues.load();
  // Opening a topic asks first whether its number is an issue's. A list that
  // cannot be read at all then means "not an issue", so an unreachable
  // GitHub and a missing file never stop a discussion from opening.
  const issuesOrNone = () => allIssues().catch(() => []);
  const issueThread = async (number: number, listed: IForumTopic) => {
    if (live) {
      try {
        return await live.thread(number);
      } catch {
        // Offline or past GitHub's limit: the published copy below.
      }
    }
    const published = await issues.load().catch(() => []);
    return published.find((issue) => issue.number === number) ?? listed;
  };
  const repository = { owner: config.owner, name: config.name };
  const api: IGithubApi = createGithubApi({
    accessToken: () => session.accessToken(),
    onUnauthorized: () => session.invalidate(),
    fetchImpl,
  });

  // Whether the sign-in's GitHub App may comment on this repository's
  // issues: it may not unless its owner gave it "Issues: Read and write"
  // and the installation on the repository accepted that. GitHub says which
  // through the reader's own token. A yes is kept for the token; a no, or a
  // failure to ask, is asked again at the next thread, so a permission
  // granted while the app runs is seen without signing in again.
  let issueWrites: { token: string; answer: Promise<boolean> } | undefined;
  const canWriteIssues = async (): Promise<boolean> => {
    if (!signedIn()) {
      return false;
    }
    const token = await session.accessToken().catch(() => '');
    if (!token) {
      return false;
    }
    if (issueWrites?.token !== token) {
      issueWrites = {
        token,
        answer: api
          .get('https://api.github.com/user/installations')
          .then((payload) =>
            arr(rec(payload).installations).some((value) => {
              const installation = rec(value);
              return (
                str(rec(installation.account).login).toLowerCase() ===
                  config.owner.toLowerCase() &&
                str(rec(installation.permissions).issues) === 'write'
              );
            }),
          )
          .catch(() => false),
      };
    }
    const asked = issueWrites;
    const answer = await asked.answer;
    if (!answer && issueWrites === asked) {
      issueWrites = undefined;
    }
    return answer;
  };
  // The repository's id and the boards' ids, which every new topic needs.
  // Kept from the last boards read under this sign-in.
  let known: IRepositoryBoards | undefined;
  // The panel asks for the boards and a board's topics at the same moment,
  // and the topics need a board's id: both wait on one request.
  let loadingBoards: Promise<IRepositoryBoards> | undefined;

  const signedIn = () => session.state().status === 'signed-in';

  const loadBoards = (): Promise<IRepositoryBoards> => {
    loadingBoards =
      loadingBoards ??
      api
        .graphql(BOARDS_QUERY, repository)
        .then((data) => {
          known = readBoards(data);
          return known;
        })
        .finally(() => {
          loadingBoards = undefined;
        });
    return loadingBoards;
  };

  const boardFor = async (slug: string): Promise<IForumBoard | undefined> => {
    const { boards } = known ?? (await loadBoards());
    return boards.find((board) => board.slug === slug);
  };

  const startable = (repo: IRepositoryBoards): string[] =>
    repo.boards
      .filter(
        (board) =>
          board.slug !== 'polls' &&
          (board.slug !== 'announcements' || repo.canAnnounce),
      )
      .map((board) => board.slug);

  return {
    boards: async () => {
      if (!signedIn()) {
        known = undefined;
        const [loaded, issueList] = await Promise.all([
          feed.load(),
          issuesOrNone(),
        ]);
        return {
          boards: loaded.boards,
          canStartIn: [],
          issueCount: issueList.length,
        };
      }
      const [repo, issueList] = await Promise.all([
        loadBoards(),
        issuesOrNone(),
      ]);
      const variables: Record<string, unknown> = { ...repository };
      repo.boards.forEach((board, index) => {
        variables[`c${index}`] = board.id;
      });
      const counts = await api.graphql(
        boardCountsQuery(repo.boards.length),
        variables,
      );
      return {
        boards: readBoardCounts(counts, repo.boards),
        canStartIn: startable(repo),
        issueCount: issueList.length,
      };
    },

    topics: async (query) => {
      // The issues' row reads GitHub for everybody, without a token, and
      // the published file when it cannot (`issuesLive.ts`). A search
      // still spans the discussions alone.
      if (query.board === FORUM_ISSUES_BOARD && !searchWords(query.search)) {
        return feedPage(await allIssues(), query);
      }
      if (!signedIn()) {
        return feedPage((await feed.load()).topics, query);
      }
      const words = searchWords(query.search);
      if (words) {
        const data = rec(
          await api.graphql(SEARCH_QUERY, {
            query: `repo:${config.owner}/${config.name} ${words}`,
            cursor: query.cursor ?? null,
          }),
        );
        const search = rec(data.search);
        return readTopicPage(search, num(search.discussionCount));
      }
      const board = query.board ? await boardFor(query.board) : undefined;
      const data = rec(
        await api.graphql(TOPICS_QUERY, {
          ...repository,
          cursor: query.cursor ?? null,
          categoryId: board?.id ?? null,
          answered: query.filter === 'all' ? null : query.filter === 'answered',
        }),
      );
      const discussions = rec(rec(data.repository).discussions);
      return readTopicPage(discussions, num(discussions.totalCount));
    },

    topic: async (number, cursor) => {
      const issue = (await issuesOrNone()).find(
        (candidate) => candidate.number === number,
      );
      if (issue) {
        const [thread, canComment] = await Promise.all([
          issueThread(number, issue),
          canWriteIssues(),
        ]);
        return thread.issue
          ? { ...thread, issue: { ...thread.issue, canComment } }
          : thread;
      }
      if (!signedIn()) {
        const found = (await feed.load()).topics.find(
          (topic) => topic.number === number,
        );
        if (!found) {
          throw new ForumError('not_found', `No topic ${number} in the feed.`);
        }
        return found;
      }
      const data = rec(
        await api.graphql(TOPIC_QUERY, {
          ...repository,
          number,
          cursor: cursor ?? null,
        }),
      );
      const topic = readTopic(
        rec(data.repository).discussion,
        cursor === undefined,
      );
      if (!topic) {
        throw new ForumError('not_found', `GitHub has no topic ${number}.`);
      }
      return topic;
    },

    createTopic: async (slug, title, body) => {
      const repo = known ?? (await loadBoards());
      const board = repo.boards.find((candidate) => candidate.slug === slug);
      if (!board || !startable(repo).includes(slug)) {
        throw new ForumError(
          'forbidden',
          `Topics cannot be started in ${slug}.`,
        );
      }
      const data = rec(
        await api.graphql(CREATE_TOPIC, {
          repositoryId: repo.repositoryId,
          categoryId: board.id,
          title,
          body,
        }),
      );
      const number = num(rec(rec(data.createDiscussion).discussion).number);
      if (number <= 0) {
        throw new ForumError('rejected', 'GitHub did not say what it created.');
      }
      return number;
    },

    reply: async (topicId, body, replyToId) => {
      // GitHub's ids say what they name: an issue's starts `I_`, a
      // discussion's `D_`. An issue takes the general comment mutation.
      if (topicId.startsWith('I_')) {
        await api.graphql(ADD_ISSUE_COMMENT, { subjectId: topicId, body });
        return;
      }
      await (replyToId
        ? api.graphql(ADD_REPLY, { discussionId: topicId, body, replyToId })
        : api.graphql(ADD_COMMENT, { discussionId: topicId, body }));
    },

    editPost: async (id, kind, body) => {
      await api.graphql(
        kind === 'discussion' ? UPDATE_TOPIC_BODY : UPDATE_COMMENT,
        {
          id,
          body,
        },
      );
    },

    editTitle: async (topicId, title) => {
      await api.graphql(UPDATE_TOPIC_TITLE, { id: topicId, title });
    },

    deletePost: async (id) => {
      await api.graphql(DELETE_COMMENT, { id });
    },

    vote: async (id, on) =>
      readVote(
        await api.graphql(on ? ADD_VOTE : REMOVE_VOTE, { id }),
        on ? 'addReaction' : 'removeReaction',
      ),

    markAnswer: async (id, on) => {
      await api.graphql(on ? MARK_ANSWER : UNMARK_ANSWER, { id });
    },

    preview: (text) => api.markdown(text, `${config.owner}/${config.name}`),

    fetchViewer: async (accessToken) => {
      const once = createGithubApi({
        accessToken: () => Promise.resolve(accessToken),
        onUnauthorized: () => undefined,
        fetchImpl,
      });
      const viewer = rec(rec(await once.graphql(VIEWER_QUERY, {})).viewer);
      if (!str(viewer.login)) {
        throw new ForumError('rejected', 'GitHub did not say who signed in.');
      }
      return person(viewer);
    },
  };
};
