import { BrowserWindow, ipcMain } from 'electron';
import {
  FORUM_BODY_MAX,
  FORUM_SEARCH_MAX,
  FORUM_TITLE_MAX,
  type IForumPerson,
  type IForumTopicQuery,
  type TForumAuthState,
  type TForumFilter,
  type TForumPostKind,
  type TForumResult,
} from '../../common/forum/forumTypes';
import { resolveLocale, translate } from '../../common/i18n';
import { FORUM_CONFIG, type IForumConfig } from '../forum/forumConfig';
import ForumError from '../forum/forumError';
import { createForumFeed } from '../forum/forumFeed';
import { createForumService } from '../forum/forumService';
import { createForumSession } from '../forum/forumSession';
import type { ISignInPages } from '../forum/githubOAuth';
import signInPage from '../forum/signInPage';
import openExternalIfSafe from '../safeExternal';

/**
 * The forum, as the renderer sees it.
 *
 * The renderer never reaches GitHub and never holds a token: it asks, and it
 * is told. Every answer is `{ ok, value }` or a failure word, so the reason
 * something did not happen crosses the bridge intact instead of arriving as
 * an Error the other side cannot tell apart from any other.
 *
 * Every argument is shape-checked before it is used. The caller is this app,
 * but a string reaching GitHub unbounded is the kind of trust that stops
 * being true after one refactor.
 */

export interface IForumIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  logger?: { warn(message: string): void };
  config?: IForumConfig;
  fetchImpl?: typeof fetch;
}

const CHANNELS = [
  'forum-state',
  'forum-sign-in',
  'forum-sign-in-cancel',
  'forum-sign-out',
  'forum-boards',
  'forum-topics',
  'forum-topic',
  'forum-create-topic',
  'forum-reply',
  'forum-edit',
  'forum-edit-title',
  'forum-delete',
  'forum-upvote',
  'forum-mark-answer',
  'forum-preview',
] as const;

/** GitHub's node ids: a type prefix and base64url. */
const NODE_ID = /^[A-Za-z0-9_=-]{4,120}$/;
/** GraphQL cursors are base64; the feed's are offsets. */
const CURSOR = /^[A-Za-z0-9+/=_-]{1,256}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;
const FILTERS: readonly TForumFilter[] = ['all', 'answered', 'unanswered'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const nodeId = (value: unknown): string => {
  if (typeof value !== 'string' || !NODE_ID.test(value)) {
    throw new ForumError('rejected', 'Malformed id.');
  }
  return value;
};

/** Trimmed, non-empty and inside GitHub's limit — or refused before asking. */
const text = (value: unknown, max: number): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || trimmed.length > max) {
    throw new ForumError('rejected', 'Text empty or too long.');
  }
  return trimmed;
};

const readQuery = (value: unknown): IForumTopicQuery => {
  const query = isRecord(value) ? value : {};
  const board = typeof query.board === 'string' ? query.board : '';
  const search = typeof query.search === 'string' ? query.search : '';
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined;
  if (
    (board !== '' && !SLUG.test(board)) ||
    search.length > FORUM_SEARCH_MAX ||
    (cursor !== undefined && !CURSOR.test(cursor))
  ) {
    throw new ForumError('rejected', 'Malformed topic query.');
  }
  return {
    board,
    filter: FILTERS.find((filter) => filter === query.filter) ?? 'all',
    search,
    ...(cursor ? { cursor } : {}),
  };
};

