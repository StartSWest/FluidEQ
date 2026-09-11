/**
 * The forum, as both processes see it.
 *
 * The forum is the project's GitHub Discussions, read and written from inside
 * the app. The main process owns every request and hands the renderer these
 * shapes, whichever source they came from: the public feed the repository
 * publishes (anybody, no account) or GitHub's own API under the reader's
 * GitHub sign-in. Both are reduced to the same model here, so the panel never
 * has to know which one answered.
 *
 * Bodies are GitHub's own rendering of the author's markdown. They are
 * strangers' markup and the renderer treats them that way — see `GithubHtml`.
 */

/** A person as GitHub shows them. `login` is `ghost` for a deleted account. */
export interface IForumPerson {
  login: string;
  avatarUrl: string | null;
  url: string | null;
}

/** A discussion category: GitHub's name for what the panel calls a board. */
export interface IForumBoard {
  /** GitHub's node id. Empty when the feed did not carry one. */
  id: string;
  slug: string;
  /** GitHub's own name, in English; the panel translates the ones it knows. */
  name: string;
  /** The category's emoji as a character. */
  emoji: string;
  description: string;
  /** Q&A-style: a reply can be marked as the answer. */
  isAnswerable: boolean;
  /** How many topics it holds, when the source could say. */
  topicCount?: number;
}

export interface IForumBoards {
  boards: IForumBoard[];
  /**
   * The boards a new topic can be started in by this reader. Empty when
   * nobody is signed in. Announcements are for maintainers and polls can only
   * be started on GitHub's own page, so neither is offered unless that is who
   * is signed in — and polls never.
   */
  canStartIn: string[];
}

/** What the signed-in reader may do to one post. Absent when read signed out. */
export interface IForumPostViewer {
  canEdit: boolean;
  canDelete: boolean;
  canUpvote: boolean;
  hasUpvoted: boolean;
  canMarkAnswer: boolean;
  canUnmarkAnswer: boolean;
}

/**
 * How GitHub relates the author to the repository. `maker` is the owner —
 * the one person whose answer carries the project's weight.
 */
export type TForumAuthorRole = 'maker' | 'maintainer' | 'none';

/** One piece of writing: an opening post, a comment or a reply. */
export interface IForumPost {
  /** GitHub's node id; what an edit, a reply or an upvote is addressed to. */
  id: string;
  bodyHtml: string;
  /** The markdown source — present only where the reader can edit it. */
  body?: string;
  createdAt: string;
  editedAt?: string;
  url: string;
  author: IForumPerson;
  authorRole: TForumAuthorRole;
  upvotes: number;
  /** Hidden by a moderator. Shown folded, and only on request. */
  minimized: boolean;
  viewer?: IForumPostViewer;
}

export interface IForumComment extends IForumPost {
  /**
   * The comment a reply to this one is filed under. Its own id, except for
   * the replies the website's giscus box nested under a topic's opening
   * comment: those read as comments here, and GitHub still wants anything
   * said back to them filed under that opening comment.
   */
  threadId: string;
  isAnswer: boolean;
  /** GitHub nests one level only: a reply to a reply is a reply to this. */
  replies: IForumPost[];
  /** Replies GitHub holds, which can be more than `replies` carries. */
  replyTotal: number;
}

export interface IForumTopicSummary {
  id: string;
  number: number;
  title: string;
  /** A line of the opening post as plain text. */
  excerpt: string;
  createdAt: string;
  /** Last activity: a new reply moves a topic up the list. */
  updatedAt: string;
  url: string;
  board: string;
  answered: boolean;
  locked: boolean;
  replyCount: number;
  upvotes: number;
  author: IForumPerson;
}

/**
 * Where the opening post's words actually live. A topic started through the
 * website's comment box is opened by the giscus bot, and the person's post is
 * its first comment; editing "the post" there means editing that comment.
 */
export type TForumPostKind = 'discussion' | 'comment';

export interface IForumTopic extends IForumTopicSummary {
  post: IForumPost;
  postKind: TForumPostKind;
  comments: IForumComment[];
  commentTotal: number;
  /** Set when GitHub has more comments than were sent; asks for the next page. */
  commentsCursor?: string;
  /** The reader may edit the title. Absent when read signed out. */
  canEditTitle?: boolean;
}

export interface IForumTopicPage {
  topics: IForumTopicSummary[];
  total: number;
  /** Set when there is another page. */
  cursor?: string;
}

/** Answered or not — meaningful only on a board where answers are marked. */
export type TForumFilter = 'all' | 'answered' | 'unanswered';

export interface IForumTopicQuery {
  /** A board's slug, or empty for every board. */
  board: string;
  filter: TForumFilter;
  /** Words to look for. A search spans every board. */
  search: string;
  cursor?: string;
}

/**
 * Why something did not happen, as one word the panel turns into a sentence.
 *
 * `rate_limited` carries the time GitHub said to come back; the rest are
 * complete as a word.
 */
export type TForumFailure =
  | 'network'
  | 'signed_out'
  | 'rate_limited'
  | 'forbidden'
  | 'locked'
  | 'not_found'
  | 'rejected'
  | 'unconfigured'
  | 'cancelled';

export interface IForumFailure {
  failure: TForumFailure;
  /** Epoch milliseconds, for `rate_limited`. */
  retryAt?: number;
  /** GitHub's own words, when it gave a reason worth passing on. */
  detail?: string;
}

export type TForumResult<T> =
  { ok: true; value: T } | ({ ok: false } & IForumFailure);

/**
 * Who is writing, if anyone.
 *
 * `unconfigured` is a build with no GitHub App to sign in through — every
 * fork, and every checkout without the variables. Reading still works there;
 * only the pen is missing.
 */
export type TForumAuthState =
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'signing-in'; authorizeUrl: string }
  | { status: 'signed-in'; viewer: IForumPerson };

/** Limits GitHub itself enforces, checked on this side first. */
export const FORUM_TITLE_MAX = 256;
export const FORUM_BODY_MAX = 65_536;
export const FORUM_SEARCH_MAX = 200;
