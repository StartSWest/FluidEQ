/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import type {
  IForumTopic,
  IForumTopicSummary,
  TForumAuthState,
} from '../../../common/forum/forumTypes';
import { type IForumFeed, readFeed } from '../../../main/forum/forumFeed';
import { readPinned } from '../../../main/forum/forumGraphqlModel';
import { pinnedFirst } from '../../../main/forum/forumPins';
import { createForumService } from '../../../main/forum/forumService';
import type { IForumSession } from '../../../main/forum/forumSession';

/**
 * The repository's pinned discussions lead the Forum's lists, from either
 * source: the published feed for anybody, GitHub's API under a sign-in.
 * Ordered by activity alone, the welcome post and the guides sank under every
 * new reply. Each case stands beside the same list with nothing pinned, which
 * is ordered exactly as before.
 */

const CONFIG = {
  owner: 'StartSWest',
  name: 'FluidEQ',
  feedUrl: 'https://example.test/feed.json',
  issuesUrl: 'https://example.test/issues.json',
  clientId: 'Iv23liEXAMPLE000000',
  tokenUrl: 'https://example.test/functions/v1/github-token',
};

const person = { login: 'a', avatarUrl: null, url: null };

const topic = (
  number: number,
  board: string,
  updatedAt: string,
  extra: Partial<IForumTopic> = {},
): IForumTopic => ({
  id: `D${number}`,
  number,
  title: `Topic ${number}`,
  excerpt: '',
  createdAt: updatedAt,
  updatedAt,
  url: '',
  board,
  answered: false,
  locked: false,
  replyCount: 0,
  votes: 0,
  author: person,
  post: {
    id: `D${number}`,
    bodyHtml: '',
    createdAt: updatedAt,
    url: '',
    author: person,
    authorRole: 'none',
    votes: 0,
    minimized: false,
  },
  postKind: 'discussion',
  comments: [],
  commentTotal: 0,
  ...extra,
});

const session = (auth: TForumAuthState): IForumSession => ({
  state: () => auth,
  accessToken: () => Promise.resolve('ghu_token'),
  signIn: () => Promise.reject(new Error('not in these tests')),
  cancelSignIn: () => undefined,
  signOut: () => Promise.resolve({ status: 'signed-out' }),
  invalidate: () => undefined,
});

const numbers = (list: readonly IForumTopicSummary[]) =>
  list.map((item) => item.number);

describe('the feed carries the pins', () => {
  const payload = (extra: Record<string, unknown>) => ({
    topics: [
      { number: 1, categorySlug: 'q-a' },
      { number: 40, categorySlug: 'general' },
    ],
    ...extra,
  });

  it('marks the pinned topics, in GitHub’s order, and drops what is not a number', () => {
    const feed = readFeed(payload({ pinned: [40, 1, 40, -3, 'x'] }));
    expect(feed.pinned).toEqual([40, 1]);
    expect(feed.topics.map((item) => item.pinned === true)).toEqual([
      true,
      true,
    ]);
  });

  it('reads a feed published before pins as one with none', () => {
    const feed = readFeed(payload({}));
    expect(feed.pinned).toEqual([]);
    expect(feed.topics.some((item) => item.pinned)).toBe(false);
  });
});

describe('signed out, a list from the feed', () => {
  const TOPICS = [
    topic(1, 'q-a', '2026-09-01T00:00:00Z', { answered: true }),
    topic(2, 'q-a', '2026-09-05T00:00:00Z', { title: 'Headphones' }),
    topic(3, 'general', '2026-09-03T00:00:00Z', { title: 'Headphones too' }),
  ];
  const serviceFor = (feed: IForumFeed) =>
    createForumService({
      config: CONFIG,
      session: session({ status: 'signed-out' }),
      feed: { load: () => Promise.resolve(feed) },
    });
  const pinnedService = serviceFor({
    boards: [],
    pinned: [3, 1],
    topics: TOPICS.map((item) =>
      [3, 1].includes(item.number) ? { ...item, pinned: true } : item,
    ),
  });
  const plainService = serviceFor({ boards: [], pinned: [], topics: TOPICS });

  it('leads every board with the pins, in GitHub’s order', async () => {
    const all = await pinnedService.topics({
      board: '',
      filter: 'all',
      search: '',
    });
    expect(numbers(all.topics)).toEqual([3, 1, 2]);
    expect(all.topics.map((item) => item.pinned === true)).toEqual([
      true,
      true,
      false,
    ]);
    const control = await plainService.topics({
      board: '',
      filter: 'all',
      search: '',
    });
    expect(numbers(control.topics)).toEqual([2, 3, 1]);
  });

  it('shows on a board only its own pins, and only those its filter lets through', async () => {
    expect(
      numbers(
        (
          await pinnedService.topics({
            board: 'q-a',
            filter: 'all',
            search: '',
          })
        ).topics,
      ),
    ).toEqual([1, 2]);
    expect(
      numbers(
        (
          await pinnedService.topics({
            board: 'q-a',
            filter: 'unanswered',
            search: '',
          })
        ).topics,
      ),
    ).toEqual([2]);
  });

  it('leaves a search in its own order', async () => {
    const found = await pinnedService.topics({
      board: '',
      filter: 'all',
      search: 'headphones',
    });
    expect(numbers(found.topics)).toEqual([2, 3]);
  });
});