export const registerForumIpc = ({
  getMainWindow,
  userDataDir,
  logger,
  config = FORUM_CONFIG,
  fetchImpl = fetch,
}: IForumIpcDeps) => {
  const send = (channel: string, payload: unknown) => {
    getMainWindow()?.webContents.send(channel, payload);
  };

  // The service needs the session for its token and the session needs the
  // service to ask GitHub who signed in; the lookup goes through this
  // binding so neither has to be built inside the other.
  const lookup: { viewer: (token: string) => Promise<IForumPerson> } = {
    viewer: () => Promise.reject(new ForumError('unconfigured', 'Not ready.')),
  };
  const session = createForumSession({
    config,
    userDataDir,
    fetchImpl,
    logger,
    fetchViewer: (token) => lookup.viewer(token),
    onState: (state: TForumAuthState) => send('forum-state-changed', state),
  });
  const service = createForumService({
    config,
    session,
    feed: createForumFeed(config.feedUrl, fetchImpl),
    fetchImpl,
  });
  lookup.viewer = (token) => service.fetchViewer(token);

  const guard = async <T>(work: () => Promise<T>): Promise<TForumResult<T>> => {
    try {
      return { ok: true, value: await work() };
    } catch (error) {
      if (error instanceof ForumError) {
        return { ok: false, ...error.toFailure() };
      }
      logger?.warn(`Forum request failed unexpectedly: ${error}`);
      return { ok: false, failure: 'network' };
    }
  };

  const pagesFor = (locale: unknown): ISignInPages => {
    const code = resolveLocale(typeof locale === 'string' ? locale : undefined);
    return {
      success: signInPage(
        code,
        'success',
        translate(code, 'forum.signInPage.successTitle'),
        translate(code, 'forum.signInPage.successBody'),
      ),
      failure: signInPage(
        code,
        'failure',
        translate(code, 'forum.signInPage.failureTitle'),
        translate(code, 'forum.signInPage.failureBody'),
      ),
      cancelled: signInPage(
        code,
        'failure',
        translate(code, 'forum.signInPage.cancelledTitle'),
        translate(code, 'forum.signInPage.cancelledBody'),
      ),
    };
  };

  ipcMain.handle('forum-state', () => session.state());

  ipcMain.handle('forum-sign-in', (_event, locale: unknown) =>
    guard(async () => {
      const state = await session.signIn(pagesFor(locale), openExternalIfSafe);
      // The person is in their browser; bring them back to where the forum
      // is. Windows may only flash the taskbar button instead, which is its
      // rule about stealing focus and still says where to look.
      const target = getMainWindow();
      if (target) {
        if (target.isMinimized()) {
          target.restore();
        }
        target.focus();
      }
      return state;
    }),
  );

  ipcMain.handle('forum-sign-in-cancel', () => {
    session.cancelSignIn();
  });

  ipcMain.handle('forum-sign-out', () => session.signOut());

  ipcMain.handle('forum-boards', () => guard(() => service.boards()));

  ipcMain.handle('forum-topics', (_event, query: unknown) =>
    guard(async () => service.topics(readQuery(query))),
  );

  ipcMain.handle('forum-topic', (_event, number: unknown, cursor: unknown) =>
    guard(async () => {
      if (
        typeof number !== 'number' ||
        !Number.isInteger(number) ||
        number <= 0
      ) {
        throw new ForumError('rejected', 'Malformed topic number.');
      }
      if (
        cursor !== undefined &&
        (typeof cursor !== 'string' || !CURSOR.test(cursor))
      ) {
        throw new ForumError('rejected', 'Malformed cursor.');
      }
      return service.topic(number, cursor);
    }),
  );

  ipcMain.handle('forum-create-topic', (_event, draft: unknown) =>
    guard(async () => {
      const input = isRecord(draft) ? draft : {};
      const board = typeof input.board === 'string' ? input.board : '';
      if (!SLUG.test(board)) {
        throw new ForumError('rejected', 'Malformed board.');
      }
      return service.createTopic(
        board,
        text(input.title, FORUM_TITLE_MAX),
        text(input.body, FORUM_BODY_MAX),
      );
    }),
  );

  ipcMain.handle('forum-reply', (_event, draft: unknown) =>
    guard(async () => {
      const input = isRecord(draft) ? draft : {};
      return service.reply(
        nodeId(input.topicId),
        text(input.body, FORUM_BODY_MAX),
        input.replyToId === undefined ? undefined : nodeId(input.replyToId),
      );
    }),
  );

  ipcMain.handle('forum-edit', (_event, draft: unknown) =>
    guard(async () => {
      const input = isRecord(draft) ? draft : {};
      const kind: TForumPostKind =
        input.kind === 'discussion' ? 'discussion' : 'comment';
      return service.editPost(
        nodeId(input.id),
        kind,
        text(input.body, FORUM_BODY_MAX),
      );
    }),
  );

  ipcMain.handle(
    'forum-edit-title',
    (_event, topicId: unknown, title: unknown) =>
      guard(async () =>
        service.editTitle(nodeId(topicId), text(title, FORUM_TITLE_MAX)),
      ),
  );

  ipcMain.handle('forum-delete', (_event, id: unknown) =>
    guard(async () => service.deletePost(nodeId(id))),
  );

  ipcMain.handle('forum-upvote', (_event, id: unknown, on: unknown) =>
    guard(async () => service.upvote(nodeId(id), on === true)),
  );

  ipcMain.handle('forum-mark-answer', (_event, id: unknown, on: unknown) =>
    guard(async () => service.markAnswer(nodeId(id), on === true)),
  );

  ipcMain.handle('forum-preview', (_event, body: unknown) =>
    guard(async () => service.preview(text(body, FORUM_BODY_MAX))),
  );

  return {
    dispose: () => {
      session.cancelSignIn();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
