/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Switching Claude accounts, on the accounts pane (Ivan, 2026-11-28: "make
 * sure when I switch accounts it updates ... the session usage values this
 * is from the other account"; and of the plan, "ultra or max needs to update
 * properly when I switch accounts"). The usage bars and the plan's name are
 * only ever the signed-in account's: at a switch the previous account's
 * figures go at once, the new account's shapes stand while its own are
 * read, and a reading that names another account than the one shown asks
 * who is signed in again. Each case beside its control.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import type {
  IStudioChatLimits,
  IStudioChatLimitsAsk,
  IStudioChatLimitsNews,
  TStudioChatAvailability,
} from '../../../common/studioChat';
import type { IStudioProject } from '../../../main/ipc/studioProjectTypes';
import StudioChat from '../../../renderer/studio/chat/StudioChat';
import StudioChatAccounts from '../../../renderer/studio/chat/StudioChatAccounts';
import { resetStudioChatModelsForTesting } from '../../../renderer/studio/chat/studioChatModels';
import { resetStudioChatStore } from '../../../renderer/studio/chat/studioChatStore';
import { resetStudioMakersStore } from '../../../renderer/studio/chat/studioMakersStore';
import studioChatBridge from '../../utils/studioChatBridge';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));
// The whole pane, for its head: what stands beside the head is not this.
jest.mock('../../../renderer/studio/StudioStartHere', () => () => null);
jest.mock('../../../renderer/studio/chat/StudioChatThread', () => () => null);

const project: IStudioProject = {
  id: '11111111-2222-4333-8444-555555555555',
  folderName: 'ring',
  path: 'C:\\Scenes\\ring',
};

const A = 'first@example.com';
const B = 'second@example.com';
const HOUR = 3600 * 1000;

/** Who `claude auth status` says is signed in: the email and the plan's kind. */
const signedIn = (email: string, plan = 'max'): TStudioChatAvailability => ({
  state: 'ready',
  email,
  plan,
});

/** A reading of `account`, its five hours `used` and its plan as named. */
const readingOf = (
  account: string,
  used: number,
  plan: string,
): IStudioChatLimits => ({
  account,
  plan,
  fiveHour: { used, resetsAt: Date.now() + 2 * HOUR },
  week: { used: used / 2, resetsAt: Date.now() + 100 * HOUR },
  at: Date.now(),
});

let tell: (news: IStudioChatLimitsNews) => void;
let bridge: {
  studioChatAvailability: jest.Mock<Promise<TStudioChatAvailability>, []>;
  studioChatSignIn: jest.Mock<Promise<TStudioChatAvailability>, []>;
  studioChatLimits: jest.Mock<
    Promise<IStudioChatLimitsNews>,
    [IStudioChatLimitsAsk]
  >;
};

/**
 * Main as it answers: each account's own last reading, and A's only for A;
 * B has none yet, so it is being read.
 */
const kept = new Map<string, IStudioChatLimits>();

beforeEach(() => {
  resetStudioChatStore();
  resetStudioChatModelsForTesting();
  resetStudioMakersStore();
  kept.clear();
  kept.set(A, readingOf(A, 1, 'Ultra'));
  tell = () => undefined;
  bridge = {
    studioChatAvailability: jest.fn(async () => signedIn(A)),
    studioChatSignIn: jest.fn(async () => signedIn(B)),
    studioChatLimits: jest.fn(async ({ account }: IStudioChatLimitsAsk) => {
      const reading = account ? kept.get(account) : undefined;
      return reading
        ? { limits: reading, checking: false }
        : { checking: true };
    }),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        ...studioChatBridge(project.id),
        ...bridge,
        studioChatDraft: jest.fn(async () => undefined),
        studioChatDraftChange: jest.fn(async () => undefined),
        studioChatModels: jest.fn(async () => ({ checked: true, lines: [] })),
        onStudioChatLimits: (
          listener: (news: IStudioChatLimitsNews) => void,
        ) => {
          tell = listener;
          return () => undefined;
        },
      },
    },
  });
});

const showPane = async () => {
  render(
    <StudioChatAccounts closeRef={createRef()} onClose={() => undefined} />,
  );
  await screen.findByText(A);
};

/** Lets every ask to main that is out answer. */
const settle = () => act(async () => undefined);

const meter = (name: string) =>
  screen.queryByRole('meter', { name: `studioChat.limits.${name}` });

const shapes = () => document.querySelector('.studio-chat-limits.is-shaped');

/** What the Claude card says it is doing (Higgsfield's card says its own). */
const claudeStatus = () =>
  within(
    screen.getByRole('region', { name: 'studioChat.accounts.claude' }),
  ).queryByRole('status');

