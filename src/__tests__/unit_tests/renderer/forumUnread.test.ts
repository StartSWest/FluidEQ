import {
  isPostNew,
  isTopicNew,
  markAllRead,
  markTopicRead,
  readForumRead,
} from '../../../renderer/forum/forumUnread';

const topic = (
  number: number,
  updatedAt: string,
  login = 'someone',
  replyCount = 1,
) => ({
  number,
  updatedAt,
  replyCount,
  author: { login, avatarUrl: null, url: null },
});

beforeEach(() => localStorage.clear());

it('calls a topic new until it is opened, and new again when somebody replies', () => {
  const before = readForumRead();
  const first = topic(4, '2026-10-12T10:00:00Z');
  expect(isTopicNew(before, first, 'me')).toBe(true);
  const read = markTopicRead(before, first);
  expect(isTopicNew(read, first, 'me')).toBe(false);
  expect(isTopicNew(read, topic(4, '2026-10-12T11:00:00Z'), 'me')).toBe(true);
  // Kept for the next visit.
  expect(isTopicNew(readForumRead(), first, 'me')).toBe(false);
});

it('leaves the reader’s own unanswered topic alone, and not anybody else’s', () => {
  const read = readForumRead();
  expect(
    isTopicNew(read, topic(5, '2026-08-01T00:00:00Z', 'me', 0), 'me'),
  ).toBe(false);
  expect(
    isTopicNew(read, topic(5, '2026-08-01T00:00:00Z', 'you', 0), 'me'),
  ).toBe(true);
  expect(
    isTopicNew(read, topic(5, '2026-08-01T00:00:00Z', 'me', 2), 'me'),
  ).toBe(true);
});

it('marks everything read up to the list’s newest activity, not this machine’s clock', () => {
  const listed = [
    topic(1, '2026-10-12T09:00:00Z'),
    topic(2, '2026-10-12T12:00:00Z'),
  ];
  const read = markAllRead(readForumRead(), listed);
  expect(listed.some((each) => isTopicNew(read, each, 'me'))).toBe(false);
  expect(isTopicNew(read, topic(2, '2026-10-12T12:05:00Z'), 'me')).toBe(true);
});

it('marks a reply new only when it came after the reader last looked', () => {
  const lookedAt = Date.parse('2026-10-12T10:00:00Z');
  expect(isPostNew('2026-10-12T09:59:00Z', lookedAt)).toBe(false);
  expect(isPostNew('2026-10-12T10:01:00Z', lookedAt)).toBe(true);
});
