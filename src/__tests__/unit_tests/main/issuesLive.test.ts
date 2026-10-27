/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  FORUM_ISSUES_BOARD,
  type IForumTopic,
  type TForumAuthState,
} from '../../../common/forum/forumTypes';
import { createForumService } from '../../../main/forum/forumService';
import type { IForumSession } from '../../../main/forum/forumSession';
import {
  createIssuesLive,
  nextPage,
  readLiveIssue,
} from '../../../main/forum/issuesLive';

/**
 * Issues read from GitHub itself (Ivan, 2026-10-27: "I am refreshing and the
 * new post is not displayed"): the published file sat behind a five-minute
 * cache, so a reply made seconds ago was missing from every read of it.
 */

const REPO = 'https://api.github.com/repos/StartSWest/FluidEQ';

const restIssue = (number: number, extra: Record<string, unknown> = {}) => ({
  number,
  node_id: `I_kw${number}`,
  title: `Issue ${number}`,
  body: 'raw **markdown**',
  body_text: 'Chinese output names garbled',
  body_html: '<p>Chinese output names garbled</p>',
  created_at: '2026-10-20T00:00:00Z',
  updated_at: '2026-10-27T22:52:26Z',
  html_url: `https://github.com/StartSWest/FluidEQ/issues/${number}`,
  state: 'open',
  locked: false,
  comments: 2,
  labels: [{ name: 'bug' }],
  reactions: { '+1': 3 },
  author_association: 'NONE',
  user: {
    login: 'reporter',
    avatar_url: 'https://avatars.githubusercontent.com/u/1',
    html_url: 'https://github.com/reporter',
  },
  ...extra,
});

const restComment = (id: string, at: string) => ({
  node_id: id,
  body_html: `<p>${id}</p>`,
  created_at: at,
  html_url: `https://github.com/StartSWest/FluidEQ/issues/39#${id}`,
  author_association: 'OWNER',
  reactions: { '+1': 0 },
  user: { login: 'StartSWest', avatar_url: '', html_url: '' },
});

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('reading issues from GitHub', () => {
  it('reads an issue as the Forum shows one, and leaves pull requests out', () => {
    expect(readLiveIssue(restIssue(39))).toMatchObject({
      id: 'I_kw39',
      number: 39,
      board: FORUM_ISSUES_BOARD,
      excerpt: 'Chinese output names garbled',
      replyCount: 2,
      votes: 3,
      issue: { closed: false, labels: ['bug'] },
      post: { bodyHtml: '<p>Chinese output names garbled</p>' },
    });
    expect(
      readLiveIssue(restIssue(40, { pull_request: { url: 'x' } })),
    ).toBeUndefined();
  });

  it('follows GitHub’s next link and no further', () => {
    expect(
      nextPage(
        `<${REPO}/issues?page=2>; rel="next", <${REPO}/issues?page=5>; rel="last"`,
      ),
    ).toBe(`${REPO}/issues?page=2`);
    expect(nextPage(`<${REPO}/issues?page=1>; rel="prev"`)).toBeUndefined();
    expect(nextPage(null)).toBeUndefined();
  });

  it('shows a reply made a moment ago, and asks again by ETag for nothing', async () => {
    const comments = [restComment('IC_a', '2026-10-27T20:00:00Z')];
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (url.endsWith('/comments?per_page=100')) {
        if (headers['If-None-Match'] === `"c${comments.length}"`) {
          return new Response(null, { status: 304 });
        }
        return json(comments, { etag: `"c${comments.length}"` });
      }
      return json(restIssue(39), { etag: '"issue"' });
    });
    const live = createIssuesLive({
      owner: 'StartSWest',
      name: 'FluidEQ',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect((await live.thread(39)).comments.map((c) => c.id)).toEqual(['IC_a']);

    comments.push(restComment('IC_b', '2026-10-27T22:52:26Z'));
    const after = await live.thread(39);
    expect(after.comments.map((c) => c.id)).toEqual(['IC_a', 'IC_b']);
    expect(after.comments[1]).toMatchObject({ authorRole: 'maker' });

    // Read again with nothing new: GitHub answers 304 and the copy holds.
    const again = await live.thread(39);
    expect(again.comments).toHaveLength(2);
    const commentReads = fetchImpl.mock.calls.filter(([url]) =>
      url.endsWith('/comments?per_page=100'),
    );
    const lastCommentRead = commentReads[commentReads.length - 1];
    expect(
      (lastCommentRead?.[1]?.headers as Record<string, string>)[
        'If-None-Match'
      ],
    ).toBe('"c2"');
  });
});

