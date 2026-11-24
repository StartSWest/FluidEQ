/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { translate as mockTranslate } from '../../../common/i18n';
import type { ISceneDownloadsPaused } from '../../../common/sceneDownloads';
import SceneDownloadsPausedNotice, {
  resumeTime,
} from '../../../renderer/plus/SceneDownloadsPausedNotice';

// The server's daily download allowance (server 0117), said in words: once
// per pause, the day it comes back named when that is tomorrow, and the
// service's pause told apart from the account's.

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (
      key: Parameters<typeof mockTranslate>[1],
      vars: Parameters<typeof mockTranslate>[2],
    ) => mockTranslate('en', key, vars),
  }),
}));

let hear: ((paused: ISceneDownloadsPaused) => void) | undefined;
beforeEach(() => {
  hear = undefined;
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        onSceneDownloadsPaused: (
          listener: (paused: ISceneDownloadsPaused) => void,
        ) => {
          hear = listener;
          return () => {
            hear = undefined;
          };
        },
      },
    },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'electron');
});

const say = (paused: ISceneDownloadsPaused) => act(() => hear?.(paused));
const cards = () =>
  document.querySelectorAll('.plus-toast-slot:not(.is-leaving)');

/** The next UTC midnight, which is when the server's day ends. */
const nextUtcMidnight = () => {
  const at = new Date();
  at.setUTCHours(24, 0, 0, 0);
  return at.toISOString();
};

it('says when downloads come back, on the reader’s clock', async () => {
  render(<SceneDownloadsPausedNotice />);
  expect(cards()).toHaveLength(0);
  const resetsAt = nextUtcMidnight();
  await say({ reason: 'daily_allowance', resetsAt });
  const { time, tomorrow } = resumeTime(resetsAt, 'en');
  const expected = tomorrow
    ? `You've reached today's limit for scene downloads. They start again tomorrow at ${time}.`
    : `You've reached today's limit for scene downloads. They start again at ${time}.`;
  expect(screen.getByText(expected)).toBeVisible();
  // A problem: it stays until closed, and is read out as an alert.
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

it('shows a pause once, even after it was closed, and a new pause again', async () => {
  render(<SceneDownloadsPausedNotice />);
  const resetsAt = nextUtcMidnight();
  await say({ reason: 'daily_allowance', resetsAt });
  await say({ reason: 'daily_allowance', resetsAt });
  expect(cards()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  await say({ reason: 'daily_allowance', resetsAt });
  expect(cards()).toHaveLength(0);
  await say({ reason: 'busy', resetsAt });
  expect(
    screen.getByText(
      'Scene previews are paused for the rest of the day while the gallery is very busy. Scenes you own still download.',
    ),
  ).toBeVisible();
});

it('names tomorrow only when the day changes on the reader’s clock', () => {
  const now = new Date(2026, 10, 24, 15, 0);
  expect(
    resumeTime(new Date(2026, 10, 24, 19, 0).toISOString(), 'en', now),
  ).toEqual({
    time: '7:00 PM',
    tomorrow: false,
  });
  expect(
    resumeTime(new Date(2026, 10, 25, 9, 0).toISOString(), 'en', now),
  ).toEqual({
    time: '9:00 AM',
    tomorrow: true,
  });
  // The reader's own way of writing a time, not English's.
  expect(
    resumeTime(new Date(2026, 10, 24, 19, 0).toISOString(), 'de', now).time,
  ).toBe('19:00');
});
