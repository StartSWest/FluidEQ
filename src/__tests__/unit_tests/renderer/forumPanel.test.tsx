/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  FORUM_ISSUES_BOARD,
  type IForumTopic,
  type IForumTopicSummary,
  type TForumAuthState,
} from '../../../common/forum/forumTypes';
import ForumPanel from '../../../renderer/forum/ForumPanel';
import {
  openForum,
  resetForumStore,
  selectBoard,
  useForum,
} from '../../../renderer/forum/forumStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/**
 * The Forum tab against a bridge that answers the way the main process does.
 * What the panel shows, which button wears the loud style, and what the
 * store does with answers that arrive late or change who is reading.
 */

const person = { login: 'asker', avatarUrl: null, url: null };

const summary = (number: number, board: string): IForumTopicSummary => ({
  id: `D${number}`,
  number,
  title: `Topic ${number} on ${board}`,
  excerpt: 'excerpt',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-02T00:00:00Z',
  url: `https://github.com/o/r/discussions/${number}`,
  board,
  answered: false,
  locked: false,
  replyCount: 0,
  votes: 1,
  author: person,
});

const thread = (number: number): IForumTopic => ({
  ...summary(number, 'q-a'),
  post: {
    id: `D${number}`,
    bodyHtml: '<p>The whole <strong>question</strong></p>',
    createdAt: '2026-09-01T00:00:00Z',
    url: '',
    author: person,
    authorRole: 'none',
    votes: 1,
    minimized: false,
    viewer: {
      canEdit: false,
      canDelete: false,
      canVote: true,
      hasVoted: false,
      canMarkAnswer: false,
      canUnmarkAnswer: false,
    },
  },
  postKind: 'discussion',
  comments: [],
  commentTotal: 0,
});

type TListener = (state: TForumAuthState) => void;

const installBridge = (overrides: Record<string, unknown> = {}) => {
  const listeners: TListener[] = [];
  const bridge = {
    // The Forum tells main when it has the zoom keys (`useReadingKeys`).
    sendMessage: jest.fn(),
    forumState: jest.fn(() => Promise.resolve({ status: 'signed-out' })),
    onForumState: jest.fn((listener: TListener) => {
      listeners.push(listener);
      return () => undefined;
    }),
    forumBoards: jest.fn(() =>
      Promise.resolve({
        ok: true,
        value: {
          boards: [
            {
              id: 'Q',
              slug: 'q-a',
              name: 'Q&A',
              emoji: '',
              description: '',
              isAnswerable: true,
              topicCount: 1,
            },
          ],
          canStartIn: [],
        },
      }),
    ),
    forumTopics: jest.fn(() =>
      Promise.resolve({
        ok: true,
        value: { topics: [summary(1, 'q-a')], total: 1 },
      }),
    ),
    forumTopic: jest.fn(() => Promise.resolve({ ok: true, value: thread(1) })),
    // The browser never comes back in these tests; the sign-in stays open.
    forumSignIn: jest.fn(() => new Promise<void>(() => {})),
    forumVote: jest.fn(() =>
      Promise.resolve({ ok: true, value: { votes: 2, hasVoted: true } }),
    ),
    ...overrides,
  };
  Object.defineProperty(window, 'electron', {
    value: { ipcRenderer: bridge, platform: 'win32' },
    configurable: true,
  });
  return {
    bridge,
    push: (state: TForumAuthState) => listeners.forEach((l) => l(state)),
  };
};

beforeEach(() => {
  resetForumStore();
});

describe('the Forum tab', () => {
  it('reads the boards and topics, with the sign-in as the loud action', async () => {
    installBridge();
    render(<ForumPanel />);
    expect(await screen.findByText('Topic 1 on q-a')).toBeInTheDocument();
    expect(screen.getAllByText('forum.board.qa').length).toBeGreaterThan(0);
    const signIn = screen.getByRole('button', { name: 'forum.signIn' });
    expect(signIn).toHaveClass('button', 'small');
    expect(signIn).not.toHaveClass('subtle');
  });

  it('opens a topic in place and shows its post', async () => {
    const { bridge } = installBridge();
    render(<ForumPanel />);
    fireEvent.click(await screen.findByText('Topic 1 on q-a'));
    expect(await screen.findByText('question')).toBeInTheDocument();
    expect(bridge.forumTopic).toHaveBeenCalledWith(1, undefined);
    expect(screen.getByText('forum.thread.signInToReply')).toBeInTheDocument();
  });

  // The pin is marked on its row, and only there: the topic beside it, read
  // in the same list, is the control.
  it('marks a pinned topic as pinned, and no other', async () => {
    installBridge({
      forumTopics: jest.fn(() =>
        Promise.resolve({
          ok: true,
          value: {
            topics: [{ ...summary(1, 'q-a'), pinned: true }, summary(2, 'q-a')],
            total: 2,
          },
        }),
      ),
    });
    render(<ForumPanel />);
    const pinnedRow = (await screen.findByText('Topic 1 on q-a')).closest(
      'button',
    );
    const otherRow = screen.getByText('Topic 2 on q-a').closest('button');
    expect(pinnedRow).toHaveTextContent('forum.topic.pinned');
    expect(otherRow).not.toHaveTextContent('forum.topic.pinned');
  });

  it('says why when the forum cannot be reached', async () => {
    installBridge({
      forumTopics: jest.fn(() =>
        Promise.resolve({ ok: false, failure: 'network' }),
      ),
    });
    render(<ForumPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'forum.error.network',
    );
  });
});

