import '@testing-library/jest-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IAccountState } from '../../../main/account/session';
import type { IEntitlementStatus } from '../../../main/account/entitlement';
import type {
  IPlusTrialOffer,
  TPlusTrialOutcome,
} from '../../../common/plusTrial';
import { PLUS_TERMS_VERSION } from '../../../common/plusTerms';
import { PLUS_TRIAL_TERMS_VERSION } from '../../../common/plusTrial';
import { I18nProvider } from '../../../renderer/utils/I18nContext';
import PlusTrialAgreement from '../../../renderer/account/PlusTrialAgreement';
import PlusTrialOffer, {
  PlusTrialCard,
} from '../../../renderer/plus/PlusTrialCard';
import PlusTrialSettings from '../../../renderer/plus/PlusTrialSettings';
import {
  activatePlusTrial,
  getPlusTrialSnapshot,
  resetPlusTrialStore,
} from '../../../renderer/plus/trialStore';
import { resetAccountStore } from '../../../renderer/account/accountStore';
import { resetEntitlementStore } from '../../../renderer/account/entitlementStore';
import { subscribeAccountPanelRequests } from '../../../renderer/account/accountPanel';

jest.mock('../../../common/accountConfig', () => ({
  ...jest.requireActual('../../../common/accountConfig'),
  isCheckoutConfigured: () => true,
}));

const NOW = Date.parse('2026-09-19T12:00:00Z');
const END = NOW + 30 * 86_400_000;
const eligible: IPlusTrialOffer = {
  enabled: true,
  days: 30,
  state: 'eligible',
  termsVersion: PLUS_TERMS_VERSION,
  trialTermsVersion: PLUS_TRIAL_TERMS_VERSION,
};
const active: IPlusTrialOffer = {
  ...eligible,
  state: 'active',
  startedAt: NOW,
  endsAt: END,
};
let account: IAccountState;
let emitAccount: (value: IAccountState) => void;
let emitEntitlement: (value: IEntitlementStatus) => void;
const getOffer = jest.fn<Promise<TPlusTrialOutcome>, []>();
const start = jest.fn<Promise<TPlusTrialOutcome>, [unknown]>();
const checkout = jest.fn();
const setOffer = jest.fn();
const getSettings = jest.fn();
const close = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  resetPlusTrialStore();
  resetAccountStore();
  resetEntitlementStore();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  localStorage.setItem('fluideq.locale', 'en');
  account = { status: 'signed-in', identity: { id: 'account-a' } };
  emitAccount = () => {};
  emitEntitlement = () => {};
  getOffer.mockResolvedValue({ ok: true, offer: eligible });
  start.mockResolvedValue({ ok: true, offer: active });
  getSettings.mockResolvedValue({
    ok: true,
    settings: { enabled: false, days: 30 },
  });
  setOffer.mockResolvedValue({
    ok: true,
    settings: { enabled: true, days: 30, eligibleSince: NOW },
  });
  window.electron = {
    ipcRenderer: {
      getAccountState: async () => account,
      onAccountState: (listener: typeof emitAccount) => {
        emitAccount = listener;
        return () => {};
      },
      getEntitlementStatus: async () => ({ state: 'none' }),
      onEntitlementChanged: (listener: typeof emitEntitlement) => {
        emitEntitlement = listener;
        return () => {};
      },
      getPlusTrialOffer: getOffer,
      startPlusTrial: start,
      openCheckout: checkout,
      getPlusTrialSettings: getSettings,
      setPlusTrialOffer: setOffer,
      setAppLocale: async () => {},
    },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  cleanup();
  resetPlusTrialStore();
  resetAccountStore();
  resetEntitlementStore();
  jest.restoreAllMocks();
});

const agreement = async () => {
  render(
    <I18nProvider>
      <PlusTrialAgreement onClose={close} />
    </I18nProvider>,
  );
  return screen.findByRole('button', { name: 'Start my free 30 days' });
};

it('requires an unchecked agreement, sends both versions, and never opens billing', async () => {
  const button = await agreement();
  expect(button).toBeDisabled();
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(start).not.toHaveBeenCalled();
  expect(
    screen.getByText(/FluidEQ keeps working normally/),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(button);
  expect(start).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledWith({
    accepted: true,
    termsVersion: PLUS_TERMS_VERSION,
    trialTermsVersion: PLUS_TRIAL_TERMS_VERSION,
  });
  expect(
    await screen.findByText('Your free month of Plus is active'),
  ).toBeInTheDocument();
  expect(screen.getByText(/Plus is free until/)).toHaveTextContent(
    'October 19, 2026',
  );
  expect(checkout).not.toHaveBeenCalled();
});

it('keeps the free app available without accepting anything', async () => {
  await agreement();
  await userEvent.click(
    screen.getByRole('button', { name: 'Keep using free' }),
  );
  expect(close).toHaveBeenCalledTimes(1);
  expect(start).not.toHaveBeenCalled();
  expect(checkout).not.toHaveBeenCalled();
});

it.each(['terms-outdated', 'ineligible', 'unavailable'] as const)(
  'removes activation after the server refuses with %s',
  async (reason) => {
    start.mockResolvedValue({ ok: false, reason });
    const button = await agreement();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start my free 30 days' }),
    ).not.toBeInTheDocument();
    expect(checkout).not.toHaveBeenCalled();
  },
);

