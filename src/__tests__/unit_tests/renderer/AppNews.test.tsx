/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import '@testing-library/jest-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { translate } from '../../../common/i18n';
import {
  EMPTY_NEWS,
  type IAppNews,
  type IAppNewsState,
} from '../../../common/appNews';
import {
  AppNewsHost,
  AppNewsNotice,
} from '../../../renderer/components/AppNews';
import {
  previewAppNews,
  resetAppNewsStore,
} from '../../../renderer/plus/appNewsStore';
import helpMenuActions from '../../../renderer/help/helpMenuActions';
import { claimNotice } from '../../../renderer/utils/noticeTurn';

let mockMode = 'app';
jest.mock('../../../renderer/player/windowModeStore', () => ({
  useWindowMode: () => ({ mode: mockMode, isPinned: false }),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: Parameters<typeof translate>[1]) => translate('en', key),
  }),
}));

const now = Date.parse('2026-10-28T15:00:00Z');
const news: IAppNews = {
  id: 5,
  title: 'Product news',
  body: 'The full announcement.\n\nAnother paragraph.',
  audience: 'everyone',
  startsAt: now - 1000,
  expiresAt: now + 1000,
  action: { label: 'Read more', url: 'https://example.invalid/news' },
};
const fresh: IAppNewsState = { items: [news], unread: [5], offline: false };
let push = (_state: IAppNewsState) => {};
const bridge = {
  getAppNews: jest.fn(),
  appNewsSeen: jest.fn(),
  onAppNews: jest.fn((listener: typeof push) => {
    push = listener;
    return () => undefined;
  }),
};
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
const mount = async (state = fresh) => {
  bridge.getAppNews.mockResolvedValue(state);
  await act(async () => {
    render(
      <>
        <AppNewsNotice />
        <AppNewsHost />
      </>,
    );
  });
};
beforeEach(() => {
  mockMode = 'app';
  jest.clearAllMocks();
  resetAppNewsStore();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  bridge.appNewsSeen.mockResolvedValue({ ...fresh, unread: [] });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});
