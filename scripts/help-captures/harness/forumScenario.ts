/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type {
  IForumBoard,
  IForumComment,
  IForumPerson,
  IForumPost,
  IForumTopic,
  IForumTopicQuery,
  IForumTopicSummary,
  TForumAuthorRole,
} from 'common/forum/forumTypes';

/**
 * The forum the harness shows: a few topics in three boards, some with
 * replies the reader has not read. Every handle is made up and no picture
 * is anybody's — the avatars are left empty, so they draw as initials. Times
 * are counted back from the moment the harness loads, so "new" stays new
 * whenever it is run.
 */

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const HOUR = 60;
const DAY = 24 * HOUR;

const someone = (login: string): IForumPerson => ({
  login,
  avatarUrl: null,
  url: null,
});

const MAKER = someone('fluideq-maker');

const BOARDS: IForumBoard[] = [
  {
    id: 'board-general',
    slug: 'general',
    name: 'General',
    emoji: '💬',
    description: 'Anything FluidEQ',
    isAnswerable: false,
    topicCount: 2,
  },
  {
    id: 'board-ideas',
    slug: 'ideas',
    name: 'Ideas',
    emoji: '💡',
    description: 'What it should do next',
    isAnswerable: false,
    topicCount: 1,
  },
  {
    id: 'board-qa',
    slug: 'q-a',
    name: 'Q&A',
    emoji: '🙏',
    description: 'Ask, and mark the answer that worked',
    isAnswerable: true,
    topicCount: 1,
  },
  {
    id: 'board-show',
    slug: 'show-and-tell',
    name: 'Show and tell',
    emoji: '🙌',
    description: 'A tuning you are proud of',
    isAnswerable: false,
    topicCount: 1,
  },
];

const post = (
  id: string,
  author: IForumPerson,
  minutesAgo: number,
  text: string,
  role: TForumAuthorRole = 'none',
): IForumPost => ({
  id,
  bodyHtml: `<p>${text}</p>`,
  createdAt: ago(minutesAgo),
  url: '',
  author,
  authorRole: role,
  votes: 0,
  minimized: false,
});

const comment = (
  base: IForumPost,
  replies: IForumPost[] = [],
): IForumComment => ({
  ...base,
  threadId: base.id,
  isAnswer: false,
  replies,
  replyTotal: replies.length,
});

interface IHarnessTopic {
  summary: IForumTopicSummary;
  opening: IForumPost;
  comments: IForumComment[];
}

const topic = (
  number: number,
  board: string,
  title: string,
  opening: IForumPost,
  comments: IForumComment[],
): IHarnessTopic => {
  const times = [
    opening.createdAt,
    ...comments.flatMap((each) => [
      each.createdAt,
      ...each.replies.map((nested) => nested.createdAt),
    ]),
  ].sort();
  return {
    summary: {
      id: `topic-${number}`,
      number,
      title,
      excerpt: opening.bodyHtml.replace(/<[^>]*>/g, ''),
      createdAt: opening.createdAt,
      updatedAt: times[times.length - 1],
      url: '',
      board,
      answered: false,
      locked: false,
      replyCount: comments.reduce(
        (sum, each) => sum + 1 + each.replies.length,
        0,
      ),
      votes: 0,
      author: opening.author,
    },
    opening,
    comments,
  };
};

const lena = someone('lowend-lena');
const mika = someone('mika-tunes');
const riff = someone('riffwright');
const dan = someone('dac-dan');

const TOPICS: IHarnessTopic[] = [
  topic(
    12,
    'q-a',
    'Bass sounds thin on my headset after the update',
    post(
      'p12',
      lena,
      6 * HOUR,
      'Since 2.1 the low end feels lighter with the same preset. Did something change in how the bass shelf is drawn?',
    ),
    [
      comment(
        post(
          'c12a',
          MAKER,
          5 * HOUR,
          'Which output are you on, and is the preset’s Room copy picked?',
          'maker',
        ),
      ),
      comment(
        post('c12b', lena, 3 * HOUR, 'The wired one. No Room, just Gaming.'),
      ),
      comment(
        post(
          'c12c',
          lena,
          25,
          'Found it — Tone’s Bass was at −3 from last week. Is there a way to see it on the graph?',
        ),
        [post('r12c', dan, 10, 'Same here, it hid under the EQ line for me.')],
      ),
    ],
  ),
  topic(
    11,
    'ideas',
    'Could the Room work on speakers too?',
    post(
      'p11',
      mika,
      2 * DAY,
      'The Room is great on headphones. A speaker version that widens a desk pair would be lovely.',
    ),
    [comment(post('c11a', riff, 3 * HOUR, 'Seconding this for a laptop.'))],
  ),
  topic(
    9,
    'show-and-tell',
    'My metal preset for open-backs',
    post(
      'p9',
      riff,
      DAY,
      'Scooped a little at 400 Hz, a shelf for the cymbals, and the Maximizer at Punch.',
    ),
    [],
  ),
  topic(
    8,
    'general',
    'Config — what Equalizer APO actually has on disk',
    post(
      'p8',
      MAKER,
      60 * DAY,
      'This thread is for the Config tab: what Equalizer APO actually has on disk, not what FluidEQ intends.',
      'maker',
    ),
    [],
  ),
  topic(
    7,
    'general',
    'EQ — bands, filter types and the preamp',
    post(
      'p7',
      MAKER,
      61 * DAY,
      'This thread is for the EQ tab — your own bands, placed by hand.',
      'maker',
    ),
    [],
  ),
];

/** Up to when topic 12 was read before: its old replies stay old, the last one is new. */
export const FORUM_READ_SEED = JSON.stringify({
  allReadAt: 0,
  topics: { 12: Date.parse(ago(2 * HOUR)) },
});

const ok = <T>(value: T) => ({ ok: true, value });

export const FORUM_INVOKES: Record<string, (args: unknown[]) => unknown> = {
  'forum-state': () => ({ status: 'signed-in', viewer: MAKER }),
  'forum-boards': () => ok({ boards: BOARDS, canStartIn: ['general'] }),
  'forum-topics': ([query]) => {
    const { board, search } = query as IForumTopicQuery;
    const topics = TOPICS.map((each) => each.summary).filter(
      (each) =>
        (board === '' || each.board === board) &&
        each.title.toLowerCase().includes(search.toLowerCase()),
    );
    return ok({ topics, total: topics.length });
  },
  'forum-topic': ([number]) => {
    const found = TOPICS.find((each) => each.summary.number === number);
    if (!found) {
      return { ok: false, failure: 'not_found' };
    }
    const value: IForumTopic = {
      ...found.summary,
      post: found.opening,
      postKind: 'discussion',
      comments: found.comments,
      commentTotal: found.comments.length,
    };
    return ok(value);
  },
};