describe('signed in, a list read a page at a time', () => {
  const node = (number: number, slug: string, updatedAt: string) => ({
    id: `D${number}`,
    number,
    title: `Topic ${number}`,
    bodyText: '',
    createdAt: updatedAt,
    updatedAt,
    url: `https://github.com/StartSWest/FluidEQ/discussions/${number}`,
    locked: false,
    category: { slug },
    author: { login: 'a' },
    comments: { totalCount: 0 },
  });
  const answer = (pins: unknown[]) => ({
    repository: {
      discussions: {
        totalCount: 4,
        pageInfo: { hasNextPage: true, endCursor: 'NEXT' },
        nodes: [
          node(5, 'q-a', '2026-09-05T00:00:00Z'),
          node(9, 'q-a', '2026-09-04T00:00:00Z'),
          node(6, 'general', '2026-09-03T00:00:00Z'),
        ],
      },
      pinnedDiscussions: { nodes: pins },
    },
  });
  const PINS = [
    { discussion: node(9, 'q-a', '2026-09-04T00:00:00Z') },
    { discussion: node(7, 'general', '2026-08-01T00:00:00Z') },
  ];
  const serviceAnswering = (data: unknown) =>
    createForumService({
      config: CONFIG,
      session: session({
        status: 'signed-in',
        viewer: { login: 'me', avatarUrl: null, url: null },
      }),
      feed: {
        load: () => Promise.resolve({ boards: [], topics: [], pinned: [] }),
      },
      fetchImpl: (async () =>
        new Response(JSON.stringify({ data }), {
          headers: { 'Content-Type': 'application/json' },
        })) as typeof fetch,
    });

  it('reads the pins from GitHub’s answer, in its order', () => {
    expect(numbers(readPinned(answer(PINS)))).toEqual([9, 7]);
    expect(readPinned({})).toEqual([]);
  });

  it('leads the first page with the pins and repeats none of them', async () => {
    const page = await serviceAnswering(answer(PINS)).topics({
      board: '',
      filter: 'all',
      search: '',
    });
    expect(numbers(page.topics)).toEqual([9, 7, 5, 6]);
    expect(page.topics.filter((item) => item.pinned).length).toBe(2);
    const control = await serviceAnswering(answer([])).topics({
      board: '',
      filter: 'all',
      search: '',
    });
    expect(numbers(control.topics)).toEqual([5, 9, 6]);
  });

  it('keeps a later page free of the pins already shown on the first', async () => {
    const later = await serviceAnswering(answer(PINS)).topics({
      board: '',
      filter: 'all',
      search: '',
      cursor: 'NEXT',
    });
    expect(numbers(later.topics)).toEqual([5, 6]);
  });
});

describe('which pins fit a list', () => {
  const pin = (number: number, board: string, answered = false) =>
    ({
      ...topic(number, board, '2026-09-01T00:00:00Z'),
      answered,
    }) as IForumTopicSummary;

  it('keeps another board’s pin out, and an answered pin out of the unanswered', () => {
    const pins = [pin(1, 'general'), pin(2, 'q-a', true), pin(3, 'q-a')];
    expect(
      numbers(
        pinnedFirst(
          [],
          pins,
          { board: 'q-a', filter: 'unanswered', search: '' },
          true,
        ),
      ),
    ).toEqual([3]);
    expect(
      numbers(
        pinnedFirst(
          [],
          pins,
          { board: 'q-a', filter: 'all', search: '' },
          true,
        ),
      ),
    ).toEqual([2, 3]);
  });
});