it('does not start against an agreement version that this build cannot show', async () => {
  getOffer.mockResolvedValue({
    ok: true,
    offer: { ...eligible, trialTermsVersion: PLUS_TRIAL_TERMS_VERSION + 1 },
  });
  render(
    <I18nProvider>
      <PlusTrialAgreement onClose={close} />
    </I18nProvider>,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Update FluidEQ');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(start).not.toHaveBeenCalled();
});

it('coalesces repeated starts while activation is pending', async () => {
  let finish: (value: TPlusTrialOutcome) => void = () => {};
  start.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await agreement();
  let first: Promise<boolean> = Promise.resolve(false);
  await act(async () => {
    first = activatePlusTrial(true);
    expect(await activatePlusTrial(true)).toBe(false);
  });
  expect(start).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole('button', { name: 'Starting your free month…' }),
  ).toBeDisabled();
  await act(async () => {
    finish({ ok: true, offer: active });
    await first;
  });
  expect(
    screen.getByText('Your free month of Plus is active'),
  ).toBeInTheDocument();
});

it('drops an activation reply after changing accounts', async () => {
  let finish: (value: TPlusTrialOutcome) => void = () => {};
  start.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await agreement();
  let first: Promise<boolean> = Promise.resolve(false);
  await act(async () => {
    first = activatePlusTrial(true);
  });
  await act(async () => {
    account = { status: 'signed-in', identity: { id: 'account-b' } };
    emitAccount(account);
  });
  await act(async () => {
    finish({ ok: true, offer: active });
    expect(await first).toBe(false);
  });
  expect(getPlusTrialSnapshot()).toMatchObject({
    owner: 'account-b',
    offer: { state: 'eligible' },
  });
  expect(
    screen.queryByText('Your free month of Plus is active'),
  ).not.toBeInTheDocument();
});

it('shows expiry on a focus event even when the offer cannot be refreshed', async () => {
  getOffer.mockResolvedValue({ ok: true, offer: active });
  render(
    <I18nProvider>
      <PlusTrialOffer />
    </I18nProvider>,
  );
  await screen.findByText('Your free month of Plus is active');
  jest.spyOn(Date, 'now').mockReturnValue(END);
  getOffer.mockResolvedValue({ ok: false, reason: 'offline' });
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(
    screen.getByText('Your free month of Plus has ended.'),
  ).toBeInTheDocument();
  expect(screen.getByText(/FluidEQ still works normally/)).toBeInTheDocument();
  expect(checkout).not.toHaveBeenCalled();
});

it.each(['plus', 'gift'])(
  'hides cached trial messaging as soon as %s access is confirmed, even offline',
  async (plan) => {
    getOffer.mockResolvedValue({ ok: true, offer: active });
    render(
      <I18nProvider>
        <PlusTrialOffer />
      </I18nProvider>,
    );
    await screen.findByText('Your free month of Plus is active');
    getOffer.mockResolvedValue({ ok: false, reason: 'offline' });
    await act(async () => {
      emitEntitlement({
        state: 'active',
        plan,
        periodEndsAt: END + 86_400_000,
      });
    });
    expect(
      screen.queryByText('Your free month of Plus is active'),
    ).not.toBeInTheDocument();
    jest.spyOn(Date, 'now').mockReturnValue(END);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(
      screen.queryByText('Your free month of Plus has ended.'),
    ).not.toBeInTheDocument();
  },
);

it('offers free continuation first and opens a separate subscription agreement only by choice', async () => {
  const request = jest.fn();
  const stop = subscribeAccountPanelRequests(request);
  render(
    <I18nProvider>
      <PlusTrialCard offer={{ ...active, state: 'ended' }} onKeepFree={close} />
    </I18nProvider>,
  );
  const buttons = screen.getAllByRole('button');
  expect(buttons.map((button) => button.textContent)).toEqual([
    'Keep using free',
    'See Plus plans',
  ]);
  await userEvent.click(buttons[1]);
  expect(request).toHaveBeenCalledWith('subscribe');
  expect(checkout).not.toHaveBeenCalled();
  await userEvent.click(buttons[0]);
  expect(close).toHaveBeenCalledTimes(1);
  stop();
});

it('keeps the admin switch off until an explicit save and never grants a trial', async () => {
  render(
    <I18nProvider>
      <PlusTrialSettings />
    </I18nProvider>,
  );
  const checkbox = await screen.findByRole('checkbox', {
    name: 'Offer 30 days of Plus',
  });
  expect(checkbox).not.toBeChecked();
  const save = screen.getByRole('button', { name: 'Save offer setting' });
  expect(save).toBeDisabled();
  await userEvent.click(checkbox);
  expect(setOffer).not.toHaveBeenCalled();
  await userEvent.click(save);
  expect(setOffer).toHaveBeenCalledWith(true);
  expect(await screen.findByText('Offer setting saved.')).toBeInTheDocument();
  expect(start).not.toHaveBeenCalled();
});
