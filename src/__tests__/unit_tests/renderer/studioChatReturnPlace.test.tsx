/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A chat opens where the member left it (Ivan, 2026-11-28: "when opening
 * studio scenes chats I want to auto scroll to last seen message because is
 * kind of sending me to almost the very top of the message when returning
 * back to them"): at the end, with whatever came since, if that is where they
 * were; on the line they were reading if they had scrolled up. Each chat its
 * own, and every case runs while the chat's pictures are still taking their
 * size, which is when it went wrong.
 *
 * jsdom has no layout, so the thread gets one here: each message a height,
 * 300px more for every picture in it once that picture is sized, a 400px
 * view, a scroll position the browser clamps, and scroll events that arrive
 * a frame late, as Chromium dispatches them.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IStudioChat, TStudioChatEntry } from '../../../common/studioChat';
import StudioChatThread from '../../../renderer/studio/chat/StudioChatThread';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

const PAD = 16;
const GAP = 16;
const VIEW = 400;
const PICTURE = 300;

const sized = new WeakSet<Element>();
const tops = new WeakMap<Element, number>();
const late = new Set<Element>();

const isLog = (element: Element) => element.getAttribute('role') === 'log';
const messagesIn = (log: Element) =>
  [...log.children].filter(
    (child) => !child.classList.contains('studio-chat__latest-dock'),
  );
const heightOf = (message: Element) =>
  (message.classList.contains('studio-chat__mine') ? 60 : 200) +
  [...message.querySelectorAll('img')].filter((img) => sized.has(img)).length *
    PICTURE;
const topOf = (message: Element) => {
  const all = messagesIn(message.parentElement as Element);
  return all
    .slice(0, all.indexOf(message))
    .reduce((top, child) => top + heightOf(child) + GAP, PAD);
};
const contentOf = (log: Element) =>
  messagesIn(log).reduce((sum, child) => sum + heightOf(child) + GAP, PAD) -
  GAP +
  PAD;
const furthest = (log: Element) => Math.max(0, contentOf(log) - VIEW);
/** Where the browser holds the thread: never past its end. */
const held = (log: Element) => {
  const stored = tops.get(log) ?? 0;
  const clamped = Math.min(stored, furthest(log));
  if (clamped !== stored) {
    tops.set(log, clamped);
    late.add(log);
  }
  return clamped;
};

const elementTop = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollTop',
);
const elementHeight = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollHeight',
);
const elementClient = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'clientHeight',
);
const offsetTop = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetTop',
);
const offsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight',
);
const realObserver = globalThis.ResizeObserver;

/**
 * The page's resize observers, each told whenever the test changes a size,
 * whatever it watches.
 */
const observers = new Set<() => void>();
const TestResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
  const observer: ResizeObserver = {
    observe: () => undefined,
    unobserve: () => undefined,
    disconnect: () => {
      observers.delete(told);
    },
  };
  const told = () => callback([], observer);
  observers.add(told);
  return observer;
});

beforeAll(() => {
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get(this: Element) {
      return isLog(this) ? held(this) : 0;
    },
    set(this: Element, value: number) {
      if (!isLog(this)) {
        return;
      }
      const next = Math.min(Math.max(0, value), furthest(this));
      if (next !== held(this)) {
        late.add(this);
      }
      tops.set(this, next);
    },
  });
  Object.defineProperty(Element.prototype, 'scrollHeight', {
    configurable: true,
    get(this: Element) {
      return isLog(this) ? Math.max(VIEW, contentOf(this)) : 0;
    },
  });
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get(this: Element) {
      return isLog(this) ? VIEW : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement && isLog(this.parentElement) ? topOf(this) : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement && isLog(this.parentElement)
        ? heightOf(this)
        : 0;
    },
  });
  Object.assign(globalThis, { ResizeObserver: TestResizeObserver });
});

afterAll(() => {
  const put = (
    target: object,
    name: string,
    descriptor: PropertyDescriptor | undefined,
  ) => {
    if (descriptor) {
      Object.defineProperty(target, name, descriptor);
    }
  };
  put(Element.prototype, 'scrollTop', elementTop);
  put(Element.prototype, 'scrollHeight', elementHeight);
  put(Element.prototype, 'clientHeight', elementClient);
  put(HTMLElement.prototype, 'offsetTop', offsetTop);
  put(HTMLElement.prototype, 'offsetHeight', offsetHeight);
  Object.assign(globalThis, { ResizeObserver: realObserver });
});

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false }),
  });
});

