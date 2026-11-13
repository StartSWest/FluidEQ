/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each chat keeps its own model and effort (Ivan, 2026-11-09: "each chat
 * needs to have its own model select and effort, I cannot change in one and
 * get it changed on all other"; 2026-11-13: "still, when I change the model
 * it changes in all the chats, not good", and "solo es por chat": a pick is
 * its chat's and nothing else's, and a new chat starts on the default).
 *
 * The second report was chats nobody had picked in: they read the last pick
 * made anywhere, so they all moved with it, and the first version of this
 * file never looked at one. Here main is a stand-in that keeps each
 * project's open chat and its earlier ones the way main does, picks in the
 * chat; "after a reload" is a new window's stores over the same main and
 * the same storage.
 */
import '@testing-library/jest-dom';
import { screen, within } from '@testing-library/react';
import type {
  IStudioChat,
  IStudioChatPast,
  IStudioChatPicked,
} from '../../../common/studioChat';
import {
  chatPicksOf,
  resetChatPicksForTesting,
  setChatEffort,
  setChatModel,
} from '../../../renderer/studio/chat/chatPicks';
import StudioChatEffortDots from '../../../renderer/studio/chat/StudioChatEffortDots';
import {
  loadPastStudioChats,
  loadStudioChat,
  newStudioChat,
  openPastStudioChat,
  resetStudioChatStore,
  retryStudioChatOn,
  sendToStudioChat,
} from '../../../renderer/studio/chat/studioChatStore';
import { setup } from '../../utils/userEventUtils';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

const MEDIUM = 'medium';
const said = (text: string): IStudioChat['entries'] => [
  { kind: 'me', id: `said-${text}`, text },
];

/** Main, as far as a chat's picks go. */
interface IMain {
  /** The project the member is on. */
  open: string;
  chats: Record<string, IStudioChat>;
  past: Record<string, (IStudioChatPast & { chat: IStudioChat })[]>;
  sent: { model?: string; effort?: string }[];
  retried: { model?: string; effort?: string }[];
}
let main: IMain;

const empty = (projectId: string): IStudioChat => ({
  projectId,
  entries: [],
  busy: false,
});
const openChat = () => {
  main.chats[main.open] ??= empty(main.open);
  return main.chats[main.open];
};
/** The open chat put aside, when it has anything in it, as main does it. */
const putAside = () => {
  const chat = openChat();
  if (chat.entries.length > 0) {
    (main.past[main.open] ??= []).unshift({
      id: `past-${chat.entries[0].id}`,
      title: chat.entries[0].text,
      savedAt: 1,
      source: 'fluideq',
      chat,
    });
  }
};

const connect = () => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        studioChatLoad: async () => ({ ...openChat() }),
        studioChatPicks: async ({
          projectId,
          model,
          effort,
        }: IStudioChatPicked) => {
          // Only for the project that is open (`chatShown.ts`).
          if (projectId === main.open) {
            main.chats[projectId] = {
              ...openChat(),
              picks: { model, effort },
            };
          }
        },
        studioChatNew: async () => {
          putAside();
          main.chats[main.open] = empty(main.open);
          return { ...openChat() };
        },
        studioChatPast: async () =>
          (main.past[main.open] ?? []).map(
            ({ id, title, savedAt, source }): IStudioChatPast => ({
              id,
              title,
              savedAt,
              source,
            }),
          ),
        studioChatOpenPast: async (id: string) => {
          const from = main.past[main.open] ?? [];
          const found = from.find((past) => past.id === id);
          if (found) {
            main.past[main.open] = from.filter((past) => past !== found);
            putAside();
            main.chats[main.open] = found.chat;
          }
          return { ...openChat() };
        },
        studioChatSend: async (message: {
          model?: string;
          effort?: string;
        }) => {
          main.sent.push(message);
        },
        studioChatRetry: async (picks: { model?: string; effort?: string }) => {
          main.retried.push(picks);
        },
      },
    },
  });
};

/** The member opens a project: its chat is asked of main and shown. */
const go = async (projectId: string) => {
  main.open = projectId;
  await loadStudioChat();
};

/** A new window over the same main and the same storage. */
const reload = () => {
  resetStudioChatStore();
  resetChatPicksForTesting();
};

