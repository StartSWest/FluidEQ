/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import {
  createForumFeed,
  readFeed,
  textToHtml,
} from '../../../main/forum/forumFeed';
import {
  readBoardCounts,
  readBoards,
  readTopic,
  readTopicPage,
  readTopicSummary,
  readUpvote,
} from '../../../main/forum/forumGraphqlModel';
import { excerptOf, person } from '../../../main/forum/forumRead';

/**
 * The forum's two sources reduced to one model: the feed the repository
 * publishes, read by anybody, and GitHub's GraphQL, read under a sign-in.
 * Both are strangers' data, so every reader is fed the shapes GitHub really
 * sends and the broken ones it could.
 */

const author = (login: string) => ({
  login,
  avatarUrl: `https://avatars.githubusercontent.com/u/1?v=4`,
  url: `https://github.com/${login}`,
});

describe('the published feed', () => {
  const current = {
    generatedAt: '2026-09-11T00:00:00Z',
    total: 2,
    categories: [
      {
        id: 'C1',
        name: 'Q&A',
        slug: 'q-a',
        emoji: '🙏',
        description: 'Ask',
        isAnswerable: true,
      },
      {
        id: 'C2',
        name: 'Ideas',
        slug: 'ideas',
        emoji: '💡',
        description: 'Idea',
        isAnswerable: false,
      },
    ],
    topics: [
      {
        id: 'D1',
        postId: 'D1',
        number: 1,
        title: 'Thin sound',
        body: 'The long body of the question, well past the excerpt that the feed also carries.',
        bodyHtml: '<p>The long body</p>',
        excerpt: 'The long body of the qu',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-02T00:00:00Z',
        upvotes: 3,
        url: 'https://github.com/o/r/discussions/1',
        locked: false,
        role: 'none',
        categorySlug: 'q-a',
        answered: true,
        replies: 1,
        author: author('asker'),
        comments: [
          {
            id: 'C-1',
            body: 'text',
            bodyHtml: '<p>An answer</p>',
            createdAt: '2026-09-01T01:00:00Z',
            url: 'https://github.com/o/r/discussions/1#c1',
            isMinimized: false,
            upvotes: 2,
            role: 'maker',
            isAnswer: true,
            replyTotal: 1,
            author: author('maker'),
            replies: [
              {
                id: 'R-1',
                body: 'spam',
                bodyHtml: '<p>spam</p>',
                createdAt: '2026-09-01T02:00:00Z',
                url: 'https://github.com/o/r/discussions/1#r1',
                isMinimized: true,
                author: author('spammer'),
              },
            ],
          },
        ],
      },
    ],
  };

  it('reads every board, including the empty ones, with counts', () => {
    const feed = readFeed(current);
    expect(feed.boards.map((board) => [board.slug, board.topicCount])).toEqual([
      ['q-a', 1],
      ['ideas', 0],
    ]);
    expect(feed.boards[0].isAnswerable).toBe(true);
  });

  it('keeps moderation, answers, roles and the whole text for the excerpt', () => {
    const [topic] = readFeed(current).topics;
    expect(topic.excerpt).toContain('well past the excerpt');
    expect(topic.comments[0]).toMatchObject({
      isAnswer: true,
      authorRole: 'maker',
      upvotes: 2,
      threadId: 'C-1',
      bodyHtml: '<p>An answer</p>',
    });
    expect(topic.comments[0].replies[0].minimized).toBe(true);
    expect(topic.post.viewer).toBeUndefined();
  });

  it('reads the older feed: boards from its topics, text bodies escaped', () => {
    const older = {
      topics: [
        {
          number: 9,
          title: 'Old',
          body: 'line one\nline <two>\n\nsecond paragraph',
          excerpt: 'line one',
          createdAt: '2026-08-01T00:00:00Z',
          updatedAt: '2026-08-01T00:00:00Z',
          category: 'General',
          categorySlug: 'general',
          comments: [
            { id: 'x', body: 'a <b>bold</b> claim', author: author('a') },
          ],
        },
      ],
    };
    const feed = readFeed(older);
    expect(feed.boards).toEqual([
      expect.objectContaining({
        slug: 'general',
        name: 'General',
        topicCount: 1,
      }),
    ]);
    expect(feed.topics[0].comments[0].bodyHtml).toBe(
      '<p>a &lt;b&gt;bold&lt;/b&gt; claim</p>',
    );
  });

  it('turns text into escaped paragraphs and line breaks', () => {
    expect(textToHtml('a & b\nc\n\n<d>')).toBe(
      '<p>a &amp; b<br>c</p>\n<p>&lt;d&gt;</p>',
    );
  });

  it('drops topics with no number and refuses a feed that is not an object', () => {
    expect(readFeed({ topics: [{ title: 'no number' }] }).topics).toEqual([]);
    expect(() => readFeed('nonsense')).toThrow();
  });

  it('asks again with the ETag and keeps the copy it has on a 304', async () => {
    const calls: Array<Record<string, string>> = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push(headers);
      return headers['If-None-Match']
        ? new Response(null, { status: 304 })
        : new Response(JSON.stringify(current), {
            status: 200,
            headers: { etag: '"v1"' },
          });
    }) as typeof fetch;
    const feed = createForumFeed('https://example.test/feed.json', fetchImpl);
    const first = await feed.load();
    const second = await feed.load();
    expect(calls[1]).toEqual({ 'If-None-Match': '"v1"' });
    expect(second).toBe(first);
  });

  it('answers from its copy when offline, and fails when it has none', async () => {
    let online = true;
    const fetchImpl = (async () => {
      if (!online) {
        throw new Error('offline');
      }
      return new Response(JSON.stringify(current), {
        headers: { etag: '"v1"' },
      });
    }) as typeof fetch;
    const feed = createForumFeed('https://example.test/feed.json', fetchImpl);
    const copy = await feed.load();
    online = false;
    await expect(feed.load()).resolves.toBe(copy);

    const empty = createForumFeed('https://example.test/feed.json', fetchImpl);
    await expect(empty.load()).rejects.toMatchObject({ failure: 'network' });
  });
});

