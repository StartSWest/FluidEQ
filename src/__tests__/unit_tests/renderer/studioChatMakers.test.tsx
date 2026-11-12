/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Higgsfield, the Studio's one maker, as the member sees it in the chat's
 * Accounts (Ivan, 2026-11-11: "let's remove GPT then and let's only use
 * Higgsfield"): its card and the press that sets it up, with no GPT card,
 * no ChatGPT card and no choice of maker beside it.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { THiggsfieldAccount } from '../../../common/studioMakers';
import StudioChatAccounts from '../../../renderer/studio/chat/StudioChatAccounts';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';
import { resetStudioMakersStore } from '../../../renderer/studio/chat/studioMakersStore';
import studioChatBridge from '../../utils/studioChatBridge';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

/** Higgsfield as main answers it. */
const makers = (state: THiggsfieldAccount['state']): THiggsfieldAccount => ({
  state,
});

let now: THiggsfieldAccount;
const studioChatMakers = jest.fn(async () => now);
const studioChatHiggsfieldConnect = jest.fn(
  async (): Promise<THiggsfieldAccount | undefined> => now,
);
const studioChatLimits = jest.fn(async () => undefined);
let studioChatAvailability: jest.Mock;

beforeEach(() => {
  resetStudioChatStore();
  resetStudioMakersStore();
  jest.clearAllMocks();
  now = makers('missing');
  studioChatAvailability = jest.fn(async () => ({ state: 'ready' as const }));
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        ...studioChatBridge(),
        studioChatAvailability,
        studioChatLimits,
        studioChatMakers,
        studioChatHiggsfieldConnect,
      },
    },
  });
});

const accounts = () =>
  render(
    <StudioChatAccounts
      closeRef={{ current: null }}
      onClose={() => undefined}
    />,
  );

const higgsfield = () =>
  screen.findByLabelText('studioChat.accounts.higgsfield');
/** A press, and everything main's answer to it changes on the page. */
const pressAndSettle = (button: HTMLElement) =>
  act(async () => {
    fireEvent.click(button);
  });
const buttonsOf = (card: HTMLElement) =>
  within(card)
    .queryAllByRole('button')
    .map((button) => button.textContent);

