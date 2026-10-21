import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TAdminOutcome } from './plus/adminInsightsApi';
import {
  parseCreatorStatus,
  type ICreatorPayoutPreview,
  type ICreatorPayoutRun,
  type ICreatorStatus,
  type TCreatorFailure,
  type TCreatorOutcome,
} from '../common/creatorPayouts';

// A creator paid for their scenes (premium 0064): the figures, signing up on
// Stripe's pages, and the creator's Stripe dashboard.
export const creatorBridge = {
  getCreatorStatus: (): Promise<TCreatorOutcome> =>
    ipcRenderer.invoke('creator-get'),
  // Opens Stripe's sign-up in the browser; `country` only the first time.
  startCreatorSignUp: (
    country: string | undefined,
    locale: string,
  ): Promise<{ ok: true } | { ok: false; reason: TCreatorFailure }> =>
    ipcRenderer.invoke('creator-sign-up', country, locale),
  openCreatorDashboard: (): Promise<
    { ok: true } | { ok: false; reason: TCreatorFailure }
  > => ipcRenderer.invoke('creator-dashboard'),
  refreshCreatorStatus: (): Promise<TCreatorOutcome> =>
    ipcRenderer.invoke('creator-refresh'),
  // The admin's: who a run would pay, and paying them (the server decides
  // who the admin is).
  previewCreatorPayouts: (): Promise<TAdminOutcome<ICreatorPayoutPreview>> =>
    ipcRenderer.invoke('creator-payouts-preview'),
  runCreatorPayouts: (): Promise<TAdminOutcome<ICreatorPayoutRun>> =>
    ipcRenderer.invoke('creator-payouts-run'),
  // Told when Stripe's sign-up sends the creator back (`appLinks.ts`).
  onCreatorChanged: (listener: (status: ICreatorStatus) => void) => {
    const handler = (_event: IpcRendererEvent, value: unknown) => {
      const status = parseCreatorStatus(value);
      if (status) {
        listener(status);
      }
    };
    ipcRenderer.on('creator-changed', handler);
    return () => {
      ipcRenderer.removeListener('creator-changed', handler);
    };
  },
};
