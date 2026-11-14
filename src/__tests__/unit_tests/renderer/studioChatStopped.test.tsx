/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the chat says where a reply stopped short (Ivan, 2026-11-13: "make
 * sure the chat shows the messages well, like the session limit for Fable
 * and Opus, or if it needs to re-login"): each reason its own words and the
 * action that mends it, and "stopped before it finished" only for a stop
 * Claude Code gave no reason the chat knows, with what it did say.
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  IStudioChatLimits,
  TStudioChatEntry,
} from '../../../common/studioChat';
import {
  STUDIO_CHAT_FAILURES,
  type TStudioChatFailure,
} from '../../../common/studioChatStop';
import StudioChatReply from '../../../renderer/studio/chat/StudioChatReply';
import {
  checkStudioChatLimits,
  resetStudioChatStore,
} from '../../../renderer/studio/chat/studioChatStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

const HOUR = 3600 * 1000;
const NOW = Date.now();
const failed = (
  failure: TStudioChatFailure,
  more: Partial<TReply> = {},
): TReply => ({
  kind: 'claude',
  id: 'reply',
  text: '',
  steps: [],
  state: 'failed',
  failure,
  ...more,
});

let bridge: {
  studioChatLimits: jest.Mock;
  studioChatSignIn: jest.Mock;
  studioChatCompact: jest.Mock;
};
const onRetry = jest.fn();

/** The reply as the thread draws the chat's last one, or an earlier one. */
const show = (reply: TReply, last = true) =>
  render(
    <StudioChatReply
      reply={reply}
      playing={false}
      onRetry={last ? onRetry : undefined}
      onOpenPicture={() => undefined}
      onRestore={async () => ({ ok: true })}
    />,
  );

const buttons = () =>
  screen.getAllByRole('button').map((button) => button.textContent);

