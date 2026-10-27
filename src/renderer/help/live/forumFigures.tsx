/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo } from 'react';
import type {
  IForumBoard,
  IForumPerson,
  IForumTopicSummary,
} from 'common/forum/forumTypes';
import ForumRail from '../../forum/ForumRail';
import { newTopics } from '../../forum/forumNew';
import { listKey, type IForumState } from '../../forum/forumState';
import TopicList from '../../forum/TopicList';
import '../../styles/CommunityRail.scss';
import '../../styles/Community.scss';
import '../../styles/Forum.scss';
import '../../styles/ForumList.scss';

/**
 * The Forum chapter's page, drawn by the page's own rail and topic list
 * (`helpChapters/listen.ts`) from a made-up forum: its six boards, a few
 * issues, a reader signed in with GitHub, and six topics, the two newest
 * come in since the reader last looked — which is what New for you and the
 * New marks are. The page itself reads the project's real Discussions; the
 * people here have no pictures, so each wears the forum's lettered disc.
 */

const nothing = () => undefined;

const HOUR = 3_600_000;

const person = (login: string): IForumPerson => ({
  login,
  avatarUrl: null,
  url: null,
});

/** A board by its slug, which is what the rail names it by in each language. */
const board = (
  slug: string,
  emoji: string,
  topicCount: number,
): IForumBoard => ({
  id: `board-${slug}`,
  slug,
  name: slug,
  emoji,
  description: '',
  isAnswerable: slug === 'q-a',
  topicCount,
});

const BOARDS: IForumBoard[] = [
  board('announcements', '📣', 4),
  board('general', '💬', 18),
  board('ideas', '💡', 9),
  board('polls', '🗳️', 2),
  board('q-a', '🙏', 12),
  board('show-and-tell', '🙌', 7),
];

/** Each topic, and how long ago something last happened in it. */
const TOPICS: readonly (Omit<IForumTopicSummary, 'updatedAt' | 'createdAt'> & {
  hoursAgo: number;
})[] = [
  {
    id: 't-1',
    number: 141,
    title: 'HD 600 with the Room on: which head size?',
    excerpt:
      'Medium sounds right to me, but Fit picked large twice. Is there a rule of thumb?',
    url: '',
    board: 'q-a',
    answered: true,
    locked: false,
    replyCount: 4,
    votes: 3,
    author: person('kenji-audio'),
    hoursAgo: 2,
  },
  {
    id: 't-2',
    number: 139,
    title: 'Desktop and laptop playing each other, in sync',
    excerpt:
      'Linked both with Share Audio and set the laptop’s level in my mix. No echo at all.',
    url: '',
    board: 'show-and-tell',
    answered: false,
    locked: false,
    replyCount: 2,
    votes: 7,
    author: person('theolind'),
    hoursAgo: 5,
  },
  {
    id: 't-3',
    number: 132,
    title: 'Idea: remember a preset per app',
    excerpt:
      'Games on one curve, music on another, switched by whichever app is playing.',
    url: '',
    board: 'ideas',
    answered: false,
    locked: false,
    replyCount: 6,
    votes: 11,
    author: person('ana-sound'),
    hoursAgo: 30,
  },
  {
    id: 't-4',
    number: 128,
    title: 'What’s new: one player, live Help and Share Audio groups',
    excerpt:
      'The Compact player is one amp for every visualizer, and Share Audio links any number of computers.',
    url: '',
    board: 'announcements',
    answered: false,
    locked: false,
    replyCount: 3,
    votes: 15,
    author: person('FluidEQ'),
    hoursAgo: 52,
  },
  {
    id: 't-5',
    number: 121,
    title: 'Bass Forge on small desk speakers',
    excerpt:
      'It fills them out nicely at low volume. How far can it go before it gets muddy?',
    url: '',
    board: 'general',
    answered: false,
    locked: false,
    replyCount: 1,
    votes: 2,
    author: person('rhea-m'),
    hoursAgo: 75,
  },
  {
    id: 't-6',
    number: 117,
    title: 'Which visualizers run best on integrated graphics?',
    excerpt:
      'A laptop with Intel graphics: the 2D ones are smooth, some worlds stutter.',
    url: '',
    board: 'q-a',
    answered: false,
    locked: false,
    replyCount: 0,
    votes: 1,
    author: person('noor-b'),
    hoursAgo: 98,
  },
];

/** The forum as the reader left it a day ago, with the topics' times now. */
const madeUpForum = (now: number): IForumState => {
  const topics = TOPICS.map(({ hoursAgo, ...topic }) => {
    const at = new Date(now - hoursAgo * HOUR).toISOString();
    return { ...topic, createdAt: at, updatedAt: at };
  });
  const place = { board: '', filter: 'all' as const, search: '' };
  return {
    auth: { status: 'signed-in', viewer: person('mara-q') },
    boards: BOARDS,
    canStartIn: [],
    issueCount: 5,
    boardsStatus: 'ready',
    ...place,
    topics,
    listedFor: listKey(place),
    total: topics.length,
    listStatus: 'ready',
    view: { kind: 'list' },
    topicStatus: 'idle',
    read: { allReadAt: now - 24 * HOUR, topics: {} },
    recent: topics,
    recentStatus: 'ready',
    openedReadAt: now - 24 * HOUR,
  };
};

/**
 * The Forum on All topics, in the workspace's card, as tall as a window's
 * page: the list scrolls inside itself there, as it does here.
 */
const ForumDrawing = () => {
  const forum = useMemo(() => madeUpForum(Date.now()), []);
  return (
    <div
      className="workspace-tab-panel workspace-tab-panel--forum"
      style={{ height: 640 }}
    >
      <div className="community forum">
        <ForumRail
          boards={forum.boards}
          board={forum.board}
          searching={false}
          auth={forum.auth}
          loadingBoards={false}
          fresh={newTopics(forum)}
          issueCount={forum.issueCount}
          onSelect={nothing}
        />
        <section className="community__main forum__main">
          <TopicList forum={forum} />
        </section>
      </div>
    </div>
  );
};

export default ForumDrawing;
