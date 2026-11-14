/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import HelpGuide from 'renderer/help/HelpGuide';
import ForumPanel from 'renderer/forum/ForumPanel';
import { resetForumStore } from 'renderer/forum/forumStore';
import {
  getReadingSize,
  largerReadingText,
  reloadReadingSize,
} from 'renderer/reading/readingSize';
import { I18nProvider } from 'renderer/utils/I18nContext';

/**
 * Help shares the Forum's reading size (Ivan, 2026-11-13: "sure, in Help
 * too"): the same control in its rail, the same keys and wheel over it, one
 * size for both pages. Each case beside the one that must leave the size
 * alone, and Help open over the Forum, where main must go on letting the
 * keys through while either page holds them.
 */

// Captures are pictures, not text: drawn as nothing here.
jest.mock('renderer/help/HelpFigure', () => ({
  __esModule: true,
  default: () => null,
}));

beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    },
  });
  Object.defineProperties(HTMLElement.prototype, {
    scrollIntoView: { configurable: true, value: () => undefined },
    scrollTo: { configurable: true, value: () => undefined },
  });
});

const installBridge = () => {
  const bridge = {
    sendMessage: jest.fn(),
    forumState: jest.fn(() => Promise.resolve({ status: 'signed-out' })),
    onForumState: jest.fn(() => () => undefined),
    forumBoards: jest.fn(() =>
      Promise.resolve({ ok: true, value: { boards: [], canStartIn: [] } }),
    ),
    forumTopics: jest.fn(() =>
      Promise.resolve({
        ok: true,
        value: {
          topics: [
            {
              id: 'D1',
              number: 1,
              title: 'A topic to read',
              excerpt: '',
              createdAt: '2026-11-01T00:00:00Z',
              updatedAt: '2026-11-01T00:00:00Z',
              url: '',
              board: 'q-a',
              answered: false,
              locked: false,
              replyCount: 0,
              votes: 0,
              author: { login: 'reader', avatarUrl: null, url: null },
            },
          ],
          total: 1,
        },
      }),
    ),
  };
  Object.defineProperty(window, 'electron', {
    value: { ipcRenderer: bridge, platform: 'win32' },
    configurable: true,
  });
  return bridge;
};

const helpScale = () =>
  (document.querySelector('.help-guide') as HTMLElement).style.getPropertyValue(
    '--reading-scale',
  );

// Help's own search box; the Forum behind it has one too.
const helpSearch = () => document.getElementById('help-search') as HTMLElement;

const openHelp = () =>
  render(
    <I18nProvider>
      <HelpGuide onClose={() => undefined} />
    </I18nProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  reloadReadingSize();
  resetForumStore();
});

it('carries the shared size, and steps it from its own rail', () => {
  installBridge();
  largerReadingText();
  openHelp();
  expect(helpScale()).toBe('1.15');
  fireEvent.click(screen.getByRole('button', { name: 'Larger text' }));
  expect(getReadingSize()).toBe(1.3);
  expect(helpScale()).toBe('1.3');
  expect(
    within(screen.getByRole('group', { name: 'Text size' })).getByRole(
      'status',
    ),
  ).toHaveTextContent('Text size 130%');
});

it('takes Ctrl + over the guide, and a plain + types', () => {
  installBridge();
  openHelp();
  const search = helpSearch();
  act(() => search.focus());
  fireEvent.keyDown(search, { key: '=' });
  expect(getReadingSize()).toBe(1);
  fireEvent.keyDown(search, { key: '=', ctrlKey: true });
  expect(getReadingSize()).toBe(1.15);
  fireEvent.wheel(search, { deltaY: -100, ctrlKey: true });
  expect(getReadingSize()).toBe(1.3);
  fireEvent.keyDown(search, { key: '0', ctrlKey: true });
  expect(getReadingSize()).toBe(1);
});

it('keeps the keys from main while Help sits over the Forum and either holds them', async () => {
  const bridge = installBridge();
  render(<ForumPanel />);
  // The Forum's first read lands before anything is pressed.
  await screen.findByText('A topic to read');
  openHelp();
  act(() => helpSearch().focus());
  expect(bridge.sendMessage).toHaveBeenLastCalledWith('reading-zoom-keys', [
    true,
  ]);
  // A press in the Forum behind: the Forum holds them now, Help lets go, and
  // main must not hear a "false" in between.
  const forum = document.querySelector('.forum') as HTMLElement;
  fireEvent.pointerDown(forum);
  expect(bridge.sendMessage).not.toHaveBeenLastCalledWith('reading-zoom-keys', [
    false,
  ]);
  // And back in Help, a press there sizes the text.
  act(() => helpSearch().focus());
  fireEvent.keyDown(window, { key: '=', ctrlKey: true });
  expect(getReadingSize()).toBe(1.15);
});