beforeEach(() => {
  window.localStorage.clear();
  main = { open: 'scene-a', chats: {}, past: {}, sent: [], retried: [] };
  connect();
  reload();
});

describe('the model of a chat nobody has picked in', () => {
  it('stays as it was when another chat changes its own, also after a reload', async () => {
    await go('scene-a');
    await go('scene-b');
    // The control: both stand on the default.
    expect(chatPicksOf('scene-a').model).toBe('default');
    expect(chatPicksOf('scene-b').model).toBe('default');

    setChatModel('scene-b', 'opus');
    expect(chatPicksOf('scene-b').model).toBe('opus');
    // The report: this one changed too.
    expect(chatPicksOf('scene-a').model).toBe('default');

    reload();
    await go('scene-a');
    expect(chatPicksOf('scene-a')).toEqual({
      model: 'default',
      effort: MEDIUM,
    });
    await go('scene-b');
    expect(chatPicksOf('scene-b').model).toBe('opus');
  });

  it('is the default in a project met for the first time, whatever was picked in other chats', async () => {
    await go('scene-a');
    setChatModel('scene-a', 'sonnet');
    setChatEffort('scene-a', 'high');
    // "Solo es por chat": no pick is a default another chat starts on.
    await go('scene-new');
    expect(chatPicksOf('scene-new')).toEqual({
      model: 'default',
      effort: MEDIUM,
    });
    expect(main.chats['scene-new'].picks).toEqual({
      model: 'default',
      effort: MEDIUM,
    });
    // The control: the chat the picks were made in has them.
    expect(chatPicksOf('scene-a')).toEqual({ model: 'sonnet', effort: 'high' });
  });

  it('is not kept anywhere but in its chat: a pick stores nothing in the window', async () => {
    await go('scene-a');
    setChatModel('scene-a', 'opus');
    setChatEffort('scene-a', 'max');
    expect(window.localStorage).toHaveLength(0);
    // The control: it did reach the chat.
    expect(main.chats['scene-a'].picks).toEqual({
      model: 'opus',
      effort: 'max',
    });
  });

  it('is its own in a picker with no chat behind it, which tells nobody', async () => {
    // Help's figure of the composer: a picker and no chat.
    setChatModel(undefined, 'opus');
    expect(chatPicksOf(undefined).model).toBe('opus');
    // A project whose chat main has not handed over yet reads the default.
    expect(chatPicksOf('scene-a').model).toBe('default');
    await go('scene-a');
    expect(chatPicksOf('scene-a').model).toBe('default');
    expect(main.chats['scene-a'].picks?.model).toBe('default');
  });
});

describe('a chat from before the chats kept their own picks', () => {
  beforeEach(() => {
    // As the version before left storage: the last pick, and one project's.
    window.localStorage.setItem('fluideq.studio.chatModel', 'sonnet');
    window.localStorage.setItem('fluideq.studio.chatEffort', 'high');
    window.localStorage.setItem(
      'fluideq.studio.chatPicks',
      JSON.stringify({ 'scene-picked': { model: 'opus', effort: 'low' } }),
    );
    main.chats['scene-old'] = { ...empty('scene-old'), entries: said('old') };
    main.chats['scene-picked'] = {
      ...empty('scene-picked'),
      entries: said('picked'),
    };
    reload();
  });

  it('takes what it stood on, not a pick made in another chat before it was opened again', async () => {
    await go('scene-a');
    setChatModel('scene-a', 'haiku');
    setChatEffort('scene-a', 'max');

    await go('scene-old');
    expect(chatPicksOf('scene-old')).toEqual({
      model: 'sonnet',
      effort: 'high',
    });
    await go('scene-picked');
    expect(chatPicksOf('scene-picked')).toEqual({
      model: 'opus',
      effort: 'low',
    });
    // The control: a project met for the first time, with nothing said in
    // its chat, stood on nothing and takes the default.
    await go('scene-new');
    expect(chatPicksOf('scene-new')).toEqual({
      model: 'default',
      effort: MEDIUM,
    });

    // And main has each in its chat, so a reload and another pick move none.
    reload();
    await go('scene-a');
    setChatModel('scene-a', 'fable');
    await go('scene-old');
    expect(chatPicksOf('scene-old').model).toBe('sonnet');
  });

  it("starts its project's new chat on the default, not on what the project once stood on", async () => {
    await go('scene-picked');
    expect(chatPicksOf('scene-picked').model).toBe('opus');
    await newStudioChat();
    expect(chatPicksOf('scene-picked')).toEqual({
      model: 'default',
      effort: MEDIUM,
    });
  });
});

