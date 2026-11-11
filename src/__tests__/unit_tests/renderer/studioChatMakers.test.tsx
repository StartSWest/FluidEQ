/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Higgsfield beside GPT in the Studio's chat, as the member sees it (Ivan,
 * 2026-11-11: "quiero que Fluid esté preparado para usar Higgsfield. Y que
 * pida si quiere usar GPT o Higgsfield"): the two cards in Accounts, the
 * press that sets Higgsfield up, the choice of which is used, and the card
 * that asks when both are connected.
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
import type { TStudioChatAsk } from '../../../common/studioChat';
import type { IStudioMakers } from '../../../common/studioMakers';
import StudioChatAccounts from '../../../renderer/studio/chat/StudioChatAccounts';
import StudioChatAsk from '../../../renderer/studio/chat/StudioChatAsk';
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

const makers = (
  gpt: boolean,
  higgsfield: IStudioMakers['higgsfield']['state'],
  choice: IStudioMakers['choice'] = 'ask',
): IStudioMakers => ({
  gpt: gpt ? { found: true, name: 'gpt-studio@a-market' } : { found: false },
  higgsfield: { state: higgsfield },
  choice,
});

let now: IStudioMakers;
const studioChatMakers = jest.fn(async () => now);
const studioChatMakersChoice = jest.fn(
  async (choice: IStudioMakers['choice']) => choice,
);
const studioChatMakerAnswer = jest.fn(async () => undefined);
const studioChatAnswer = jest.fn(async () => undefined);
const studioChatHiggsfieldConnect = jest.fn(
  async (): Promise<IStudioMakers | undefined> => now,
);
const studioChatLimits = jest.fn(async () => undefined);
let studioChatAvailability: jest.Mock;

