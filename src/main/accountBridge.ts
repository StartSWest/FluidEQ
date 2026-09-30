/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ipcRenderer, IpcRendererEvent } from 'electron';
import type { IAccountState } from './account/session';
import type { IEntitlementStatus } from './account/entitlement';
import type { TBillingOutcome } from './ipc/account';

/**
 * The FluidEQ account and what it is entitled to: signing up and in, codes
 * and passwords, and Plus's checkout and portal.
 */

const getAccountState = () =>
  ipcRenderer.invoke('account-state') as Promise<IAccountState>;

/**
 * What was typed crosses once, in one direction. The password is not kept on
 * either side; the main process turns it into a session and forgets it.
 */
const signUpAccount = (details: {
  email: string;
  password: string;
  name?: string;
}) => ipcRenderer.invoke('account-sign-up', details) as Promise<IAccountState>;

const signInAccount = (credentials: { email: string; password: string }) =>
  ipcRenderer.invoke('account-sign-in', credentials) as Promise<IAccountState>;

const confirmAccountCode = (code: string) =>
  ipcRenderer.invoke('account-confirm-code', code) as Promise<IAccountState>;

const resendAccountCode = () =>
  ipcRenderer.invoke('account-resend-code') as Promise<IAccountState>;

const forgotAccountPassword = (email: string) =>
  ipcRenderer.invoke(
    'account-forgot-password',
    email,
  ) as Promise<IAccountState>;

const resetAccountPassword = (details: { code: string; password: string }) =>
  ipcRenderer.invoke(
    'account-reset-password',
    details,
  ) as Promise<IAccountState>;

const abandonAccountPending = () =>
  ipcRenderer.invoke('account-abandon-pending') as Promise<IAccountState>;

const signOutAccount = () =>
  ipcRenderer.invoke('account-sign-out') as Promise<void>;

const onAccountState = (listener: (state: IAccountState) => void) => {
  const wrapped = (_event: IpcRendererEvent, state: IAccountState) =>
    listener(state);
  ipcRenderer.on('account-state-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('account-state-changed', wrapped);
  };
};

const getEntitlementStatus = () =>
  ipcRenderer.invoke('entitlement-status') as Promise<IEntitlementStatus>;

const refreshEntitlement = () =>
  ipcRenderer.invoke('entitlement-refresh') as Promise<IEntitlementStatus>;

/**
 * The server mints the page for this account; the renderer never sees the
 * URL. It names the Plus terms version the person just agreed to.
 */
const openCheckout = (termsVersion: number) =>
  ipcRenderer.invoke(
    'entitlement-open-checkout',
    termsVersion,
  ) as Promise<TBillingOutcome>;

const openSubscriptionPortal = () =>
  ipcRenderer.invoke('entitlement-open-portal') as Promise<TBillingOutcome>;

/** Development only: whether the pretend-membership buttons may be shown. */
const isMembershipSimulatorAvailable = () =>
  ipcRenderer.invoke('dev-membership-available') as Promise<boolean>;

/** Development only: send the merchant's own event to the real server. */
const simulateMembership = (simulation: 'started' | 'cancelled') =>
  ipcRenderer.invoke(
    'dev-membership-simulate',
    simulation,
  ) as Promise<TBillingOutcome>;

const onEntitlementChanged = (
  listener: (status: IEntitlementStatus) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, status: IEntitlementStatus) =>
    listener(status);
  ipcRenderer.on('entitlement-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('entitlement-changed', wrapped);
  };
};

const accountBridge = {
  getAccountState,
  signUpAccount,
  signInAccount,
  confirmAccountCode,
  resendAccountCode,
  forgotAccountPassword,
  resetAccountPassword,
  abandonAccountPending,
  signOutAccount,
  onAccountState,
  getEntitlementStatus,
  refreshEntitlement,
  openCheckout,
  openSubscriptionPortal,
  isMembershipSimulatorAvailable,
  simulateMembership,
  onEntitlementChanged,
};

export default accountBridge;