describe("a project's chats", () => {
  it('each keep their own: a new chat starts on the default, and the earlier one has its own when opened again', async () => {
    await go('scene-a');
    setChatModel('scene-a', 'opus');
    main.chats['scene-a'].entries = said('first');
    await go('scene-b');
    setChatModel('scene-b', 'haiku');

    await go('scene-a');
    await newStudioChat();
    // Not the chat put aside's Opus, and not Haiku, picked last elsewhere.
    expect(chatPicksOf('scene-a').model).toBe('default');
    setChatModel('scene-a', 'sonnet');
    main.chats['scene-a'].entries = said('second');

    await loadPastStudioChats();
    await openPastStudioChat('past-said-first');
    expect(chatPicksOf('scene-a').model).toBe('opus');

    reload();
    await go('scene-a');
    expect(chatPicksOf('scene-a').model).toBe('opus');
    await loadPastStudioChats();
    await openPastStudioChat('past-said-second');
    expect(chatPicksOf('scene-a').model).toBe('sonnet');
  });

  it("start one brought in from Claude Code's own history on the default", async () => {
    window.localStorage.setItem('fluideq.studio.chatModel', 'sonnet');
    reload();
    await go('scene-a');
    main.past['scene-a'] = [
      {
        id: 'claude-code:abc',
        title: 'theirs',
        savedAt: 1,
        source: 'claude-code',
        chat: { ...empty('scene-a'), entries: said('theirs') },
      },
    ];
    await loadPastStudioChats();
    await openPastStudioChat('claude-code:abc');
    // Not Sonnet, which an older chat of FluidEQ's would have stood on.
    expect(chatPicksOf('scene-a').model).toBe('default');
  });
});

describe('what a chat sends', () => {
  it('goes on its own picks, and "Switch to Opus" switches that chat alone', async () => {
    await go('scene-a');
    setChatModel('scene-a', 'fable');
    await go('scene-b');
    setChatModel('scene-b', 'fable');
    setChatEffort('scene-b', 'high');

    await retryStudioChatOn('opus');
    expect(main.retried).toEqual([
      expect.objectContaining({ model: 'opus', effort: 'high' }),
    ]);
    expect(chatPicksOf('scene-b').model).toBe('opus');
    expect(main.chats['scene-b'].picks?.model).toBe('opus');

    await go('scene-a');
    expect(chatPicksOf('scene-a').model).toBe('fable');
    await sendToStudioChat('still Fable here');
    expect(main.sent).toEqual([
      expect.objectContaining({ model: 'fable', effort: MEDIUM }),
    ]);
  });

  it('is told to main for the project the pick was made on', async () => {
    await go('scene-a');
    setChatModel('scene-a', 'opus');
    setChatEffort('scene-a', 'low');
    expect(main.chats['scene-a'].picks).toEqual({
      model: 'opus',
      effort: 'low',
    });
    expect(main.chats['scene-b']).toBeUndefined();
  });
});

describe('the effort dots of two chats', () => {
  it('move one chat and leave the other where it was', async () => {
    await go('scene-a');
    await go('scene-b');
    setChatEffort('scene-a', 'low');
    setChatEffort('scene-b', 'high');
    const { user } = setup(
      <>
        <div data-testid="a">
          <StudioChatEffortDots chatKey="scene-a" disabled={false} />
        </div>
        <div data-testid="b">
          <StudioChatEffortDots chatKey="scene-b" disabled={false} />
        </div>
      </>,
    );
    const radios = (id: string) =>
      within(screen.getByTestId(id)).getAllByRole('radio');
    await user.click(radios('a')[4]);
    expect(chatPicksOf('scene-a').effort).toBe('max');
    expect(chatPicksOf('scene-b').effort).toBe('high');
    // low, medium, high, xhigh, max: the other chat's third dot still lit.
    expect(radios('b')[2]).toHaveAttribute('aria-checked', 'true');
    expect(radios('a')[4]).toHaveAttribute('aria-checked', 'true');
  });
});