describe('the forum store', () => {
  const Probe = () => {
    const forum = useForum();
    return (
      <span data-testid="topics">
        {forum.topics.map((t) => t.board).join(',')}
      </span>
    );
  };

  it('keeps the newest board when an older answer lands last', async () => {
    let releaseFirst: () => void = () => undefined;
    const forumTopics = jest.fn((query: { board: string }) =>
      query.board === 'slow'
        ? new Promise((resolve) => {
            releaseFirst = () =>
              resolve({
                ok: true,
                value: { topics: [summary(1, 'slow')], total: 1 },
              });
          })
        : Promise.resolve({
            ok: true,
            value: { topics: [summary(2, 'fast')], total: 1 },
          }),
    );
    installBridge({ forumTopics });
    render(<Probe />);
    act(() => selectBoard('slow'));
    act(() => selectBoard('fast'));
    await waitFor(() =>
      expect(screen.getByTestId('topics')).toHaveTextContent('fast'),
    );
    await act(async () => releaseFirst());
    expect(screen.getByTestId('topics')).toHaveTextContent('fast');
  });

  it('reads everything again when the reader signs in', async () => {
    const { bridge, push } = installBridge();
    await act(async () => openForum());
    const before = bridge.forumTopics.mock.calls.length;
    await act(async () =>
      push({
        status: 'signed-in',
        viewer: { login: 'me', avatarUrl: null, url: null },
      }),
    );
    await waitFor(() =>
      expect(bridge.forumTopics.mock.calls.length).toBeGreaterThan(before),
    );
    // The in-between state changes nothing that is shown, so reads nothing.
    const settled = bridge.forumTopics.mock.calls.length;
    await act(async () =>
      push({
        status: 'signed-in',
        viewer: { login: 'me', avatarUrl: null, url: null },
      }),
    );
    expect(bridge.forumTopics.mock.calls.length).toBe(settled);
  });

  it('votes on the post being read, and patches it in place', async () => {
    const { bridge } = installBridge();
    render(<ForumPanel />);
    fireEvent.click(await screen.findByText('Topic 1 on q-a'));
    await screen.findByText('question');

    fireEvent.click(screen.getByRole('button', { name: 'forum.action.vote' }));
    await act(async () => {});
    expect(bridge.forumVote).toHaveBeenCalledWith('D1', true);
    const voted = screen.getByRole('button', {
      name: 'forum.action.removeVote',
    });
    expect(voted).toHaveTextContent('2');
    expect(voted).toHaveAttribute('aria-pressed', 'true');

    // Pressing it again takes the vote back, rather than casting a second.
    fireEvent.click(voted);
    await act(async () => {});
    expect(bridge.forumVote).toHaveBeenLastCalledWith('D1', false);
  });

  it('says on a board how many of its topics are new, and its total once they are read', async () => {
    // What earlier tests read is kept on this machine, as in the app.
    window.localStorage.clear();
    // As main answers: the discussion on its board, and no issues.
    installBridge({
      forumTopics: jest.fn((query: { board: string }) =>
        Promise.resolve({
          ok: true,
          value:
            query.board === FORUM_ISSUES_BOARD
              ? { topics: [], total: 0 }
              : { topics: [summary(1, 'q-a')], total: 1 },
        }),
      ),
    });
    render(<ForumPanel />);
    await screen.findByText('Topic 1 on q-a');
    const boardRow = () =>
      screen
        .getAllByRole('button')
        .find(
          (button) =>
            button.classList.contains('forum__board') &&
            button.textContent?.includes('forum.board.qa'),
        ) as HTMLElement;
    // Topic 1 has activity this reader has not seen: the board says 1 new,
    // in the news badge, where it used to show a dot beside its total.
    await waitFor(() =>
      expect(boardRow().querySelector('.forum-news-badge')).toHaveTextContent(
        '1',
      ),
    );
    expect(boardRow().querySelector('.forum__count')).toBeNull();
    fireEvent.click(screen.getByText('Topic 1 on q-a'));
    await screen.findByText('question');
    await waitFor(() =>
      expect(boardRow().querySelector('.forum-news-badge')).toBeNull(),
    );
    expect(boardRow().querySelector('.forum__count')).toHaveTextContent('1');
  });

  it('shows the count with nothing to press when nobody is signed in', async () => {
    installBridge({
      forumTopic: jest.fn(() => {
        const signedOut = thread(1);
        return Promise.resolve({
          ok: true,
          value: {
            ...signedOut,
            post: { ...signedOut.post, viewer: undefined },
          },
        });
      }),
    });
    render(<ForumPanel />);
    fireEvent.click(await screen.findByText('Topic 1 on q-a'));
    await screen.findByText('question');
    expect(
      screen.queryByRole('button', { name: 'forum.action.vote' }),
    ).toBeNull();
    expect(screen.getByLabelText('forum.topic.votes:1')).toBeInTheDocument();
  });
});