it("never shows the previous account's usage or plan after a switch in FluidEQ", async () => {
  await showPane();
  // A, with A's own figures and Claude Code's own name for A's plan.
  expect(
    await screen.findByRole('meter', { name: 'studioChat.limits.fiveHour' }),
  ).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByText('studioChat.wherePlan Ultra')).toBeInTheDocument();

  // "Use another account": Claude Code is signed in to B now.
  fireEvent.click(
    screen.getByRole('button', { name: 'studioChat.accounts.switch' }),
  );
  await screen.findByText(B);
  await settle();

  // Nothing of A's beside B: no bars, and B's plan by its own kind.
  expect(meter('fiveHour')).toBeNull();
  expect(meter('week')).toBeNull();
  expect(screen.queryByText('studioChat.wherePlan Ultra')).toBeNull();
  expect(screen.getByText('studioChat.wherePlan Max')).toBeInTheDocument();
  // B's usage was asked for, for B, and is being read: its shapes stand,
  // and the card says it is checking.
  expect(bridge.studioChatLimits).toHaveBeenLastCalledWith({ account: B });
  expect(shapes()).toBeInTheDocument();
  expect(claudeStatus()).toHaveTextContent('studioChat.accounts.checking');

  // B's own reading arrives: its figures, and its plan as Claude Code names it.
  act(() => tell({ limits: readingOf(B, 0.2, 'Max 20x'), checking: false }));
  expect(meter('fiveHour')).toHaveAttribute('aria-valuenow', '20');
  expect(screen.getByText('studioChat.wherePlan Max 20x')).toBeInTheDocument();
  expect(shapes()).toBeNull();
  expect(claudeStatus()).toBeNull();
});

it("names the new account's plan in the panel's head as on the card, never the old one's", async () => {
  // Ivan, 2026-11-28: "same for the plan ultra or max needs to update
  // properly when I switch accounts", in the head and on the card alike.
  render(<StudioChat project={project} />);
  fireEvent.click(await screen.findByTitle('studioChat.accounts.open'));
  await screen.findByText(A);
  await settle();
  // A's own reading names A's plan, in both places.
  expect(screen.getAllByText('studioChat.wherePlan Ultra')).toHaveLength(2);

  fireEvent.click(
    screen.getByRole('button', { name: 'studioChat.accounts.switch' }),
  );
  await screen.findByText(B);
  await settle();
  // Nowhere is B called Ultra: B's own kind stands in both places until
  // B's reading comes.
  expect(screen.queryAllByText('studioChat.wherePlan Ultra')).toHaveLength(0);
  expect(screen.getAllByText('studioChat.wherePlan Max')).toHaveLength(2);

  act(() => tell({ limits: readingOf(B, 0.2, 'Max 20x'), checking: false }));
  expect(screen.getAllByText('studioChat.wherePlan Max 20x')).toHaveLength(2);
  expect(screen.queryAllByText('studioChat.wherePlan Max')).toHaveLength(0);
});

it("keeps a late reading of the previous account off the new one's card", async () => {
  await showPane();
  await screen.findByRole('meter', { name: 'studioChat.limits.fiveHour' });
  fireEvent.click(
    screen.getByRole('button', { name: 'studioChat.accounts.switch' }),
  );
  await screen.findByText(B);
  await settle();
  act(() => tell({ limits: readingOf(B, 0.2, 'Max 20x'), checking: false }));
  bridge.studioChatAvailability.mockResolvedValue(signedIn(B));

  // A run that started before the switch answers late, with A's figures.
  act(() => tell({ limits: readingOf(A, 0.9, 'Ultra'), checking: false }));
  await settle();
  expect(meter('fiveHour')).toHaveAttribute('aria-valuenow', '20');
  expect(screen.getByText('studioChat.wherePlan Max 20x')).toBeInTheDocument();
  // It names someone other than B, so who is signed in is asked again.
  expect(bridge.studioChatAvailability).toHaveBeenCalledTimes(2);
});

it('follows a switch made outside FluidEQ to the new account and its figures', async () => {
  await showPane();
  await screen.findByRole('meter', { name: 'studioChat.limits.fiveHour' });
  const asked = bridge.studioChatAvailability.mock.calls.length;
  // Claude Code was signed in to B in a terminal: the next reading is B's.
  bridge.studioChatAvailability.mockResolvedValue(signedIn(B));
  act(() => tell({ limits: readingOf(B, 0.4, 'Max 20x'), checking: false }));

  // Who is signed in is asked again, and the card goes over to B.
  expect(await screen.findByText(B)).toBeInTheDocument();
  await settle();
  expect(bridge.studioChatAvailability).toHaveBeenCalledTimes(asked + 1);
  expect(screen.queryByText(A)).toBeNull();
  expect(meter('fiveHour')).toHaveAttribute('aria-valuenow', '40');
  expect(screen.getByText('studioChat.wherePlan Max 20x')).toBeInTheDocument();
});

it('asks nobody again for a reading of the account shown', async () => {
  await showPane();
  await screen.findByRole('meter', { name: 'studioChat.limits.fiveHour' });
  act(() => tell({ limits: readingOf(A, 0.5, 'Ultra'), checking: false }));
  await settle();
  // The control for the two above: A's own reading moves A's bars and
  // asks Claude Code nothing about who is signed in.
  expect(meter('fiveHour')).toHaveAttribute('aria-valuenow', '50');
  expect(bridge.studioChatAvailability).toHaveBeenCalledTimes(1);
});

it('says there is nothing once a reading of a new account brought nothing', async () => {
  kept.clear();
  await showPane();
  await settle();
  expect(shapes()).toBeInTheDocument();
  expect(screen.queryByText('studioChat.limits.none')).toBeNull();
  act(() => tell({ checking: false }));
  expect(shapes()).toBeNull();
  expect(screen.getByText('studioChat.limits.none')).toBeInTheDocument();
});
