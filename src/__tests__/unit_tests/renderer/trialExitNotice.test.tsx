/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountState } from '../../../main/account/session';
import TrialExitNotice from '../../../renderer/components/TrialExitNotice';

/**
 * The one question asked once a member's free trial has ended without Plus:
 * only of that member, once, and the answer goes to the server whole.
 */

const ME = 'c0ffee00-1111-4222-8333-444455556666';

let account: IAccountState = { status: 'signed-in', identity: { id: ME } };
let trial: { offer?: { state: string }; owner: string } = {
  offer: { state: 'ended' },
  owner: ME,
};

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => account,
  getAccountSnapshot: () => account,
  subscribeAccount: () => () => undefined,
}));
jest.mock('../../../renderer/plus/trialStore', () => ({
  usePlusTrial: () => trial,
}));

const bridge = {
  getTrialExit: jest.fn(),
  reportTrialExit: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  account = { status: 'signed-in', identity: { id: ME } };
  trial = { offer: { state: 'ended' }, owner: ME };
  bridge.getTrialExit.mockResolvedValue({ ok: true, status: { asked: true } });
  bridge.reportTrialExit.mockResolvedValue({ ok: true });
  Object.assign(window, { electron: { ipcRenderer: bridge } });
});

const card = () => screen.findByText('trialExit.notice.title');

it('asks a member whose trial ended and who has not said', async () => {
  render(<TrialExitNotice />);
  expect(await card()).toBeInTheDocument();
  expect(bridge.getTrialExit).toHaveBeenCalledTimes(1);
});

it('asks nobody whose trial is running, or who already answered, or nobody signed in', async () => {
  trial = { offer: { state: 'active' }, owner: ME };
  const { unmount } = render(<TrialExitNotice />);
  expect(bridge.getTrialExit).not.toHaveBeenCalled();
  unmount();

  trial = { offer: { state: 'ended' }, owner: ME };
  bridge.getTrialExit.mockResolvedValue({
    ok: true,
    status: { asked: true, reason: 'price' },
  });
  const second = render(<TrialExitNotice />);
  await waitFor(() => expect(bridge.getTrialExit).toHaveBeenCalled());
  expect(screen.queryByText('trialExit.notice.title')).not.toBeInTheDocument();
  second.unmount();

  // The server's own word: a member who paid after the trial is not asked.
  bridge.getTrialExit.mockResolvedValue({ ok: true, status: { asked: false } });
  const third = render(<TrialExitNotice />);
  await waitFor(() => expect(bridge.getTrialExit).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('trialExit.notice.title')).not.toBeInTheDocument();
  third.unmount();

  account = { status: 'signed-out' };
  render(<TrialExitNotice />);
  expect(screen.queryByText('trialExit.notice.title')).not.toBeInTheDocument();
});

it('never asks again on this computer once put off', async () => {
  const { unmount } = render(<TrialExitNotice />);
  await card();
  await userEvent.click(
    screen.getByRole('button', { name: 'trialExit.later' }),
  );
  expect(screen.queryByText('trialExit.notice.title')).not.toBeInTheDocument();
  unmount();

  render(<TrialExitNotice />);
  // Not even asked of the server: this computer already has its answer.
  expect(bridge.getTrialExit).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('trialExit.notice.title')).not.toBeInTheDocument();
});

it('sends the reason picked and the note, then says thank you', async () => {
  render(<TrialExitNotice />);
  await card();
  await userEvent.click(
    screen.getByRole('button', { name: 'trialExit.notice.open' }),
  );
  const send = screen.getByRole('button', { name: 'trialExit.send' });
  // Nothing to send until a reason is picked.
  expect(send).toBeDisabled();
  await userEvent.click(screen.getByLabelText('trialExit.reason.price'));
  await userEvent.type(
    screen.getByLabelText('trialExit.note'),
    '  A yearly price would help.  ',
  );
  await userEvent.click(send);
  expect(bridge.reportTrialExit).toHaveBeenCalledWith(
    'price',
    'A yearly price would help.',
  );
  const thanks = await screen.findByText('trialExit.thanks.title');
  // Not a modal: the corner gives way to modals, and a thank-you counted as
  // one hid itself and came back for ever, freezing the window.
  expect(thanks.closest('.trial-exit-notice')).toHaveAttribute(
    'aria-modal',
    'false',
  );
  expect(localStorage.getItem(`fluideq.trialExit.${ME}`)).toBe('sent');
});

it('keeps the question open and says so when the answer did not go through', async () => {
  bridge.reportTrialExit.mockResolvedValue({ ok: false, reason: 'offline' });
  render(<TrialExitNotice />);
  await card();
  await userEvent.click(
    screen.getByRole('button', { name: 'trialExit.notice.open' }),
  );
  await userEvent.click(screen.getByLabelText('trialExit.reason.no-time'));
  await userEvent.click(screen.getByRole('button', { name: 'trialExit.send' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'trialExit.failed',
  );
  expect(screen.getByRole('button', { name: 'trialExit.send' })).toBeEnabled();
  expect(localStorage.getItem(`fluideq.trialExit.${ME}`)).toBeNull();
});
