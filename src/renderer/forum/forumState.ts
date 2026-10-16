import { useSyncExternalStore } from 'react';
import type {
  IForumBoard,
  IForumFailure,
  IForumTopic,
  IForumTopicSummary,
  TForumAuthState,
  TForumFilter,
  TForumResult,
} from 'common/forum/forumTypes';
import type { IForumRead } from './forumUnread';

/**
 * The forum, as one snapshot the panel reads: the snapshot itself and the
 * few things every part of the store shares to change it. What is loaded
 * and written is `forumStore.ts`; what is new to this reader, `forumNew.ts`.
 *
 * Answers can arrive out of order — switch boards twice quickly and the first
 * board's topics may land last — so every load carries a ticket, and an
 * answer whose ticket is no longer the current one is dropped rather than
 * painted over the newer one.
 */

export type TForumView =
  { kind: 'list' } | { kind: 'topic'; number: number } | { kind: 'compose' };

export type TLoadStatus = 'idle' | 'loading' | 'more' | 'ready' | 'error';

/**
 * The rail's first row: every board's topics with something this reader has
 * not read (`forumUnread.ts`). Not a GitHub category — it is never sent to
 * main, and a slug cannot hold the colon.
 */
export const NEW_BOARD = ':new';

export interface IForumState {
  auth: TForumAuthState;
  boards: IForumBoard[];
  canStartIn: string[];
  boardsStatus: TLoadStatus;
  /** A board's slug, `NEW_BOARD`, or empty for every board. */
  board: string;
  filter: TForumFilter;
  /** The search that produced the list — not what is being typed. */
  search: string;
  topics: IForumTopicSummary[];
  /**
   * Which list `topics` is — see `listKey`. A list for another board, filter
   * or search is not shown while its replacement loads.
   */
  listedFor: string;
  total: number;
  cursor?: string;
  listStatus: TLoadStatus;
  view: TForumView;
  topic?: IForumTopic;
  topicStatus: TLoadStatus;
  /** The last failure, until dismissed or something succeeds. */
  error?: IForumFailure;
  /** What this reader has read, as this machine remembers it. */
  read: IForumRead;
  /**
   * Every board's topics, latest activity first, back to the line under which
   * everything is read: what the new ones are picked from.
   */
  recent: IForumTopicSummary[];
  recentStatus: TLoadStatus;
  /**
   * Up to when the open topic had been read when it was opened, so the posts
   * after that stay marked new while it is read — opening it reads it.
   */
  openedReadAt: number;
}

const INITIAL: IForumState = {
  auth: { status: 'signed-out' },
  boards: [],
  canStartIn: [],
  boardsStatus: 'idle',
  board: '',
  filter: 'all',
  search: '',
  topics: [],
  listedFor: '',
  total: 0,
  listStatus: 'idle',
  view: { kind: 'list' },
  topicStatus: 'idle',
  read: { allReadAt: 0, topics: {} },
  recent: [],
  recentStatus: 'idle',
  openedReadAt: 0,
};

let state: IForumState = INITIAL;
const listeners = new Set<() => void>();
export const tickets = { boards: 0, list: 0, topic: 0, recent: 0 };

/** The snapshot as it stands now. */
export const forumNow = (): IForumState => state;

export const bridge = () => window.electron?.ipcRenderer;

export const publish = (next: Partial<IForumState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export const failureOf = (
  result: TForumResult<unknown>,
): IForumFailure | undefined =>
  result.ok
    ? undefined
    : {
        failure: result.failure,
        ...(result.retryAt === undefined ? {} : { retryAt: result.retryAt }),
        ...(result.detail === undefined ? {} : { detail: result.detail }),
      };

/** A bridge that is not there (tests, a broken preload) reads as offline. */
const OFFLINE: IForumFailure = { failure: 'network' };

export const call = async <T>(
  request: (() => Promise<TForumResult<T>> | undefined) | undefined,
): Promise<TForumResult<T>> => (await request?.()) ?? { ok: false, ...OFFLINE };

/** One list's identity: the board, the filter and the search that make it. */
export const listKey = ({
  board,
  filter,
  search,
}: Pick<IForumState, 'board' | 'filter' | 'search'>) =>
  JSON.stringify([board, filter, search]);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useForum = (): IForumState =>
  useSyncExternalStore(subscribe, forumNow, forumNow);

/**
 * One value read from the snapshot, for a surface outside the Forum that
 * should redraw only when that value changes — not on every load and keystroke
 * of a forum it is not showing. `select` must answer a primitive, or the same
 * object for the same snapshot.
 */
export const useForumValue = <T>(select: (forum: IForumState) => T): T =>
  useSyncExternalStore(
    subscribe,
    () => select(state),
    () => select(state),
  );

/** Test seam: the snapshot and every ticket as they started. */
export const resetForumState = () => {
  state = INITIAL;
  tickets.boards = 0;
  tickets.list = 0;
  tickets.topic = 0;
  tickets.recent = 0;
};
