/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import type {
  IForumTopic,
  TForumAuthState,
} from '../../../common/forum/forumTypes';
import { buildForumConfig } from '../../../main/forum/forumConfig';
import type { IForumFeed } from '../../../main/forum/forumFeed';
import {
  createForumService,
  searchWords,
} from '../../../main/forum/forumService';
import type { IForumSession } from '../../../main/forum/forumSession';

/**
 * The forum answers the same questions from two sources: the feed for anybody,
 * GitHub under a sign-in. These pin which one answers when, and what each
 * does with a board, a filter, a search and a page.
 */

const CONFIG = {
  owner: 'StartSWest',
  name: 'FluidEQ',
  feedUrl: 'https://example.test/feed.json',
  clientId: 'Iv23liEXAMPLE000000',
  clientSecret: 'a'.repeat(40),
};

const topic = (
  number: number,
  board: string,
  updatedAt: string,
  extra: Partial<IForumTopic> = {},
): IForumTopic => ({
  id: `D${number}`,
  number,
  title: `Topic ${number}`,
  excerpt: `about ${board}`,
  createdAt: updatedAt,
  updatedAt,
  url: `https://github.com/o/r/discussions/${number}`,
  board,
  answered: false,
  locked: false,
  replyCount: 0,
  upvotes: 0,
  author: { login: 'a', avatarUrl: null, url: null },
  post: {
    id: `D${number}`,
    bodyHtml: '<p>body</p>',
    createdAt: updatedAt,
    url: '',
    author: { login: 'a', avatarUrl: null, url: null },
    authorRole: 'none',
    upvotes: 0,
    minimized: false,
  },
  postKind: 'discussion',
  comments: [],
  commentTotal: 0,
  ...extra,
});

const FEED: IForumFeed = {
  boards: [],
  topics: [
    topic(1, 'q-a', '2026-09-01T00:00:00Z', { answered: true }),
    topic(2, 'q-a', '2026-09-05T00:00:00Z', { title: 'Headphones sound thin' }),
    topic(3, 'general', '2026-09-03T00:00:00Z'),
  ],
};

const session = (auth: TForumAuthState): IForumSession => ({
  state: () => auth,
  accessToken: () => Promise.resolve('ghu_token'),
  signIn: () => Promise.reject(new Error('not in these tests')),
  cancelSignIn: () => undefined,
  signOut: () => Promise.resolve({ status: 'signed-out' }),
  invalidate: () => undefined,
});

describe('reading signed out, from the feed', () => {
  const service = createForumService({
    config: CONFIG,
    session: session({ status: 'signed-out' }),
    feed: { load: () => Promise.resolve(FEED) },
  });

  it('lists every board newest activity first', async () => {
    const page = await service.topics({ board: '', filter: 'all', search: '' });
    expect(page.topics.map((item) => item.number)).toEqual([2, 3, 1]);
    expect(page.total).toBe(3);
    expect(page.cursor).toBeUndefined();
  });

  it('narrows to a board and to its answered topics', async () => {
    expect(
      (
        await service.topics({ board: 'q-a', filter: 'answered', search: '' })
      ).topics.map((item) => item.number),
    ).toEqual([1]);
    expect(
      (
        await service.topics({ board: 'q-a', filter: 'unanswered', search: '' })
      ).topics.map((item) => item.number),
    ).toEqual([2]);
  });

  it('searches across every board, whatever board is chosen', async () => {
    const page = await service.topics({
      board: 'general',
      filter: 'all',
      search: 'THIN headphones',
    });
    expect(page.topics.map((item) => item.number)).toEqual([2]);
  });

  it('pages in 25s with an offset cursor', async () => {
    const many: IForumFeed = {
      boards: [],
      topics: Array.from({ length: 30 }, (_, index) =>
        topic(
          index + 1,
          'general',
          `2026-09-01T00:00:${String(59 - index).padStart(2, '0')}Z`,
        ),
      ),
    };
    const paging = createForumService({
      config: CONFIG,
      session: session({ status: 'signed-out' }),
      feed: { load: () => Promise.resolve(many) },
    });
    const first = await paging.topics({ board: '', filter: 'all', search: '' });
    expect(first.topics).toHaveLength(25);
    expect(first.cursor).toBe('25');
    const second = await paging.topics({
      board: '',
      filter: 'all',
      search: '',
      cursor: first.cursor,
    });
    expect(second.topics.map((item) => item.number)).toEqual([
      26, 27, 28, 29, 30,
    ]);
    expect(second.cursor).toBeUndefined();
  });

  it('sends list rows without their threads', async () => {
    const page = await service.topics({ board: '', filter: 'all', search: '' });
    expect(Object.keys(page.topics[0])).not.toContain('comments');
  });

  it('reports a topic the feed does not have as not found', async () => {
    await expect(service.topic(404)).rejects.toMatchObject({
      failure: 'not_found',
    });
  });

  it('offers nowhere to start a topic', async () => {
    expect((await service.boards()).canStartIn).toEqual([]);
  });
});

