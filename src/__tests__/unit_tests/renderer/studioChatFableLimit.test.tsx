/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Fable's limit in the chat (Ivan, 2026-11-13: "when fable reaches the
 * session limit show that in the chat and ask to change to opus if there is
 * still session room for opus"): Opus offered only on a reading taken after
 * the wall that leaves it room, never switched to on its own; otherwise
 * each window that holds Opus too, with its reset. Fable's own window on
 * the accounts card beside the plan's. Each case beside its control.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  IStudioChatLimits,
  IStudioChatModels,
} from '../../../common/studioChat';
import { opusRoomOf } from '../../../renderer/studio/chat/fableLimit';
import {
  chatPicksOf,
  resetChatPicksForTesting,
} from '../../../renderer/studio/chat/chatPicks';
import StudioChatFableLimit from '../../../renderer/studio/chat/StudioChatFableLimit';
import StudioChatLimits from '../../../renderer/studio/chat/StudioChatLimits';
import { resetStudioChatModelsForTesting } from '../../../renderer/studio/chat/studioChatModels';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

const HOUR = 3600 * 1000;
const NOW = Date.now();

const MODELS: IStudioChatModels = {
  checked: true,
  lines: [
    { id: 'fable', name: 'Fable 5.2' },
    { id: 'opus', name: 'Opus 5.5' },
  ],
};

describe('whether Opus has room', () => {
  const shared = {
    fiveHour: { used: 0.4, resetsAt: NOW + HOUR },
    week: { used: 0.6, resetsAt: NOW + 50 * HOUR },
    fable: { used: 1, resetsAt: NOW + 40 * HOUR },
    at: NOW,
  };

  it('has room while the plan’s windows are short of full, whatever Fable’s', () => {
    expect(opusRoomOf(shared, NOW)).toEqual({ state: 'room' });
  });

  it('is full when a window Opus is held to is spent, naming each', () => {
    expect(
      opusRoomOf(
        { ...shared, fiveHour: { used: 1, resetsAt: NOW + HOUR } },
        NOW,
      ),
    ).toEqual({
      state: 'full',
      spent: [{ window: 'fiveHour', resetsAt: NOW + HOUR }],
    });
    expect(
      opusRoomOf({ ...shared, opus: { used: 1, resetsAt: NOW + HOUR } }, NOW),
    ).toEqual({
      state: 'full',
      spent: [{ window: 'opus', resetsAt: NOW + HOUR }],
    });
  });

  it('says nothing when a window is missing or its figure is from before its reset', () => {
    const { week, ...noWeek } = shared;
    expect(week).toBeDefined();
    expect(opusRoomOf(noWeek, NOW)).toEqual({ state: 'unknown' });
    expect(
      opusRoomOf(
        { ...shared, fiveHour: { used: 0.1, resetsAt: NOW - 1 } },
        NOW,
      ),
    ).toEqual({ state: 'unknown' });
    // A spent window that has since reset holds nothing back either.
    expect(
      opusRoomOf({ ...shared, fiveHour: { used: 1, resetsAt: NOW - 1 } }, NOW),
    ).toEqual({ state: 'unknown' });
    expect(opusRoomOf(undefined, NOW)).toEqual({ state: 'unknown' });
  });
});

