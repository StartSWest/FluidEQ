/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PART_POINTS, SCORE_PARTS } from '../../../common/leaderboardScore';
import { subscribeAccountPanelRequests } from '../../../renderer/account/accountPanel';
import { resetEntitlementStore } from '../../../renderer/account/entitlementStore';
import LeaderboardCard from '../../../renderer/account/LeaderboardCard';
import LeaderboardView from '../../../renderer/community/LeaderboardView';
import {
  loadProfile,
  resetProfileStore,
} from '../../../renderer/plus/profileStore';
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
  getEntitlementStatus: jest.fn(),
  onEntitlementChanged: jest.fn(() => () => {}),
  plusProfile: jest.fn(),
  plusCreateProfile: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  resetLeaderboardStore();
  resetEntitlementStore();
  resetProfileStore();
  bridge.getEntitlementStatus.mockResolvedValue({ state: 'active' });
  bridge.plusProfile.mockResolvedValue({
    ok: true,
    value: {
      userId: 'me',
      handle: 'me_here',
      displayName: 'Me',
      role: 'member',
    },
  });
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
          likes: 3,
        },
        {
          rank: 2,
          handle: 'bob',
          displayName: 'Bob',
          role: 'admin',
          points: 55,
          minutes: 90,
          activeDays: 2,
          likes: 0,
        },
      ],
      me: {
        rank: 40,
        points: 25,
        minutes: 30,
        activeDays: 1,
        likes: 0,
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
    // My standing leads the board, wherever I rank: the rank of the total,
    // and the one person just ahead with the points it takes to pass them.
    expect(screen.getByText('leaderboard.hero.title')).toBeInTheDocument();
    expect(screen.getByText('leaderboard.hero.of:120')).toBeInTheDocument();
    expect(
      screen.getByText('leaderboard.hero.toPass:31,Bob'),
    ).toBeInTheDocument();

    // Under every name, the three things the points are made of: hours,
    // active days, and — only when there are any — likes on scenes someone
    // made. Ada has three likes, Bob none. Nothing about messages remains.
    expect(screen.getByTitle('leaderboard.stat.days:9')).toHaveTextContent('9');
    expect(screen.getByTitle('leaderboard.stat.days:2')).toHaveTextContent('2');
    expect(screen.getAllByTitle(/^leaderboard\.stat\.likes:/)).toHaveLength(1);
    expect(screen.getByTitle('leaderboard.stat.likes:3')).toHaveTextContent(
      '3',
    );
    expect(screen.queryByTitle(/messages|mentions/)).toBeNull();
    // The maker wears the one role mark there is.
    expect(screen.getAllByText('leaderboard.role.admin')).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('tab', { name: 'leaderboard.thisMonth' }),
    );
    expect(bridge.leaderboardBoard).toHaveBeenLastCalledWith('month');
  });

  /**
   * How points are earned stands beside the board, the same for everyone,
   * and says where the numbers come from with a way to everything sent.
   */
  it('explains every way to earn points, and leads to what the app sends', async () => {
    const requests = jest.fn();
    const unsubscribe = subscribeAccountPanelRequests(requests);
    render(<LeaderboardView />);
    const guide = await screen.findByRole('complementary', {
      name: 'leaderboard.guide.title',
    });
    expect(guide).toHaveTextContent('leaderboard.guide.lead');
    // Listening, active days and likes: nothing the channels used to feed.
    expect(SCORE_PARTS).toEqual(['hours', 'days', 'likes']);
    SCORE_PARTS.forEach((part) => {
      expect(guide).toHaveTextContent(
        `leaderboard.guide.value:${PART_POINTS[part]}`,
      );
    });
    // The limits come from the scoring's own numbers.
    expect(guide).toHaveTextContent('leaderboard.guide.hours:16');
    expect(guide).toHaveTextContent('leaderboard.guide.days:30');
    expect(guide).toHaveTextContent('leaderboard.guide.likes');
    expect(guide).not.toHaveTextContent(/messages|mentions/);

    await userEvent.click(
      screen.getByRole('button', { name: 'leaderboard.guide.terms' }),
    );
    expect(requests).toHaveBeenCalledWith('terms');
    unsubscribe();
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

describe('choosing the name the board shows', () => {
  const noName = () =>
    bridge.plusProfile.mockResolvedValue({ ok: true, value: null });

  /**
   * The server counts a member's listening only under a name, and the chat
   * that used to ask for one is gone: the board asks, and ranks them once it
   * is saved.
   */
  it('asks a Plus member without a name for one, and asks the board again once it is saved', async () => {
    noName();
    bridge.plusCreateProfile.mockResolvedValue({
      ok: true,
      value: {
        userId: 'me',
        handle: 'ivan_c',
        displayName: 'Ivan C',
        role: 'member',
      },
    });
    await loadProfile('me');
    render(<LeaderboardView />);
    const handle = await screen.findByLabelText(/leaderboard\.name\.handle/);
    const name = screen.getByLabelText('leaderboard.name.name');
    const save = screen.getByRole('button', { name: 'leaderboard.name.save' });
    // The loud button, and only once there is something to save.
    expect(save).toHaveClass('button', 'small');
    expect(save).not.toHaveClass('subtle');
    expect(save).toBeDisabled();

    // Only what the server accepts can be typed: lower case, a-z, 0-9, _.
    await userEvent.type(handle, 'Ivan C!');
    expect(handle).toHaveValue('ivanc');
    await userEvent.clear(handle);
    await userEvent.type(handle, 'ivan_c');
    expect(save).toBeDisabled();
    await userEvent.type(name, '  Ivan C  ');
    expect(save).toBeEnabled();

    const asked = bridge.leaderboardBoard.mock.calls.length;
    await userEvent.click(save);
    expect(bridge.plusCreateProfile).toHaveBeenCalledWith('ivan_c', 'Ivan C');
    expect(bridge.leaderboardBoard.mock.calls.length).toBe(asked + 1);
    expect(screen.queryByLabelText('leaderboard.name.name')).toBeNull();
  });

  it('says so when the handle is taken, and keeps what was typed', async () => {
    noName();
    bridge.plusCreateProfile.mockResolvedValue({
      ok: false,
      failure: 'handle_taken',
    });
    await loadProfile('me');
    render(<LeaderboardView />);
    await userEvent.type(
      await screen.findByLabelText(/leaderboard\.name\.handle/),
      'ada',
    );
    await userEvent.type(screen.getByLabelText('leaderboard.name.name'), 'Ada');
    await userEvent.click(
      screen.getByRole('button', { name: 'leaderboard.name.save' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'leaderboard.name.error.handleTaken',
    );
    expect(screen.getByLabelText(/leaderboard\.name\.handle/)).toHaveValue(
      'ada',
    );
  });

  it('does not ask a member who already has a name', async () => {
    await loadProfile('me');
    render(<LeaderboardView />);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.queryByText('leaderboard.name.title')).toBeNull();
  });

  it('does not ask an account without Plus, which the board does not rank', async () => {
    noName();
    bridge.getEntitlementStatus.mockResolvedValue({ state: 'none' });
    await loadProfile('me');
    render(<LeaderboardView />);
    await act(async () => {});
    expect(screen.queryByText('leaderboard.name.title')).toBeNull();
  });
});
