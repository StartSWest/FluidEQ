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
  type IForumTopicQuery,
  type IForumTopicSummary,
  type TForumAuthState,
} from '../../../common/forum/forumTypes';
import ForumPanel from '../../../renderer/forum/ForumPanel';
import { forumNewsText } from '../../../renderer/forum/ForumNewsBadge';
import { reloadForumNewsHidden } from '../../../renderer/forum/forumNewsPref';
import { resetForumStore } from '../../../renderer/forum/forumStore';
import HelpMenu from '../../../renderer/help/HelpMenu';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/**
 * Help's count of what is new in the Forum (Ivan, 2026-10-14): the number on
 * Help's button and on the Forum's row in its menu, the same number the
 * Forum's own "New for you" row shows, read without the Forum being open.
 */

const READ_KEY = 'fluideq.forum.read.v1';

const topic = (
  number: number,
  overrides: Partial<IForumTopicSummary> = {},
): IForumTopicSummary => ({
  id: `D${number}`,
  number,
  title: `Topic ${number}`,
  excerpt: 'excerpt',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: `2026-10-${String(10 + (number % 10)).padStart(2, '0')}T00:00:00Z`,
  url: '',
  board: 'q-a',
  answered: false,
  locked: false,
  replyCount: 1,
  votes: 0,
  author: { login: 'someone', avatarUrl: null, url: null },
  ...overrides,
});

const page = (topics: IForumTopicSummary[]) =>
  Promise.resolve({ ok: true, value: { topics, total: topics.length } });

/** The topics for every board's list, the issues for the issues' row. */
const byBoard =
  (topics: IForumTopicSummary[], issues: IForumTopicSummary[] = []) =>
  (query: IForumTopicQuery) =>
    page(query.board === FORUM_ISSUES_BOARD ? issues : topics);

/** How many times the topics — not the issues — were asked for. */
const topicReads = (forumTopics: jest.Mock) =>
  forumTopics.mock.calls.filter(
    ([query]: [IForumTopicQuery]) => query.board !== FORUM_ISSUES_BOARD,
  ).length;

const installBridge = (
  topics: IForumTopicSummary[],
  overrides: Record<string, unknown> = {},
  issues: IForumTopicSummary[] = [],
) => {
  const bridge = {
    forumState: jest.fn((): Promise<TForumAuthState> =>
      Promise.resolve({ status: 'signed-out' }),
    ),
    onForumState: jest.fn(() => () => undefined),
    forumBoards: jest.fn(() =>
      Promise.resolve({ ok: true, value: { boards: [], canStartIn: [] } }),
    ),
    forumTopics: jest.fn(byBoard(topics, issues)),
    ...overrides,
  };
  Object.defineProperty(window, 'electron', {
    value: { ipcRenderer: bridge, platform: 'win32' },
    configurable: true,
  });
  return bridge;
};

const renderHelp = () =>
  render(
    <HelpMenu
      onTour={jest.fn()}
      onTroubleshoot={jest.fn()}
      onReport={jest.fn()}
      onForum={jest.fn()}
      onAbout={jest.fn()}
      forumOpen={false}
    />,
  );

const HIDDEN_KEY = 'fluideq.forum.newsHidden.v1';

beforeEach(() => {
  resetForumStore();
  window.localStorage.removeItem(READ_KEY);
  window.localStorage.removeItem(HIDDEN_KEY);
  reloadForumNewsHidden();
});