const session = (auth: TForumAuthState): IForumSession => ({
  state: () => auth,
  accessToken: () => Promise.resolve('ghu_token'),
  signIn: () => Promise.reject(new Error('not in these tests')),
  cancelSignIn: () => undefined,
  signOut: () => Promise.resolve({ status: 'signed-out' }),
  invalidate: () => undefined,
});

const CONFIG = {
  owner: 'StartSWest',
  name: 'FluidEQ',
  feedUrl: 'https://example.test/feed.json',
  issuesUrl: 'https://example.test/issues.json',
  clientId: 'Iv23liEXAMPLE000000',
  tokenUrl: 'https://example.test/functions/v1/github-token',
};

const published = readLiveIssue(restIssue(39)) as IForumTopic;

describe('the Forum’s issues, live first', () => {
  const build = (
    auth: TForumAuthState,
    live: { list: jest.Mock; thread: jest.Mock },
    installations: unknown = { installations: [] },
  ) => {
    const fetchImpl = jest.fn(async (url: string) =>
      url.endsWith('/user/installations')
        ? json(installations)
        : json({
            data: { addComment: { commentEdge: { node: { id: 'IC_new' } } } },
          }),
    );
    const service = createForumService({
      config: CONFIG,
      session: session(auth),
      feed: { load: () => Promise.resolve({ boards: [], topics: [] }) },
      issues: { load: () => Promise.resolve([published]) },
      live,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    return { service, fetchImpl };
  };

  it('opens a thread from GitHub, not the five-minute-old file', async () => {
    const fresh = {
      ...published,
      comments: [{ id: 'IC_b' }],
    } as unknown as IForumTopic;
    const { service } = build(
      { status: 'signed-out' },
      {
        list: jest.fn(async () => [published]),
        thread: jest.fn(async () => fresh),
      },
    );
    const thread = await service.topic(39);
    expect(thread.comments.map((c) => c.id)).toEqual(['IC_b']);
  });

  it('falls back to the published file when GitHub cannot be asked', async () => {
    const { service } = build(
      { status: 'signed-out' },
      {
        list: jest.fn(async () => {
          throw new Error('limit spent');
        }),
        thread: jest.fn(async () => {
          throw new Error('limit spent');
        }),
      },
    );
    const page = await service.topics({
      board: FORUM_ISSUES_BOARD,
      filter: 'all',
      search: '',
    });
    expect(page.topics.map((row) => row.number)).toEqual([39]);
    await expect(service.topic(39)).resolves.toMatchObject({ number: 39 });
  });

  it('offers a comment box only where GitHub says the app may write issues', async () => {
    const live = {
      list: jest.fn(async () => [published]),
      thread: jest.fn(async () => published),
    };
    const signedIn: TForumAuthState = {
      status: 'signed-in',
      viewer: { login: 'reader', avatarUrl: null, url: null },
    };
    const without = build(signedIn, live, {
      installations: [
        {
          account: { login: 'StartSWest' },
          permissions: { discussions: 'write', metadata: 'read' },
        },
      ],
    });
    expect((await without.service.topic(39)).issue?.canComment).toBe(false);

    const withIssues = build(signedIn, live, {
      installations: [
        {
          account: { login: 'StartSWest' },
          permissions: { discussions: 'write', issues: 'write' },
        },
      ],
    });
    expect((await withIssues.service.topic(39)).issue?.canComment).toBe(true);

    const signedOut = build({ status: 'signed-out' }, live);
    expect((await signedOut.service.topic(39)).issue?.canComment).toBe(false);
  });

  it('comments on an issue with GitHub’s general comment mutation', async () => {
    const { service, fetchImpl } = build(
      {
        status: 'signed-in',
        viewer: { login: 'reader', avatarUrl: null, url: null },
      },
      { list: jest.fn(async () => []), thread: jest.fn() },
    );
    await service.reply('I_kw39', 'Thanks, fixed in 2.1');
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    const [, init] = calls[calls.length - 1] as unknown as [
      string,
      RequestInit,
    ];
    const sent = JSON.parse(String(init.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(sent.query).toContain('addComment');
    expect(sent.variables).toEqual({
      subjectId: 'I_kw39',
      body: 'Thanks, fixed in 2.1',
    });
  });
});
