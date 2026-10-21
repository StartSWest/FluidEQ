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
import { I18nProvider } from '../../../renderer/utils/I18nContext';
import { PlusTrialCard } from '../../../renderer/plus/PlusTrialCard';
import PlusTrialSettings from '../../../renderer/plus/PlusTrialSettings';
import {
  resetPlusTrialStore,
  usePlusTrial,
} from '../../../renderer/plus/trialStore';
import { resetAccountStore } from '../../../renderer/account/accountStore';
import { resetEntitlementStore } from '../../../renderer/account/entitlementStore';

/** The gallery's trial card, as `PlusTrialBanner` shows it from the store. */
function TrialFromStore() {
  const { offer, owner } = usePlusTrial();
  return offer ? <PlusTrialCard key={owner} offer={offer} /> : null;
}

const NOW = Date.parse('2026-09-19T12:00:00Z');
const END = NOW + 15 * 86_400_000;
const eligible: IPlusTrialOffer = {
  enabled: true,
  days: 15,
  state: 'eligible',
  termsVersion: PLUS_TERMS_VERSION,
  trialTermsVersion: 1,
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
  getSettings.mockResolvedValue({
    ok: true,
    settings: { enabled: false, days: 15 },
  });
  setOffer.mockResolvedValue({
    ok: true,
    settings: { enabled: true, days: 15, eligibleSince: NOW },
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

/**
 * Plus is not sold any more (credits replaced it): a trial the server still
 * calls open to this account is not offered, so nothing at all is drawn.
 */
it('offers no trial, even one the server still lists as open', async () => {
  const { container } = render(
    <I18nProvider>
      <TrialFromStore />
    </I18nProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(getOffer).toHaveBeenCalled();
  expect(container).toBeEmptyDOMElement();
});

it('shows expiry on a focus event even when the offer cannot be refreshed', async () => {
  getOffer.mockResolvedValue({ ok: true, offer: active });
  render(
    <I18nProvider>
      <TrialFromStore />
    </I18nProvider>,
  );
  await screen.findByText('Your free trial of Plus is active');
  jest.spyOn(Date, 'now').mockReturnValue(END);
  getOffer.mockResolvedValue({ ok: false, reason: 'offline' });
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(
    screen.getByText('Your free trial of Plus has ended.'),
  ).toBeInTheDocument();
  expect(screen.getByText(/FluidEQ still works normally/)).toBeInTheDocument();
});

it.each(['plus', 'gift'])(
  'hides cached trial messaging as soon as %s access is confirmed, even offline',
  async (plan) => {
    getOffer.mockResolvedValue({ ok: true, offer: active });
    render(
      <I18nProvider>
        <TrialFromStore />
      </I18nProvider>,
    );
    await screen.findByText('Your free trial of Plus is active');
    getOffer.mockResolvedValue({ ok: false, reason: 'offline' });
    await act(async () => {
      emitEntitlement({
        state: 'active',
        plan,
        periodEndsAt: END + 86_400_000,
      });
    });
    expect(
      screen.queryByText('Your free trial of Plus is active'),
    ).not.toBeInTheDocument();
    jest.spyOn(Date, 'now').mockReturnValue(END);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(
      screen.queryByText('Your free trial of Plus has ended.'),
    ).not.toBeInTheDocument();
  },
);

it('lets an ended trial go back to the free app, and offers no plans', async () => {
  render(
    <I18nProvider>
      <PlusTrialCard offer={{ ...active, state: 'ended' }} onKeepFree={close} />
    </I18nProvider>,
  );
  const buttons = screen.getAllByRole('button');
  expect(buttons.map((button) => button.textContent)).toEqual([
    'Keep using free',
  ]);
  await userEvent.click(buttons[0]);
  expect(close).toHaveBeenCalledTimes(1);
});

it('keeps the admin switch off until an explicit save and never grants a trial', async () => {
  render(
    <I18nProvider>
      <PlusTrialSettings />
    </I18nProvider>,
  );
  const checkbox = await screen.findByRole('checkbox', {
    name: 'Offer 15 days of Plus',
  });
  expect(checkbox).not.toBeChecked();
  const save = screen.getByRole('button', { name: 'Save offer setting' });
  expect(save).toBeDisabled();
  await userEvent.click(checkbox);
  expect(setOffer).not.toHaveBeenCalled();
  await userEvent.click(save);
  expect(setOffer).toHaveBeenCalledWith(true);
  expect(await screen.findByText('Offer setting saved.')).toBeInTheDocument();
});
