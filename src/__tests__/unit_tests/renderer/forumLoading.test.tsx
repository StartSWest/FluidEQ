/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import type { IForumTopicSummary } from '../../../common/forum/forumTypes';
import ForumPanel from '../../../renderer/forum/ForumPanel';
import {
  ForumLoadingLayer,
  TopicListLoading,
} from '../../../renderer/forum/ForumLoading';
import {
  refreshForum,
  resetForumStore,
  selectBoard,
} from '../../../renderer/forum/forumStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/**
 * The Forum's loading placeholders: they stand in for a page that is not
 * there yet, leave on their fade's own end rather than on a clock, and never
 * cover a list that is only being read again.
 */

const layer = () => document.querySelector('.forum__loading');

/** jsdom runs no transitions; this is the event the browser sends at the end. */
const endFade = (element: Element) => {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: 'opacity' });
  act(() => {
    element.dispatchEvent(event);
  });
};

const setReducedMotion = (reduce: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('reduce'),
      media: query,
    }),
  });
};

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('the loading layer', () => {
  it('says it is loading, fades when the page arrives, and goes on the fade’s end', () => {
    const { rerender } = render(
      <ForumLoadingLayer loading>
        <TopicListLoading />
      </ForumLoadingLayer>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('forum.loading');
    expect(
      document.querySelectorAll('.forum__loading-topics > li').length,
    ).toBe(8);

    rerender(
      <ForumLoadingLayer loading={false}>
        <TopicListLoading />
      </ForumLoadingLayer>,
    );
    const leaving = layer();
    expect(leaving).toHaveClass('is-leaving');
    expect(screen.queryByRole('status')).toBeNull();

    // A fade on something inside is not the layer's own.
    const inner = document.querySelector('.forum__bone');
    if (inner) {
      endFade(inner);
    }
    expect(layer()).not.toBeNull();

    if (leaving) {
      endFade(leaving);
    }
    expect(layer()).toBeNull();
  });

  it('comes back at once if loading starts again while it is leaving', () => {
    const { rerender } = render(
      <ForumLoadingLayer loading>
        <span />
      </ForumLoadingLayer>,
    );
    rerender(
      <ForumLoadingLayer loading={false}>
        <span />
      </ForumLoadingLayer>,
    );
    expect(layer()).toHaveClass('is-leaving');
    rerender(
      <ForumLoadingLayer loading>
        <span />
      </ForumLoadingLayer>,
    );
    expect(layer()).not.toHaveClass('is-leaving');
  });

  it('leaves at once when motion is reduced, where no fade would end', () => {
    setReducedMotion(true);
    const { rerender } = render(
      <ForumLoadingLayer loading>
        <span />
      </ForumLoadingLayer>,
    );
    rerender(
      <ForumLoadingLayer loading={false}>
        <span />
      </ForumLoadingLayer>,
    );
    expect(layer()).toBeNull();
  });
});

const summary = (number: number, board: string): IForumTopicSummary => ({
  id: `D${number}`,
  number,
  title: `Topic ${number} on ${board}`,
  excerpt: 'excerpt',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-02T00:00:00Z',
  url: '',
  board,
  answered: false,
  locked: false,
  replyCount: 0,
  votes: 0,
  author: { login: 'asker', avatarUrl: null, url: null },
});

/** A bridge whose topic lists arrive only when the test says so. */
const installBridge = () => {
  const answers: Array<() => void> = [];
  const bridge = {
    forumState: () => Promise.resolve({ status: 'signed-out' }),
    onForumState: () => () => undefined,
    forumBoards: () =>
      Promise.resolve({ ok: true, value: { boards: [], canStartIn: [] } }),
    forumTopics: jest.fn(
      (query: { board: string }) =>
        new Promise((resolve) => {
          answers.push(() =>
            resolve({
              ok: true,
              value: { topics: [summary(1, query.board || 'all')], total: 1 },
            }),
          );
        }),
    ),
  };
  Object.defineProperty(window, 'electron', {
    value: { ipcRenderer: bridge, platform: 'win32' },
    configurable: true,
  });
  return {
    answer: async () => {
      await act(async () => {
        answers.splice(0).forEach((resume) => resume());
      });
    },
  };
};

describe('the topic list while it loads', () => {
  beforeEach(() => resetForumStore());

  it('stands in for a list that is not this one yet, but keeps one being read again', async () => {
    const { answer } = installBridge();
    render(<ForumPanel />);
    await act(async () => {});

    // Nothing loaded: the placeholder, and no rows.
    expect(layer()).not.toBeNull();
    await answer();
    expect(screen.getByText('Topic 1 on all')).toBeInTheDocument();
    const first = layer();
    if (first) {
      endFade(first);
    }
    expect(layer()).toBeNull();

    // The same list read again: its rows stay and nothing covers them.
    await act(async () => {
      refreshForum().catch(() => undefined);
    });
    expect(layer()).toBeNull();
    expect(screen.getByText('Topic 1 on all')).toBeInTheDocument();
    await answer();

    // Another board: its predecessor's topics are not shown under its name.
    act(() => selectBoard('ideas'));
    expect(layer()).not.toBeNull();
    expect(screen.queryByText('Topic 1 on all')).toBeNull();
    await answer();
    expect(screen.getByText('Topic 1 on ideas')).toBeInTheDocument();
  });
});
