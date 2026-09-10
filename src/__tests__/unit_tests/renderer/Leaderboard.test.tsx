/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaderboardCard from '../../../renderer/account/LeaderboardCard';
import LeaderboardView from '../../../renderer/community/LeaderboardView';
import { resetLeaderboardStore } from '../../../renderer/usage/leaderboardStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const status = { optedIn: false, todayMinutes: 0, eligible: true };
const bridge = {
  leaderboardStatus: jest.fn(),
  leaderboardOptIn: jest.fn(),
  leaderboardBoard: jest.fn(),
  leaderboardRemoveMe: jest.fn(),
  onLeaderboardStatus: jest.fn(() => () => {}),
};

beforeEach(() => {
  jest.clearAllMocks();
  resetLeaderboardStore();
  bridge.leaderboardStatus.mockResolvedValue(status);
  bridge.leaderboardOptIn.mockImplementation((value: boolean) =>
    Promise.resolve({ ...status, optedIn: value, todayMinutes: 90 }),
  );
  bridge.leaderboardRemoveMe.mockResolvedValue({ ok: true });
  bridge.leaderboardBoard.mockResolvedValue({
    ok: true,
    value: {
      period: 'all',
      rows: [
        {
          rank: 1,
          handle: 'ada',
          displayName: 'Ada',
          role: 'member',
          points: 1240,
          minutes: 600,
          activeDays: 9,
          messages: 12,
          replies: 3,
          mentions: 5,
        },
        {
          rank: 2,
          handle: 'bob',
          displayName: 'Bob',
          role: 'admin',
          points: 55,
          minutes: 90,
          activeDays: 2,
          messages: 0,
          replies: 0,
          mentions: 0,
        },
      ],
      me: {
        rank: 40,
        points: 25,
        minutes: 30,
        activeDays: 1,
        messages: 0,
        replies: 0,
        mentions: 0,
        players: 120,
      },
    },
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

describe('the leaderboard card', () => {
  /** Off by default; joining is the loud action, everything else is quiet. */
  it('starts out with the loud Join button and a quiet Remove', async () => {
    render(<LeaderboardCard />);
    const join = await screen.findByRole('button', {
      name: 'leaderboard.card.join',
    });
    expect(join).toHaveClass('button', 'small');
    expect(join).not.toHaveClass('subtle');
    expect(
      screen.getByRole('button', { name: 'leaderboard.card.remove' }),
    ).toHaveClass('subtle');
    expect(screen.getByText('leaderboard.card.today:0')).toBeInTheDocument();
  });

  it('flips to a quiet Leave once joined and shows the hours as told', async () => {
    render(<LeaderboardCard />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'leaderboard.card.join' }),
    );
    expect(bridge.leaderboardOptIn).toHaveBeenCalledWith(true);
    const leave = await screen.findByRole('button', {
      name: 'leaderboard.card.leave',
    });
    expect(leave).toHaveClass('subtle');
    expect(screen.getByText('leaderboard.card.today:1.5')).toBeInTheDocument();
  });

  it('warns when joined without Plus, because nothing is sent until then', async () => {
    bridge.leaderboardStatus.mockResolvedValue({
      optedIn: true,
      todayMinutes: 0,
      eligible: false,
    });
    render(<LeaderboardCard />);
    expect(
      await screen.findByText('leaderboard.card.plusOnly'),
    ).toBeInTheDocument();
  });

  it('asks before removing, keeps the data on the loud button, and confirms once it is gone', async () => {
    render(<LeaderboardCard />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'leaderboard.card.remove' }),
    );
    // Nothing has left yet: the question stands where the buttons were.
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'leaderboard.card.removeConfirmBody',
    );
    expect(bridge.leaderboardRemoveMe).not.toHaveBeenCalled();
    const keep = screen.getByRole('button', {
      name: 'leaderboard.card.removeKeep',
    });
    expect(keep).toHaveClass('button', 'small');
    expect(keep).not.toHaveClass('subtle');
    await userEvent.click(keep);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(bridge.leaderboardRemoveMe).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: 'leaderboard.card.remove' }),
    );
    const confirm = screen.getByRole('button', {
      name: 'leaderboard.card.removeConfirm',
    });
    expect(confirm).toHaveClass('subtle');
    await userEvent.click(confirm);
    expect(bridge.leaderboardRemoveMe).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'leaderboard.card.removed',
    );
  });
});

describe('the leaderboard view', () => {
  it('lists the board in hours, pins my own place underneath, and switches period', async () => {
    render(<LeaderboardView />);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('leaderboard.hours:10')).toBeInTheDocument();
    expect(screen.getByText('leaderboard.players:120')).toBeInTheDocument();
    // Rank 40 is not in the top rows, so it appears as my own pinned line.
    expect(screen.getByText('leaderboard.you')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('tab', { name: 'leaderboard.thisMonth' }),
    );
    expect(bridge.leaderboardBoard).toHaveBeenLastCalledWith('month');
  });

  it('says why when the server refuses', async () => {
    bridge.leaderboardBoard.mockResolvedValue({
      ok: false,
      failure: 'plus_required',
    });
    render(<LeaderboardView />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'leaderboard.error.plusRequired',
    );
  });

  it('survives a bridge that never answers', async () => {
    bridge.leaderboardBoard.mockResolvedValue(undefined);
    render(<LeaderboardView />);
    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
