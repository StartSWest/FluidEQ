/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetAccountStore } from '../../../renderer/account/accountStore';
import { resetEntitlementStore } from '../../../renderer/account/entitlementStore';
import CommunityPanel from '../../../renderer/community/CommunityPanel';
import {
  resetPlusNavigation,
  usePlusNavigation,
} from '../../../renderer/plus/plusNavigation';
import { resetProfileStore } from '../../../renderer/plus/profileStore';
import { resetLeaderboardStore } from '../../../renderer/usage/leaderboardStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

// The three places are whole views with their own tests; here only the rail
// that leads to them is under test.
jest.mock('../../../renderer/plus/VisualizersView', () => ({
  __esModule: true,
  default: () => <div>visualizers view</div>,
}));
jest.mock('../../../renderer/studio/StudioPanel', () => ({
  __esModule: true,
  default: () => <div>studio view</div>,
}));
jest.mock('../../../renderer/community/LeaderboardView', () => ({
  __esModule: true,
  default: () => <div>board view</div>,
}));

const bridge = {
  getAccountState: jest.fn(),
  onAccountState: jest.fn(() => () => {}),
  getEntitlementStatus: jest.fn(),
  onEntitlementChanged: jest.fn(() => () => {}),
  plusProfile: jest.fn(),
};

const signedIn = {
  status: 'signed-in',
  identity: { id: 'acct-1', email: 'me@example.com', name: 'Me' },
};

function Place() {
  return <output>{usePlusNavigation().place}</output>;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetAccountStore();
  resetEntitlementStore();
  resetProfileStore();
  resetLeaderboardStore();
  resetPlusNavigation();
  bridge.getAccountState.mockResolvedValue(signedIn);
  bridge.getEntitlementStatus.mockResolvedValue({ state: 'active' });
  bridge.plusProfile.mockResolvedValue({ ok: true, value: null });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

const renderPanel = async () => {
  render(
    <>
      <CommunityPanel onSignIn={jest.fn()} onShowGraph={jest.fn()} />
      <Place />
    </>,
  );
  await act(async () => {});
};

describe('the Plus tab', () => {
  /** The channels went to the Forum tab; three places stay, nothing else. */
  it('holds Visualizers, the leaderboard and the Studio, and opens on Visualizers', async () => {
    await renderPanel();
    const rail = screen.getByRole('navigation', { name: 'tabs.plus' });
    const places = within(rail)
      .getAllByRole('button')
      .filter((button) => button.classList.contains('community__channel'));
    expect(places.map((button) => button.textContent)).toEqual([
      'plus.visualizers.titleplus.visualizers.blurb',
      'leaderboard.titleleaderboard.rail.blurb',
      'studio.titlestudio.rail.blurb',
    ]);
    expect(screen.getByText('visualizers view')).toBeInTheDocument();
    expect(rail).not.toHaveTextContent(/community|channel/);
  });

  it('asks the server for the name of the account signed in, once', async () => {
    await renderPanel();
    expect(bridge.plusProfile).toHaveBeenCalledTimes(1);
  });

  /** Choosing a name is the board's; the foot of the rail is the way there. */
  it('leads a Plus member without a name to the board to choose one', async () => {
    await renderPanel();
    await userEvent.click(
      screen.getByRole('button', { name: 'leaderboard.name.choose' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('board');
    expect(screen.getByText('board view')).toBeInTheDocument();
  });

  it('shows the chosen name and handle at the foot of the rail, and no way to choose again', async () => {
    bridge.plusProfile.mockResolvedValue({
      ok: true,
      value: {
        userId: 'acct-1',
        handle: 'ivan_c',
        displayName: 'Ivan C',
        role: 'admin',
      },
    });
    await renderPanel();
    expect(screen.getByText('Ivan C')).toBeInTheDocument();
    expect(screen.getByText('@ivan_c')).toBeInTheDocument();
    expect(screen.getByText('leaderboard.role.admin')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'leaderboard.name.choose' }),
    ).toBeNull();
  });

  it('offers no name to an account without Plus, which the board does not rank', async () => {
    bridge.getEntitlementStatus.mockResolvedValue({ state: 'none' });
    await renderPanel();
    expect(
      screen.queryByRole('button', { name: 'leaderboard.name.choose' }),
    ).toBeNull();
  });

  it('asks a visitor to sign in, naming the three places and nothing else', async () => {
    bridge.getAccountState.mockResolvedValue({ status: 'signed-out' });
    await renderPanel();
    expect(screen.getByRole('button', { name: 'account.signIn' })).toHaveClass(
      'button',
      'small',
    );
    expect(screen.getByRole('list')).toHaveTextContent(
      'plus.visualizers.titleleaderboard.titlestudio.title',
    );
    expect(bridge.plusProfile).not.toHaveBeenCalled();
  });
});
