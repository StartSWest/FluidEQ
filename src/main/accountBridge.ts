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

/** Whether Google sign-in is switched on at the sign-in service. */
const isGoogleSignInAvailable = () =>
  ipcRenderer.invoke('account-google-available') as Promise<boolean>;

/**
 * Sign in with Google in the browser. Resolves when the attempt ends: signed
 * in, refused, or cancelled. `locale` is the language of the browser tab's
 * last page.
 */
const signInWithGoogle = (locale: string) =>
  ipcRenderer.invoke(
    'account-sign-in-google',
    locale,
  ) as Promise<IAccountState>;

/** Stop the attempt in flight. */
const cancelAccountAttempt = () =>
  ipcRenderer.invoke('account-cancel') as Promise<IAccountState>;

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
  isGoogleSignInAvailable,
  signInWithGoogle,
  cancelAccountAttempt,
  signOutAccount,
  onAccountState,
  getEntitlementStatus,
  refreshEntitlement,
  onEntitlementChanged,
};

export default accountBridge;
