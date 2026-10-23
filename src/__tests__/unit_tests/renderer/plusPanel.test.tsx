/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { subscribeAccountPanelRequests } from '../../../renderer/account/accountPanel';
import { resetAccountStore } from '../../../renderer/account/accountStore';
import { resetEntitlementStore } from '../../../renderer/account/entitlementStore';
import CommunityPanel from '../../../renderer/community/CommunityPanel';
import {
  resetPlusNavigation,
  usePlusNavigation,
} from '../../../renderer/plus/plusNavigation';
import { resetProfileStore } from '../../../renderer/plus/profileStore';

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
  /**
   * The channels went to the Forum tab; three places stayed, and Dynamic
   * lighting came in under the Studio.
   */
  it('holds Visualizers, the Studio and Dynamic lighting, and opens on Visualizers', async () => {
    await renderPanel();
    const rail = screen.getByRole('navigation', { name: 'tabs.plus' });
    const places = within(rail)
      .getAllByRole('button')
      .filter((button) => button.classList.contains('community__channel'));
    // Top to bottom as the rail lists them; the leaderboard that stood first
    // is gone (2026-10-21).
    expect(places.map((button) => button.textContent)).toEqual([
      'plus.visualizers.titleplus.visualizers.blurb',
      'studio.titlestudio.rail.blurb',
      'lighting.titlelighting.rail.blurb',
    ]);
    expect(screen.getByText('visualizers view')).toBeInTheDocument();
    expect(rail).not.toHaveTextContent(/community|channel/);
  });

  it('asks the server for the name of the account signed in, once', async () => {
    await renderPanel();
    expect(bridge.plusProfile).toHaveBeenCalledTimes(1);
  });

  /** The name is chosen in the account panel; the foot of the rail leads there. */
  it('leads a member without a name to the account panel to choose one', async () => {
    const requests = jest.fn();
    const unsubscribe = subscribeAccountPanelRequests(requests);
    await renderPanel();
    await userEvent.click(
      screen.getByRole('button', { name: 'profile.name.choose' }),
    );
    expect(requests).toHaveBeenCalledWith('home');
    expect(screen.getByRole('status')).toHaveTextContent('visualizers');
    unsubscribe();
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
    expect(screen.getByText('profile.role.admin')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'profile.name.choose' }),
    ).toBeNull();
  });

  /** The member's own card at the foot of the rail is the way to the account. */
  it('opens the account when the member’s own card is clicked', async () => {
    const requests = jest.fn();
    const unsubscribe = subscribeAccountPanelRequests(requests);
    await renderPanel();
    await userEvent.click(screen.getByTitle('account.menu'));
    expect(requests).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  /** Anyone may publish to the gallery, so anyone may need a name for it. */
  it('offers a name to an account without Plus too', async () => {
    bridge.getEntitlementStatus.mockResolvedValue({ state: 'none' });
    await renderPanel();
    expect(
      screen.getByRole('button', { name: 'profile.name.choose' }),
    ).toBeInTheDocument();
  });

  /**
   * The stores start signed out and without Plus; drawing that before the
   * main process answered flashed the welcome at a member opening the tab.
   */
  it('draws neither the welcome nor the rail until the account and Plus have answered', async () => {
    let answerAccount: (state: typeof signedIn) => void = () => {};
    let answerPlus: (status: { state: string }) => void = () => {};
    bridge.getAccountState.mockReturnValue(
      new Promise((resolve) => {
        answerAccount = resolve;
      }),
    );
    bridge.getEntitlementStatus.mockReturnValue(
      new Promise((resolve) => {
        answerPlus = resolve;
      }),
    );
    await renderPanel();
    const waiting = screen.getByRole('status', { name: 'account.checking' });
    expect(document.querySelector('.plus-welcome')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();

    await act(async () => answerAccount(signedIn));
    // Signed in, but whether with Plus is not known yet: still waiting.
    expect(waiting).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();

    await act(async () => answerPlus({ state: 'active' }));
    expect(
      screen.queryByRole('status', { name: 'account.checking' }),
    ).toBeNull();
    expect(
      screen.getByRole('navigation', { name: 'tabs.plus' }),
    ).toBeInTheDocument();
  });

  it('asks a visitor to sign in, naming what an account opens and what takes Plus', async () => {
    bridge.getAccountState.mockResolvedValue({ status: 'signed-out' });
    await renderPanel();
    // The free app comes first; sign-in is a quiet independent choice.
    const signIn = screen.getByRole('button', { name: 'account.signIn' });
    expect(signIn).toHaveClass('button', 'plus-welcome__button');
    expect(signIn).toHaveClass('subtle');
    expect(
      screen.getByRole('heading', { name: 'trial.free.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('trial.free.body')).toBeInTheDocument();
    expect(screen.getByText('trial.browse')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'trial.extras.title' }),
    ).toBeInTheDocument();
    const perks = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(perks.map((perk) => perk.textContent)).toEqual([
      'trial.extras.scenes',
      'trial.extras.studio',
      'trial.extras.desktop',
    ]);
    expect(bridge.plusProfile).not.toHaveBeenCalled();
  });
});