beforeEach(() => {
  resetStudioChatStore();
  resetStudioMakersStore();
  jest.clearAllMocks();
  now = makers(false, 'missing');
  studioChatAvailability = jest.fn(async () => ({ state: 'ready' as const }));
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        ...studioChatBridge(),
        studioChatAvailability,
        studioChatLimits,
        studioChatMakers,
        studioChatMakersChoice,
        studioChatMakerAnswer,
        studioChatAnswer,
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
const gpt = () => screen.findByLabelText('studioChat.accounts.gpt');
/** A press, and everything main's answer to it changes on the page. */
const pressAndSettle = (button: HTMLElement) =>
  act(async () => {
    fireEvent.click(button);
  });
const buttonsOf = (card: HTMLElement) =>
  within(card)
    .queryAllByRole('button')
    .map((button) => button.textContent);

describe('the makers in Accounts', () => {
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
      makers(false, 'ready'),
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
    let finish: (value: IStudioMakers) => void = () => undefined;
    studioChatHiggsfieldConnect.mockImplementationOnce(
      () =>
        new Promise<IStudioMakers>((resolve) => {
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
      finish(makers(false, 'signed-out'));
    });
    expect(card).toHaveTextContent('studioChat.accounts.higgsfieldOut');
    expect(buttonsOf(card)).toEqual(['studioChat.accounts.higgsfieldSignIn']);
  });

  it('offers only the sign-in where Higgsfield is there and signed out', async () => {
    now = makers(false, 'signed-out');
    accounts();
    const card = await higgsfield();
    expect(buttonsOf(card)).toEqual(['studioChat.accounts.higgsfieldSignIn']);
    await pressAndSettle(within(card).getByRole('button'));
    expect(studioChatHiggsfieldConnect).toHaveBeenCalledWith(false);
  });

  it('signs out first for another account', async () => {
    now = makers(false, 'ready');
    accounts();
    const card = await higgsfield();
    await pressAndSettle(
      within(card).getByRole('button', { name: 'studioChat.accounts.switch' }),
    );
    expect(studioChatHiggsfieldConnect).toHaveBeenCalledWith(true);
  });

  it('asks again, and runs nothing, where Higgsfield could not be reached', async () => {
    now = makers(false, 'unreachable');
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

  it('shows the GPT plugin by its own name, or says there is none', async () => {
    now = makers(true, 'missing');
    const { unmount } = accounts();
    expect(await gpt()).toHaveTextContent(
      'studioChat.accounts.gptFound {"name":"gpt-studio"}',
    );
    unmount();
    resetStudioChatStore();
    resetStudioMakersStore();
    now = makers(false, 'missing');
    accounts();
    const none = await gpt();
    expect(none).toHaveTextContent('studioChat.accounts.gptMissing');
    expect(buttonsOf(none)).toEqual([]);
  });

  it('asks again when the window comes back, for a sign-in finished in the browser', async () => {
    now = makers(false, 'signed-out');
    accounts();
    const card = await higgsfield();
    now = makers(false, 'ready');
    fireEvent.focus(window);
    await waitFor(() =>
      expect(card).toHaveTextContent('studioChat.accounts.higgsfieldReady'),
    );
  });

  it('lets the member choose between them only while both are connected', async () => {
    now = makers(true, 'signed-out');
    const { unmount } = accounts();
    await higgsfield();
    expect(screen.queryByLabelText('studioChat.accounts.makeWith')).toBeNull();
    unmount();
    resetStudioChatStore();
    resetStudioMakersStore();

    now = makers(true, 'ready');
    accounts();
    const choice = await screen.findByLabelText('studioChat.accounts.makeWith');
    const pressedOf = () =>
      within(choice)
        .getAllByRole('button')
        .map((button) => [
          button.textContent,
          button.getAttribute('aria-pressed'),
        ]);
    expect(pressedOf()).toEqual([
      ['studioChat.accounts.makeWithAsk', 'true'],
      ['studioChat.accounts.gpt', 'false'],
      ['studioChat.accounts.higgsfield', 'false'],
    ]);
    fireEvent.click(
      within(choice).getByRole('button', {
        name: 'studioChat.accounts.higgsfield',
      }),
    );
    expect(studioChatMakersChoice).toHaveBeenCalledWith('higgsfield');
    await waitFor(() =>
      expect(pressedOf()).toEqual([
        ['studioChat.accounts.makeWithAsk', 'false'],
        ['studioChat.accounts.gpt', 'false'],
        ['studioChat.accounts.higgsfield', 'true'],
      ]),
    );
  });

  it('shows neither, and asks nothing, on a computer without Claude Code', async () => {
    studioChatAvailability.mockImplementation(async () => ({
      state: 'missing' as const,
    }));
    accounts();
    await screen.findByText('studioChat.accounts.claudeMissing');
    expect(
      screen.queryByLabelText('studioChat.accounts.higgsfield'),
    ).toBeNull();
    expect(screen.queryByLabelText('studioChat.accounts.gpt')).toBeNull();
    expect(studioChatMakers).not.toHaveBeenCalled();
  });
});

describe('the card that asks which maker', () => {
  const card = (what: 'picture' | 'frames' = 'picture'): TStudioChatAsk => ({
    id: 'm-1',
    projectId: 'lake',
    kind: 'maker',
    what,
    why: 'A heron for the shore.',
  });

  it('names what is made, says why, and offers both makers, each with what it runs on', () => {
    render(<StudioChatAsk ask={card()} />);
    expect(
      screen.getByRole('region', { name: 'studioChat.ask.makerPicture' }),
    ).toHaveTextContent('A heron for the shore.');
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'studioChat.accounts.gpt',
      'studioChat.accounts.higgsfield',
      'studioChat.ask.notNow',
    ]);
    expect(buttons[0]).toHaveAccessibleDescription('studioChat.ask.makerGpt');
    expect(buttons[1]).toHaveAccessibleDescription(
      'studioChat.ask.makerHiggsfield',
    );
    // Neither maker is the suggested one: both loud, the decline quiet.
    expect(buttons[0]).not.toHaveClass('subtle');
    expect(buttons[1]).not.toHaveClass('subtle');
    expect(buttons[2]).toHaveClass('subtle');
  });

  it('titles a set of frames as frames', () => {
    render(<StudioChatAsk ask={card('frames')} />);
    expect(
      screen.getByRole('region', { name: 'studioChat.ask.makerFrames' }),
    ).toBeInTheDocument();
  });

  it('answers the maker pressed, for this once', () => {
    render(<StudioChatAsk ask={card()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'studioChat.accounts.gpt' }),
    );
    expect(studioChatMakerAnswer).toHaveBeenCalledWith('m-1', 'gpt', false);
    expect(studioChatAnswer).not.toHaveBeenCalled();
  });

  it('keeps the maker pressed when "remember" is ticked', async () => {
    now = makers(true, 'ready');
    accounts();
    await higgsfield();
    render(<StudioChatAsk ask={card()} />);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'studioChat.ask.makerRemember' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('region', { name: 'studioChat.ask.makerPicture' }),
      ).getByRole('button', { name: 'studioChat.accounts.higgsfield' }),
    );
    expect(studioChatMakerAnswer).toHaveBeenCalledWith(
      'm-1',
      'higgsfield',
      true,
    );
    // Accounts shows the choice at once, before main answers.
    expect(
      within(screen.getByLabelText('studioChat.accounts.makeWith')).getByRole(
        'button',
        { name: 'studioChat.accounts.higgsfield' },
      ),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('answers no for "Not now", and names no maker', () => {
    render(<StudioChatAsk ask={card()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'studioChat.ask.notNow' }),
    );
    expect(studioChatAnswer).toHaveBeenCalledWith('m-1', 'no');
    expect(studioChatMakerAnswer).not.toHaveBeenCalled();
  });
});