afterEach(() => {
  cleanup();
  resetAppNewsStore();
  frames.clear();
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

it('announces politely without a modal, focus movement, or a stack of cards', async () => {
  const previous = document.createElement('button');
  document.body.append(previous);
  previous.focus();
  await mount({
    ...fresh,
    items: [news, { ...news, id: 4, startsAt: now - 2000 }],
    unread: [5, 4],
  });
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).not.toHaveAttribute('aria-modal', 'true');
  expect(document.activeElement).toBe(previous);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'The full announcement. Another paragraph.',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(bridge.appNewsSeen).toHaveBeenCalledWith(5);
});

it('waits for the sound drawer without dismissing unread news or changing the workspace DOM', async () => {
  bridge.getAppNews.mockResolvedValue(fresh);
  const view = render(
    <>
      <section aria-label="Workspace">
        <button type="button">Playback</button>
      </section>
      <AppNewsNotice />
      <AppNewsHost />
    </>,
  );
  await screen.findByRole('status');
  const workspace = screen.getByRole('region', { name: 'Workspace' });
  const before = workspace.outerHTML;
  view.rerender(
    <>
      <section aria-label="Workspace">
        <button type="button">Playback</button>
      </section>
      <AppNewsNotice obscured />
      <AppNewsHost />
    </>,
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Workspace' })).toBe(workspace);
  expect(workspace.outerHTML).toBe(before);
  expect(bridge.appNewsSeen).not.toHaveBeenCalled();
  view.rerender(
    <>
      <section aria-label="Workspace">
        <button type="button">Playback</button>
      </section>
      <AppNewsNotice />
      <AppNewsHost />
    </>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Product news');
});

it('keeps a fresh account push when the initial cache response arrives late', async () => {
  let answer = (_state: IAppNewsState) => {};
  bridge.getAppNews.mockImplementationOnce(
    () =>
      new Promise<IAppNewsState>((resolve) => {
        answer = resolve;
      }),
  );
  render(
    <>
      <AppNewsNotice />
      <AppNewsHost />
    </>,
  );
  await act(async () => {
    push(fresh);
    answer(EMPTY_NEWS);
  });
  expect(screen.getByRole('status')).toHaveTextContent('Product news');
});

it('opens the full reader, marks once, and remains readable later through Help', async () => {
  await mount();
  await userEvent.click(screen.getByRole('button', { name: 'Read news' }));
  expect(screen.getByRole('dialog', { name: 'App news' })).toHaveTextContent(
    'The full announcement.',
  );
  expect(screen.getByRole('link', { name: 'Read more' })).toHaveAttribute(
    'href',
    news.action?.url,
  );
  expect(bridge.appNewsSeen).toHaveBeenCalledTimes(1);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  const tour = jest.fn();
  const forum = jest.fn();
  const actions = helpMenuActions(
    (key) => translate('en', key),
    {
      onTour: tour,
      onForum: forum,
      onAbout: jest.fn(),
      onReport: jest.fn(),
      onTroubleshoot: jest.fn(),
    },
    jest.fn(),
  );
  act(() => actions.find((entry) => entry.id === 'appNews')?.run());
  expect(screen.getByRole('dialog', { name: 'App news' })).toHaveTextContent(
    'Another paragraph.',
  );
  expect(bridge.appNewsSeen).toHaveBeenCalledTimes(1);
  act(() => actions.find((entry) => entry.id === 'whatsNew')?.run());
  act(() => actions.find((entry) => entry.id === 'forum')?.run());
  expect(tour).toHaveBeenCalledTimes(1);
  expect(forum).toHaveBeenCalledTimes(1);
});

it('previews an unpublished draft without marking the live item or recording the draft', async () => {
  await mount();
  act(() =>
    previewAppNews({
      ...news,
      id: 99,
      title: 'Unpublished draft',
      startsAt: now + 5000,
      expiresAt: now + 10000,
    }),
  );
  expect(screen.getByRole('dialog', { name: 'App news' })).toHaveTextContent(
    'Preview. Nothing was sent and nothing was recorded.',
  );
  expect(
    screen.getByRole('heading', { name: 'Unpublished draft' }),
  ).toBeInTheDocument();
  expect(bridge.appNewsSeen).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('status')).toHaveTextContent('Product news');
});

it('gives urgent notices, existing scene announcements, fullscreen and compact Amp their turn', async () => {
  await mount();
  (['engineTrouble', 'sceneAnnouncement', 'appFull'] as const).forEach(
    (claim) => {
      let release = () => {};
      act(() => {
        release = claimNotice(claim);
      });
      try {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      } finally {
        act(release);
      }
      expect(screen.getByRole('status')).toBeInTheDocument();
    },
  );
  mockMode = 'player';
  act(() => push({ ...fresh }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(bridge.appNewsSeen).not.toHaveBeenCalled();
});

it('drops painted content exactly at expiry without a network poll', async () => {
  await mount();
  const calls = bridge.getAppNews.mock.calls.length;
  jest.spyOn(Date, 'now').mockReturnValue(news.expiresAt);
  act(() => {
    const queued = [...frames.values()];
    frames.clear();
    queued.forEach((callback) => callback(0));
  });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(bridge.getAppNews).toHaveBeenCalledTimes(calls);
  expect(bridge.appNewsSeen).not.toHaveBeenCalled();
});

it('ignores a dismissal acknowledgement overtaken by sign-out, and refreshes on reconnect', async () => {
  let acknowledge = (_state: IAppNewsState) => {};
  bridge.appNewsSeen.mockImplementationOnce(
    () =>
      new Promise<IAppNewsState>((resolve) => {
        acknowledge = resolve;
      }),
  );
  await mount({ ...fresh, items: [{ ...news, audience: 'accounts' }] });
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  await act(async () => {
    push(EMPTY_NEWS);
    acknowledge({ ...fresh, items: [{ ...news, audience: 'accounts' }] });
  });
  expect(screen.queryByText('Product news')).not.toBeInTheDocument();
  bridge.getAppNews.mockResolvedValue(EMPTY_NEWS);
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
  expect(bridge.getAppNews).toHaveBeenLastCalledWith(true);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