describe("GitHub's GraphQL answers", () => {
  it('reads boards and who may announce', () => {
    const data = {
      repository: {
        id: 'R1',
        viewerPermission: 'WRITE',
        discussionCategories: {
          nodes: [
            {
              id: 'C1',
              name: 'Q&A',
              slug: 'q-a',
              emojiHTML: '<div>🙏</div>',
              isAnswerable: true,
            },
            { id: '', slug: 'broken' },
          ],
        },
      },
    };
    const repo = readBoards(data);
    expect(repo).toMatchObject({ repositoryId: 'R1', canAnnounce: false });
    expect(repo.boards).toEqual([
      expect.objectContaining({ slug: 'q-a', emoji: '🙏', isAnswerable: true }),
    ]);
    expect(
      readBoards({ repository: { viewerPermission: 'MAINTAIN' } }).canAnnounce,
    ).toBe(true);
    expect(
      readBoardCounts({ repository: { c0: { totalCount: 4 } } }, repo.boards)[0]
        .topicCount,
    ).toBe(4);
  });

  const giscusTopic = {
    id: 'D9',
    number: 9,
    title: 'From the website',
    bodyText: 'placeholder the bot wrote',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-03T00:00:00Z',
    url: 'https://github.com/o/r/discussions/9',
    upvoteCount: 0,
    locked: false,
    answer: null,
    category: { slug: 'q-a' },
    author: { login: 'giscus', avatarUrl: null, url: null },
    comments: { totalCount: 3 },
    opening: {
      nodes: [{ author: author('person'), bodyText: 'What the person wrote' }],
    },
    viewerCanUpdate: false,
    thread: {
      totalCount: 3,
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
        {
          id: 'OPEN',
          body: 'md',
          bodyHTML: '<p>What the person wrote</p>',
          createdAt: '2026-09-01T00:00:00Z',
          url: 'https://github.com/o/r/discussions/9#open',
          upvoteCount: 1,
          author: author('person'),
          authorAssociation: 'NONE',
          viewerCanUpdate: true,
          replies: {
            totalCount: 1,
            nodes: [
              {
                id: 'UNDER',
                bodyHTML: '<p>said under the opening</p>',
                author: author('helper'),
                viewerCanUpdate: false,
              },
            ],
          },
        },
        {
          id: 'LATER',
          bodyHTML: '<p>a normal comment</p>',
          author: author('helper'),
          isAnswer: true,
          viewerCanMarkAsAnswer: false,
          viewerCanUnmarkAsAnswer: true,
          replies: { totalCount: 0, nodes: [] },
        },
      ],
    },
  };

  it('credits a website topic to its person, not the giscus bot', () => {
    const summary = readTopicSummary(giscusTopic);
    expect(summary).toMatchObject({
      author: expect.objectContaining({ login: 'person' }),
      excerpt: 'What the person wrote',
      replyCount: 2,
    });
  });

  it('opens a website topic on the person’s comment and lifts what was said under it', () => {
    const topic = readTopic(giscusTopic, true);
    expect(topic?.postKind).toBe('comment');
    expect(topic?.post).toMatchObject({ id: 'OPEN', body: 'md' });
    expect(
      topic?.comments.map((comment) => [comment.id, comment.threadId]),
    ).toEqual([
      ['UNDER', 'OPEN'],
      ['LATER', 'LATER'],
    ]);
    expect(topic?.comments[1].viewer).toMatchObject({ canUnmarkAnswer: true });
  });

  it('does not promote on a later page, where the opening comment is not', () => {
    expect(readTopic(giscusTopic, false)?.postKind).toBe('discussion');
  });

  it('keeps the markdown source only where the reader can edit it', () => {
    const topic = readTopic(giscusTopic, true);
    expect(topic?.comments[0].body).toBeUndefined();
    expect(topic?.post.body).toBe('md');
  });

  it('pages on the cursor GitHub gives, and stops when it gives none', () => {
    const page = readTopicPage(
      {
        pageInfo: { hasNextPage: true, endCursor: 'abc' },
        nodes: [giscusTopic, { number: 0 }],
      },
      7,
    );
    expect(page).toMatchObject({ total: 7, cursor: 'abc' });
    expect(page.topics).toHaveLength(1);
    expect(
      readTopicPage({ pageInfo: { hasNextPage: false } }, 0).cursor,
    ).toBeUndefined();
  });

  it('reads the new upvote state from the mutation', () => {
    expect(
      readUpvote(
        { addUpvote: { subject: { upvoteCount: 5, viewerHasUpvoted: true } } },
        'addUpvote',
      ),
    ).toEqual({ upvotes: 5, hasUpvoted: true });
  });
});

describe('small readers', () => {
  it('sizes avatars and refuses non-https ones', () => {
    expect(
      person({
        login: 'a',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      }).avatarUrl,
    ).toBe('https://avatars.githubusercontent.com/u/1?v=4&s=80');
    expect(
      person({ login: 'a', avatarUrl: 'http://plain.test/a.png' }).avatarUrl,
    ).toBeNull();
    expect(person({ login: 'a', avatarUrl: 42 }).avatarUrl).toBeNull();
    expect(person(null).login).toBe('ghost');
  });

  it('cuts an excerpt at a word and marks the cut', () => {
    const excerpt = excerptOf(`${'word '.repeat(80)}end`, 40);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt).not.toMatch(/wor…$/);
    expect(excerptOf('short')).toBe('short');
  });
});
