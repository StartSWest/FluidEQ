import type { IForumTopicSummary } from 'common/forum/forumTypes';

/**
 * What this reader has already read in the forum, so what is new can be
 * shown apart (Ivan, 2026-10-13: "easily know where there are new messages
 * in the forum and have a way to just see those new ones").
 *
 * A topic is read up to the last activity it showed when it was opened: its
 * `updatedAt`, which GitHub moves with every reply and by which the list is
 * already ordered. Anything after that is new. "Mark all as read" moves one
 * line for every topic at once, and the topics opened since stand above it.
 *
 * A topic never opened is new, unless it is the reader's own and nobody has
 * answered it — there is nothing in it they have not read.
 *
 * Kept on this machine only. GitHub has no read state for discussions, and a
 * convenience lost with the storage costs nothing worse than a list that
 * reads as new once more.
 */

const STORAGE_KEY = 'fluideq.forum.read.v1';

export interface IForumRead {
  /** Epoch ms: every activity up to this moment is read. 0 for never. */
  allReadAt: number;
  /** Per topic number, epoch ms of the activity it was read up to. */
  topics: Record<number, number>;
}

const NOTHING_READ: IForumRead = { allReadAt: 0, topics: {} };

const timeOf = (iso: string): number => {
  const at = Date.parse(iso);
  return Number.isFinite(at) ? at : 0;
};

export const readForumRead = (): IForumRead => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    if (typeof parsed !== 'object' || parsed === null) {
      return NOTHING_READ;
    }
    const { allReadAt, topics } = parsed as Record<string, unknown>;
    const entries =
      typeof topics === 'object' && topics !== null
        ? Object.entries(topics).filter(
            (entry): entry is [string, number] =>
              typeof entry[1] === 'number' && Number.isFinite(entry[1]),
          )
        : [];
    return {
      allReadAt:
        typeof allReadAt === 'number' && Number.isFinite(allReadAt)
          ? allReadAt
          : 0,
      topics: Object.fromEntries(
        entries.map(([number, at]) => [Number(number), at]),
      ),
    };
  } catch {
    // Unreadable storage reads as nothing read: the cost is a list that
    // shows as new once more, never a forum that fails to open.
    return NOTHING_READ;
  }
};

const writeForumRead = (read: IForumRead) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(read));
  } catch {
    // Quota or a locked profile. The topic still reads as read for this
    // visit, which is the part on screen.
  }
};

/** `read` with `topic` read up to its last activity, kept for next time. */
export const markTopicRead = (
  read: IForumRead,
  topic: Pick<IForumTopicSummary, 'number' | 'updatedAt'>,
): IForumRead => {
  const at = timeOf(topic.updatedAt);
  if ((read.topics[topic.number] ?? 0) >= at || read.allReadAt >= at) {
    return read;
  }
  const next = { ...read, topics: { ...read.topics, [topic.number]: at } };
  writeForumRead(next);
  return next;
};

/**
 * Everything read up to the newest activity among `topics` — the list's own
 * clock, not this machine's, which may run ahead of or behind GitHub's. The
 * per-topic marks under that line say nothing more, so they go.
 */
export const markAllRead = (
  read: IForumRead,
  topics: readonly Pick<IForumTopicSummary, 'updatedAt'>[],
): IForumRead => {
  const newest = Math.max(
    read.allReadAt,
    ...topics.map((topic) => timeOf(topic.updatedAt)),
  );
  const next: IForumRead = {
    allReadAt: newest,
    topics: Object.fromEntries(
      Object.entries(read.topics).filter(([, at]) => at > newest),
    ),
  };
  writeForumRead(next);
  return next;
};

/** Up to when `number` was read: its own mark, or the line under every topic. */
export const readUpTo = (read: IForumRead, number: number): number =>
  Math.max(read.allReadAt, read.topics[number] ?? 0);

/** Whether `topic` has activity this reader has not seen. */
export const isTopicNew = (
  read: IForumRead,
  topic: Pick<
    IForumTopicSummary,
    'number' | 'updatedAt' | 'replyCount' | 'author'
  >,
  viewerLogin: string | undefined,
): boolean => {
  const opened = read.topics[topic.number] !== undefined;
  if (
    !opened &&
    topic.replyCount === 0 &&
    viewerLogin !== undefined &&
    topic.author.login === viewerLogin
  ) {
    return false;
  }
  return timeOf(topic.updatedAt) > readUpTo(read, topic.number);
};

/** Whether a post written at `createdAt` came after the reader last looked. */
export const isPostNew = (createdAt: string, readAt: number): boolean =>
  timeOf(createdAt) > readAt;