/** The scroll events of the last frame, delivered. */
const nextFrame = () => {
  const due = [...late];
  late.clear();
  act(() => {
    due.forEach((log) => log.dispatchEvent(new Event('scroll')));
  });
};

/**
 * The thread's pictures decoded, in the order Chromium does it: their size
 * known and laid out first, then the frame's scroll events, then the
 * observers, and the pictures' `load` last.
 */
const picturesSettle = () => {
  const pictures = [...document.querySelectorAll('[role="log"] img')];
  pictures.forEach((img) => sized.add(img));
  nextFrame();
  act(() => observers.forEach((told) => told()));
  pictures.forEach((img) => fireEvent.load(img));
  nextFrame();
};

const PIXEL = 'data:image/jpeg;base64,/9j/';

/** A chat of `turns` requests, each answered with two pictures and words. */
const chatOf = (projectId: string, turns: number): IStudioChat => ({
  projectId,
  busy: false,
  entries: Array.from({ length: turns }).flatMap(
    (_, turn): TStudioChatEntry[] => [
      { kind: 'me', id: `${projectId}-m${turn}`, text: `ask ${turn}` },
      {
        kind: 'claude',
        id: `${projectId}-c${turn}`,
        text: `answer ${turn}`,
        steps: [
          {
            id: `${projectId}-a${turn}`,
            kind: 'look',
            state: 'done',
            picture: PIXEL,
          },
          {
            id: `${projectId}-b${turn}`,
            kind: 'look',
            state: 'done',
            picture: PIXEL,
          },
        ],
        state: 'done',
      },
    ],
  ),
});

const withReply = (chat: IStudioChat): IStudioChat => ({
  ...chat,
  entries: [
    ...chat.entries,
    {
      kind: 'claude',
      id: `${chat.projectId}-late`,
      text: 'the reply that came while away',
      steps: [
        {
          id: `${chat.projectId}-late-a`,
          kind: 'look',
          state: 'done',
          picture: PIXEL,
        },
      ],
      state: 'done',
    },
  ],
});

const thread = (chat: IStudioChat) => (
  <StudioChatThread
    chat={chat}
    onIdea={() => undefined}
    onCarryOn={() => undefined}
    onRetry={() => undefined}
    onRestore={() => Promise.resolve({ ok: true })}
  />
);

const log = () => screen.getByRole('log');
const atEnd = () => furthest(log()) - log().scrollTop;
const messageSaying = (words: string) =>
  messagesIn(log()).find((child) => child.textContent?.includes(words)) as
    Element | undefined;
/** Where `words`' message starts, `offset` pixels into it. */
const into = (words: string, offset: number) => {
  const message = messageSaying(words);
  expect(message).toBeDefined();
  return message ? topOf(message) + offset : Number.NaN;
};
/** The member scrolls to read `words`' message, `offset` pixels into it. */
const readAt = (words: string, offset: number) => {
  log().scrollTop = into(words, offset);
  nextFrame();
};

it('comes back to the end of a chat, with the reply that came while away, once its pictures have their size', () => {
  const lake = chatOf('lake', 6);
  const { rerender } = render(thread(lake));
  picturesSettle();
  expect(atEnd()).toBe(0);
  rerender(thread(chatOf('city', 4)));
  picturesSettle();
  rerender(thread(withReply(lake)));
  picturesSettle();
  expect(log()).toHaveTextContent('the reply that came while away');
  expect(atEnd()).toBe(0);
});

it('comes back to the line being read, after the Studio was left and opened again', () => {
  const garden = chatOf('garden', 6);
  const first = render(thread(garden));
  picturesSettle();
  readAt('answer 2', 120);
  first.unmount();

  render(thread(garden));
  picturesSettle();
  expect(log().scrollTop).toBe(into('answer 2', 120));
});

it('keeps each chat its own place: the one read further up and the one at its end', () => {
  const river = chatOf('river', 6);
  const harbour = chatOf('harbour', 6);
  const { rerender } = render(thread(river));
  picturesSettle();
  readAt('answer 1', 40);
  rerender(thread(harbour));
  picturesSettle();
  expect(atEnd()).toBe(0);
  rerender(thread(river));
  picturesSettle();
  expect(log().scrollTop).toBe(into('answer 1', 40));
  // Read further up, the way back to the end is offered at once.
  expect(
    screen.getByRole('button', { name: 'studioChat.latest' }),
  ).toBeInTheDocument();
});