describe('the card where the reply stopped', () => {
  let retried: jest.Mock;

  /** The bridge, answering every reading with `limits` taken `age` ago. */
  const bridge = (
    limits: Omit<IStudioChatLimits, 'at'>,
    {
      age = 0,
      models = MODELS,
    }: { age?: number; models?: IStudioChatModels } = {},
  ) => {
    // The picks are read back from storage: emptied first.
    window.localStorage.clear();
    resetStudioChatStore();
    resetStudioChatModelsForTesting();
    resetChatPicksForTesting();
    retried = jest.fn(async () => undefined);
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        ipcRenderer: {
          studioChatLimits: jest.fn(async () => ({
            ...limits,
            at: Date.now() - age,
          })),
          studioChatModels: jest.fn(async () => models),
          studioChatRetry: retried,
        },
      },
    });
  };

  const ROOM = {
    fiveHour: { used: 0.4, resetsAt: NOW + HOUR },
    week: { used: 0.6, resetsAt: NOW + 50 * HOUR },
    fable: { used: 1, resetsAt: NOW + 40 * HOUR },
  };

  it('offers Opus, loud, beside a quiet decline, and says when Fable is back', async () => {
    bridge(ROOM);
    render(<StudioChatFableLimit canRetry />);
    const offer = await screen.findByRole('button', {
      name: 'studioChat.fable.switch',
    });
    expect(offer).toHaveClass('button', 'small');
    expect(offer).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: 'studioChat.fable.notNow' }),
    ).toHaveClass('subtle');
    const back = new Intl.DateTimeFormat('en', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(ROOM.fable.resetsAt);
    expect(screen.getByRole('alert')).toHaveTextContent(
      `studioChat.failed.fableLimit studioChat.fable.back ${back}`,
    );
    // Nothing went again on its own.
    expect(retried).not.toHaveBeenCalled();
  });

  it('switches this chat to Opus and sends the message again on the press', async () => {
    bridge(ROOM);
    render(<StudioChatFableLimit canRetry />);
    const offer = await screen.findByRole('button', {
      name: 'studioChat.fable.switch',
    });
    fireEvent.click(offer);
    // Busy while it goes, and free again once it has been handed over.
    expect(offer).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(offer).toHaveAttribute('aria-busy', 'false'));
    expect(retried).toHaveBeenCalledTimes(1);
    expect(retried.mock.calls[0][0]).toMatchObject({ model: 'opus' });
    expect(chatPicksOf(undefined).model).toBe('opus');
  });

  it('leaves the chat as it is on “Not now”', async () => {
    bridge(ROOM);
    render(<StudioChatFableLimit canRetry />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'studioChat.fable.notNow' }),
    );
    expect(
      screen.queryByRole('button', { name: 'studioChat.fable.switch' }),
    ).toBeNull();
    expect(retried).not.toHaveBeenCalled();
    expect(chatPicksOf(undefined).model).not.toBe('opus');
  });

  it('says Opus is at its limit too, with each window’s reset, and offers nothing', async () => {
    bridge({ ...ROOM, fiveHour: { used: 1, resetsAt: NOW + HOUR } });
    render(<StudioChatFableLimit canRetry />);
    expect(
      await screen.findByText('studioChat.fable.opusFull'),
    ).toBeInTheDocument();
    const time = new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(NOW + HOUR);
    expect(
      screen.getByText(
        `studioChat.limits.fiveHour · studioChat.limits.resets ${time}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'studioChat.fable.switch' }),
    ).toBeNull();
  });

  it('does not believe a reading from before the wall: it checks instead', async () => {
    bridge(ROOM, { age: 60 * 1000 });
    render(<StudioChatFableLimit canRetry />);
    expect(
      await screen.findByText('studioChat.fable.checking'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'studioChat.fable.switch' }),
    ).toBeNull();
  });

  it('offers nothing on a reply that cannot go again, or where Opus is not offered', async () => {
    bridge(ROOM);
    const { unmount } = render(<StudioChatFableLimit canRetry={false} />);
    expect(
      await screen.findByText(/studioChat\.failed\.fableLimit/),
    ).toBeInTheDocument();
    // Nothing said of Opus at all: not even that it is being checked.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/studioChat\.fable\.(checking|opus)/)).toBeNull();
    unmount();

    bridge(ROOM, {
      models: { checked: true, lines: [{ id: 'fable', name: 'Fable 5.2' }] },
    });
    render(<StudioChatFableLimit canRetry />);
    // The reading arrives, and the models; still no offer.
    await screen.findByText(/studioChat\.fable\.back/);
    expect(
      await screen.findByText(/studioChat\.failed\.fableLimit/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/studioChat\.fable\.(checking|opus)/)).toBeNull();
  });
});

it('shows Fable’s window on the accounts card beside the plan’s', async () => {
  resetStudioChatStore();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        studioChatLimits: jest.fn(async () => ({
          fiveHour: { used: 0.4, resetsAt: Date.now() + HOUR },
          week: { used: 0.6, resetsAt: Date.now() + 50 * HOUR },
          fable: { used: 0.83, resetsAt: Date.now() + 40 * HOUR },
          at: Date.now(),
        })),
      },
    },
  });
  render(<StudioChatLimits />);
  expect(
    await screen.findByRole('meter', { name: 'studioChat.limits.fable' }),
  ).toHaveAttribute('aria-valuenow', '83');
  // The control: the plan's own windows still stand.
  expect(
    screen.getByRole('meter', { name: 'studioChat.limits.fiveHour' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('meter', { name: 'studioChat.limits.opus' }),
  ).toBeNull();
});