describe('reading and writing signed in, through GitHub', () => {
  const graphql = (answers: Record<string, unknown>) => {
    const sent: Array<{ query: string; variables: Record<string, unknown> }> =
      [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      sent.push(body);
      const name = /(query|mutation) (\w+)/.exec(body.query)?.[2] ?? '';
      return new Response(JSON.stringify({ data: answers[name] ?? {} }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    return { sent, fetchImpl };
  };

  const BOARDS = {
    repository: {
      id: 'R1',
      viewerPermission: 'READ',
      discussionCategories: {
        nodes: [
          { id: 'A', slug: 'announcements', name: 'Announcements' },
          { id: 'Q', slug: 'q-a', name: 'Q&A', isAnswerable: true },
          { id: 'P', slug: 'polls', name: 'Polls' },
        ],
      },
    },
  };

  it('never offers polls, and announcements only to maintainers', async () => {
    const { fetchImpl } = graphql({
      ForumBoards: BOARDS,
      ForumBoardCounts: {},
    });
    const service = createForumService({
      config: CONFIG,
      session: session({
        status: 'signed-in',
        viewer: { login: 'me', avatarUrl: null, url: null },
      }),
      feed: { load: () => Promise.resolve(FEED) },
      fetchImpl,
    });
    expect((await service.boards()).canStartIn).toEqual(['q-a']);
    await expect(service.createTopic('polls', 't', 'b')).rejects.toMatchObject({
      failure: 'forbidden',
    });
  });

  it('scopes a search to this repository, whatever qualifiers were typed', async () => {
    const { sent, fetchImpl } = graphql({ ForumSearch: { search: {} } });
    const service = createForumService({
      config: CONFIG,
      session: session({
        status: 'signed-in',
        viewer: { login: 'me', avatarUrl: null, url: null },
      }),
      feed: { load: () => Promise.resolve(FEED) },
      fetchImpl,
    });
    await service.topics({
      board: '',
      filter: 'all',
      search: 'repo:someone/else thin "sound"',
    });
    expect(sent[0].variables.query).toBe('repo:StartSWest/FluidEQ thin sound');
  });

  it('files a reply to a comment under it, and a reply to the topic at the top', async () => {
    const { sent, fetchImpl } = graphql({});
    const service = createForumService({
      config: CONFIG,
      session: session({
        status: 'signed-in',
        viewer: { login: 'me', avatarUrl: null, url: null },
      }),
      feed: { load: () => Promise.resolve(FEED) },
      fetchImpl,
    });
    await service.reply('D1', 'top level');
    await service.reply('D1', 'nested', 'C7');
    expect(sent[0].query).not.toContain('replyToId');
    expect(sent[1].variables).toEqual({
      discussionId: 'D1',
      body: 'nested',
      replyToId: 'C7',
    });
  });

  it('creates the topic in the board chosen, in this repository', async () => {
    const { sent, fetchImpl } = graphql({
      ForumBoards: BOARDS,
      ForumCreateTopic: { createDiscussion: { discussion: { number: 42 } } },
    });
    const service = createForumService({
      config: CONFIG,
      session: session({
        status: 'signed-in',
        viewer: { login: 'me', avatarUrl: null, url: null },
      }),
      feed: { load: () => Promise.resolve(FEED) },
      fetchImpl,
    });
    await expect(service.createTopic('q-a', 'Title', 'Body')).resolves.toBe(42);
    expect(sent[sent.length - 1].variables).toEqual({
      repositoryId: 'R1',
      categoryId: 'Q',
      title: 'Title',
      body: 'Body',
    });
  });
});

describe('search words and the build configuration', () => {
  it('strips qualifiers and quotes from a search', () => {
    expect(searchWords('  org:x  is:open "exact words"  plain ')).toBe(
      'exact words plain',
    );
  });

  it('signs in only with both halves of a well-formed GitHub App pair', () => {
    expect(
      buildForumConfig({
        FLUIDEQ_GITHUB_CLIENT_ID: 'Iv23liABCDEFGHIJKLMN',
        FLUIDEQ_GITHUB_CLIENT_SECRET: 'b'.repeat(40),
      }).clientId,
    ).toBe('Iv23liABCDEFGHIJKLMN');
    expect(
      buildForumConfig({ FLUIDEQ_GITHUB_CLIENT_ID: 'Iv23liABCDEFGHIJKLMN' })
        .clientId,
    ).toBe('');
    expect(
      buildForumConfig({
        FLUIDEQ_GITHUB_CLIENT_ID: 'not an id',
        FLUIDEQ_GITHUB_CLIENT_SECRET: 'b'.repeat(40),
      }).clientSecret,
    ).toBe('');
    expect(buildForumConfig({}).feedUrl).toBe(
      'https://raw.githubusercontent.com/StartSWest/FluidEQ/discussions-data/discussions.json',
    );
  });
});