describe("Help's count of what is new in the Forum", () => {
  it('shows the number on the button and on the Forum row', async () => {
    installBridge([topic(1), topic(2)]);
    renderHelp();
    const button = await screen.findByRole('button', {
      name: 'help.menu · forum.new.countLabel:2',
    });
    expect(button).toHaveTextContent('2');
    fireEvent.click(button);
    const forumRow = screen.getByRole('menuitem', { name: /tabs\.forum/ });
    expect(forumRow.querySelector('.forum-news-badge')).toHaveTextContent('2');
    // Only the Forum's row carries it.
    expect(document.querySelectorAll('.forum-news-badge')).toHaveLength(2);
  });

  it('stops counting at 99+', async () => {
    installBridge(Array.from({ length: 120 }, (_, index) => topic(index + 1)));
    renderHelp();
    expect(
      await screen.findByRole('button', {
        name: 'help.menu · forum.new.countLabel:99+',
      }),
    ).toHaveTextContent('99+');
    expect(forumNewsText(99, 'en')).toBe('99');
    expect(forumNewsText(100, 'en')).toBe('99+');
  });

  it('draws nothing while nothing is new: read, or the reader’s own unanswered topic', async () => {
    window.localStorage.setItem(
      READ_KEY,
      JSON.stringify({
        allReadAt: 0,
        topics: { 1: Date.parse('2026-10-11T00:00:00Z') },
      }),
    );
    const bridge = installBridge(
      [
        topic(1),
        topic(2, {
          replyCount: 0,
          author: { login: 'me', avatarUrl: null, url: null },
        }),
      ],
      {
        forumState: jest.fn(() =>
          Promise.resolve({
            status: 'signed-in',
            viewer: { login: 'me', avatarUrl: null, url: null },
          }),
        ),
      },
    );
    renderHelp();
    await waitFor(() => expect(bridge.forumTopics).toHaveBeenCalled());
    // Let the answer land before asserting on its absence.
    await act(async () => {});
    expect(
      screen.getByRole('button', { name: 'help.menu' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.forum-news-badge')).toBeNull();
  });

  it('reads again when the window comes back', async () => {
    const topics = [topic(1)];
    const bridge = installBridge([], {
      forumTopics: jest.fn(byBoard(topics)),
    });
    renderHelp();
    await screen.findByRole('button', {
      name: 'help.menu · forum.new.countLabel:1',
    });
    topics.push(topic(2));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(
      await screen.findByRole('button', {
        name: 'help.menu · forum.new.countLabel:2',
      }),
    ).toBeInTheDocument();
    expect(topicReads(bridge.forumTopics)).toBe(2);
  });

  it('counts new activity on the repository’s issues as well', async () => {
    installBridge([topic(1)], {}, [
      topic(40, {
        board: FORUM_ISSUES_BOARD,
        issue: { closed: false, labels: [] },
      }),
      topic(41, {
        board: FORUM_ISSUES_BOARD,
        issue: { closed: true, labels: [] },
      }),
    ]);
    renderHelp();
    expect(
      await screen.findByRole('button', {
        name: 'help.menu · forum.new.countLabel:3',
      }),
    ).toHaveTextContent('3');
  });

  it('keeps a failure in the background out of the Forum’s error bar', async () => {
    let online = false;
    installBridge([], {
      forumTopics: jest.fn(() =>
        online
          ? page([topic(1)])
          : Promise.resolve({ ok: false, failure: 'network' }),
      ),
    });
    renderHelp();
    await act(async () => {});
    online = true;
    render(<ForumPanel />);
    expect(await screen.findByText('Topic 1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stands aside while the Forum is open, which reads itself again', async () => {
    const bridge = installBridge([topic(1)]);
    renderHelp();
    render(<ForumPanel />);
    expect(await screen.findByText('Topic 1')).toBeInTheDocument();
    await act(async () => {});
    bridge.forumTopics.mockClear();
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    // The page's own refresh: the list and the new ones, and nothing more.
    expect(topicReads(bridge.forumTopics)).toBe(2);
  });
});

describe('clearing the count, and switching it off', () => {
  const openMenu = async (name: string) => {
    fireEvent.click(await screen.findByRole('button', { name }));
  };

  it('marks everything read from the menu the count is on', async () => {
    installBridge([topic(1), topic(2)]);
    renderHelp();
    await openMenu('help.menu · forum.new.countLabel:2');
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'forum.new.markAllRead' }),
    );
    expect(
      screen.getByRole('button', { name: 'help.menu' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.forum-news-badge')).toBeNull();
    // And for good: what was read is kept.
    expect(
      JSON.parse(window.localStorage.getItem(READ_KEY) ?? '{}'),
    ).toMatchObject({
      allReadAt: Date.parse('2026-10-12T00:00:00Z'),
    });
  });

  it('turns the count off and on again, and remembers it', async () => {
    const bridge = installBridge([topic(1)]);
    const { unmount } = renderHelp();
    await openMenu('help.menu · forum.new.countLabel:1');
    fireEvent.click(screen.getByRole('menuitem', { name: 'forum.news.hide' }));
    expect(
      screen.getByRole('button', { name: 'help.menu' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.forum-news-badge')).toBeNull();
    // Off, nothing reads the Forum in the background — not even on focus.
    bridge.forumTopics.mockClear();
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(bridge.forumTopics).not.toHaveBeenCalled();

    unmount();
    resetForumStore();
    reloadForumNewsHidden();
    renderHelp();
    await act(async () => {});
    expect(bridge.forumTopics).not.toHaveBeenCalled();
    await openMenu('help.menu');
    expect(
      screen.queryByRole('menuitem', { name: 'forum.new.markAllRead' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'forum.news.show' }));
    expect(
      await screen.findByRole('button', {
        name: 'help.menu · forum.new.countLabel:1',
      }),
    ).toBeInTheDocument();
  });
});