describe('Higgsfield in Accounts', () => {
  it('is the one maker there: no GPT, no ChatGPT, no choice of maker', async () => {
    now = makers('ready');
    accounts();
    await higgsfield();
    // The control: the Claude account is drawn beside it.
    expect(
      screen.getByLabelText('studioChat.accounts.claude'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('studioChat.accounts.gpt')).toBeNull();
    expect(screen.queryByLabelText('studioChat.accounts.chatgpt')).toBeNull();
    expect(screen.queryByLabelText('studioChat.accounts.makeWith')).toBeNull();
    expect(
      screen
        .getAllByRole('region')
        .map((card) => card.getAttribute('aria-label')),
    ).toEqual(['studioChat.accounts.claude', 'studioChat.accounts.higgsfield']);
  });

  it('offers to set Higgsfield up where it is missing, and says what that does', async () => {
    accounts();
    const card = await higgsfield();
    expect(card).toHaveTextContent('studioChat.accounts.higgsfieldMissing');
    expect(buttonsOf(card)).toEqual([
      'studioChat.accounts.higgsfieldSetUp',
      'studioChat.accounts.higgsfieldAbout',
    ]);
    // The suggested press is the loud one; the other the quiet one.
    const [setUp, about] = within(card).getAllByRole('button');
    expect(setUp).toHaveClass('button', 'small');
    expect(setUp).not.toHaveClass('subtle');
    expect(about).toHaveClass('subtle');
  });

  it('sets it up on the press, and shows what came of it', async () => {
    accounts();
    const card = await higgsfield();
    studioChatHiggsfieldConnect.mockImplementationOnce(async () =>
      makers('ready'),
    );
    fireEvent.click(
      within(card).getByRole('button', {
        name: 'studioChat.accounts.higgsfieldSetUp',
      }),
    );
    expect(studioChatHiggsfieldConnect).toHaveBeenCalledWith(false);
    await waitFor(() =>
      expect(card).toHaveTextContent('studioChat.accounts.higgsfieldReady'),
    );
    expect(buttonsOf(card)).toEqual(['studioChat.accounts.switch']);
  });

  it('says to finish in the browser while the sign-in is open, and takes no second press', async () => {
    accounts();
    const card = await higgsfield();
    let finish: (value: THiggsfieldAccount) => void = () => undefined;
    studioChatHiggsfieldConnect.mockImplementationOnce(
      () =>
        new Promise<THiggsfieldAccount>((resolve) => {
          finish = resolve;
        }),
    );
    const setUp = within(card).getByRole('button', {
      name: 'studioChat.accounts.higgsfieldSetUp',
    });
    fireEvent.click(setUp);
    await waitFor(() => expect(setUp).toBeDisabled());
    expect(setUp).toHaveClass('is-running');
    expect(card).toHaveTextContent('studioChat.accounts.higgsfieldConnecting');
    fireEvent.click(setUp);
    expect(studioChatHiggsfieldConnect).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(makers('signed-out'));
    });
    expect(card).toHaveTextContent('studioChat.accounts.higgsfieldOut');
    expect(buttonsOf(card)).toEqual(['studioChat.accounts.higgsfieldSignIn']);
  });

  it('offers only the sign-in where Higgsfield is there and signed out', async () => {
    now = makers('signed-out');
    accounts();
    const card = await higgsfield();
    expect(buttonsOf(card)).toEqual(['studioChat.accounts.higgsfieldSignIn']);
    await pressAndSettle(within(card).getByRole('button'));
    expect(studioChatHiggsfieldConnect).toHaveBeenCalledWith(false);
  });

  // Ivan, 2026-11-11: the card said connected over a chat that could not
  // reach Higgsfield, which was a claude.ai connector.
  it('never calls a claude.ai connector connected, and offers the set-up the chat can use', async () => {
    now = makers('connector');
    accounts();
    const card = await higgsfield();
    expect(card).toHaveTextContent('studioChat.accounts.higgsfieldConnector');
    expect(card).not.toHaveTextContent('studioChat.accounts.higgsfieldReady');
    expect(buttonsOf(card)).toEqual(['studioChat.accounts.higgsfieldSetUp']);
    const [setUp] = within(card).getAllByRole('button');
    expect(setUp).not.toHaveClass('subtle');
    await pressAndSettle(setUp);
    expect(studioChatHiggsfieldConnect).toHaveBeenCalledWith(false);
  });

  it('signs out first for another account', async () => {
    now = makers('ready');
    accounts();
    const card = await higgsfield();
    await pressAndSettle(
      within(card).getByRole('button', { name: 'studioChat.accounts.switch' }),
    );
    expect(studioChatHiggsfieldConnect).toHaveBeenCalledWith(true);
  });

  it('asks again, and runs nothing, where Higgsfield could not be reached', async () => {
    now = makers('unreachable');
    accounts();
    const card = await higgsfield();
    expect(card).toHaveTextContent('studioChat.accounts.higgsfieldUnreachable');
    const asked = studioChatMakers.mock.calls.length;
    await pressAndSettle(
      within(card).getByRole('button', {
        name: 'studioChat.accounts.checkAgain',
      }),
    );
    expect(studioChatMakers).toHaveBeenCalledTimes(asked + 1);
    expect(studioChatHiggsfieldConnect).not.toHaveBeenCalled();
  });

  it('asks again when the window comes back, for a sign-in finished in the browser', async () => {
    now = makers('signed-out');
    accounts();
    const card = await higgsfield();
    now = makers('ready');
    fireEvent.focus(window);
    await waitFor(() =>
      expect(card).toHaveTextContent('studioChat.accounts.higgsfieldReady'),
    );
  });

  it('is not shown, and nothing is asked, on a computer without Claude Code', async () => {
    studioChatAvailability.mockImplementation(async () => ({
      state: 'missing' as const,
    }));
    accounts();
    await screen.findByText('studioChat.accounts.claudeMissing');
    expect(
      screen.queryByLabelText('studioChat.accounts.higgsfield'),
    ).toBeNull();
    expect(studioChatMakers).not.toHaveBeenCalled();
  });
});