beforeEach(() => {
  window.localStorage.clear();
  resetStudioChatStore();
  onRetry.mockReset();
  bridge = {
    studioChatLimits: jest.fn(async () => undefined),
    studioChatSignIn: jest.fn(async () => ({ state: 'ready' })),
    studioChatCompact: jest.fn(async () => undefined),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

describe('the notice where a reply stopped', () => {
  const WORDS: Record<Exclude<TStudioChatFailure, 'fable-limit'>, string> = {
    missing: 'studioChat.failed.missing',
    'signed-out': 'studioChat.failed.signedOut',
    limit: 'studioChat.failed.limit',
    subscription: 'studioChat.failed.subscription',
    network: 'studioChat.failed.network',
    server: 'studioChat.failed.server',
    'too-long': 'studioChat.failed.tooLong',
    crashed: 'studioChat.failed.crashed',
  };

  it('has words of its own for every reason, and the generic line for one alone', () => {
    // Every reason the chat can give is in this table, Fable's card aside.
    expect(Object.keys(WORDS).sort()).toEqual(
      STUDIO_CHAT_FAILURES.filter((one) => one !== 'fable-limit').sort(),
    );
    Object.entries(WORDS).forEach(([failure, words]) => {
      const { unmount } = show(failed(failure as TStudioChatFailure));
      expect(screen.getByRole('alert')).toHaveTextContent(words);
      unmount();
    });
    const said = Object.values(WORDS);
    expect(new Set(said).size).toBe(said.length);
    expect(said.filter((words) => words.endsWith('.crashed'))).toHaveLength(1);
  });

  it('names the limit and when it resets, as Claude Code said', () => {
    const resetsAt = NOW + 30 * HOUR;
    show(failed('limit', { limit: { window: 'week', resetsAt } }));
    const day = new Intl.DateTimeFormat('en', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(resetsAt);
    // The words, then the reset on a line of its own under them.
    expect(screen.getByRole('alert')).toHaveTextContent(
      `studioChat.failed.limitWeekstudioChat.limits.resets ${day}`,
    );
  });

  it('names the 5-hour limit with its time alone, and Opus’s own', () => {
    const resetsAt = NOW + 2 * HOUR;
    const { unmount } = show(
      failed('limit', { limit: { window: 'fiveHour', resetsAt } }),
    );
    const time = new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(resetsAt);
    expect(screen.getByRole('alert')).toHaveTextContent(
      `studioChat.failed.limitFiveHourstudioChat.limits.resets ${time}`,
    );
    unmount();
    show(failed('limit', { limit: { window: 'opus' } }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studioChat.failed.limitOpus',
    );
  });

  it('takes the reset from the plan’s last reading where the stop named none, if it is still ahead', async () => {
    const limits = (resetsAt: number): IStudioChatLimits => ({
      week: { used: 1, resetsAt },
      at: NOW,
    });
    bridge.studioChatLimits.mockResolvedValue(limits(NOW + 30 * HOUR));
    await checkStudioChatLimits();
    const { unmount } = show(failed('limit', { limit: { window: 'week' } }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studioChat.limits.resets',
    );
    unmount();
    // The control: a reading whose week has reset since says nothing.
    bridge.studioChatLimits.mockResolvedValue(limits(NOW - HOUR));
    await checkStudioChatLimits();
    show(failed('limit', { limit: { window: 'week' } }));
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      'studioChat.limits.resets',
    );
  });

  it('says no reset on any other reason, whatever the plan’s reading', async () => {
    bridge.studioChatLimits.mockResolvedValue({
      week: { used: 1, resetsAt: NOW + 30 * HOUR },
      at: NOW,
    });
    await checkStudioChatLimits();
    // Even on a reply that somehow kept a limit beside another reason.
    show(
      failed('server', {
        limit: { window: 'week', resetsAt: NOW + 30 * HOUR },
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      /^studioChat\.failed\.server/,
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      'studioChat.limits.resets',
    );
  });
});

describe('what the member can do about it', () => {
  it('offers the sign-in on a lost one, loud, and sends the message again once signed in', async () => {
    show(failed('signed-out'));
    const signIn = screen.getByRole('button', { name: 'studioChat.signIn' });
    expect(signIn).toHaveClass('button', 'small');
    expect(signIn).not.toHaveClass('subtle');
    fireEvent.click(signIn);
    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
    expect(bridge.studioChatSignIn).toHaveBeenCalledTimes(1);
  });

  it('does not send again when the sign-in was not completed', async () => {
    bridge.studioChatSignIn.mockResolvedValue({ state: 'signed-out' });
    show(failed('signed-out'));
    fireEvent.click(screen.getByRole('button', { name: 'studioChat.signIn' }));
    await waitFor(() =>
      expect(bridge.studioChatSignIn).toHaveBeenCalledTimes(1),
    );
    expect(onRetry).not.toHaveBeenCalled();
  });

  it.each(['network', 'server'] as const)(
    'offers "Try again", loud, when Claude could not be reached or was busy: %s',
    (failure) => {
      show(failed(failure));
      const again = screen.getByRole('button', { name: 'notice.tryAgain' });
      expect(again).not.toHaveClass('subtle');
      fireEvent.click(again);
      expect(onRetry).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['limit', 'subscription'] as const)(
    'offers "Try again" quietly where it only works once something else is in order: %s',
    (failure) => {
      show(failed(failure));
      const again = screen.getByRole('button', { name: 'notice.tryAgain' });
      expect(again).toHaveClass('subtle');
      fireEvent.click(again);
      expect(onRetry).toHaveBeenCalledTimes(1);
    },
  );

  it('offers to compact a chat that grew too long, and compacts it', async () => {
    show(failed('too-long'));
    fireEvent.click(
      screen.getByRole('button', { name: 'studioChat.compact.label' }),
    );
    await waitFor(() =>
      expect(bridge.studioChatCompact).toHaveBeenCalledTimes(1),
    );
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('offers nothing to press on a reply that is not the chat’s last', () => {
    (
      ['network', 'server', 'limit', 'subscription', 'too-long'] as const
    ).forEach((failure) => {
      const { unmount } = show(failed(failure), false);
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      unmount();
    });
  });

  it('offers no "Try again" on a stop with no notice: "Carry on" is the thread’s', () => {
    show(failed('crashed'));
    expect(
      screen.queryByRole('button', { name: 'notice.tryAgain' }),
    ).toBeNull();
  });
});

describe('a stop with no notice of its own', () => {
  it('says what Claude Code said, under the generic line', () => {
    show(failed('crashed', { said: 'API Error: 400 something new' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'studioChat.failed.crashedstudioChat.failed.said API Error: 400 something new',
    );
  });

  it('says the generic line alone where Claude Code said nothing', () => {
    show(failed('crashed'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /^studioChat\.failed\.crashed$/,
    );
  });

  it('never shows those words under a reason that has a notice', () => {
    show(failed('network', { said: 'left over' }));
    expect(screen.getByRole('alert')).not.toHaveTextContent('left over');
  });
});

describe('a reply the member stopped, or FluidEQ closing', () => {
  it('says so quietly: no alert, no reason, nothing to press', () => {
    show({ ...failed('crashed'), state: 'stopped', failure: undefined });
    expect(screen.getByText('studioChat.stopped')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('is on the page with the buttons a failure has, as the control', () => {
    show(failed('network'));
    expect(buttons()).toEqual(['notice.tryAgain']);
  });
});
