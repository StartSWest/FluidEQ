/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  FORUM_ISSUES_BOARD,
  type TForumAuthState,
} from '../../../common/forum/forumTypes';
import { createForumIssues, readIssues } from '../../../main/forum/forumIssues';
import { createForumService } from '../../../main/forum/forumService';
import type { IForumSession } from '../../../main/forum/forumSession';

/**
 * GitHub Issues in the Forum (Ivan, 2026-10-16): read from the issues' file
 * the workflow publishes, for everybody, signed in or not, and never from
 * GitHub's API — which would want the app to hold a permission it does not.
 */

const CONFIG = {
  owner: 'StartSWest',
  name: 'FluidEQ',
  feedUrl: 'https://example.test/feed.json',
  issuesUrl: 'https://example.test/issues.json',
  clientId: 'Iv23liEXAMPLE000000',
  tokenUrl: 'https://example.test/functions/v1/github-token',
};

/** An issue as `discussions-feed.yml` writes it. */
const published = (
  number: number,
  state: 'open' | 'closed',
  updatedAt: string,
  labels: string[] = [],
) => ({
  id: `I_${number}`,
  number,
  title: `Issue ${number}`,
  body: 'The sound drops out\nevery few minutes.',
  bodyHtml: '<p>The sound drops out every few minutes.</p>',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt,
  url: `https://github.com/StartSWest/FluidEQ/issues/${number}`,
  locked: false,
  state,
  labels,
  votes: 2,
  role: 'none',
  author: { login: 'reporter', avatarUrl: null, url: null },
  replies: 1,
  comments: [
    {
      id: `IC_${number}`,
      body: 'Thanks',
      bodyHtml: '<p>Thanks</p>',
      createdAt: updatedAt,
      url: `https://github.com/StartSWest/FluidEQ/issues/${number}#c`,
      isMinimized: false,
      votes: 0,
      role: 'maker',
      author: { login: 'StartSWest', avatarUrl: null, url: null },
    },
  ],
});

const FILE = {
  generatedAt: '2026-10-16T00:00:00Z',
  issues: [
    published(30, 'open', '2026-10-16T00:00:00Z', ['bug', 'engine']),
    published(29, 'closed', '2026-10-15T00:00:00Z'),
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

const SIGNED_IN: TForumAuthState = {
  status: 'signed-in',
  viewer: { login: 'reader', avatarUrl: null, url: null },
};

describe('the issues file', () => {
  it('reads each issue as a thread on the issues’ row', () => {
    const [open, closed] = readIssues(FILE);
    expect(open).toMatchObject({
      number: 30,
      board: FORUM_ISSUES_BOARD,
      answered: false,
      replyCount: 1,
      votes: 2,
      excerpt: 'The sound drops out every few minutes.',
      issue: { closed: false, labels: ['bug', 'engine'] },
    });
    expect(open.comments).toEqual([
      expect.objectContaining({
        id: 'IC_30',
        authorRole: 'maker',
        threadId: 'IC_30',
        replies: [],
      }),
    ]);
    expect(closed.issue).toEqual({ closed: true, labels: [] });
  });

  it('is no issues at all while it has never been published', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(new Response('Not Found', { status: 404 })),
    );
    const issues = createForumIssues(CONFIG.issuesUrl, fetchImpl);
    await expect(issues.load()).resolves.toEqual([]);
  });

  it('still fails on a failure that is not a missing file', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(new Response('', { status: 500 })),
    );
    const issues = createForumIssues(CONFIG.issuesUrl, fetchImpl);
    await expect(issues.load()).rejects.toMatchObject({ failure: 'network' });
  });
});

describe('the issues’ row in the Forum', () => {
  const build = (auth: TForumAuthState) => {
    // GitHub's API is never asked about an issue: any call to it fails the
    // test that makes one.
    const fetchImpl = jest.fn(() =>
      Promise.reject(new Error('GitHub was asked')),
    );
    const service = createForumService({
      config: CONFIG,
      session: session(auth),
      feed: { load: () => Promise.resolve({ boards: [], topics: [] }) },
      issues: { load: () => Promise.resolve(readIssues(FILE)) },
      fetchImpl,
    });
    return { service, fetchImpl };
  };

  it.each([
    ['signed out', { status: 'signed-out' } as TForumAuthState],
    ['signed in', SIGNED_IN],
  ])('lists every issue from the file, %s', async (_, auth) => {
    const { service, fetchImpl } = build(auth);
    const page = await service.topics({
      board: FORUM_ISSUES_BOARD,
      filter: 'all',
      search: '',
    });
    expect(page.topics.map((row) => row.number)).toEqual([30, 29]);
    expect(page.topics[0].issue).toEqual({
      closed: false,
      labels: ['bug', 'engine'],
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reads open as unanswered and closed as answered', async () => {
    const { service } = build({ status: 'signed-out' });
    const open = await service.topics({
      board: FORUM_ISSUES_BOARD,
      filter: 'unanswered',
      search: '',
    });
    const closed = await service.topics({
      board: FORUM_ISSUES_BOARD,
      filter: 'answered',
      search: '',
    });
    expect(open.topics.map((row) => row.number)).toEqual([30]);
    expect(closed.topics.map((row) => row.number)).toEqual([29]);
  });

  it('opens an issue from the file even signed in', async () => {
    const { service, fetchImpl } = build(SIGNED_IN);
    const thread = await service.topic(29);
    expect(thread.issue?.closed).toBe(true);
    expect(thread.comments).toHaveLength(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('counts the issues with the boards', async () => {
    const { service } = build({ status: 'signed-out' });
    await expect(service.boards()).resolves.toMatchObject({ issueCount: 2 });
  });

  it('never stops a discussion opening when the issues cannot be read', async () => {
    const service = createForumService({
      config: CONFIG,
      session: session({ status: 'signed-out' }),
      feed: {
        load: () =>
          Promise.resolve({
            boards: [],
            topics: readIssues({
              issues: [published(7, 'open', '2026-10-01T00:00:00Z')],
            }).map((thread) => ({ ...thread, board: 'q-a', issue: undefined })),
          }),
      },
      issues: { load: () => Promise.reject(new Error('offline')) },
    });
    await expect(service.topic(7)).resolves.toMatchObject({ number: 7 });
    await expect(service.boards()).resolves.toMatchObject({ issueCount: 0 });
  });
});
