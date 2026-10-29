/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Getting paid for scenes, in the account panel: an invitation until the
 * creator signs up on Stripe's pages, then where that stands, then what is
 * ready, on hold and paid. Every number is the server's; a server that
 * cannot say leaves the card out rather than drawing zeroes.
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ICreatorStatus,
  TCreatorOutcome,
} from '../../../common/creatorPayouts';
import CreatorPayoutsCard from '../../../renderer/account/CreatorPayoutsCard';
import { resetCreatorStore } from '../../../renderer/account/creatorStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const TERMS = {
  sharePercent: 50,
  holdDays: 30,
  minimumCents: 1000,
  agreementVersion: 1,
  payoutDays: 15,
  // The card's own rules, once FluidEQ can pay creators (premium 0070).
  payoutsOpen: true,
};
const base: ICreatorStatus = {
  terms: TERMS,
  heldCents: 0,
  readyCents: 0,
  paidCents: 0,
  sales: 0,
};
const ACCOUNT = {
  country: 'DE',
  detailsSubmitted: true,
  payoutsEnabled: true,
  agreedVersion: 1,
};

const mockStatus = jest.fn<Promise<TCreatorOutcome>, []>();
const mockSignUp = jest.fn();
const mockDashboard = jest.fn();

beforeEach(() => {
  resetCreatorStore();
  mockStatus.mockReset();
  mockSignUp.mockReset().mockResolvedValue({ ok: true });
  mockDashboard.mockReset();
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        getCreatorStatus: () => mockStatus(),
        startCreatorSignUp: (...args: unknown[]) => mockSignUp(...args),
        openCreatorDashboard: () => mockDashboard(),
        onCreatorChanged: () => () => undefined,
      },
    },
  });
});

const showing = (status: ICreatorStatus) => {
  mockStatus.mockResolvedValue({ ok: true, status });
  render(<CreatorPayoutsCard accountId="me" />);
};

it('leaves the card out while the server cannot say', async () => {
  mockStatus.mockResolvedValue({ ok: false, reason: 'unavailable' });
  const { container } = render(<CreatorPayoutsCard accountId="me" />);
  await waitFor(() => expect(mockStatus).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it('leaves the card out while the server has payouts closed', async () => {
  mockStatus.mockResolvedValue({
    ok: true,
    status: { ...base, terms: { ...TERMS, payoutsOpen: false } },
  });
  const { container, unmount } = render(<CreatorPayoutsCard accountId="me" />);
  await waitFor(() => expect(mockStatus).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
  // The positive control: the same answer with payouts open is a card.
  unmount();
  showing(base);
  expect(
    await screen.findByRole('button', { name: 'creator.setUp' }),
  ).toBeInTheDocument();
});

it('invites, and signs up in the country chosen with the terms agreed', async () => {
  showing(base);
  await userEvent.click(
    await screen.findByRole('button', { name: 'creator.setUp' }),
  );
  // The reader's own country, when Stripe pays there: jsdom speaks en-US.
  expect(screen.getByText('creator.terms.share:50')).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'creator.dialog.go' }),
  );
  expect(mockSignUp).toHaveBeenCalledWith('US', 'en');
  expect(await screen.findByText('creator.opened')).toBeInTheDocument();
});

it('picks an unfinished sign-up up again without asking the country', async () => {
  showing({ ...base, account: { ...ACCOUNT, detailsSubmitted: false } });
  await userEvent.click(
    await screen.findByRole('button', { name: 'creator.finish' }),
  );
  expect(screen.queryByText('creator.dialog.country')).toBeNull();
  await userEvent.click(
    screen.getByRole('button', { name: 'creator.dialog.go' }),
  );
  expect(mockSignUp).toHaveBeenCalledWith(undefined, 'en');
});

it('asks for newer terms before anything else', async () => {
  showing({
    ...base,
    terms: { ...TERMS, agreementVersion: 2 },
    account: ACCOUNT,
  });
  expect(
    await screen.findByRole('button', { name: 'creator.readTerms' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('creator.ready')).toBeNull();
});

it('shows what is ready, on hold and paid once Stripe can pay', async () => {
  showing({
    ...base,
    account: ACCOUNT,
    readyCents: 1245,
    heldCents: 1873,
    paidCents: 4210,
    sales: 37,
  });
  expect(await screen.findByText('$12.45')).toBeInTheDocument();
  expect(screen.getByText('$18.73')).toBeInTheDocument();
  expect(screen.getByText('$42.10')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'creator.setUp' })).toBeNull();
});

it('says why the dashboard did not open', async () => {
  mockDashboard.mockResolvedValue({ ok: false, reason: 'offline' });
  showing({ ...base, account: ACCOUNT });
  await userEvent.click(
    await screen.findByRole('button', { name: 'creator.dashboard' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'creator.error.offline',
  );
});
